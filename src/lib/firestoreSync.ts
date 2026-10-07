import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase.ts';
import {
  StudentUser,
  DriverUser,
  AdminUser,
  Bus,
  Route,
  AttendanceRecord,
} from '../types/index.ts';

// Helper to remove any undefined values so Firestore does not reject with unsupported field value
function cleanFirestoreData<T extends Record<string, any>>(data: T): Partial<T> {
  const result: any = {};
  if (!data || typeof data !== 'object') return result;
  for (const key of Object.keys(data)) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  return result;
}

// Collections mapping
export const COLLECTIONS = {
  STUDENTS: 'students',
  DRIVERS: 'drivers',
  ADMINS: 'admins',
  BUSES: 'buses',
  ROUTES: 'routes',
  ATTENDANCE: 'attendance',
  COMPLAINTS: 'complaints',
  TRIPS: 'trips',
  STUDENT_STATUSES: 'studentStatuses',
};

// Firestore CRUD operations
export const FirestoreService = {
  // --- Student Status ---
  async syncStudentStatus(statusRecord: {
    student_id: string;
    date: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    updated_at: string;
    bus_id: string | null;
    student_name: string;
  }) {
    try {
      const docId = `${statusRecord.student_id}_${statusRecord.date}`;
      const ref = doc(db, COLLECTIONS.STUDENT_STATUSES, docId);
      await setDoc(ref, cleanFirestoreData(statusRecord), { merge: true });
    } catch (e) {
      console.warn('Firestore syncStudentStatus notice:', e);
    }
  },

  // --- Attendance & Boarding History (Cloud Firestore) ---
  /**
   * Saves a verified QR boarding attendance record into Firestore 'attendance' collection.
   */
  async syncAttendanceRecord(record: AttendanceRecord) {
    try {
      if (!record || !record.attendance_id) return;
      const ref = doc(db, COLLECTIONS.ATTENDANCE, record.attendance_id);
      await setDoc(ref, cleanFirestoreData(record), { merge: true });
    } catch (e) {
      console.warn('Firestore syncAttendanceRecord notice:', e);
    }
  },

  /**
   * Syncs a list of attendance records to Firestore in a single batch write.
   */
  async syncAttendanceBatch(records: AttendanceRecord[]) {
    try {
      if (!records || !records.length) return true;
      const batch = writeBatch(db);
      records.forEach((r) => {
        if (r.attendance_id) {
          const ref = doc(db, COLLECTIONS.ATTENDANCE, r.attendance_id);
          batch.set(ref, cleanFirestoreData(r), { merge: true });
        }
      });
      await batch.commit();
      return true;
    } catch (e) {
      console.warn('Firestore syncAttendanceBatch notice:', e);
      return false;
    }
  },

  /**
   * Reads a student's past boarding records from Firestore collection 'attendance'.
   */
  async getStudentAttendanceFromFirestore(studentId: string): Promise<AttendanceRecord[]> {
    try {
      const colRef = collection(db, COLLECTIONS.ATTENDANCE);
      const q = query(colRef, where('student_id', '==', studentId));
      const snap = await getDocs(q);
      const records: AttendanceRecord[] = [];
      snap.forEach((docSnap) => {
        records.push({ ...(docSnap.data() as AttendanceRecord), attendance_id: docSnap.id });
      });
      return records.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (e) {
      console.warn('Firestore getStudentAttendanceFromFirestore notice:', e);
      return [];
    }
  },

  /**
   * Subscribes to real-time boarding updates for a student directly from Firestore.
   */
  subscribeStudentAttendance(
    studentId: string,
    onUpdate: (records: AttendanceRecord[]) => void
  ): () => void {
    try {
      const colRef = collection(db, COLLECTIONS.ATTENDANCE);
      const q = query(colRef, where('student_id', '==', studentId));
      return onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({
            ...(d.data() as AttendanceRecord),
            attendance_id: d.id,
          }));
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          onUpdate(items);
        },
        (error) => {
          console.warn('Firestore subscribeStudentAttendance notice:', error);
        }
      );
    } catch (err) {
      console.warn('Failed to subscribe student attendance in Firestore:', err);
      return () => {};
    }
  },

  // --- Students ---
  async updateStudent(studentId: string, updates: Partial<StudentUser>) {
    try {
      const ref = doc(db, COLLECTIONS.STUDENTS, studentId);
      await setDoc(ref, cleanFirestoreData(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updateStudent notice:', e);
    }
  },

  async deleteStudent(studentId: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
    } catch (e) {
      console.warn('Firestore deleteStudent notice:', e);
    }
  },

  // --- Drivers ---
  async updateDriver(driverId: string, updates: Partial<DriverUser>) {
    try {
      const ref = doc(db, COLLECTIONS.DRIVERS, driverId);
      await setDoc(ref, cleanFirestoreData(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updateDriver notice:', e);
    }
  },

  async deleteDriver(driverId: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.DRIVERS, driverId));
    } catch (e) {
      console.warn('Firestore deleteDriver notice:', e);
    }
  },

  // --- Admins ---
  async updateAdmin(adminId: string, updates: Partial<AdminUser>) {
    try {
      const ref = doc(db, COLLECTIONS.ADMINS, adminId);
      await setDoc(ref, cleanFirestoreData(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updateAdmin notice:', e);
    }
  },

  async deleteAdmin(adminId: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ADMINS, adminId));
    } catch (e) {
      console.warn('Firestore deleteAdmin notice:', e);
    }
  },

  // --- Buses ---
  async updateBus(busId: string, updates: Partial<Bus>) {
    try {
      const ref = doc(db, COLLECTIONS.BUSES, busId);
      await setDoc(ref, cleanFirestoreData(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updateBus notice:', e);
    }
  },

  async deleteBus(busId: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.BUSES, busId));
    } catch (e) {
      console.warn('Firestore deleteBus notice:', e);
    }
  },

  // --- Routes ---
  async updateRoute(routeId: string, updates: Partial<Route>) {
    try {
      const ref = doc(db, COLLECTIONS.ROUTES, routeId);
      await setDoc(ref, cleanFirestoreData(updates), { merge: true });
    } catch (e) {
      console.warn('Firestore updateRoute notice:', e);
    }
  },

  async deleteRoute(routeId: string) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ROUTES, routeId));
    } catch (e) {
      console.warn('Firestore deleteRoute notice:', e);
    }
  },

  // --- Real-time Listeners ---
  subscribeCollection<T>(collectionName: string, onUpdate: (data: T[]) => void) {
    try {
      const colRef = collection(db, collectionName);
      return onSnapshot(
        colRef,
        (snapshot) => {
          const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) as T[];
          onUpdate(items);
        },
        (error) => {
          console.warn(`Firestore listener error on ${collectionName}:`, error);
        }
      );
    } catch (err) {
      console.warn(`Failed to attach listener on ${collectionName}:`, err);
      return () => {};
    }
  },

  // --- Batch Seed or Sync ---
  async syncInitialDataToFirestore(dataset: {
    students: StudentUser[];
    drivers: DriverUser[];
    admins: AdminUser[];
    buses: Bus[];
    routes: Route[];
  }) {
    try {
      const batch = writeBatch(db);

      dataset.students.forEach((s) => {
        if (s.student_id) {
          const ref = doc(db, COLLECTIONS.STUDENTS, s.student_id);
          batch.set(ref, cleanFirestoreData(s), { merge: true });
        }
      });

      dataset.drivers.forEach((d) => {
        if (d.driver_id) {
          const ref = doc(db, COLLECTIONS.DRIVERS, d.driver_id);
          batch.set(ref, cleanFirestoreData(d), { merge: true });
        }
      });

      dataset.admins.forEach((a) => {
        if (a.admin_id) {
          const ref = doc(db, COLLECTIONS.ADMINS, a.admin_id);
          batch.set(ref, cleanFirestoreData(a), { merge: true });
        }
      });

      dataset.buses.forEach((b) => {
        if (b.bus_id) {
          const ref = doc(db, COLLECTIONS.BUSES, b.bus_id);
          batch.set(ref, cleanFirestoreData(b), { merge: true });
        }
      });

      dataset.routes.forEach((r) => {
        if (r.route_id) {
          const ref = doc(db, COLLECTIONS.ROUTES, r.route_id);
          batch.set(ref, cleanFirestoreData(r), { merge: true });
        }
      });

      await batch.commit();
      return true;
    } catch (err) {
      console.warn('Firestore initial sync notice:', err);
      return false;
    }
  },
};
