export type UserRole = 'ADMIN' | 'STUDENT' | 'DRIVER';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export type BusStatus = 'IDLE' | 'ON_TRIP' | 'BREAKDOWN' | 'MAINTENANCE';

export type TripStatus = 'ACTIVE' | 'COMPLETED' | 'BREAKDOWN';

export type StudentTransportStatus = 'WAITING' | 'NOT_COMING' | 'ABSENT' | 'BOARDED' | 'NOT_SET' | 'PLEASE_WAIT' | 'NOT_RETURNING';

export type ComplaintCategory =
  | 'Cleanliness'
  | 'Seat Availability'
  | 'Speeding'
  | 'Driver Behaviour'
  | 'Bus Condition'
  | 'Other';

export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface AdminUser {
  admin_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'ADMIN';
  account_status: AccountStatus;
  qr_identity: string;
  permissions?: string[];
  password_hash?: string;
}

export interface StudentUser {
  student_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  year: string | null;
  bus_id: string | null;
  bus_number: string | null;
  route_id: string | null;
  boarding_point: string | null;
  boarding_lat: number | null;
  boarding_lng: number | null;
  qr_identity: string;
  account_status: AccountStatus;
  role: 'STUDENT';
  password_hash?: string;
}

export interface DriverUser {
  driver_id: string;
  driver_name: string;
  phone: string | null;
  email: string | null;
  assigned_bus_id: string | null;
  bus_number: string | null;
  route_id: string | null;
  qr_identity: string;
  account_status: AccountStatus;
  role: 'DRIVER';
  password_hash?: string;
}

export type AppUser = AdminUser | StudentUser | DriverUser;

export interface Bus {
  bus_id: string;
  bus_number: string;
  route_id: string | null;
  route_name: string | null;
  destination: string | null;
  assigned_driver_id: string | null;
  assigned_driver_name: string | null;
  bus_status: BusStatus;
  current_lat?: number | null;
  current_lng?: number | null;
  gps_accuracy?: number | null;
  last_gps_update?: string | null;
  location_source?: 'MOBILE_DRIVER_GPS' | 'COLLEGE_BUS_GPS';
  active_trip_id?: string | null;
}

export const COLLEGE_DESTINATION = {
  id: 'aalim-college-destination',
  name: 'Aalim Muhammed Salegh College of Engineering',
  terminalName: 'CAMPUS',
  address: 'Muthapudupet, Avadi, IAF, Chennai – 600 055, Tamil Nadu, India',
  shortAddress: 'Muthapudupet, Avadi, IAF, Chennai – 600 055',
  latitude: 13.147194, // Stop #6: 13°08'49.9"N
  longitude: 80.058528, // 80°03'30.7"E
  dms: "13°08'49.9\"N 80°03'30.7\"E",
};

export interface DriverSpecifiedStop {
  stopNumber: number;
  name: string;
  dms: string;
  latitude: number;
  longitude: number;
}

export const DRIVER_SPECIFIED_STOPS: DriverSpecifiedStop[] = [
  {
    stopNumber: 1,
    name: 'AVADI',
    dms: "13°07'39.2\"N 80°06'50.6\"E",
    latitude: 13.127556,
    longitude: 80.114056,
  },
  {
    stopNumber: 2,
    name: 'AJEYA STADIUM',
    dms: "13°08'02.9\"N 80°06'07.3\"E",
    latitude: 13.134139,
    longitude: 80.102028,
  },
  {
    stopNumber: 3,
    name: 'AVADI HVF MAIN GATE',
    dms: "13°08'26.5\"N 80°05'32.7\"E",
    latitude: 13.140694,
    longitude: 80.092417,
  },
  {
    stopNumber: 4,
    name: 'CRP CROSS ROAD',
    dms: "13°08'57.0\"N 80°05'16.7\"E",
    latitude: 13.149167,
    longitude: 80.087972,
  },
  {
    stopNumber: 5,
    name: 'AVADI AIRFORCE MAIN GATE',
    dms: "13°08'49.0\"N 80°04'23.8\"E",
    latitude: 13.146944,
    longitude: 80.073278,
  },
  {
    stopNumber: 6,
    name: 'CAMPUS',
    dms: "13°08'49.9\"N 80°03'30.7\"E",
    latitude: 13.147194,
    longitude: 80.058528,
  },
];

export interface Route {
  route_id: string;
  route_name: string;
  destination: string;
  driver_name: string | null;
  driver_phone: string | null;
  boarding_points: string[];
}

export interface BoardingPoint {
  boarding_point_id: string;
  route_id: string;
  boarding_point_name: string;
  latitude: number | null;
  longitude: number | null;
  sequence?: number;
}

export interface OperationalBoardingPoint {
  sequence: number;
  boarding_point_id: string;
  boarding_point_name: string;
  latitude: number;
  longitude: number;
  assigned_student_count: number;
  waiting_student_count: number;
  boarded_student_count: number;
  absent_student_count: number;
  students?: Array<{
    student_id: string;
    full_name: string;
    today_status: string;
    phone: string | null;
  }>;
}

