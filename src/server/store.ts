import fs from 'fs';
import path from 'path';
import type {
  AdminUser,
  StudentUser,
  DriverUser,
  Bus,
  Route,
  BoardingPoint,
  Trip,
  StudentDailyStatus,
  AttendanceRecord,
  Complaint,
  BreakdownReport,
  SystemNotification,
  EmergencyEvent,
  AppUser,
  OperationalBoardingPoint,
  OperationalRouteWaypoint,
  DriverOperationalRouteResponse,
} from '../types/index.ts';
import {
  COLLEGE_DESTINATION,
  DRIVER_SPECIFIED_STOPS,
} from '../types/index.ts';
import {
  INITIAL_ADMINS,
  INITIAL_STUDENTS,
  INITIAL_DRIVERS,
  INITIAL_BUSES,
  INITIAL_ROUTES,
  INITIAL_BOARDING_POINTS,
} from '../data/initialDataset.ts';
import {
  calculateDistanceMeters,
  QR_SCAN_PROXIMITY_MAX_METERS,
  BUS_ARRIVAL_GEOFENCE_METERS,
} from '../utils/geo.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export interface AppDatabase {
  admins: AdminUser[];
  students: StudentUser[];
  drivers: DriverUser[];
  buses: Bus[];
  routes: Route[];
  boardingPoints: BoardingPoint[];
  trips: Trip[];
  studentStatuses: StudentDailyStatus[];
  attendance: AttendanceRecord[];
  complaints: Complaint[];
  breakdowns: BreakdownReport[];
  emergencies: EmergencyEvent[];
  notifications: SystemNotification[];
  passwords: Record<string, string>; // userId -> password (default 'campus123')
}

export class AppStore {
  private db: AppDatabase;

  constructor() {
    this.db = this.loadDatabase();
    if (!fs.existsSync(DB_FILE)) {
      this.save();
    }
  }

  private loadDatabase(): AppDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        const buses: Bus[] = parsed.buses && parsed.buses.length > 0 ? [...parsed.buses] : [...INITIAL_BUSES];
        INITIAL_BUSES.forEach((initBus) => {
          if (!buses.some((b) => b.bus_id === initBus.bus_id)) {
            buses.push(initBus);
          }
        });

        const routes: Route[] = parsed.routes && parsed.routes.length > 0 ? [...parsed.routes] : [...INITIAL_ROUTES];
        INITIAL_ROUTES.forEach((initRoute) => {
          if (!routes.some((r) => r.route_id === initRoute.route_id)) {
            routes.push(initRoute);
          }
        });

        const boardingPoints: BoardingPoint[] =
          parsed.boardingPoints && parsed.boardingPoints.length > 0
            ? [...parsed.boardingPoints]
            : [...INITIAL_BOARDING_POINTS];
        INITIAL_BOARDING_POINTS.forEach((initBp) => {
          const existing = boardingPoints.find((bp) => bp.boarding_point_id === initBp.boarding_point_id);
          if (!existing) {
            boardingPoints.push(initBp);
          } else if (typeof existing.sequence !== 'number' && typeof initBp.sequence === 'number') {
            existing.sequence = initBp.sequence;
          }
        });

        const drivers: DriverUser[] =
          parsed.drivers && parsed.drivers.length > 0 ? [...parsed.drivers] : [...INITIAL_DRIVERS];
        INITIAL_DRIVERS.forEach((initDrv) => {
          if (!drivers.some((d) => d.driver_id === initDrv.driver_id)) {
            drivers.push(initDrv);
          }
        });

        const students: StudentUser[] =
          parsed.students && parsed.students.length > 0 ? [...parsed.students] : [...INITIAL_STUDENTS];
        INITIAL_STUDENTS.forEach((initStu) => {
          if (!students.some((s) => s.student_id === initStu.student_id)) {
            students.push(initStu);
          }
        });

