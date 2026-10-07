import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus,
  MapPin,
  Clock,
  QrCode,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Send,
  Navigation,
  Compass,
  Radio,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Phone,
  X,
  History,
  Calendar,
  Cloud,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import {
  StudentUser,
  Bus as BusType,
  Route,
  StudentDailyStatus,
  Complaint,
  ComplaintCategory,
  COLLEGE_DESTINATION,
  AttendanceRecord,
} from '../types/index.ts';
import { MapViewer, MapMarkerPoint } from '../components/MapViewer.tsx';
import { QRScannerModal } from '../components/QRScannerModal.tsx';
import { QRModal } from '../components/QRModal.tsx';
import { StudentBoardingHistoryModal } from '../components/StudentBoardingHistoryModal.tsx';
import { FirestoreService } from '../lib/firestoreSync.ts';

interface StudentDashboardProps {
  activeTab?: string;
  onNavigate?: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  activeTab = 'DASHBOARD',
  onNavigate,
}) => {
  const { user } = useAuth();
  const student = user as StudentUser;

  const [studentData, setStudentData] = useState<StudentUser | null>(student);
  const [assignedBus, setAssignedBus] = useState<BusType | null>(null);
  const [assignedRoute, setAssignedRoute] = useState<Route | null>(null);
  const [todayStatus, setTodayStatus] = useState<StudentDailyStatus | null>(null);
  const [isEveningMode, setIsEveningMode] = useState<boolean>(false);

  // Student device GPS state
  const [studentCoords, setStudentCoords] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isWatchingGps, setIsWatchingGps] = useState<boolean>(false);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Status update message banner
  const [statusFeedbackBanner, setStatusFeedbackBanner] = useState<{
    text: string;
    type: 'WAITING' | 'ABSENT' | 'BOARDED' | 'INFO';
  } | null>(null);

  // Bus live GPS state
  const [busLive, setBusLive] = useState<{
    bus_number: string;
    bus_status: string;
    current_lat: number | null;
    current_lng: number | null;
    gps_accuracy: number | null;
    last_gps_update: string | null;
    location_source: string;
  } | null>(null);

  // Attendance scanner modal
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Student Identity QR modal
  const [showIdQr, setShowIdQr] = useState<boolean>(false);

  // Complaints
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [showComplaintForm, setShowComplaintForm] = useState<boolean>(false);
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>('Seat Availability');
  const [complaintDesc, setComplaintDesc] = useState<string>('');
  const [complaintSubmitting, setComplaintSubmitting] = useState<boolean>(false);
  const [complaintFeedback, setComplaintFeedback] = useState<string | null>(null);

  // Status updating state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const todayStatusRef = useRef<StudentDailyStatus | null>(todayStatus);

  // FEATURE 2: Bus Arrival Alert Banner State
  const [busArrivalAlert, setBusArrivalAlert] = useState<{
    message: string;
    busNumber?: string;
    distanceMeters?: number;
    timestamp: string;
  } | null>(null);
  const lastArrivalNotifIdRef = useRef<string | null>(null);

  // Past Boarding History State (Cloud Firestore)
  const [boardingRecords, setBoardingRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isFirestoreLive, setIsFirestoreLive] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  useEffect(() => {
    todayStatusRef.current = todayStatus;
  }, [todayStatus]);

  useEffect(() => {
    if (!student?.student_id) return;
    loadStudentInfo();
    loadComplaints();
    startStudentGps();
    checkArrivalNotifications();
    loadBoardingHistory();

    // Attach real-time Cloud Firestore attendance subscription
    const unsubscribeFirestore = FirestoreService.subscribeStudentAttendance(
      student.student_id,
      (liveRecords) => {
        if (liveRecords) {
          setBoardingRecords((prev) => {
            const map = new Map<string, AttendanceRecord>();
            prev.forEach((r) => map.set(r.attendance_id, r));
            liveRecords.forEach((r) => map.set(r.attendance_id, r));
            return Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
          setIsFirestoreLive(true);
          setIsLoadingHistory(false);
        }
      }
    );

    const interval = setInterval(() => {
      refreshBusLive();
      checkArrivalNotifications();
    }, 4000);

    return () => {
      clearInterval(interval);
      stopStudentGps();
      unsubscribeFirestore();
    };
  }, [student?.student_id]);

  // Load Past Boarding History from Firestore & API
  const loadBoardingHistory = async () => {
    if (!student?.student_id) return;
    setIsLoadingHistory(true);
    try {
      // 1. Fetch from Firestore
      const firestoreRecords = await FirestoreService.getStudentAttendanceFromFirestore(student.student_id);

      // 2. Fetch from backend store
      let apiRecords: AttendanceRecord[] = [];
      try {
        const res = await Api.getStudentAttendanceHistory(student.student_id);
        if (res?.attendance) {
          apiRecords = res.attendance;
        }
      } catch (e) {
        console.warn('API getStudentAttendanceHistory notice:', e);
      }

      // 3. Merge unique records by attendance_id
      const recordMap = new Map<string, AttendanceRecord>();
      apiRecords.forEach((r) => {
        if (r.attendance_id) recordMap.set(r.attendance_id, r);
      });
      firestoreRecords.forEach((r) => {
        if (r.attendance_id) recordMap.set(r.attendance_id, r);
      });

      const merged = Array.from(recordMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setBoardingRecords(merged);

      // 4. Batch sync any records to Firestore so database stays completely hydrated
      if (apiRecords.length > 0) {
        FirestoreService.syncAttendanceBatch(apiRecords);
      }
    } catch (err) {
      console.warn('loadBoardingHistory error:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // FEATURE 2: Check for incoming bus arrival notifications (< 500m geofence)
  const checkArrivalNotifications = async () => {
    if (!student?.student_id) return;
    try {
      const allNotifs = await Api.getNotifications();
      const arrivalNotif = allNotifs.find(
        (n) =>
          n.type === 'BUS_ARRIVAL' &&
          (n.target_student_id === student.student_id ||
            n.metadata?.student_id === student.student_id)
      );

      if (arrivalNotif && arrivalNotif.notification_id !== lastArrivalNotifIdRef.current) {
        lastArrivalNotifIdRef.current = arrivalNotif.notification_id;

        setBusArrivalAlert({
          message: arrivalNotif.message,
          busNumber: arrivalNotif.metadata?.bus_number || student.bus_number || 'Bus',
          distanceMeters: arrivalNotif.metadata?.distance_meters,
          timestamp: arrivalNotif.timestamp,
        });

        // Trigger native browser Web Push notification if allowed
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              new Notification('🚌 Your bus is arriving soon!', {
                body: arrivalNotif.message,
                icon: '/favicon.ico',
              });
            } catch (_) {}
          }
        }

        // Haptic feedback vibration
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate([250, 100, 250, 100, 300]);
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('Arrival notification check error:', e);
    }
  };

  const loadStudentInfo = async () => {
    try {
      const data = await Api.getStudentData(student.student_id);
      setStudentData(data.student);
      setAssignedBus(data.bus);
      setAssignedRoute(data.route);
      setTodayStatus(data.todayStatus);

      // If student has saved coordinates in today's status, restore them
      if (data.todayStatus?.latitude && data.todayStatus?.longitude && !studentCoords) {
        setStudentCoords({
          lat: data.todayStatus.latitude,
          lng: data.todayStatus.longitude,
          accuracy: 10,
        });
      }

      if (data.bus) {
        refreshBusLive(data.bus.bus_id);
      }
    } catch (e) {
      console.warn('Failed to load student info:', e);
    }
  };

  const loadComplaints = async () => {
    try {
      const all = await Api.getComplaints();
      setComplaints(all.filter((c) => c.student_id === student.student_id));
    } catch (e) {
      console.warn('Failed to load complaints:', e);
    }
  };

  const refreshBusLive = async (targetBusId?: string) => {
    const busId = targetBusId || assignedBus?.bus_id || studentData?.bus_id;
    if (!busId) return;

    try {
      const live = await Api.getStudentBusLive(busId);
      setBusLive(live);
    } catch (e) {
      console.warn('Failed to refresh bus live location:', e);
    }
  };

  // Student Device GPS using navigator.geolocation.watchPosition()
  const startStudentGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation API is not supported on this device/browser.');
      return;
    }

    setGpsError(null);
    setIsWatchingGps(true);

    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
    }

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || null,
        };
        setStudentCoords(coords);
        setGpsError(null);

        // Only stream live coordinates if student is currently WAITING (🟡 Yellow)
        const curStatus = todayStatusRef.current?.status;
        if (
          student?.student_id &&
          (curStatus === 'WAITING' || curStatus === 'PLEASE_WAIT')
        ) {
          Api.updateStudentStatus(student.student_id, curStatus, coords.lat, coords.lng).catch(() => {});
        }
      },
      (err) => {
        setIsWatchingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Mobile GPS permission is disabled. Tap "Use My Stop GPS" below to use your stop location.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Mobile GPS signal is temporarily unavailable.');
        } else {
          setGpsError('GPS location request timed out.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 3000,
      }
    );
  };

  const stopStudentGps = () => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setIsWatchingGps(false);
  };

  const toggleStudentGps = () => {
    if (isWatchingGps) {
      stopStudentGps();
    } else {
      startStudentGps();
    }
  };

  // Set stop coordinates fallback to official registered boarding point
  const handleCalibrateToStop = () => {
    const officialLat = studentData?.boarding_lat ?? student.boarding_lat;
    const officialLng = studentData?.boarding_lng ?? student.boarding_lng;

    if (typeof officialLat === 'number' && typeof officialLng === 'number') {
      const calibrated = { lat: officialLat, lng: officialLng, accuracy: 5 };
      setStudentCoords(calibrated);
      setGpsError(null);

      const curStatus = todayStatusRef.current?.status;
      if (
        student?.student_id &&
        (curStatus === 'WAITING' ||
          curStatus === 'PLEASE_WAIT' ||
          curStatus === 'NOT_COMING' ||
          curStatus === 'NOT_RETURNING')
      ) {
        Api.updateStudentStatus(student.student_id, curStatus, officialLat, officialLng).catch(() => {});
      }

      setStatusFeedbackBanner({
        text: `📍 GPS position set to your official registered boarding stop (${studentData?.boarding_point || 'Stop'}). Driver GPS map updated!`,
        type: 'INFO',
      });
      setTimeout(() => setStatusFeedbackBanner(null), 5000);
    } else {
      setStatusFeedbackBanner({
        text: `⚠️ No official boarding GPS coordinates set by admin yet for stop "${studentData?.boarding_point || ''}". Please enable mobile GPS.`,
        type: 'INFO',
      });
      setTimeout(() => setStatusFeedbackBanner(null), 5000);
    }
  };

  // Student Transport Status update (Morning & Evening)
  const handleStatusChange = async (newStatus: 'WAITING' | 'NOT_COMING' | 'PLEASE_WAIT' | 'NOT_RETURNING') => {
    if (!studentData) return;
    setIsUpdatingStatus(true);
    setStatusFeedbackBanner(null);

    try {
      let lat = studentCoords?.lat || null;
      let lng = studentCoords?.lng || null;

      const isWaiting = newStatus === 'WAITING' || newStatus === 'PLEASE_WAIT';
      const isAbsent = newStatus === 'NOT_COMING' || newStatus === 'NOT_RETURNING';

      if (isWaiting) {
        // When WAITING: if mobile GPS is not yet on, start it immediately
        if (!isWatchingGps) {
          startStudentGps();
        }
        // If live GPS coordinates not yet acquired, fallback to official saved boarding point
        if (lat === null || lng === null) {
          lat = studentData.boarding_lat ?? student.boarding_lat ?? null;
          lng = studentData.boarding_lng ?? student.boarding_lng ?? null;
        }
      } else if (isAbsent) {
        // When ABSENT: show registered boarding point as red
        lat = studentData.boarding_lat ?? student.boarding_lat ?? null;
        lng = studentData.boarding_lng ?? student.boarding_lng ?? null;
      }

      const stuId = studentData.student_id || student.student_id || 'STU-100';
      await Api.updateStudentStatus(
        stuId,
        newStatus,
        lat,
        lng
      );

      const todayDate = new Date().toISOString().split('T')[0];
      const updated: StudentDailyStatus = {
        student_id: stuId,
        student_name: studentData.full_name || student.full_name,
        bus_id: studentData.bus_id || student.bus_id,
        date: todayDate,
        status: newStatus,
        updated_at: new Date().toISOString(),
        latitude: lat,
        longitude: lng,
      };
      setTodayStatus(updated);
      todayStatusRef.current = updated;

      // Sync to Firestore in background
      try {
        FirestoreService.syncStudentStatus({
          student_id: stuId,
          student_name: studentData.full_name || student.full_name,
          bus_id: studentData.bus_id || student.bus_id,
          date: todayDate,
          status: newStatus,
          latitude: lat,
          longitude: lng,
          updated_at: new Date().toISOString(),
        });
      } catch (_f) {}

      // Feedback banner
      if (newStatus === 'WAITING' || newStatus === 'PLEASE_WAIT') {
        // Request Web Push Notification permission for automated arrival alerts
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
          }
        }

        setStatusFeedbackBanner({
          text: `🟡 You are marked as WAITING. Your pickup coordinates are stored for automated bus arrival push alerts (< 500m)!`,
          type: 'WAITING',
        });
      } else {
        setStatusFeedbackBanner({
          text: `🔴 You are marked as ABSENT. Driver has been notified on their GPS map to skip your boarding stop today.`,
          type: 'ABSENT',
        });
      }
    } catch (err: any) {
      console.warn('Student status update:', err?.message || err);
      const todayDate = new Date().toISOString().split('T')[0];
      const stuId = studentData.student_id || student.student_id || 'STU-100';
      setTodayStatus((prev) => ({
        student_id: stuId,
        student_name: studentData.full_name || student.full_name,
        bus_id: studentData.bus_id || student.bus_id,
        date: todayDate,
        status: newStatus,
        updated_at: new Date().toISOString(),
        latitude: null,
        longitude: null,
        ...(prev || {}),
      }));
      setStatusFeedbackBanner({
        text: `Status updated to ${newStatus}.`,
        type: newStatus === 'WAITING' || newStatus === 'PLEASE_WAIT' ? 'WAITING' : 'ABSENT',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // FEATURE 1: Bus Dynamic QR Scan with GPS Proximity Verification
  const handleScanAttendance = async (decodedToken: string) => {
    setScanError(null);
    setAttendanceSuccess(null);

    try {
      // 1. Frontend (Student App): Capture live GPS coordinates (lat, lng) upon scanning
      let lat = studentCoords?.lat ?? null;
      let lng = studentCoords?.lng ?? null;

      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const freshPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 4000,
              maximumAge: 1000,
            });
          });
          lat = freshPosition.coords.latitude;
          lng = freshPosition.coords.longitude;
          setStudentCoords({ lat, lng, accuracy: freshPosition.coords.accuracy || 5 });
        } catch (geoErr) {
          console.warn('Live GPS refresh before scan note:', geoErr);
        }
      }

      // Check if coordinates were captured
      if (lat === null || lng === null) {
        setScanError('Boarding Failed: Mobile GPS location is required to verify physical proximity to the bus. Please allow location permissions.');
        return;
      }

      // 2. Submit student coordinates & QR payload to backend API (/api/verify-boarding)
      const res = await Api.verifyBoarding(
        student.student_id,
        decodedToken,
        lat,
        lng
      );

      // 3. Distance <= 30m: Approve boarding, update student status to "BOARDED" (🟢 Green)
      setAttendanceSuccess(res.message);
      setShowScanner(false);

      if (res.record) {
        // Immediately sync verified boarding pass into Cloud Firestore
        FirestoreService.syncAttendanceRecord(res.record);
        setBoardingRecords((prev) => [
          res.record!,
          ...prev.filter((r) => r.attendance_id !== res.record!.attendance_id),
        ]);
      }

      const boardedStatus: StudentDailyStatus = {
        student_id: student.student_id,
        student_name: student.full_name,
        bus_id: student.bus_id,
        date: new Date().toISOString().split('T')[0],
        status: 'BOARDED',
        updated_at: new Date().toISOString(),
        latitude: lat,
        longitude: lng,
      };
      setTodayStatus(boardedStatus);
      todayStatusRef.current = boardedStatus;

      setStatusFeedbackBanner({
        text: `🟢 Verified Attendance: ${res.message}`,
        type: 'BOARDED',
      });

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([100, 50, 150]);
        } catch (_) {}
      }

      loadStudentInfo();
    } catch (err: any) {
      // Distance > 30m: Reject scan with message "Boarding Failed: You must be near the bus to scan."
      const rawError = err.message || err.error || 'Boarding Failed: You must be near the bus to scan.';
      setScanError(rawError);
      setStatusFeedbackBanner({
        text: `🔴 ${rawError}`,
        type: 'ABSENT',
      });
    }
  };

  // Submit Complaint
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintDesc.trim()) return;

    setComplaintSubmitting(true);
    setComplaintFeedback(null);

    try {
      const res = await Api.submitComplaint(student.student_id, complaintCategory, complaintDesc.trim());
      setComplaints([res.complaint, ...complaints]);
      setComplaintDesc('');
      setShowComplaintForm(false);
      setComplaintFeedback('Complaint submitted successfully. Transport office has been notified.');
    } catch (err: any) {
      setComplaintFeedback(err.message || 'Failed to submit complaint.');
    } finally {
      setComplaintSubmitting(false);
    }
  };

  // Distance calculator (Haversine)
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const distanceToBus =
    studentCoords && busLive?.current_lat && busLive?.current_lng
      ? calculateDistanceKm(studentCoords.lat, studentCoords.lng, busLive.current_lat, busLive.current_lng)
      : null;

  const activeDriverPhone =
    assignedRoute?.driver_phone ||
    assignedDriverPhone(assignedBus?.assigned_driver_id) ||
    '+91 98401 23452';

  // Build map markers
  const mapMarkers: MapMarkerPoint[] = [];

  // 1. Official College Campus Destination
  mapMarkers.push({
    id: COLLEGE_DESTINATION.id,
    lat: COLLEGE_DESTINATION.latitude,
    lng: COLLEGE_DESTINATION.longitude,
    type: 'DESTINATION',
    title: COLLEGE_DESTINATION.name,
    subtitle: COLLEGE_DESTINATION.address,
  });

  if (busLive?.current_lat && busLive?.current_lng) {
    mapMarkers.push({
      id: 'bus-marker',
      lat: busLive.current_lat,
      lng: busLive.current_lng,
      type: 'BUS',
      title: `Bus ${busLive.bus_number}`,
      subtitle: `Status: ${busLive.bus_status} (${busLive.location_source})`,
      accuracy: busLive.gps_accuracy,
      timestamp: busLive.last_gps_update,
      phone: activeDriverPhone,
      phoneLabel: 'Call Bus Driver',
    });
  }

  const officialBoardingLat = studentData?.boarding_lat ?? student.boarding_lat;
  const officialBoardingLng = studentData?.boarding_lng ?? student.boarding_lng;

  // 3. Official Registered Boarding Point (Reference Stop)
  if (officialBoardingLat && officialBoardingLng) {
    mapMarkers.push({
      id: 'official-boarding-point',
      lat: officialBoardingLat,
      lng: officialBoardingLng,
      type: 'BOARDING_POINT',
      title: student.boarding_point || 'Official Boarding Point',
      subtitle: `Registered Boarding Stop for ${student.full_name}`,
    });
  }

  // 4. Student Live / Status Marker (🟡 WAITING at current mobile GPS, 🔴 ABSENT at boarding stop, 🟢 BOARDED)
  const isWaiting = todayStatus?.status === 'WAITING' || todayStatus?.status === 'PLEASE_WAIT';
  const isAbsent = todayStatus?.status === 'NOT_COMING' || todayStatus?.status === 'NOT_RETURNING';
  const isBoarded = todayStatus?.status === 'BOARDED';

  // Per specifications:
  // WAITING: Use student's current mobile GPS
  // ABSENT: Use student's registered boardingLat + boardingLng (do NOT track live GPS)
  // BOARDED: Use student's location
  let studentPinLat: number | null | undefined = null;
  let studentPinLng: number | null | undefined = null;

  if (isWaiting) {
    studentPinLat = studentCoords?.lat ?? officialBoardingLat;
    studentPinLng = studentCoords?.lng ?? officialBoardingLng;
  } else if (isAbsent) {
    studentPinLat = officialBoardingLat;
    studentPinLng = officialBoardingLng;
  } else if (studentCoords?.lat && studentCoords?.lng) {
    studentPinLat = studentCoords.lat;
    studentPinLng = studentCoords.lng;
  } else if (officialBoardingLat && officialBoardingLng) {
    studentPinLat = officialBoardingLat;
    studentPinLng = officialBoardingLng;
  }

  if (studentPinLat && studentPinLng) {
    let studentType: MapMarkerPoint['type'] = 'USER';
    if (isWaiting) {
      studentType = 'STUDENT_WAITING';
    } else if (isAbsent) {
      studentType = 'STUDENT_ABSENT';
    } else if (isBoarded) {
      studentType = 'STUDENT_BOARDED';
    }

    mapMarkers.push({
      id: 'student-marker',
      lat: studentPinLat,
      lng: studentPinLng,
      type: studentType,
      title: `${student.full_name} (${isWaiting && studentCoords ? 'My Live Mobile GPS' : 'Official Boarding Point'})`,
      subtitle: student.boarding_point ? `Stop: ${student.boarding_point} • Status: ${todayStatus?.status || 'Not Set'}` : undefined,
      accuracy: studentCoords?.accuracy,
    });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Welcome & Identity Card */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 to-indigo-900 p-6 text-white shadow-xl shadow-purple-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-purple-600/60 px-2.5 py-0.5 text-[11px] font-bold tracking-wider uppercase border border-purple-400/30">
                Student Transport Portal
              </span>
              <span className="text-purple-300 text-xs font-mono">&bull; {student.student_id}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{student.full_name}</h2>
            <p className="text-xs sm:text-sm text-purple-200">
              {student.department || 'Department: Engineering'} &bull; {student.year || '3rd Year'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowHistoryModal(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 active:scale-95 px-3.5 py-2 text-xs font-bold text-white shadow-md border border-purple-400/40 transition cursor-pointer"
            >
              <History className="h-4 w-4 text-purple-200" />
              <span>Boarding History</span>
              {boardingRecords.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-400 text-slate-950 px-1.5 py-0.2 text-[10px] font-black">
                  {boardingRecords.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowIdQr(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold backdrop-blur-xs border border-white/20 transition cursor-pointer"
            >
              <QrCode className="h-4 w-4" />
              <span>My ID QR</span>
            </button>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center space-x-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition cursor-pointer"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Scan Bus Boarding QR</span>
            </button>
          </div>
        </div>

        {/* Transport Assignment Highlights */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-purple-700/60 text-xs">
          <div className="rounded-xl bg-purple-900/50 p-2.5 border border-purple-700/50">
            <span className="text-purple-300 block text-[10px] font-semibold uppercase">Assigned Bus</span>
            <span className="font-bold text-sm text-white">{student.bus_number || student.bus_id || 'TN 22 CZ 4102'}</span>
          </div>

          <div className="rounded-xl bg-purple-900/50 p-2.5 border border-purple-700/50">
            <span className="text-purple-300 block text-[10px] font-semibold uppercase">Route</span>
            <span className="font-bold text-sm text-white truncate block">
              {assignedRoute?.route_name || assignedBus?.route_name || 'Avadi to Campus'}
            </span>
          </div>

          <div className="rounded-xl bg-purple-900/50 p-2.5 border border-purple-700/50">
            <span className="text-purple-300 block text-[10px] font-semibold uppercase">Boarding Stop</span>
            <span className="font-bold text-sm text-white truncate block">
              {student.boarding_point || 'Avadi'}
            </span>
          </div>

          <div className="rounded-xl bg-purple-900/50 p-2.5 border border-purple-700/50">
            <span className="text-purple-300 block text-[10px] font-semibold uppercase">Bus Status</span>
            <span className="font-bold text-sm text-white flex items-center space-x-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  busLive?.bus_status === 'ON_TRIP'
                    ? 'bg-emerald-400 animate-ping'
                    : busLive?.bus_status === 'BREAKDOWN'
                    ? 'bg-rose-500'
                    : 'bg-amber-400'
                }`}
              />
              <span>{busLive?.bus_status || assignedBus?.bus_status || 'IDLE'}</span>
            </span>
          </div>
        </div>

        {/* Destination Info */}
        <div className="mt-4 pt-3 border-t border-purple-700/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              Campus Destination
            </span>
            <span className="font-bold text-white">{COLLEGE_DESTINATION.name}</span>
          </div>
          <span className="text-purple-200 text-[11px]">{COLLEGE_DESTINATION.address}</span>
        </div>
      </div>

      {/* FEATURE 2: Automated Bus Arrival Push Alert (Geofence <= 500m) */}
      {busArrivalAlert && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 p-4 sm:p-5 shadow-2xl border-2 border-amber-300 ring-4 ring-amber-300/40 flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center space-x-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-amber-300 shadow-xl border border-amber-400">
              <Bus className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-amber-300">
                  AUTOMATED GEOFENCE ARRIVAL ALERT
                </span>
                <span className="text-[11px] font-extrabold text-slate-950">
                  ~2-3 minutes away
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-950 mt-1">
                {busArrivalAlert.message}
              </h4>
            </div>
          </div>
          <button
            onClick={() => setBusArrivalAlert(null)}
            className="rounded-full p-2 text-slate-950 hover:bg-amber-300 transition cursor-pointer"
            title="Dismiss alert"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Real-time Status Feedback Banner */}
      {statusFeedbackBanner && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold shadow-md border flex items-center justify-between transition-all ${
            statusFeedbackBanner.type === 'WAITING'
              ? 'bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-300'
              : statusFeedbackBanner.type === 'ABSENT'
              ? 'bg-rose-50 text-rose-900 border-rose-300 ring-2 ring-rose-300'
              : statusFeedbackBanner.type === 'BOARDED'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-300'
              : 'bg-purple-50 text-purple-900 border-purple-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Radio className="h-4 w-4 shrink-0 text-purple-700 animate-pulse" />
            <span>{statusFeedbackBanner.text}</span>
          </div>
          <button
            onClick={() => setStatusFeedbackBanner(null)}
            className="p-1 rounded-lg hover:bg-black/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* GPS Warning if Denied */}
      {gpsError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 flex items-start justify-between space-x-3">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">GPS Access Notice</p>
              <p className="mt-0.5 text-amber-800">{gpsError}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleCalibrateToStop}
              className="rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 px-3 py-1 font-bold text-xs transition cursor-pointer"
            >
              Use Stop GPS
            </button>
            <button
              onClick={startStudentGps}
              className="rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1 font-semibold text-xs transition cursor-pointer"
            >
              Retry GPS
            </button>
          </div>
        </div>
      )}

      {/* Verification / Attendance Success Banner */}
      {attendanceSuccess && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-900 flex items-center space-x-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-emerald-900">✅ Boarding Verified Successfully</h4>
            <p className="text-emerald-800 mt-0.5">
              Your attendance has been securely recorded on the bus log. Your transport status is now BOARDED.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Status & Live Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: GPS Sharing & Transport Status */}
        <div className="space-y-6">
          {/* Official Boarding Point Card (Read-only set by Transport Admin) */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-purple-700" />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Official Boarding Stop
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center space-x-1">
                <span>🔒 Set by Admin</span>
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-extrabold text-slate-900">
                {studentData?.boarding_point || 'Boarding stop designated by Transport Admin'}
              </div>
              {typeof (studentData?.boarding_lat ?? student.boarding_lat) === 'number' &&
              typeof (studentData?.boarding_lng ?? student.boarding_lng) === 'number' ? (
                <div className="text-[11px] font-mono text-purple-700 font-semibold flex items-center space-x-1 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                  <MapPin className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span>
                    GPS: {(studentData?.boarding_lat ?? student.boarding_lat)?.toFixed(5)},{' '}
                    {(studentData?.boarding_lng ?? student.boarding_lng)?.toFixed(5)}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">
                  Awaiting transport administration boarding coordinate mapping.
                </p>
              )}
              <p className="text-[10.5px] text-slate-500 pt-1 leading-relaxed">
                This is your official pickup point registered by the college transport department. Students cannot alter this official boarding location.
              </p>
            </div>
          </div>

          {/* Student GPS Location Sharing Card */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center space-x-2">
                <Radio className={`h-4 w-4 ${isWatchingGps ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Student Live GPS Location
                </h4>
              </div>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                  isWatchingGps
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {isWatchingGps ? 'Active' : 'Standby'}
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              When enabled, your live coordinates are broadcast directly to your bus driver so they can locate you at your boarding stop.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={toggleStudentGps}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition cursor-pointer border ${
                  isWatchingGps
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-sm'
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>{isWatchingGps ? 'GPS Enabled (ON)' : 'Turn On My GPS'}</span>
              </button>

              <button
                type="button"
                onClick={handleCalibrateToStop}
                title="Use official registered boarding stop coordinates"
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 flex items-center justify-center space-x-1 transition cursor-pointer"
              >
                <MapPin className="h-3.5 w-3.5 text-purple-600" />
                <span>Use Stop GPS</span>
              </button>
            </div>

            {/* Coordinates Pill */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px]">
              <span className="text-slate-600 font-mono">
                {studentCoords
                  ? `Live GPS: ${studentCoords.lat.toFixed(5)}, ${studentCoords.lng.toFixed(5)}`
                  : 'Mobile GPS not acquired yet. Tap "Turn On My GPS".'}
              </span>
            </div>
          </div>

          {/* Today's Transport Status Card */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Today&apos;s Transport Status</h3>
                <p className="text-xs text-slate-500">Communicate your boarding intent to the driver</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEveningMode(!isEveningMode)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                  isEveningMode
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {isEveningMode ? 'Evening Return' : 'Morning Trip'}
              </button>
            </div>

            {/* Current Active Status Indicator */}
            <div className="mb-4 p-3 rounded-2xl bg-purple-50/70 border border-purple-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Current Status:</span>
              <span
                className={`font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider ${
                  todayStatus?.status === 'BOARDED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : todayStatus?.status === 'WAITING' || todayStatus?.status === 'PLEASE_WAIT'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-200'
                    : todayStatus?.status === 'NOT_COMING' || todayStatus?.status === 'NOT_RETURNING'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300 ring-2 ring-rose-200'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {todayStatus?.status ? todayStatus.status.replace('_', ' ') : 'Not Selected Yet'}
              </span>
            </div>

            {/* Status Selection Buttons */}
            {!isEveningMode ? (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleStatusChange('WAITING')}
                  disabled={isUpdatingStatus || todayStatus?.status === 'BOARDED'}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                    todayStatus?.status === 'WAITING'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 text-lg">
                      🟡
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Waiting at Bus Stop</div>
                      <div className="text-[11px] text-slate-500">Streams live GPS pin to driver map</div>
                    </div>
                  </div>
                  {todayStatus?.status === 'WAITING' && <CheckCircle2 className="h-4 w-4 text-amber-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange('NOT_COMING')}
                  disabled={isUpdatingStatus || todayStatus?.status === 'BOARDED'}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                    todayStatus?.status === 'NOT_COMING'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/30'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 text-lg">
                      🔴
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Not Coming / Absent</div>
                      <div className="text-[11px] text-slate-500">Tells driver to skip your stop</div>
                    </div>
                  </div>
                  {todayStatus?.status === 'NOT_COMING' && <CheckCircle2 className="h-4 w-4 text-rose-600" />}
                </button>
              </div>
            ) : (
              /* Evening Status */
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => handleStatusChange('PLEASE_WAIT')}
                  disabled={isUpdatingStatus || todayStatus?.status === 'BOARDED'}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                    todayStatus?.status === 'PLEASE_WAIT'
                      ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 text-lg">
                      🟡
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Please Wait (Coming to Bus)</div>
                      <div className="text-[11px] text-slate-500">Streams live GPS pin to driver map</div>
                    </div>
                  </div>
                  {todayStatus?.status === 'PLEASE_WAIT' && <CheckCircle2 className="h-4 w-4 text-amber-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange('NOT_RETURNING')}
                  disabled={isUpdatingStatus || todayStatus?.status === 'BOARDED'}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer ${
                    todayStatus?.status === 'NOT_RETURNING'
                      ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-rose-300 hover:bg-rose-50/30'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 text-lg">
                      🔴
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Not Returning by Bus</div>
                      <div className="text-[11px] text-slate-500">Tells driver to skip your stop</div>
                    </div>
                  </div>
                  {todayStatus?.status === 'NOT_RETURNING' && <CheckCircle2 className="h-4 w-4 text-rose-600" />}
                </button>
              </div>
            )}

            {/* Boarded Rule Notice */}
            <p className="mt-4 text-[11px] text-slate-400 leading-tight">
              <strong>Attendance Rule:</strong> 🟢 &quot;Boarded&quot; status is securely registered when you scan the dynamic QR on the driver&apos;s phone.
            </p>
          </div>

          {/* Bus Distance & Driver Contact Card */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Live Bus Telemetry</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Distance from Bus:</span>
                <span className="font-black text-purple-900">
                  {distanceToBus !== null
                    ? distanceToBus < 1
                      ? `${(distanceToBus * 1000).toFixed(0)} meters away`
                      : `${distanceToBus.toFixed(2)} km away`
                    : 'Calculating live distance...'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-500">Driver Mobile GPS:</span>
                <span className="font-semibold text-slate-800">
                  {busLive?.current_lat ? `${busLive.current_lat.toFixed(4)}, ${busLive.current_lng?.toFixed(4)}` : 'Offline / Idle'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/70 border border-purple-100">
                <div>
                  <span className="text-slate-500 block text-[11px]">Driver Mobile Contact:</span>
                  <span className="font-bold text-purple-900 text-xs font-mono">
                    {activeDriverPhone}
                  </span>
                </div>
                <a
                  href={`tel:${activeDriverPhone}`}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  title={`Direct phone call to driver ${activeDriverPhone}`}
                >
                  <Phone className="h-3 w-3" />
                  <span>Call Driver</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Bus Map & Live Tracking */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                  <span>Live Bus Map</span>
                  {busLive?.bus_status === 'ON_TRIP' && (
                    <span className="flex items-center space-x-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
                      <span>GPS STREAM LIVE</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500">
                  Real mobile phone GPS broadcast from Driver &bull; Track bus progress towards your stop
                </p>
              </div>

              <button
                type="button"
                onClick={() => refreshBusLive()}
                className="inline-flex items-center space-x-1.5 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl font-semibold border border-purple-200 transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh Map</span>
              </button>
            </div>

            {/* College Campus Destination Marker Indicator */}
            <div className="mb-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-900 text-amber-300 text-sm font-bold shrink-0 shadow-sm">
                  🏛️
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-indigo-950 text-xs">Official Destination:</span>
                    <span className="font-bold text-indigo-900">{COLLEGE_DESTINATION.name}</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">{COLLEGE_DESTINATION.address}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-md font-bold self-start sm:self-center">
                13.1474° N, 80.0591° E
              </span>
            </div>

            {/* Map Component - Simple Google Maps View */}
            <MapViewer
              viewMode="STUDENT"
              markers={mapMarkers}
              centerLat={busLive?.current_lat || studentCoords?.lat || officialBoardingLat || COLLEGE_DESTINATION.latitude}
              centerLng={busLive?.current_lng || studentCoords?.lng || officialBoardingLng || COLLEGE_DESTINATION.longitude}
              heightClass="h-[360px] sm:h-[440px] lg:h-[480px]"
              emptyStateMessage="The assigned driver has not started their trip yet. Live GPS stream will activate as soon as the driver presses START TRIP on their mobile phone."
            />
          </div>

          {/* FEATURE: Past Boarding History (Stored in Cloud Firestore) */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                    <History className="h-4 w-4" />
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">Past Boarding History</h3>
                  {isFirestoreLive ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <Cloud className="h-3 w-3" />
                      <span>Firestore Live</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      <Cloud className="h-3 w-3" />
                      <span>Firestore Synced</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified trip attendance passes with exact timestamps and bus routes stored in Cloud Firestore
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-3.5 py-1.5 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <History className="h-3.5 w-3.5 text-purple-600" />
                  <span>View All Passes ({boardingRecords.length})</span>
                </button>
              </div>
            </div>

            {/* Passes Content */}
            {isLoadingHistory ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <Cloud className="h-6 w-6 mx-auto animate-bounce text-purple-500" />
                <p>Retrieving boarding history from Cloud Firestore...</p>
              </div>
            ) : boardingRecords.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-2">
                <Bus className="h-8 w-8 mx-auto text-slate-400" />
                <p className="text-xs font-bold text-slate-700">No boarding records found in Firestore yet</p>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  When you scan the dynamic QR code inside your college bus, your verified digital boarding pass will be saved to Firestore and appear here automatically.
                </p>
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="mt-2 inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Scan Bus Boarding QR</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {boardingRecords.slice(0, 3).map((rec, index) => {
                  const isRecent = index === 0;
                  return (
                    <div
                      key={rec.attendance_id || index}
                      className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        isRecent
                          ? 'border-purple-200 bg-purple-50/40 hover:bg-purple-50/60'
                          : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                            isRecent ? 'bg-purple-700 text-white' : 'bg-slate-900 text-white'
                          }`}
                        >
                          <Bus className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-slate-900 text-sm">Bus {rec.bus_number}</span>
                            <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9.5px] font-bold">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{rec.verification_status}</span>
                            </span>
                            {isRecent && (
                              <span className="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[9px] font-bold">
                                Latest
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-600 mt-0.5 text-[11px]">
                            <span className="font-semibold text-purple-900 flex items-center space-x-1">
                              <Navigation className="h-3 w-3 text-purple-600" />
                              <span>{rec.route_name || 'Campus Route'}</span>
                            </span>
                            {rec.boarding_point && (
                              <span className="text-slate-500">&bull; Stop: {rec.boarding_point}</span>
                            )}
                            {rec.distance_meters !== undefined && rec.distance_meters !== null && (
                              <span className="text-emerald-700 font-medium">
                                &bull; Proximity: {rec.distance_meters}m
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-start sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 shrink-0">
                        <div className="flex items-center space-x-1 text-slate-800 font-bold text-xs">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {new Date(rec.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-purple-700 font-semibold text-[11px]">
                          <Clock className="h-3 w-3 text-purple-400" />
                          <span>
                            {new Date(rec.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {boardingRecords.length > 3 && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                    >
                      + View {boardingRecords.length - 3} more past boarding passes &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Complaints & Feedback Section */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Transport Complaints &amp; Service Feedback</h3>
                <p className="text-xs text-slate-500">Submit official transport feedback to college administration</p>
              </div>
              <button
                type="button"
                onClick={() => setShowComplaintForm(!showComplaintForm)}
                className="rounded-xl bg-purple-700 hover:bg-purple-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                {showComplaintForm ? 'Close Form' : '+ New Complaint'}
              </button>
            </div>

            {complaintFeedback && (
              <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                {complaintFeedback}
              </div>
            )}

            {/* Complaint Submission Form */}
            {showComplaintForm && (
              <form onSubmit={handleSubmitComplaint} className="mb-6 p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Complaint Category</label>
                    <select
                      value={complaintCategory}
                      onChange={(e) => setComplaintCategory(e.target.value as ComplaintCategory)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                    >
                      <option value="Cleanliness">Cleanliness</option>
                      <option value="Seat Availability">Seat Availability</option>
                      <option value="Speeding">Speeding</option>
                      <option value="Driver Behaviour">Driver Behaviour</option>
                      <option value="Bus Condition">Bus Condition</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Bus</label>
                    <input
                      type="text"
                      disabled
                      value={student.bus_number || student.bus_id || 'TN 22 CZ 4102'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs bg-slate-100 text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide clear details regarding the issue (time, location, specific observation)..."
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowComplaintForm(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={complaintSubmitting || !complaintDesc.trim()}
                    className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer"
                  >
                    {complaintSubmitting ? 'Submitting...' : 'Submit Complaint'}
                  </button>
                </div>
              </form>
            )}

            {/* Complaints List */}
            <div className="space-y-2.5">
              {complaints.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400">
                  You have not submitted any transport complaints.
                </p>
              ) : (
                complaints.map((c) => (
                  <div key={c.complaint_id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900">{c.category}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({c.complaint_id})</span>
                      </div>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">{c.description}</p>
                      {c.admin_remarks && (
                        <p className="text-[11px] text-purple-800 bg-purple-50 px-2 py-1 rounded-lg mt-1 border border-purple-100">
                          <strong>Admin Response:</strong> {c.admin_remarks}
                        </p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-1">
                        {new Date(c.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Camera QR Scanner Modal for Dynamic Bus Boarding QR */}
      <QRScannerModal
        isOpen={showScanner}
        onClose={() => {
          setShowScanner(false);
          setScanError(null);
        }}
        title="Scan Bus Boarding QR"
        instructionText="Scan the dynamic QR code displayed on the driver's mobile phone to record your verified attendance."
        onScanSuccess={(decodedText) => handleScanAttendance(decodedText)}
      />

      {/* Student Personal QR Identity Modal */}
      <QRModal
        isOpen={showIdQr}
        onClose={() => setShowIdQr(false)}
        title="Student Pre-Registered QR"
        subtitle={`${student.full_name} (${student.student_id})`}
        token={student.qr_identity}
      />

      {/* Student Past Boarding History Modal (Cloud Firestore) */}
      <StudentBoardingHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        studentId={student.student_id}
        studentName={student.full_name}
        records={boardingRecords}
        isLoading={isLoadingHistory}
        isFirestoreLive={isFirestoreLive}
        onOpenScanner={() => setShowScanner(true)}
      />
    </div>
  );
};

function assignedDriverPhone(driverId: string | null | undefined): string | null {
  if (driverId === 'DRV-01') return '+91 98401 23451';
  if (driverId === 'DRV-02') return '+91 98401 23452';
  if (driverId === 'DRV-03') return '+91 98401 23453';
  if (driverId === 'DRV-04') return '+91 98401 23454';
  if (driverId === 'DRV-05') return '+91 98401 23455';
  if (driverId === 'DRV-06') return '+91 98401 23456';
  if (driverId === 'DRV-07') return '+91 98401 23457';
  return null;
}
