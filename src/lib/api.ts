import {
  AdminUser,
  StudentUser,
  DriverUser,
  Bus,
  Route,
  AttendanceRecord,
  Complaint,
  BreakdownReport,
  EmergencyEvent,
  SystemNotification,
  StudentDailyStatus,
  Trip,
  ImportAuditReport,
  DriverOperationalRouteResponse,
} from '../types/index.ts';

const API_BASE = '/api';

export async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const text = await res.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = { error: text };
      }
    }

    if (!res.ok) {
      throw new Error(data?.error || data?.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    console.warn(`API Error [${endpoint}]:`, err?.message || err);
    throw err;
  }
}

export const Api = {
  // Auth
  verifyPreregistration: (identifier: string) =>
    request<{ registered: boolean; user: { id: string; name: string; role: string; qr_identity: string } }>(
      '/auth/verify-preregistration',
      { method: 'POST', body: JSON.stringify({ identifier }) }
    ),

  login: (identifier: string, password: string, role?: string) =>
    request<{ token: string; user: AdminUser | StudentUser | DriverUser; role: 'ADMIN' | 'STUDENT' | 'DRIVER' }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ identifier, password, role }) }
    ),

  qrLogin: (qrToken: string) =>
    request<{ token: string; user: AdminUser | StudentUser | DriverUser; role: 'ADMIN' | 'STUDENT' | 'DRIVER' }>(
      '/auth/qr-login',
      { method: 'POST', body: JSON.stringify({ qrToken }) }
    ),

  changePassword: (userId: string, oldPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    }),

  resetPassword: (userId: string, newPassword?: string) =>
    request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    }),

  getRegisteredUsers: () =>
    request<{
      admins: Array<{ id: string; name: string; role: string; qr: string; email: string | null; phone: string | null }>;
      drivers: Array<{ id: string; name: string; role: string; qr: string; bus: string | null; phone: string | null }>;
      students: Array<{ id: string; name: string; role: string; qr: string; bus: string | null; boarding: string | null; email: string | null; phone: string | null }>;
    }>('/auth/registered-users'),

  // Student
  getStudentData: (studentId: string) =>
    request<{
      student: StudentUser;
      bus: Bus | null;
      route: Route | null;
      todayStatus: StudentDailyStatus | null;
    }>(`/student/${studentId}`),

  updateStudentStatus: (studentId: string, status: string, latitude?: number | null, longitude?: number | null) =>
    request<{ success: boolean; message: string }>('/student/status', {
      method: 'POST',
      body: JSON.stringify({
        studentId,
        student_id: studentId,
        id: studentId,
        status,
        latitude,
        longitude,
      }),
    }),

  getStudentBusLive: (busId: string) =>
    request<{
      bus_id: string;
      bus_number: string;
      bus_status: string;
      current_lat: number | null;
      current_lng: number | null;
      gps_accuracy: number | null;
      last_gps_update: string | null;
      location_source: string;
      activeTrip: Trip | null;
      latestTrip?: Trip | null;
    }>(`/student/bus/${busId}/live`),

  // Driver
  getDriverData: (driverId: string) =>
    request<DriverOperationalRouteResponse>(`/driver/${driverId}`),

  getDriverOperationalRoute: (driverId: string) =>
    request<DriverOperationalRouteResponse>(`/driver/${driverId}/operational-route`),

  startTrip: (driverId: string, busId: string) =>
    request<{ success: boolean; trip: Trip }>('/driver/start-trip', {
      method: 'POST',
      body: JSON.stringify({ driverId, busId }),
    }),

  endTrip: (driverId: string, busId: string) =>
    request<{ success: boolean; message: string; trip: Trip }>('/driver/end-trip', {
      method: 'POST',
      body: JSON.stringify({ driverId, busId }),
    }),

  updateDriverLocation: (driverId: string, busId: string, latitude: number, longitude: number, accuracy?: number | null) =>
    request<{ success: boolean; bus: Bus }>('/driver/location', {
      method: 'POST',
      body: JSON.stringify({ driverId, busId, latitude, longitude, accuracy }),
    }),

  getDynamicQR: (driverId: string, busId: string) =>
    request<{ dynamic_qr_token: string; expires_in_seconds: number }>(`/driver/dynamic-qr/${driverId}/${busId}`),

  getDriverStudents: (busId: string) =>
    request<
      Array<
        StudentUser & {
          today_status: string;
          status_updated_at: string | null;
          student_lat: number | null;
          student_lng: number | null;
        }
      >
    >(`/driver/students/${busId}`),

  reportBreakdown: (driverId: string, busId: string, latitude: number | null, longitude: number | null, description: string) =>
    request<{ success: boolean; breakdown: BreakdownReport }>('/driver/breakdown', {
      method: 'POST',
      body: JSON.stringify({ driverId, busId, latitude, longitude, description }),
    }),

  // FEATURE 3: Driver SOS & Emergency System
  sendDriverSos: (payload: {
    busId: string;
    driverId: string;
    currentGpsLocation?: { latitude: number; longitude: number };
    latitude?: number | null;
    longitude?: number | null;
    timestamp?: string;
    reason?: string;
  }) =>
    request<{ success: boolean; message: string; emergency: EmergencyEvent }>('/driver/sos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getActiveEmergencies: () =>
    request<{ success: boolean; activeEmergencies: EmergencyEvent[] }>('/emergency/active'),

  resolveEmergency: (emergencyId: string) =>
    request<{ success: boolean; message: string; emergency: EmergencyEvent }>('/emergency/resolve', {
      method: 'POST',
      body: JSON.stringify({ emergencyId }),
    }),

  markStudentBoarded: (driverId: string, busId: string, studentId: string) =>
    request<{ success: boolean; message: string; record?: AttendanceRecord }>('/driver/mark-boarded', {
      method: 'POST',
      body: JSON.stringify({ driverId, busId, studentId }),
    }),

  // Attendance & FEATURE 1: GPS Proximity QR Verification
  verifyBoarding: (
    studentId: string,
    qrToken: string,
    latitude: number | null,
    longitude: number | null
  ) =>
    request<{
      success: boolean;
      message: string;
      distanceMeters?: number;
      maxAllowedMeters?: number;
      record?: AttendanceRecord;
      studentCoordinates?: { lat: number; lng: number };
      busCoordinates?: { lat: number; lng: number };
    }>('/verify-boarding', {
      method: 'POST',
      body: JSON.stringify({ studentId, qrToken, latitude, longitude }),
    }),

  scanBusQR: (studentId: string, qrToken: string, latitude: number | null, longitude: number | null) =>
    request<{
      success: boolean;
      message: string;
      record?: AttendanceRecord;
      distanceMeters?: number;
      maxAllowedMeters?: number;
    }>('/attendance/scan', {
      method: 'POST',
      body: JSON.stringify({ studentId, qrToken, latitude, longitude }),
    }),

  getAttendance: () => request<AttendanceRecord[]>('/attendance'),

  getStudentAttendanceHistory: (studentId: string) =>
    request<{
      success: boolean;
      studentId: string;
      totalRecords: number;
      attendance: AttendanceRecord[];
    }>(`/attendance/student/${studentId}`),

  // Complaints
  getComplaints: () => request<Complaint[]>('/complaints'),

  submitComplaint: (studentId: string, category: string, description: string) =>
    request<{ success: boolean; complaint: Complaint }>('/complaints', {
      method: 'POST',
      body: JSON.stringify({ studentId, category, description }),
    }),

  updateComplaintStatus: (id: string, status: string, adminRemarks?: string) =>
    request<{ success: boolean; complaint: Complaint }>(`/complaints/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, adminRemarks }),
    }),

  // Notifications
  getNotifications: () => request<SystemNotification[]>('/notifications'),

  sendNotification: (title: string, message: string, type?: string, target_role?: string, target_bus_id?: string) =>
    request<{ success: boolean; notification: SystemNotification }>('/notifications', {
      method: 'POST',
      body: JSON.stringify({ title, message, type, target_role, target_bus_id }),
    }),

  // Admin
  getAdminDashboard: () =>
    request<{
      totalStudents: number;
      totalDrivers: number;
      totalBuses: number;
      totalRoutes: number;
      activeTripsCount: number;
      activeTrips: Trip[];
      waitingCount: number;
      absentCount: number;
      boardedCount: number;
      attendanceTodayCount: number;
      totalAttendance: number;
      openComplaintsCount: number;
      activeBreakdownsCount: number;
      breakdowns: BreakdownReport[];
      emergencies?: EmergencyEvent[];
      activeEmergencies?: EmergencyEvent[];
      activeEmergenciesCount?: number;
      studentStatuses?: StudentDailyStatus[];
      todayStatuses?: StudentDailyStatus[];
    }>('/admin/dashboard'),

  getBuses: () => request<Bus[]>('/admin/buses'),
  getAdminBuses: () => request<Bus[]>('/admin/buses'),

  getRoutes: () => request<Route[]>('/admin/routes'),

  getUsers: () =>
    request<{
      admins: AdminUser[];
      students: StudentUser[];
      drivers: DriverUser[];
    }>('/admin/users'),

  updateUserStatus: (role: string, id: string, status: 'ACTIVE' | 'INACTIVE') =>
    request<{ success: boolean; message: string }>('/admin/users/status', {
      method: 'PUT',
      body: JSON.stringify({ role, id, status }),
    }),

  assignBusToStudent: (studentId: string, busId: string, boardingPoint?: string) =>
    request<{ success: boolean; message: string }>('/admin/users/assign-bus', {
      method: 'PUT',
      body: JSON.stringify({ studentId, busId, boardingPoint }),
    }),

  // Admin CRUD Operations
  createStudent: (studentData: any) =>
    request<{ success: boolean; student: StudentUser }>('/admin/create-student', {
      method: 'POST',
      body: JSON.stringify(studentData),
    }),

  updateStudent: (studentId: string, updates: Partial<StudentUser>) =>
    request<{ success: boolean; student: StudentUser; message: string }>(`/admin/update-student/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteStudent: (studentId: string) =>
    request<{ success: boolean; message: string }>(`/admin/delete-student/${studentId}`, {
      method: 'DELETE',
    }),

  createDriver: (driverData: any) =>
    request<{ success: boolean; driver: DriverUser }>('/admin/create-driver', {
      method: 'POST',
      body: JSON.stringify(driverData),
    }),

  updateDriver: (driverId: string, updates: Partial<DriverUser>) =>
    request<{ success: boolean; driver: DriverUser; message: string }>(`/admin/update-driver/${driverId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteDriver: (driverId: string) =>
    request<{ success: boolean; message: string }>(`/admin/delete-driver/${driverId}`, {
      method: 'DELETE',
    }),

  createAdmin: (adminData: any) =>
    request<{ success: boolean; admin: AdminUser }>('/admin/create-admin', {
      method: 'POST',
      body: JSON.stringify(adminData),
    }),

  updateAdmin: (adminId: string, updates: Partial<AdminUser>) =>
    request<{ success: boolean; admin: AdminUser; message: string }>(`/admin/update-admin/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteAdmin: (adminId: string) =>
    request<{ success: boolean; message: string }>(`/admin/delete-admin/${adminId}`, {
      method: 'DELETE',
    }),

  createBus: (busData: any) =>
    request<{ success: boolean; bus: Bus }>('/admin/create-bus', {
      method: 'POST',
      body: JSON.stringify(busData),
    }),

  updateBus: (busId: string, updates: Partial<Bus>) =>
    request<{ success: boolean; bus: Bus; message: string }>(`/admin/update-bus/${busId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteBus: (busId: string) =>
    request<{ success: boolean; message: string }>(`/admin/delete-bus/${busId}`, {
      method: 'DELETE',
    }),

  createRoute: (routeData: any) =>
    request<{ success: boolean; route: Route }>('/admin/create-route', {
      method: 'POST',
      body: JSON.stringify(routeData),
    }),

  updateRoute: (routeId: string, updates: Partial<Route>) =>
    request<{ success: boolean; route: Route; message: string }>(`/admin/update-route/${routeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteRoute: (routeId: string) =>
    request<{ success: boolean; message: string }>(`/admin/delete-route/${routeId}`, {
      method: 'DELETE',
    }),

  setUserPassword: (userId: string, newPassword: string) =>
    request<{ success: boolean; message: string }>('/admin/set-user-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    }),

  importDataset: (
    datasetType: string,
    records: any[],
    mode: 'REPLACE' | 'APPEND' | 'UPDATE' | 'UPSERT' = 'REPLACE'
  ) =>
    request<{ success: boolean; report: ImportAuditReport }>('/admin/import-dataset', {
      method: 'POST',
      body: JSON.stringify({ datasetType, records, mode }),
    }),

  resetDataset: () =>
    request<{ success: boolean; message: string }>('/admin/reset-dataset', {
      method: 'POST',
    }),

  getRawDatabase: () =>
    request<{
      success: boolean;
      filePath: string;
      counts: Record<string, number>;
      database: any;
    }>('/admin/raw-database'),

  updateRawDatabase: (database: any) =>
    request<{
      success: boolean;
      message: string;
      counts: Record<string, number>;
    }>('/admin/raw-database', {
      method: 'POST',
      body: JSON.stringify({ database }),
    }),
};