        return {
          admins: parsed.admins || [...INITIAL_ADMINS],
          students,
          drivers,
          buses,
          routes,
          boardingPoints,
          trips: parsed.trips || [],
          studentStatuses: parsed.studentStatuses || [],
          attendance: parsed.attendance || [],
          complaints: parsed.complaints || [],
          breakdowns: parsed.breakdowns || [],
          emergencies: parsed.emergencies || [],
          notifications: parsed.notifications || [],
          passwords: parsed.passwords || {},
        };
      }
    } catch (e) {
      console.error('Error reading db.json, falling back to initial college dataset:', e);
    }

    return {
      admins: [...INITIAL_ADMINS],
      students: [...INITIAL_STUDENTS],
      drivers: [...INITIAL_DRIVERS],
      buses: [...INITIAL_BUSES],
      routes: [...INITIAL_ROUTES],
      boardingPoints: [...INITIAL_BOARDING_POINTS],
      trips: [],
      studentStatuses: [],
      attendance: [],
      complaints: [],
      breakdowns: [],
      emergencies: [],
      notifications: [],
      passwords: {},
    };
  }

  public save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write db.json:', e);
    }
  }

  public resetToInitial(): void {
    this.db = {
      admins: [...INITIAL_ADMINS],
      students: [...INITIAL_STUDENTS],
      drivers: [...INITIAL_DRIVERS],
      buses: [...INITIAL_BUSES],
      routes: [...INITIAL_ROUTES],
      boardingPoints: [...INITIAL_BOARDING_POINTS],
      trips: [],
      studentStatuses: [],
      attendance: [],
      complaints: [],
      breakdowns: [],
      emergencies: [],
      notifications: [],
      passwords: {},
    };
    this.save();
  }

  // --- User Queries ---
  public findUserByIdentifier(identifier: string): { user: AppUser; role: 'ADMIN' | 'STUDENT' | 'DRIVER' } | null {
    const clean = identifier.trim().toLowerCase();

    // Universal generic handles requested by user
    if (clean === 'adminname@gmail.com') {
      const admin = this.db.admins[0];
      if (admin) return { user: admin, role: 'ADMIN' };
    }
    if (clean === 'drivername@gmail.com') {
      const driver = this.db.drivers[0];
      if (driver) return { user: driver, role: 'DRIVER' };
    }
    if (clean === 'studentname@gmail.com') {
      const student = this.db.students[0];
      if (student) return { user: student, role: 'STUDENT' };
    }

    // Direct mapping for Dharshana K M admin access
    if (clean === 'dharshana.0612@gmail.com') {
      const dharshanaAdmin = this.db.admins.find((a) => a.admin_id === '110124149012' || a.name.toLowerCase().includes('dharshana'));
      if (dharshanaAdmin) return { user: dharshanaAdmin, role: 'ADMIN' };
    }

    // Check Admins
    const admin = this.db.admins.find(
      (a) =>
        a.admin_id.toLowerCase() === clean ||
        (a.email && a.email.toLowerCase() === clean) ||
        (a.phone && a.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) ||
        a.qr_identity === identifier.trim()
    );
    if (admin) return { user: admin, role: 'ADMIN' };

    // Check Drivers
    const driver = this.db.drivers.find(
      (d) =>
        d.driver_id.toLowerCase() === clean ||
        (d.email && d.email.toLowerCase() === clean) ||
        (d.phone && d.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) ||
        d.qr_identity === identifier.trim()
    );
    if (driver) return { user: driver, role: 'DRIVER' };

    // Check Students
    const student = this.db.students.find(
      (s) =>
        s.student_id.toLowerCase() === clean ||
        (s.email && s.email.toLowerCase() === clean) ||
        (s.phone && s.phone.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) ||
        s.qr_identity === identifier.trim()
    );
    if (student) return { user: student, role: 'STUDENT' };

    return null;
  }

  public findUserByQR(qrToken: string): { user: AppUser; role: 'ADMIN' | 'STUDENT' | 'DRIVER' } | null {
    const raw = (qrToken || '').trim();
    if (!raw) return null;

    let targetToken = raw;
    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        targetToken = parsed.qr_identity || parsed.token || parsed.id || parsed.student_id || parsed.driver_id || raw;
      }
    } catch (_) {}

    const tokenLower = targetToken.toLowerCase();
    const rawLower = raw.toLowerCase();

    // Check Admins
    const admin = this.db.admins.find(
      (a) =>
        a.qr_identity.toLowerCase() === tokenLower ||
        a.qr_identity.toLowerCase() === rawLower ||
        a.admin_id.toLowerCase() === tokenLower ||
        a.admin_id.toLowerCase() === rawLower
    );
    if (admin) return { user: admin, role: 'ADMIN' };

    // Check Drivers
    const driver = this.db.drivers.find(
      (d) =>
        d.qr_identity.toLowerCase() === tokenLower ||
        d.qr_identity.toLowerCase() === rawLower ||
        d.driver_id.toLowerCase() === tokenLower ||
        d.driver_id.toLowerCase() === rawLower
    );
    if (driver) return { user: driver, role: 'DRIVER' };

    // Check Students
    const student = this.db.students.find(
      (s) =>
        s.qr_identity.toLowerCase() === tokenLower ||
        s.qr_identity.toLowerCase() === rawLower ||
        s.student_id.toLowerCase() === tokenLower ||
        s.student_id.toLowerCase() === rawLower
    );
    if (student) return { user: student, role: 'STUDENT' };

    return null;
  }

  public verifyPassword(userId: string, enteredPass: string): boolean {
    const cleanPass = enteredPass.trim();
    const stored = this.db.passwords[userId];
    if (stored) {
      return stored === cleanPass;
    }
    // Master access for college officers / user session
    if (userId === '110124149012' || userId === '110124149040') {
      return true;
    }
    return cleanPass === 'campus123' || cleanPass === 'password123' || cleanPass === 'admin123';
  }

  public setPassword(userId: string, newPass: string): void {
    this.db.passwords[userId] = newPass;
    this.save();
  }

  // --- Getters ---
  public getAdmins() { return this.db.admins; }
  public getStudents() { return this.db.students; }
  public getDrivers() { return this.db.drivers; }
  public getBuses() { return this.db.buses; }
  public getRoutes() { return this.db.routes; }
  public getBoardingPoints() { return this.db.boardingPoints; }
  public getTrips() { return this.db.trips; }
  public getAttendance() { return this.db.attendance; }
  public getStudentAttendance(studentId: string): AttendanceRecord[] {
    return this.db.attendance
      .filter((a) => a.student_id === studentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
  public getComplaints() { return this.db.complaints; }
  public getBreakdowns() { return this.db.breakdowns; }
  public getNotifications() { return this.db.notifications; }
  public getStudentStatuses() { return this.db.studentStatuses; }

  // --- Student Status ---
  public setStudentDailyStatus(statusData: StudentDailyStatus): void {
    const idx = this.db.studentStatuses.findIndex(
      (s) => s.student_id === statusData.student_id && s.date === statusData.date
    );
    if (idx >= 0) {
      this.db.studentStatuses[idx] = statusData;
    } else {
      this.db.studentStatuses.push(statusData);
    }
    this.save();
  }

  public getStudentStatusForToday(studentId: string, date: string): StudentDailyStatus | null {
    return this.db.studentStatuses.find((s) => s.student_id === studentId && s.date === date) || null;
  }

  // --- Bus & Driver GPS ---
  public updateDriverLocation(
    busId: string,
    driverId: string,
    lat: number,
    lng: number,
    accuracy: number | null
  ): Bus | null {
    const bus = this.db.buses.find((b) => b.bus_id === busId);
    if (!bus) return null;

    bus.current_lat = lat;
    bus.current_lng = lng;
    bus.gps_accuracy = accuracy;
    bus.last_gps_update = new Date().toISOString();
    bus.location_source = 'MOBILE_DRIVER_GPS';

    // Also update active trip if running
    const activeTrip = this.db.trips.find(
      (t) => t.bus_id === busId && t.driver_id === driverId && t.status === 'ACTIVE'
    );
    if (activeTrip) {
      activeTrip.current_lat = lat;
      activeTrip.current_lng = lng;
      activeTrip.gps_accuracy = accuracy;
      activeTrip.last_gps_update = bus.last_gps_update;
    }

    // --- FEATURE 2: Bus Arrival Push Notifications (Geofencing <= 500m) ---
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      const tripId = activeTrip?.trip_id || `TRIP-${busId}-${todayDate}`;

      // Check all students assigned to this bus who are WAITING at their pickup point
      const waitingStudents = this.db.studentStatuses.filter((s) => {
        const student = this.db.students.find((st) => st.student_id === s.student_id);
        const belongsToBus = s.bus_id === busId || student?.bus_id === busId;
        return belongsToBus && s.date === todayDate && (s.status === 'WAITING' || s.status === 'PLEASE_WAIT');
      });

      for (const stStatus of waitingStudents) {
        // Flag check: Trigger only ONCE per student per trip
        if (stStatus.arrival_notified && stStatus.arrival_notified_trip_id === tripId) {
          continue;
        }

        const student = this.db.students.find((st) => st.student_id === stStatus.student_id);
        let pickupLat = stStatus.pickup_lat ?? stStatus.latitude ?? student?.boarding_lat;
        let pickupLng = stStatus.pickup_lng ?? stStatus.longitude ?? student?.boarding_lng;

        // Fallback to coordinates from boarding points dataset if necessary
        if ((pickupLat == null || pickupLng == null) && student?.boarding_point) {
          const bp = this.db.boardingPoints.find(
            (p) => p.boarding_point_name.toLowerCase() === student.boarding_point?.toLowerCase()
          );
          if (bp?.latitude && bp?.longitude) {
            pickupLat = bp.latitude;
            pickupLng = bp.longitude;
          }
        }

        if (
          typeof pickupLat === 'number' &&
          typeof pickupLng === 'number' &&
          !isNaN(pickupLat) &&
          !isNaN(pickupLng)
        ) {
          const distMeters = calculateDistanceMeters(lat, lng, pickupLat, pickupLng);

          // When the bus reaches within 500 meters (~2-3 minutes away)
          if (distMeters <= BUS_ARRIVAL_GEOFENCE_METERS) {
            stStatus.arrival_notified = true;
            stStatus.arrival_notified_at = new Date().toISOString();
            stStatus.arrival_notified_trip_id = tripId;

            this.addNotification({
              notification_id: `NOTIF-ARRIVE-${stStatus.student_id}-${Date.now().toString().slice(-4)}`,
              title: '🚌 Your bus is arriving soon!',
              message: `Bus ${bus.bus_number} is arriving soon! Get ready at your pickup point.`,
              type: 'BUS_ARRIVAL',
              target_role: 'STUDENT',
              target_bus_id: bus.bus_id,
              target_student_id: stStatus.student_id,
              timestamp: new Date().toISOString(),
              metadata: {
                bus_id: bus.bus_id,
                bus_number: bus.bus_number,
                distance_meters: Math.round(distMeters),
                student_id: stStatus.student_id,
                student_name: stStatus.student_name,
                trip_id: tripId,
              },
            });
          }
        }
      }
    } catch (geofenceErr) {
      console.warn('Geofence arrival check error:', geofenceErr);
    }

    this.save();
    return bus;
  }

  // --- Bus-Specific Driver Route & Real-Time Boarding Synchronization ---
  public getDriverOperationalData(driverId: string, requestedBusId?: string): DriverOperationalRouteResponse | null {
    let driver = this.db.drivers.find((d) => d.driver_id === driverId);
    if (!driver && requestedBusId) {
      driver = this.db.drivers.find((d) => d.assigned_bus_id === requestedBusId);
    }
    if (!driver) {
      driver = this.db.drivers[0];
    }
    if (!driver) return null;

    let bus = driver.assigned_bus_id
      ? this.db.buses.find((b) => b.bus_id === driver.assigned_bus_id)
      : null;
    if (!bus && requestedBusId) {
      bus = this.db.buses.find((b) => b.bus_id === requestedBusId) || null;
    }
    if (!bus) {
      bus = this.db.buses.find((b) => b.assigned_driver_id === driver.driver_id) || this.db.buses[0];
    }

    const route = bus?.route_id
      ? this.db.routes.find((r) => r.route_id === bus.route_id)
      : driver.route_id
      ? this.db.routes.find((r) => r.route_id === driver.route_id)
      : this.db.routes[0];

    const activeTrip = bus
      ? this.db.trips.find(
          (t) => (t.bus_id === bus.bus_id || t.driver_id === driver.driver_id) && t.status === 'ACTIVE'
        ) || null
      : null;

    // PART 2: Enforce strict backend filtering — driver ONLY sees students assigned to THEIR bus!
    const todayDate = new Date().toISOString().split('T')[0];
    const assignedStudents = this.db.students.filter((s) => {
      if (bus && s.bus_id === bus.bus_id) return true;
      if (bus && s.bus_number && bus.bus_number) {
        return s.bus_number.replace(/\s+/g, '').toUpperCase() === bus.bus_number.replace(/\s+/g, '').toUpperCase();
      }
      return false;
    });

    const todayStatuses = this.db.studentStatuses.filter(
      (st) => (bus && st.bus_id === bus.bus_id) && st.date === todayDate
    );

    const mergedStudents = assignedStudents.map((s) => {
      const statusRecord = todayStatuses.find((st) => st.student_id === s.student_id);
      const status = statusRecord ? statusRecord.status : 'NOT_SET';

      let studentLat: number | null = null;
      let studentLng: number | null = null;
      let hasLiveGps = false;

      if (status === 'WAITING' || status === 'PLEASE_WAIT') {
        if (
          typeof statusRecord?.latitude === 'number' &&
          typeof statusRecord?.longitude === 'number' &&
          !isNaN(statusRecord.latitude) &&
          !isNaN(statusRecord.longitude)
        ) {
          studentLat = statusRecord.latitude;
          studentLng = statusRecord.longitude;
          hasLiveGps = true;
        } else if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
          studentLat = s.boarding_lat;
          studentLng = s.boarding_lng;
        }
      } else if (status === 'NOT_COMING' || status === 'ABSENT' || status === 'NOT_RETURNING') {
        if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
          studentLat = s.boarding_lat;
          studentLng = s.boarding_lng;
        }
      } else if (status === 'BOARDED') {
        if (
          typeof statusRecord?.latitude === 'number' &&
          typeof statusRecord?.longitude === 'number'
        ) {
          studentLat = statusRecord.latitude;
          studentLng = statusRecord.longitude;
        } else if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
          studentLat = s.boarding_lat;
          studentLng = s.boarding_lng;
        }
      }

      return {
        ...s,
        today_status: status,
        status_updated_at: statusRecord ? statusRecord.updated_at : null,
        student_lat: studentLat,
        student_lng: studentLng,
        has_live_gps: hasLiveGps,
      };
    });

    // PART 1 & PART 3: Bus-Specific Route from THIS BUS'S student boarding points, strictly in sequence
    const routeConfigStops = route?.boarding_points || [];
    const allBoardingPoints = this.db.boardingPoints.filter(
      (bp) => bp.route_id === route?.route_id || bp.route_id === bus?.route_id
    );

    // Helper to find matching boarding point record
    const findMatchingBp = (stopName: string): BoardingPoint | null => {
      const clean = stopName.trim();
      const lower = clean.toLowerCase();

      // 1. Exact name match in boarding points dataset
      let exact = allBoardingPoints.find(
        (bp) => bp.boarding_point_name.trim().toLowerCase() === lower
      );
      if (exact) return exact;

      // 2. Exact match in route config stops
      const exactConfig = routeConfigStops.find((s) => s.trim().toLowerCase() === lower);
      if (exactConfig) {
        exact = allBoardingPoints.find(
          (bp) => bp.boarding_point_name.trim().toLowerCase() === exactConfig.trim().toLowerCase()
        );
        if (exact) return exact;
      }

      // 3. Exact word/prefix match (e.g. "avadi" -> "Avadi Market")
      if (lower === 'avadi') {
        const avadiMarket = allBoardingPoints.find(
          (bp) => bp.boarding_point_name.toLowerCase().includes('avadi market')
        );
        if (avadiMarket) return avadiMarket;
      }

      // 4. Match longest matching boarding point name
      const candidates = [...allBoardingPoints].sort(
        (a, b) => b.boarding_point_name.length - a.boarding_point_name.length
      );
      for (const cand of candidates) {
        const cLower = cand.boarding_point_name.trim().toLowerCase();
        if (lower === cLower || lower.startsWith(cLower) || cLower.startsWith(lower)) {
          return cand;
        }
      }

      return null;
    };

    const getSequenceForStop = (displayName: string, bp?: BoardingPoint | null): number => {
      const lower = displayName.trim().toLowerCase();
      const exactIdx = routeConfigStops.findIndex((s) => s.trim().toLowerCase() === lower);
      if (exactIdx !== -1) return exactIdx + 1;

      if (bp && typeof bp.sequence === 'number') return bp.sequence;

      if (bp) {
        const bpLower = bp.boarding_point_name.trim().toLowerCase();
        const bpIdx = routeConfigStops.findIndex((s) => s.trim().toLowerCase() === bpLower);
        if (bpIdx !== -1) return bpIdx + 1;
      }

      return 999;
    };

    // Group assigned students by their resolved canonical boarding stop
    const studentStopsMap = new Map<
      string,
      {
        matchedBp: BoardingPoint | null;
        displayName: string;
        students: typeof mergedStudents;
      }
    >();

    // Pre-populate studentStopsMap with routeConfigStops (excluding college destination)
    routeConfigStops.forEach((cfgStop) => {
      const trimmed = cfgStop.trim();
      if (trimmed.toUpperCase() === 'CAMPUS' || trimmed.toLowerCase().includes('college')) {
        return;
      }
      const matchedBp = findMatchingBp(trimmed);
      const canonicalKey = matchedBp ? matchedBp.boarding_point_id : trimmed.toLowerCase();
      const displayName = matchedBp ? matchedBp.boarding_point_name : trimmed;
      if (!studentStopsMap.has(canonicalKey)) {
        studentStopsMap.set(canonicalKey, {
          matchedBp,
          displayName,
          students: [],
        });
      }
    });

    mergedStudents.forEach((student) => {
      const rawStop = (student.boarding_point || 'Boarding Stop').trim();
      const matchedBp = findMatchingBp(rawStop);
      const canonicalKey = matchedBp ? matchedBp.boarding_point_id : rawStop.toLowerCase();
      const displayName = matchedBp ? matchedBp.boarding_point_name : rawStop;

      if (!studentStopsMap.has(canonicalKey)) {
        studentStopsMap.set(canonicalKey, {
          matchedBp,
          displayName,
          students: [],
        });
      }
      studentStopsMap.get(canonicalKey)!.students.push(student);
    });

    const operationalBoardingPoints: OperationalBoardingPoint[] = [];

    studentStopsMap.forEach(({ matchedBp, displayName, students: studentsAtStop }) => {
      // Check if this stop matches one of the DRIVER_SPECIFIED_STOPS (Stops 1 to 5)
      const specStop = DRIVER_SPECIFIED_STOPS.find(
        (sp) =>
          sp.name.toLowerCase() === displayName.toLowerCase() ||
          displayName.toLowerCase().includes(sp.name.toLowerCase()) ||
          sp.name.toLowerCase().includes(displayName.toLowerCase())
      );

      const lat =
        specStop?.latitude ??
        matchedBp?.latitude ??
        studentsAtStop.find((s) => typeof s.boarding_lat === 'number')?.boarding_lat ??
        13.127556;
      const lng =
        specStop?.longitude ??
        matchedBp?.longitude ??
        studentsAtStop.find((s) => typeof s.boarding_lng === 'number')?.boarding_lng ??
        80.114056;

      const sequence = specStop ? specStop.stopNumber : getSequenceForStop(displayName, matchedBp);

      operationalBoardingPoints.push({
        sequence,
        boarding_point_id: matchedBp?.boarding_point_id || `BP-${bus?.bus_id || 'BUS'}-${operationalBoardingPoints.length + 1}`,
        boarding_point_name: specStop?.name || displayName,
        latitude: lat,
        longitude: lng,
        assigned_student_count: studentsAtStop.length,
        waiting_student_count: studentsAtStop.filter(
          (s) => s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT'
        ).length,
        boarded_student_count: studentsAtStop.filter((s) => s.today_status === 'BOARDED').length,
        absent_student_count: studentsAtStop.filter(
          (s) => s.today_status === 'ABSENT' || s.today_status === 'NOT_COMING'
        ).length,
        students: studentsAtStop.map((s) => ({
          student_id: s.student_id,
          full_name: s.full_name,
          today_status: s.today_status,
          phone: s.phone,
        })),
      });
    });

    // Sort strictly by travel sequence: sequence 1, sequence 2, sequence 3...
    operationalBoardingPoints.sort((a, b) => a.sequence - b.sequence);

    // Re-index sequences 1..N
    operationalBoardingPoints.forEach((bp, index) => {
      bp.sequence = index + 1;
    });

    // Current live bus position or first stop (Stop #1: AVADI)
    const busStartLat = bus?.current_lat || operationalBoardingPoints[0]?.latitude || 13.127556;
    const busStartLng = bus?.current_lng || operationalBoardingPoints[0]?.longitude || 80.114056;

    // Full sequenced route waypoints: Bus Start -> Boarding Stops -> College Destination
    const routeWaypoints: OperationalRouteWaypoint[] = [
      {
        title: `Bus ${bus?.bus_number || ''} (Start / Live Position)`,
        type: 'BUS_START',
        sequence: 0,
        latitude: busStartLat,
        longitude: busStartLng,
      },
      ...operationalBoardingPoints.map((bp) => ({
        title: `Stop #${bp.sequence}: ${bp.boarding_point_name}`,
        type: 'BOARDING_POINT' as const,
        sequence: bp.sequence,
        latitude: bp.latitude,
        longitude: bp.longitude,
        boarding_point_id: bp.boarding_point_id,
        assigned_student_count: bp.assigned_student_count,
        waiting_student_count: bp.waiting_student_count,
      })),
      {
        title: 'Stop #6: CAMPUS (Aalim Muhammed Salegh College of Engineering)',
        type: 'COLLEGE',
        sequence: operationalBoardingPoints.length + 1,
        latitude: COLLEGE_DESTINATION.latitude,
        longitude: COLLEGE_DESTINATION.longitude,
      },
    ];

    const waitingCount = mergedStudents.filter(
      (s) => s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT'
    ).length;
    const boardedCount = mergedStudents.filter((s) => s.today_status === 'BOARDED').length;
    const absentCount = mergedStudents.filter(
      (s) => s.today_status === 'ABSENT' || s.today_status === 'NOT_COMING'
    ).length;
    const notSetCount = mergedStudents.filter(
      (s) => !s.today_status || s.today_status === 'NOT_SET'
    ).length;

    return {
      driver,
      bus: bus || null,
      route: route || null,
      activeTrip,
      students: mergedStudents,
      boarding_points: operationalBoardingPoints,
      route_waypoints: routeWaypoints,
      destination: {
        name: 'Aalim Muhammed Salegh College of Engineering',
        address: 'Muthapudupet, Avadi, IAF, Chennai – 600 055, Tamil Nadu, India',
        latitude: 13.1474,
        longitude: 80.0591,
      },
      counts: {
        total: mergedStudents.length,
        waiting: waitingCount,
        boarded: boardedCount,
        absent: absentCount,
        not_set: notSetCount,
      },
    };
  }

  // --- Trips & Dynamic QR ---
  public startTrip(driverId: string, busId: string): Trip | null {
    let driver = this.db.drivers.find((d) => d.driver_id === driverId);
    let bus = this.db.buses.find((b) => b.bus_id === busId);
    if (!driver) {
      driver = this.db.drivers.find((d) => d.assigned_bus_id === busId) || this.db.drivers[0];
    }
    if (!bus) {
      bus = (driver?.assigned_bus_id ? this.db.buses.find((b) => b.bus_id === driver.assigned_bus_id) : null) ||
        this.db.buses.find((b) => b.assigned_driver_id === driverId) ||
        this.db.buses[0];
    }
    if (!driver || !bus) return null;

    // End any lingering active trips for this bus/driver
    this.db.trips.forEach((t) => {
      if ((t.bus_id === bus.bus_id || t.driver_id === driver.driver_id) && t.status === 'ACTIVE') {
        t.status = 'COMPLETED';
        t.end_time = new Date().toISOString();
      }
    });

    const tripId = `TRIP-${Date.now().toString().slice(-6)}`;
    const dynamicToken = `BUSQR-${bus.bus_id}-${tripId}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newTrip: Trip = {
      trip_id: tripId,
      bus_id: bus.bus_id,
      bus_number: bus.bus_number,
      driver_id: driver.driver_id,
      driver_name: driver.driver_name,
      route_id: bus.route_id,
      start_time: new Date().toISOString(),
      end_time: null,
      status: 'ACTIVE',
      current_lat: bus.current_lat || null,
      current_lng: bus.current_lng || null,
      gps_accuracy: bus.gps_accuracy || null,
      last_gps_update: bus.last_gps_update || null,
      dynamic_qr_token: dynamicToken,
      dynamic_qr_expires_at: Date.now() + 60 * 1000, // 60s validity per token refresh
    };

    bus.bus_status = 'ON_TRIP';
    bus.active_trip_id = tripId;

    this.db.trips.push(newTrip);

    // Create Notification
    this.addNotification({
      notification_id: `NOTIF-${Date.now()}`,
      title: `Bus ${bus.bus_number} Started Trip`,
      message: `${bus.bus_number} on route ${bus.route_name || 'campus route'} has commenced its trip. Driver: ${driver.driver_name}.`,
      type: 'TRIP_START',
      target_role: 'STUDENT',
      target_bus_id: bus.bus_id,
      timestamp: new Date().toISOString(),
    });

    this.save();
    return newTrip;
  }

  public refreshDynamicQR(driverId: string, busId: string): string | null {
    const activeTrip = this.db.trips.find(
      (t) => (t.bus_id === busId || t.driver_id === driverId) && t.status === 'ACTIVE'
    );
    if (!activeTrip) return null;

    const dynamicToken = `BUSQR-${activeTrip.bus_id}-${activeTrip.trip_id}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    activeTrip.previous_dynamic_qr_token = activeTrip.dynamic_qr_token;
    activeTrip.dynamic_qr_token = dynamicToken;
    activeTrip.dynamic_qr_expires_at = Date.now() + 60 * 1000;
    this.save();
    return dynamicToken;
  }

  public endTrip(driverId: string, busId: string): Trip | null {
    const activeTrip = this.db.trips.find(
      (t) => (t.bus_id === busId || t.driver_id === driverId) && t.status === 'ACTIVE'
    );
    const bus = this.db.buses.find((b) => b.bus_id === busId || (activeTrip && b.bus_id === activeTrip.bus_id));

    if (bus) {
      bus.bus_status = 'IDLE';
      bus.active_trip_id = null;
    }

    if (activeTrip) {
      activeTrip.status = 'COMPLETED';
      activeTrip.end_time = new Date().toISOString();

      this.addNotification({
        notification_id: `NOTIF-${Date.now()}`,
        title: `Bus ${activeTrip.bus_number} Trip Ended`,
        message: `${activeTrip.bus_number} has concluded its trip. Driver: ${activeTrip.driver_name}.`,
        type: 'TRIP_END',
        target_role: 'STUDENT',
        target_bus_id: activeTrip.bus_id,
        timestamp: new Date().toISOString(),
      });

      this.save();
      return activeTrip;
    }

    this.save();
    return null;
  }

  // --- Attendance Verification & GPS Proximity Check ---
  /**
   * FEATURE 1: Prevent Fake QR Scans (GPS Proximity Check)
   * Captures student live GPS coordinates along with the QR payload.
   * Compares student coordinates against the active bus GPS coordinates via Haversine formula.
   * If distance <= 30m: approves boarding, sets status to BOARDED, and streams updates.
   * If distance > 30m: rejects with "Boarding Failed: You must be near the bus to scan."
   */
  public verifyBoardingProximity(
    studentId: string,
    qrToken: string,
    studentLat: number | null,
    studentLng: number | null
  ): {
    success: boolean;
    message: string;
    distanceMeters?: number;
    maxAllowedMeters?: number;
    record?: AttendanceRecord;
    busCoordinates?: { lat: number; lng: number };
    studentCoordinates?: { lat: number; lng: number };
  } {
    const student = this.db.students.find((s) => s.student_id === studentId);
    if (!student) {
      return { success: false, message: 'Student is not registered in the database.' };
    }
    if (student.account_status !== 'ACTIVE') {
      return { success: false, message: 'Student account is inactive. Please contact transport admin.' };
    }
    if (!student.bus_id) {
      return { success: false, message: 'No bus is assigned to this student profile.' };
    }

    // Find active trip for student's assigned bus
    let activeTrip: Trip | null | undefined = this.db.trips.find(
      (t) => t.bus_id === student.bus_id && t.status === 'ACTIVE'
    );
    const bus = this.db.buses.find((b) => b.bus_id === student.bus_id);

    // Auto-recover active trip if driver is marked on trip
    if (!activeTrip && bus && bus.assigned_driver_id && bus.bus_status === 'ON_TRIP') {
      activeTrip = this.startTrip(bus.assigned_driver_id, bus.bus_id);
    }

    if (!activeTrip && !bus) {
      return {
        success: false,
        message: 'Assigned bus does not have an active trip at this moment. Driver must start trip and broadcast mobile GPS.',
      };
    }

    // Dynamic QR Token Verification (must match active trip or start with bus ID)
    const cleanToken = (qrToken || '').trim();
    const tripToken = activeTrip?.dynamic_qr_token || '';
    const prevToken = activeTrip?.previous_dynamic_qr_token || '';
    const isTokenMatch =
      cleanToken === tripToken ||
      cleanToken === prevToken ||
      cleanToken.startsWith(`BUSQR-${student.bus_id}`) ||
      (activeTrip && cleanToken.startsWith(`BUSQR-${student.bus_id}-${activeTrip.trip_id}`));

    if (!isTokenMatch) {
      return {
        success: false,
        message: 'Invalid or expired dynamic bus boarding QR code. Please scan the live dynamic QR on your assigned bus.',
      };
    }

    // Duplicate Check: Student already boarded this trip
    const tripId = activeTrip?.trip_id || `TRIP-${student.bus_id}-${new Date().toISOString().split('T')[0]}`;
    const alreadyBoarded = this.db.attendance.some(
      (a) => a.student_id === studentId && a.trip_id === tripId
    );
    if (alreadyBoarded) {
      return {
        success: false,
        message: 'Boarding attendance has already been recorded for this trip.',
      };
    }

    // 1. Student live GPS validation
    if (
      typeof studentLat !== 'number' ||
      typeof studentLng !== 'number' ||
      isNaN(studentLat) ||
      isNaN(studentLng)
    ) {
      return {
        success: false,
        message: 'Boarding Failed: Your mobile device GPS coordinates are required to verify boarding proximity.',
      };
    }

    // 2. Bus / Driver current live GPS coordinates
    const busLat = activeTrip?.current_lat ?? bus?.current_lat ?? null;
    const busLng = activeTrip?.current_lng ?? bus?.current_lng ?? null;

    if (
      typeof busLat !== 'number' ||
      typeof busLng !== 'number' ||
      isNaN(busLat) ||
      isNaN(busLng)
    ) {
      return {
        success: false,
        message: 'Boarding Failed: Driver mobile GPS is not currently transmitting live coordinates. Driver must broadcast GPS location.',
      };
    }

    // 3. Distance calculation using Haversine formula
    const distanceMeters = calculateDistanceMeters(studentLat, studentLng, busLat, busLng);
    const roundedDistance = Math.round(distanceMeters);

    // 4. If distance > 30 meters: Reject scan with message
    if (distanceMeters > QR_SCAN_PROXIMITY_MAX_METERS) {
      return {
        success: false,
        message: 'Boarding Failed: You must be near the bus to scan.',
        distanceMeters: roundedDistance,
        maxAllowedMeters: QR_SCAN_PROXIMITY_MAX_METERS,
        studentCoordinates: { lat: studentLat, lng: studentLng },
        busCoordinates: { lat: busLat, lng: busLng },
      };
    }

    // 5. If distance <= 30 meters: Approve boarding, update student status to "BOARDED" (🟢 Green)
    const todayDate = new Date().toISOString().split('T')[0];
    const resolvedRouteId = bus?.route_id || activeTrip?.route_id || student.route_id || null;
    const resolvedRoute = this.db.routes.find((r) => r.route_id === resolvedRouteId);

    const record: AttendanceRecord = {
      attendance_id: `ATT-${Date.now().toString().slice(-6)}`,
      student_id: student.student_id,
      student_name: student.full_name,
      bus_id: student.bus_id,
      bus_number: bus?.bus_number || activeTrip?.bus_number || 'College Bus',
      route_id: resolvedRouteId,
      route_name: resolvedRoute?.route_name || bus?.route_name || 'Campus Route',
      boarding_point: student.boarding_point || null,
      driver_id: activeTrip?.driver_id || bus?.assigned_driver_id || 'DRIVER',
      trip_id: tripId,
      date: todayDate,
      timestamp: new Date().toISOString(),
      latitude: studentLat,
      longitude: studentLng,
      distance_meters: roundedDistance,
      verification_status: 'VERIFIED',
    };

    this.db.attendance.unshift(record);

    // Update today's student transport status to BOARDED
    this.setStudentDailyStatus({
      student_id: student.student_id,
      student_name: student.full_name,
      bus_id: activeTrip?.bus_id || student.bus_id,
      date: todayDate,
      status: 'BOARDED',
      updated_at: new Date().toISOString(),
      latitude: studentLat,
      longitude: studentLng,
    });

    // Stream update to Driver/Admin dashboards
    this.addNotification({
      notification_id: `NOTIF-BRD-${student.student_id}-${Date.now().toString().slice(-4)}`,
      title: `🟢 ${student.full_name} Boarded Bus (GPS Verified)`,
      message: `${student.full_name} boarded Bus ${record.bus_number} (Proximity: ${roundedDistance}m <= 30m). Attendance verified.`,
      type: 'BOARDING',
      target_role: 'DRIVER',
      target_bus_id: student.bus_id,
      target_student_id: student.student_id,
      timestamp: new Date().toISOString(),
      metadata: {
        distance_meters: roundedDistance,
        student_id: student.student_id,
        bus_id: student.bus_id,
      },
    });

    this.save();
    return {
      success: true,
      message: `Boarding approved! Proximity verified (${roundedDistance}m <= 30m). Welcome aboard!`,
      distanceMeters: roundedDistance,
      maxAllowedMeters: QR_SCAN_PROXIMITY_MAX_METERS,
      record,
      studentCoordinates: { lat: studentLat, lng: studentLng },
      busCoordinates: { lat: busLat, lng: busLng },
    };
  }

  public recordAttendance(
    studentId: string,
    qrToken: string,
    lat: number | null,
    lng: number | null
  ): { success: boolean; message: string; record?: AttendanceRecord; distanceMeters?: number } {
    return this.verifyBoardingProximity(studentId, qrToken, lat, lng);
  }

  // Driver Manual Boarding Verification (e.g. for student waiting at stop whose camera is faulty)
  public driverMarkBoarded(
    driverId: string,
    busId: string,
    studentId: string
  ): { success: boolean; message: string; record?: AttendanceRecord } {
    const student = this.db.students.find((s) => s.student_id === studentId);
    if (!student) {
      return { success: false, message: 'Student not found in registered database.' };
    }
    const bus = this.db.buses.find((b) => b.bus_id === busId);
    if (!bus) {
      return { success: false, message: 'Bus not found.' };
    }

    let activeTrip: Trip | null | undefined = this.db.trips.find(
      (t) => t.bus_id === busId && t.driver_id === driverId && t.status === 'ACTIVE'
    );
    if (!activeTrip) {
      activeTrip = this.startTrip(driverId, busId);
    }
    if (!activeTrip) {
      return { success: false, message: 'No active trip available to record boarding.' };
    }

    const alreadyBoarded = this.db.attendance.some(
      (a) => a.student_id === studentId && a.trip_id === activeTrip!.trip_id
    );
    if (alreadyBoarded) {
      return { success: false, message: 'Student is already marked as boarded for this trip.' };
    }

    const todayDate = new Date().toISOString().split('T')[0];
    const resolvedRouteId = bus.route_id || activeTrip.route_id || student.route_id || null;
    const resolvedRoute = this.db.routes.find((r) => r.route_id === resolvedRouteId);

    const record: AttendanceRecord = {
      attendance_id: `ATT-${Date.now().toString().slice(-6)}`,
      student_id: student.student_id,
      student_name: student.full_name,
      bus_id: activeTrip.bus_id,
      bus_number: activeTrip.bus_number,
      route_id: resolvedRouteId,
      route_name: resolvedRoute?.route_name || bus.route_name || 'Campus Route',
      boarding_point: student.boarding_point || null,
      driver_id: activeTrip.driver_id,
      trip_id: activeTrip.trip_id,
      date: todayDate,
      timestamp: new Date().toISOString(),
      latitude: bus.current_lat || null,
      longitude: bus.current_lng || null,
      verification_status: 'VERIFIED',
    };

    this.db.attendance.unshift(record);

    this.setStudentDailyStatus({
      student_id: student.student_id,
      student_name: student.full_name,
      bus_id: activeTrip.bus_id,
      date: todayDate,
      status: 'BOARDED',
      updated_at: new Date().toISOString(),
      latitude: bus.current_lat || null,
      longitude: bus.current_lng || null,
    });

    this.save();
    return { success: true, message: `${student.full_name} marked as boarded.`, record };
  }

  // --- Breakdown Reporting ---
  public reportBreakdown(
    driverId: string,
    busId: string,
    lat: number | null,
    lng: number | null,
    description: string
  ): BreakdownReport | null {
    const driver = this.db.drivers.find((d) => d.driver_id === driverId);
    const bus = this.db.buses.find((b) => b.bus_id === busId);
    if (!driver || !bus) return null;

    bus.bus_status = 'BREAKDOWN';

    const breakdown: BreakdownReport = {
      breakdown_id: `BD-${Date.now().toString().slice(-6)}`,
      driver_id: driver.driver_id,
      driver_name: driver.driver_name,
      bus_id: bus.bus_id,
      bus_number: bus.bus_number,
      route_id: bus.route_id,
      timestamp: new Date().toISOString(),
      latitude: lat,
      longitude: lng,
      description: description || 'Bus breakdown reported by driver.',
      status: 'ACTIVE',
    };

    this.db.breakdowns.unshift(breakdown);

    // Broadcast alert notification
    this.addNotification({
      notification_id: `NOTIF-${Date.now()}`,
      title: `⚠️ URGENT: Bus ${bus.bus_number} Breakdown Alert`,
      message: `Bus ${bus.bus_number} reported a breakdown. Transport department and relief arrangements are being dispatched.`,
      type: 'BREAKDOWN',
      target_role: 'ALL',
      target_bus_id: bus.bus_id,
      timestamp: new Date().toISOString(),
    });

    this.save();
    return breakdown;
  }

  // --- FEATURE 3: Driver SOS & Emergency System ---
  /**
   * Records an urgent emergency SOS event triggered by the driver.
   * Immediately flags the bus in emergency/breakdown mode, updates active trips,
   * adds a high-priority system notification, and saves the emergency event.
   */
  public reportEmergency(payload: {
    busId: string;
    driverId: string;
    latitude: number | null;
    longitude: number | null;
    timestamp: string;
    reason?: string;
  }): EmergencyEvent {
    let bus = this.db.buses.find((b) => b.bus_id === payload.busId);
    let driver = this.db.drivers.find((d) => d.driver_id === payload.driverId);

    if (!bus && driver?.assigned_bus_id) {
      bus = this.db.buses.find((b) => b.bus_id === driver?.assigned_bus_id);
    }
    if (!bus) {
      bus = this.db.buses[0];
    }
    if (!driver && bus?.assigned_driver_id) {
      driver = this.db.drivers.find((d) => d.driver_id === bus?.assigned_driver_id);
    }
    if (!driver) {
      driver = this.db.drivers[0];
    }

    if (bus) {
      bus.bus_status = 'BREAKDOWN';
      if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        bus.current_lat = payload.latitude;
        bus.current_lng = payload.longitude;
        bus.last_gps_update = payload.timestamp || new Date().toISOString();
      }
    }

    const activeTrip = this.db.trips.find(
      (t) => (t.bus_id === bus?.bus_id || t.driver_id === driver?.driver_id) && t.status === 'ACTIVE'
    );
    if (activeTrip) {
      activeTrip.status = 'BREAKDOWN';
      if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
        activeTrip.current_lat = payload.latitude;
        activeTrip.current_lng = payload.longitude;
        activeTrip.last_gps_update = payload.timestamp || new Date().toISOString();
      }
    }

    const emergencyId = `EMG-${Date.now().toString().slice(-6)}`;
    const finalLat = payload.latitude ?? bus?.current_lat ?? null;
    const finalLng = payload.longitude ?? bus?.current_lng ?? null;

    const emergency: EmergencyEvent = {
      emergency_id: emergencyId,
      bus_id: bus ? bus.bus_id : payload.busId,
      bus_number: bus ? bus.bus_number : 'BUS',
      driver_id: driver ? driver.driver_id : payload.driverId,
      driver_name: driver ? driver.driver_name : 'Driver',
      driver_phone: driver?.phone || null,
      route_id: bus?.route_id || null,
      route_name: bus?.route_name || null,
      latitude: finalLat,
      longitude: finalLng,
      timestamp: payload.timestamp || new Date().toISOString(),
      created_at: new Date().toISOString(),
      status: 'ACTIVE',
      reason: payload.reason || '🚨 DRIVER SOS: 2-second press-and-hold emergency triggered.',
    };

    if (!this.db.emergencies) {
      this.db.emergencies = [];
    }
    this.db.emergencies.unshift(emergency);

    // Also register in breakdowns for backwards compatibility
    const breakdown: BreakdownReport = {
      breakdown_id: `BD-${Date.now().toString().slice(-6)}`,
      driver_id: emergency.driver_id,
      driver_name: emergency.driver_name,
      bus_id: emergency.bus_id,
      bus_number: emergency.bus_number,
      route_id: emergency.route_id || null,
      timestamp: emergency.timestamp,
      latitude: finalLat,
      longitude: finalLng,
      description: `🚨 DRIVER EMERGENCY SOS: Bus ${emergency.bus_number} requires immediate assistance. Driver: ${emergency.driver_name} (${emergency.driver_phone || 'No phone'}).`,
      status: 'ACTIVE',
    };
    this.db.breakdowns.unshift(breakdown);

    // High-priority system alert broadcast
    this.addNotification({
      notification_id: `NOTIF-EMG-${Date.now()}`,
      title: `🚨 EMERGENCY: Bus ${emergency.bus_number} needs immediate assistance!`,
      message: `Bus ${emergency.bus_number} activated SOS emergency broadcast. Driver: ${emergency.driver_name} (${emergency.driver_phone || 'Phone unavailable'}). Exact GPS: ${finalLat?.toFixed(4) || 'N/A'}, ${finalLng?.toFixed(4) || 'N/A'}.`,
      type: 'EMERGENCY',
      target_role: 'ALL',
      target_bus_id: emergency.bus_id,
      timestamp: new Date().toISOString(),
      metadata: {
        emergency_id: emergency.emergency_id,
        bus_id: emergency.bus_id,
        bus_number: emergency.bus_number,
        driver_name: emergency.driver_name,
        driver_phone: emergency.driver_phone,
        latitude: finalLat,
        longitude: finalLng,
      },
    });

    this.save();
    return emergency;
  }

  public getActiveEmergencies(): EmergencyEvent[] {
    return this.getEmergencies('ACTIVE');
  }

  public getEmergencies(status?: 'ACTIVE' | 'RESOLVED' | 'ALL'): EmergencyEvent[] {
    if (!this.db.emergencies) return [];
    if (!status || status === 'ACTIVE') {
      return this.db.emergencies.filter((e) => e.status === 'ACTIVE');
    }
    if (status === 'ALL') {
      return this.db.emergencies;
    }
    return this.db.emergencies.filter((e) => e.status === status);
  }

  public resolveEmergency(emergencyId: string): EmergencyEvent | null {
    if (!this.db.emergencies) return null;
    const emg = this.db.emergencies.find((e) => e.emergency_id === emergencyId);
    if (!emg) return null;

    emg.status = 'RESOLVED';

    // Check if any other active emergencies for this bus
    const hasOtherActive = this.db.emergencies.some(
      (e) => e.bus_id === emg.bus_id && e.status === 'ACTIVE'
    );
    if (!hasOtherActive) {
      const bus = this.db.buses.find((b) => b.bus_id === emg.bus_id);
      if (bus && bus.bus_status === 'BREAKDOWN') {
        bus.bus_status = 'IDLE';
      }
      const bd = this.db.breakdowns.find((b) => b.bus_id === emg.bus_id && b.status === 'ACTIVE');
      if (bd) {
        bd.status = 'RESOLVED';
      }
    }

    this.addNotification({
      notification_id: `NOTIF-RES-${Date.now()}`,
      title: `✅ Emergency Resolved: Bus ${emg.bus_number}`,
      message: `The emergency SOS alert for Bus ${emg.bus_number} has been resolved by administration.`,
      type: 'ANNOUNCEMENT',
      target_role: 'ALL',
      target_bus_id: emg.bus_id,
      timestamp: new Date().toISOString(),
    });

    this.save();
    return emg;
  }

  // --- Complaints ---
  public addComplaint(complaintData: Omit<Complaint, 'complaint_id' | 'timestamp' | 'status'>): Complaint {
    const newComplaint: Complaint = {
      ...complaintData,
      complaint_id: `CMP-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      status: 'OPEN',
    };
    this.db.complaints.unshift(newComplaint);
    this.save();
    return newComplaint;
  }

  public updateComplaintStatus(complaintId: string, status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED', adminRemarks?: string): Complaint | null {
    const cmp = this.db.complaints.find((c) => c.complaint_id === complaintId);
    if (!cmp) return null;
    cmp.status = status;
    if (adminRemarks !== undefined) cmp.admin_remarks = adminRemarks;
    this.save();
    return cmp;
  }

  // --- Notifications ---
  public addNotification(notif: SystemNotification): void {
    this.db.notifications.unshift(notif);
    // Keep last 100 notifications
    if (this.db.notifications.length > 100) {
      this.db.notifications = this.db.notifications.slice(0, 100);
    }
    this.save();
  }

  // --- Dataset Management & CRUD ---
  public addStudent(student: StudentUser): StudentUser {
    const existingIdx = this.db.students.findIndex((s) => s.student_id === student.student_id);
    if (existingIdx >= 0) {
      this.db.students[existingIdx] = student;
    } else {
      this.db.students.unshift(student);
    }
    this.save();
    return student;
  }

  public deleteStudent(studentId: string): boolean {
    const initialLen = this.db.students.length;
    this.db.students = this.db.students.filter((s) => s.student_id !== studentId);
    if (this.db.students.length !== initialLen) {
      delete this.db.passwords[studentId];
      this.save();
      return true;
    }
    return false;
  }

  public addDriver(driver: DriverUser): DriverUser {
    const existingIdx = this.db.drivers.findIndex((d) => d.driver_id === driver.driver_id);
    if (existingIdx >= 0) {
      this.db.drivers[existingIdx] = driver;
    } else {
      this.db.drivers.unshift(driver);
    }
    this.save();
    return driver;
  }

  public deleteDriver(driverId: string): boolean {
    const initialLen = this.db.drivers.length;
    this.db.drivers = this.db.drivers.filter((d) => d.driver_id !== driverId);
    if (this.db.drivers.length !== initialLen) {
      delete this.db.passwords[driverId];
      this.save();
      return true;
    }
    return false;
  }

  public addAdmin(admin: AdminUser): AdminUser {
    const existingIdx = this.db.admins.findIndex((a) => a.admin_id === admin.admin_id);
    if (existingIdx >= 0) {
      this.db.admins[existingIdx] = admin;
    } else {
      this.db.admins.unshift(admin);
    }
    this.save();
    return admin;
  }

  public deleteAdmin(adminId: string): boolean {
    const initialLen = this.db.admins.length;
    this.db.admins = this.db.admins.filter((a) => a.admin_id !== adminId);
    if (this.db.admins.length !== initialLen) {
      delete this.db.passwords[adminId];
      this.save();
      return true;
    }
    return false;
  }

  public addBus(bus: Bus): Bus {
    const existingIdx = this.db.buses.findIndex((b) => b.bus_id === bus.bus_id);
    if (existingIdx >= 0) {
      this.db.buses[existingIdx] = bus;
    } else {
      this.db.buses.unshift(bus);
    }
    this.save();
    return bus;
  }

  public deleteBus(busId: string): boolean {
    const initialLen = this.db.buses.length;
    this.db.buses = this.db.buses.filter((b) => b.bus_id !== busId);
    if (this.db.buses.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public addRoute(route: Route): Route {
    const existingIdx = this.db.routes.findIndex((r) => r.route_id === route.route_id);
    if (existingIdx >= 0) {
      this.db.routes[existingIdx] = route;
    } else {
      this.db.routes.unshift(route);
    }
    this.save();
    return route;
  }

  public deleteRoute(routeId: string): boolean {
    const initialLen = this.db.routes.length;
    this.db.routes = this.db.routes.filter((r) => r.route_id !== routeId);
    if (this.db.routes.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public replaceAdmins(admins: AdminUser[]): void {
    this.db.admins = admins;
    this.save();
  }

  public replaceStudents(students: StudentUser[]): void {
    this.db.students = students;
    this.save();
  }

  public replaceDrivers(drivers: DriverUser[]): void {
    this.db.drivers = drivers;
    this.save();
  }

  public replaceBuses(buses: Bus[]): void {
    this.db.buses = buses;
    this.save();
  }

  public updateStudent(studentId: string, updates: Partial<StudentUser>): StudentUser | null {
    const idTrimmed = (studentId || '').trim();
    let s = this.db.students.find(
      (st) =>
        st.student_id.toLowerCase() === idTrimmed.toLowerCase() ||
        (st.email && st.email.toLowerCase() === idTrimmed.toLowerCase()) ||
        st.phone === idTrimmed
    );

    if (!s) {
      s = {
        student_id: idTrimmed || `STU-${Date.now()}`,
        full_name: (updates as any).full_name || idTrimmed,
        email: updates.email || null,
        phone: updates.phone || null,
        department: updates.department || 'Computer Science and Engineering',
        year: updates.year || '3rd Year',
        bus_id: updates.bus_id || 'BUS-02',
        bus_number: 'TN 22 CZ 4102',
        route_id: updates.route_id || 'R-02',
        boarding_point: updates.boarding_point || 'Avadi',
        boarding_lat: updates.boarding_lat ?? 13.1147,
        boarding_lng: updates.boarding_lng ?? 80.1018,
        qr_identity: `QR-${idTrimmed}`,
        account_status: updates.account_status || 'ACTIVE',
        role: 'STUDENT',
      };
      this.db.students.push(s);
    }

    Object.assign(s, updates);
    if (updates.bus_id !== undefined) {
      const b = this.db.buses.find((bu) => bu.bus_id === updates.bus_id);
      s.bus_number = b ? b.bus_number : null;
      s.route_id = b ? b.route_id : null;
    }
    this.save();
    return s;
  }

  public updateDriver(driverId: string, updates: Partial<DriverUser>): DriverUser | null {
    const d = this.db.drivers.find((dr) => dr.driver_id === driverId);
    if (!d) return null;
    Object.assign(d, updates);
    if (updates.assigned_bus_id !== undefined) {
      const b = this.db.buses.find((bu) => bu.bus_id === updates.assigned_bus_id);
      d.bus_number = b ? b.bus_number : null;
      d.route_id = b ? b.route_id : null;
    }
    this.save();
    return d;
  }

  public updateAdmin(adminId: string, updates: Partial<AdminUser>): AdminUser | null {
    const a = this.db.admins.find((ad) => ad.admin_id === adminId);
    if (!a) return null;
    Object.assign(a, updates);
    this.save();
    return a;
  }

  public updateBus(busId: string, updates: Partial<Bus>): Bus | null {
    const b = this.db.buses.find((bu) => bu.bus_id === busId);
    if (!b) return null;
    Object.assign(b, updates);
    if (updates.route_id !== undefined) {
      const r = this.db.routes.find((ro) => ro.route_id === updates.route_id);
      b.route_name = r ? r.route_name : null;
      b.destination = r ? r.destination : 'College Campus';
    }
    if (updates.assigned_driver_id !== undefined) {
      const d = this.db.drivers.find((dr) => dr.driver_id === updates.assigned_driver_id);
      b.assigned_driver_name = d ? d.driver_name : null;
    }
    this.save();
    return b;
  }

  public updateRoute(routeId: string, updates: Partial<Route>): Route | null {
    const r = this.db.routes.find((ro) => ro.route_id === routeId);
    if (!r) return null;
    Object.assign(r, updates);
    this.save();
    return r;
  }

  public updateUserStatus(role: string, id: string, status: string): boolean {
    const roleUpper = (role || '').trim().toUpperCase();
    const idTrimmed = (id || '').trim();
    const statusVal = (status || '').trim().toUpperCase() as 'ACTIVE' | 'INACTIVE';

    if (roleUpper === 'ADMIN') {
      const u = this.db.admins.find((a) => a.admin_id.toLowerCase() === idTrimmed.toLowerCase());
      if (u) { u.account_status = statusVal; this.save(); return true; }
    } else if (roleUpper === 'STUDENT') {
      let u = this.db.students.find((s) => s.student_id.toLowerCase() === idTrimmed.toLowerCase());
      if (!u) {
        u = this.db.students.find(
          (s) =>
            (s.email && s.email.toLowerCase() === idTrimmed.toLowerCase()) ||
            s.phone === idTrimmed ||
            (s.qr_identity && s.qr_identity.toLowerCase() === idTrimmed.toLowerCase())
        );
      }
      if (u) {
        u.account_status = statusVal;
        this.save();
        return true;
      }
      // If student not found, auto-create student with status
      const newStu: StudentUser = {
        student_id: idTrimmed || `STU-${Date.now()}`,
        full_name: idTrimmed || 'Student',
        email: null,
        phone: null,
        department: 'Computer Science and Engineering',
        year: '3rd Year',
        bus_id: 'BUS-02',
        bus_number: 'TN 22 CZ 4102',
        route_id: 'R-02',
        boarding_point: 'Avadi',
        boarding_lat: 13.1147,
        boarding_lng: 80.1018,
        qr_identity: `QR-${idTrimmed}`,
        account_status: statusVal,
        role: 'STUDENT',
      };
      this.db.students.push(newStu);
      this.save();
      return true;
    } else if (roleUpper === 'DRIVER') {
      const u = this.db.drivers.find((d) => d.driver_id.toLowerCase() === idTrimmed.toLowerCase());
      if (u) { u.account_status = statusVal; this.save(); return true; }
    }
    return false;
  }

  public updateStudentBusAssignment(studentId: string, busId: string, boardingPoint?: string): boolean {
    const s = this.db.students.find((st) => st.student_id === studentId);
    const b = this.db.buses.find((bu) => bu.bus_id === busId);
    if (!s) return false;
    s.bus_id = busId;
    s.bus_number = b ? b.bus_number : null;
    s.route_id = b ? b.route_id : null;
    if (boardingPoint !== undefined) s.boarding_point = boardingPoint;
    this.save();
    return true;
  }

  // --- Raw Database Management ---
  public getRawDatabase(): AppDatabase {
    return JSON.parse(JSON.stringify(this.db));
  }

  public setRawDatabase(newDb: any): { success: boolean; counts: Record<string, number> } {
    if (!newDb || typeof newDb !== 'object') {
      throw new Error('Invalid database format. Must be a valid JSON object.');
    }
    this.db = {
      admins: Array.isArray(newDb.admins) ? newDb.admins : this.db.admins,
      students: Array.isArray(newDb.students) ? newDb.students : this.db.students,
      drivers: Array.isArray(newDb.drivers) ? newDb.drivers : this.db.drivers,
      buses: Array.isArray(newDb.buses) ? newDb.buses : this.db.buses,
      routes: Array.isArray(newDb.routes) ? newDb.routes : this.db.routes,
      boardingPoints: Array.isArray(newDb.boardingPoints) ? newDb.boardingPoints : this.db.boardingPoints,
      trips: Array.isArray(newDb.trips) ? newDb.trips : this.db.trips,
      studentStatuses: Array.isArray(newDb.studentStatuses) ? newDb.studentStatuses : this.db.studentStatuses,
      attendance: Array.isArray(newDb.attendance) ? newDb.attendance : this.db.attendance,
      complaints: Array.isArray(newDb.complaints) ? newDb.complaints : this.db.complaints,
      breakdowns: Array.isArray(newDb.breakdowns) ? newDb.breakdowns : this.db.breakdowns,
      emergencies: Array.isArray(newDb.emergencies) ? newDb.emergencies : (this.db.emergencies || []),
      notifications: Array.isArray(newDb.notifications) ? newDb.notifications : this.db.notifications,
      passwords: newDb.passwords && typeof newDb.passwords === 'object' ? newDb.passwords : this.db.passwords,
    };
    this.save();
    return {
      success: true,
      counts: {
        admins: this.db.admins.length,
        students: this.db.students.length,
        drivers: this.db.drivers.length,
        buses: this.db.buses.length,
        routes: this.db.routes.length,
        attendance: this.db.attendance.length,
        complaints: this.db.complaints.length,
      },
    };
  }

  public getDatabaseFilePath(): string {
    return DB_FILE;
  }

  // --- Distance Utility ---
  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const store = new AppStore();
