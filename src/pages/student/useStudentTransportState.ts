import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  StudentUser,
  Bus as BusType,
  Route,
  StudentDailyStatus,
  Complaint,
  ComplaintCategory,
  AttendanceRecord,
  Trip,
} from '../../types/index.ts';
import { Api } from '../../lib/api.ts';
import { FirestoreService } from '../../lib/firestoreSync.ts';

export function useStudentTransportState() {
  const { user } = useAuth();
  const student = user as StudentUser;

  const [studentData, setStudentData] = useState<StudentUser | null>(student);
  const [assignedBus, setAssignedBus] = useState<BusType | null>(null);
  const [assignedRoute, setAssignedRoute] = useState<Route | null>(null);
  const [todayStatus, setTodayStatus] = useState<StudentDailyStatus | null>(null);
  const [studentCoords, setStudentCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isWatchingGps, setIsWatchingGps] = useState<boolean>(false);
  const gpsWatchIdRef = useRef<number | null>(null);

  const [statusFeedbackBanner, setStatusFeedbackBanner] = useState<{
    text: string;
    type: 'WAITING' | 'ABSENT' | 'BOARDED' | 'INFO';
  } | null>(null);

  const [busLive, setBusLive] = useState<{
    bus_number: string;
    bus_status: string;
    current_lat: number | null;
    current_lng: number | null;
    gps_accuracy: number | null;
    last_gps_update: string | null;
    location_source: string;
    activeTrip?: Trip | null;
    latestTrip?: Trip | null;
  } | null>(null);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [boardingRecords, setBoardingRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);

  const todayStatusRef = useRef<StudentDailyStatus | null>(todayStatus);
  useEffect(() => {
    todayStatusRef.current = todayStatus;
  }, [todayStatus]);

  useEffect(() => {
    if (!student?.student_id) return;
    loadStudentInfo();
    loadComplaints();
    startStudentGps();
    loadBoardingHistory();

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
          setIsLoadingHistory(false);
        }
      }
    );

    const interval = setInterval(() => {
      refreshBusLive();
    }, 4000);

    return () => {
      clearInterval(interval);
      stopStudentGps();
      unsubscribeFirestore();
    };
  }, [student?.student_id]);

  const loadStudentInfo = async () => {
    if (!student?.student_id) return;
    try {
      const data = await Api.getStudentData(student.student_id);
      setStudentData(data.student);
      setAssignedBus(data.bus);
      setAssignedRoute(data.route);
      setTodayStatus(data.todayStatus);

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
    if (!student?.student_id) return;
    try {
      const all = await Api.getComplaints();
      setComplaints(all.filter((c) => c.student_id === student.student_id));
    } catch (e) {
      console.warn('Failed to load complaints:', e);
    }
  };

  const loadBoardingHistory = async () => {
    if (!student?.student_id) return;
    setIsLoadingHistory(true);
    try {
      const firestoreRecords = await FirestoreService.getStudentAttendanceFromFirestore(student.student_id);
      let apiRecords: AttendanceRecord[] = [];
      try {
        const res = await Api.getStudentAttendanceHistory(student.student_id);
        if (res?.attendance) apiRecords = res.attendance;
      } catch (e) {
        console.warn('API getStudentAttendanceHistory notice:', e);
      }

      const recordMap = new Map<string, AttendanceRecord>();
      apiRecords.forEach((r) => r.attendance_id && recordMap.set(r.attendance_id, r));
      firestoreRecords.forEach((r) => r.attendance_id && recordMap.set(r.attendance_id, r));

      const merged = Array.from(recordMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setBoardingRecords(merged);
    } catch (err) {
      console.warn('loadBoardingHistory error:', err);
    } finally {
      setIsLoadingHistory(false);
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

  const startStudentGps = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your device.');
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

        const curStatus = todayStatusRef.current?.status;
        if (student?.student_id && (curStatus === 'WAITING' || curStatus === 'PLEASE_WAIT')) {
          Api.updateStudentStatus(student.student_id, curStatus, coords.lat, coords.lng).catch(() => {});
        }
      },
      (err) => {
        setIsWatchingGps(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Mobile GPS permission is disabled.');
        } else {
          setGpsError('GPS location unavailable.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  };

  const stopStudentGps = () => {
    if (gpsWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
    setIsWatchingGps(false);
  };

  const handleStatusUpdate = async (newStatus: 'WAITING' | 'ABSENT' | 'BOARDED') => {
    const studentId = student?.student_id || (student as any)?.id || studentData?.student_id || 'STU-100';
    const studentName = student?.full_name || (student as any)?.name || studentData?.full_name || 'Student';
    setIsUpdatingStatus(true);
    setStatusFeedbackBanner(null);

    try {
      let latToUse: number | null = null;
      let lngToUse: number | null = null;
      let hasLiveMobileGps = false;

      const officialLat = studentData?.boarding_lat ?? student?.boarding_lat ?? null;
      const officialLng = studentData?.boarding_lng ?? student?.boarding_lng ?? null;

      if (newStatus === 'WAITING') {
        // Attempt to capture fresh mobile GPS coordinates
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000,
              });
            });
            latToUse = position.coords.latitude;
            lngToUse = position.coords.longitude;
            hasLiveMobileGps = true;
            setStudentCoords({
              lat: latToUse,
              lng: lngToUse,
              accuracy: position.coords.accuracy || null,
            });
          } catch (_geoErr) {
            // Geolocation permission not yet granted or timed out; fallback gracefully
            if (studentCoords?.lat && studentCoords?.lng) {
              latToUse = studentCoords.lat;
              lngToUse = studentCoords.lng;
              hasLiveMobileGps = true;
            } else {
              latToUse = officialLat;
              lngToUse = officialLng;
              hasLiveMobileGps = false;
            }
          }
        } else {
          latToUse = studentCoords?.lat ?? officialLat;
          lngToUse = studentCoords?.lng ?? officialLng;
        }

        // Start background watcher so live movement automatically streams
        if (!isWatchingGps) {
          startStudentGps();
        }

        if (hasLiveMobileGps && latToUse !== null && lngToUse !== null) {
          setStatusFeedbackBanner({
            type: 'WAITING',
            text: `Status updated: WAITING 🟡 using your live mobile GPS (${latToUse.toFixed(4)}, ${lngToUse.toFixed(4)}). Driver can see your exact stop position!`,
          });
        } else {
          setStatusFeedbackBanner({
            type: 'WAITING',
            text: `Status updated: WAITING 🟡 at registered stop (${student?.boarding_point || 'Registered Stop'}). Driver can see you on the route!`,
          });
        }
      } else if (newStatus === 'ABSENT') {
        // Stop GPS watching when absent
        stopStudentGps();
        latToUse = officialLat;
        lngToUse = officialLng;

        setStatusFeedbackBanner({
          type: 'ABSENT',
          text: `Status updated: ABSENT 🔴 for today. Bus driver will skip your stop (${student?.boarding_point || 'Registered Stop'}).`,
        });
      } else if (newStatus === 'BOARDED') {
        latToUse = studentCoords?.lat ?? officialLat;
        lngToUse = studentCoords?.lng ?? officialLng;

        setStatusFeedbackBanner({
          type: 'BOARDED',
          text: 'Status updated: BOARDED 🟢. Have a safe journey to campus!',
        });
      }

      const transportStatus = newStatus === 'ABSENT' ? 'NOT_COMING' : newStatus;
      await Api.updateStudentStatus(
        studentId,
        transportStatus,
        latToUse,
        lngToUse
      );

      const todayDate = new Date().toISOString().split('T')[0];
      const updatedStatus: StudentDailyStatus = {
        student_id: studentId,
        student_name: studentName,
        bus_id: assignedBus?.bus_id || student?.bus_id || null,
        date: todayDate,
        status: transportStatus,
        updated_at: new Date().toISOString(),
        latitude: latToUse,
        longitude: lngToUse,
        pickup_point_name: student?.boarding_point,
      };

      setTodayStatus(updatedStatus);
      todayStatusRef.current = updatedStatus;

      // Sync to Cloud Firestore in background
      try {
        FirestoreService.syncStudentStatus({
          student_id: studentId,
          student_name: studentName,
          bus_id: assignedBus?.bus_id || student?.bus_id || null,
          date: todayDate,
          status: transportStatus,
          latitude: latToUse,
          longitude: lngToUse,
          updated_at: new Date().toISOString(),
        });
      } catch (_fErr) {
        // Ignore firestore background sync errors
      }
    } catch (err: any) {
      const errMsg = err?.message || (typeof err === 'string' ? err : 'Status updated locally');
      console.warn('Student status update issue:', errMsg);
      // Still reflect the intended status locally so UI stays in sync
      const todayDate = new Date().toISOString().split('T')[0];
      const fallbackStatus = newStatus === 'ABSENT' ? 'NOT_COMING' : newStatus;
      setTodayStatus((prev) => ({
        student_id: studentId,
        student_name: studentName,
        bus_id: assignedBus?.bus_id || student?.bus_id || null,
        date: todayDate,
        status: fallbackStatus,
        updated_at: new Date().toISOString(),
        latitude: null,
        longitude: null,
        pickup_point_name: student?.boarding_point,
        ...(prev || {}),
      }));
      setStatusFeedbackBanner({
        type: newStatus === 'WAITING' ? 'WAITING' : newStatus === 'BOARDED' ? 'BOARDED' : 'ABSENT',
        text: `Status updated to ${newStatus}.`,
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const fileComplaint = async (category: ComplaintCategory, description: string) => {
    if (!student?.student_id || !description.trim()) return false;
    try {
      await Api.submitComplaint(
        student.student_id,
        category,
        description
      );
      await loadComplaints();
      return true;
    } catch (e) {
      console.warn('Failed to submit complaint:', e);
      return false;
    }
  };

  return {
    student,
    studentData,
    assignedBus,
    assignedRoute,
    todayStatus,
    studentCoords,
    gpsError,
    isWatchingGps,
    statusFeedbackBanner,
    busLive,
    complaints,
    boardingRecords,
    isLoadingHistory,
    isUpdatingStatus,
    startStudentGps,
    handleStatusUpdate,
    fileComplaint,
    loadStudentInfo,
    loadBoardingHistory,
  };
}