export interface OperationalRouteWaypoint {
  title: string;
  type: 'BUS_START' | 'BOARDING_POINT' | 'COLLEGE';
  sequence: number;
  latitude: number;
  longitude: number;
  boarding_point_id?: string;
  assigned_student_count?: number;
  waiting_student_count?: number;
}

export interface DriverOperationalRouteResponse {
  driver: DriverUser;
  bus: Bus | null;
  route: Route | null;
  activeTrip: Trip | null;
  students: Array<
    StudentUser & {
      today_status: string;
      status_updated_at: string | null;
      student_lat: number | null;
      student_lng: number | null;
      has_live_gps?: boolean;
    }
  >;
  boarding_points: OperationalBoardingPoint[];
  route_waypoints: OperationalRouteWaypoint[];
  destination: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  counts: {
    total: number;
    waiting: number;
    boarded: number;
    absent: number;
    not_set: number;
  };
}

export interface Trip {
  trip_id: string;
  bus_id: string;
  bus_number: string;
  driver_id: string;
  driver_name: string;
  route_id: string | null;
  start_time: string;
  end_time: string | null;
  status: TripStatus;
  current_lat: number | null;
  current_lng: number | null;
  gps_accuracy: number | null;
  last_gps_update: string | null;
  dynamic_qr_token: string;
  dynamic_qr_expires_at: number;
  previous_dynamic_qr_token?: string;
  previous_dynamic_qr_expires_at?: number;
}

export interface StudentDailyStatus {
  student_id: string;
  student_name: string;
  bus_id: string | null;
  date: string;
  status: StudentTransportStatus;
  updated_at: string;
  latitude?: number | null;
  longitude?: number | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_point_name?: string | null;
  arrival_notified?: boolean;
  arrival_notified_at?: string | null;
  arrival_notified_trip_id?: string | null;
}

export interface AttendanceRecord {
  attendance_id: string;
  student_id: string;
  student_name: string;
  bus_id: string;
  bus_number: string;
  route_id?: string | null;
  route_name?: string | null;
  boarding_point?: string | null;
  driver_id: string;
  trip_id: string;
  date: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  distance_meters?: number | null;
  verification_status: 'VERIFIED';
}

export interface Complaint {
  complaint_id: string;
  student_id: string;
  student_name: string;
  bus_id: string | null;
  bus_number: string | null;
  category: ComplaintCategory;
  description: string;
  timestamp: string;
  status: ComplaintStatus;
  admin_remarks?: string;
}

export interface BreakdownReport {
  breakdown_id: string;
  driver_id: string;
  driver_name: string;
  bus_id: string;
  bus_number: string;
  route_id: string | null;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  status: 'ACTIVE' | 'RESOLVED';
}

export interface EmergencyEvent {
  emergency_id: string;
  bus_id: string;
  bus_number: string;
  driver_id: string;
  driver_name: string;
  driver_phone?: string | null;
  route_id?: string | null;
  route_name?: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  created_at: string;
  status: 'ACTIVE' | 'RESOLVED' | 'DISMISSED';
  reason?: string;
}

export interface SystemNotification {
  notification_id: string;
  title: string;
  message: string;
  type:
    | 'TRIP_START'
    | 'TRIP_END'
    | 'BREAKDOWN'
    | 'BOARDING'
    | 'ANNOUNCEMENT'
    | 'STATUS_UPDATE'
    | 'BUS_ARRIVAL'
    | 'EMERGENCY'
    | 'MISSED_BOARDING'
    | 'GATE_PASS';
  target_role?: 'ALL' | 'STUDENT' | 'DRIVER' | 'ADMIN';
  target_bus_id?: string | null;
  target_student_id?: string | null;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ImportValidationIssue {
  type: 'ERROR' | 'WARNING';
  field: string;
  message: string;
  rowNumber?: number;
  id?: string;
}

export interface ImportAuditReport {
  datasetType: 'admins' | 'students' | 'drivers' | 'buses' | 'routes' | 'boardingPoints';
  totalSubmitted: number;
  validCount: number;
  invalidCount: number;
  issues: ImportValidationIssue[];
  importedAt: string;
}

export interface MissedBoardingIncident {
  incident_id: string;
  student_id: string;
  student_name: string;
  bus_id: string;
  bus_number: string;
  driver_id: string;
  driver_name: string;
  boarding_point: string;
  trip_id: string;
  detection_time: string;
  bus_latitude: number | null;
  bus_longitude: number | null;
  student_status: string;
  reason: string;
  reason_details?: string;
  reported_by: 'DRIVER' | 'SYSTEM';
  created_at: string;
}

export interface TransportGatePass {
  pass_id: string;
  incident_id: string;
  student_id: string;
  student_name: string;
  bus_id: string;
  bus_number: string;
  boarding_point: string;
  trip_date: string;
  incident_time: string;
  reason: string;
  generated_time: string;
  verification_code: string;
  verification_qr: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
}

export interface BusQrDisplayCredential {
  bus_id: string;
  bus_number: string;
  password_hash: string;
  is_active: boolean;
  updated_at: string;
}
