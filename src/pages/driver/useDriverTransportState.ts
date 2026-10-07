import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  DriverUser,
  Bus as BusType,
  Trip,
  StudentUser,
  Route,
  OperationalBoardingPoint,
  OperationalRouteWaypoint,
} from '../../types/index.ts';
import { Api } from '../../lib/api.ts';
import { FirestoreService } from '../../lib/firestoreSync.ts';

export interface DriverStudentRow extends StudentUser {
  today_status: string;
  status_updated_at: string | null;
  student_lat: number | null;
  student_lng: number | null;
  has_live_gps?: boolean;
}

export function useDriverTransportState() {
  const { user } = useAuth();
  const driver = user as DriverUser;

  const [driverData, setDriverData] = useState<DriverUser | null>(driver);
  const [assignedBus, setAssignedBus] = useState<BusType | null>(null);
  const [assignedRoute, setAssignedRoute] = useState<Route | null>(null);
  const [operationalBoardingPoints, setOperationalBoardingPoints] = useState<OperationalBoardingPoint[]>([]);
  const [routeWaypoints, setRouteWaypoints] = useState<OperationalRouteWaypoint[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  // Driver device GPS state (driver's mobile = Bus live GPS)
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    timestamp: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Students on this assigned bus strictly filtered
  const [students, setStudents] = useState<DriverStudentRow[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [isStartingTrip, setIsStartingTrip] = useState<boolean>(false);
  const [isEndingTrip, setIsEndingTrip] = useState<boolean>(false);

  useEffect(() => {
    if (!driver?.driver_id) return;
    loadDriverData();

    // High-frequency 2-second polling for real-time synchronization
    const interval = setInterval(() => {
      refreshLiveStatuses();
    }, 2000);

    // Instant real-time listener via Firestore
    const unsubscribeFirestore = FirestoreService.subscribeCollection<any>(
      'studentStatuses',
      (items) => {
        if (!items || items.length === 0) return;
        const targetBusId = assignedBus?.bus_id || driver.assigned_bus_id;
        const hasRelevantUpdate = items.some(
          (item) => item.bus_id === targetBusId || !targetBusId
        );
        if (hasRelevantUpdate) {
          refreshLiveStatuses();
        }
      }
    );

    return () => {
      clearInterval(interval);
      stopGpsTracking();
      unsubscribeFirestore();
    };
  }, [driver?.driver_id, assignedBus?.bus_id]);

  const loadDriverData = async () => {
    if (!driver?.driver_id) return;
    try {
      const data = await Api.getDriverData(driver.driver_id);
      setDriverData(data.driver);
      setAssignedBus(data.bus);
      setAssignedRoute(data.route);
      setActiveTrip(data.activeTrip);
      setStudents((data.students as DriverStudentRow[]) || []);
      setOperationalBoardingPoints(data.boarding_points || []);
      setRouteWaypoints(data.route_waypoints || []);

      const targetBusId = data.bus?.bus_id || driver.assigned_bus_id;
      if (data.activeTrip && !isGpsActive && targetBusId) {
        startGpsTracking(targetBusId);
      }
    } catch (e) {
      console.warn('Failed to load driver operational data:', e);
    }
  };

  const refreshLiveStatuses = async () => {
    if (!driver?.driver_id) return;
    try {
      const data = await Api.getDriverData(driver.driver_id);
      if (data?.students) {
        setStudents((data.students as DriverStudentRow[]) || []);
      }
      if (data?.boarding_points) {
        setOperationalBoardingPoints(data.boarding_points);
      }
      if (data?.route_waypoints) {
        setRouteWaypoints(data.route_waypoints);
      }
      if (data?.activeTrip !== undefined) {
        setActiveTrip(data.activeTrip);
      }
      const freshBus = data?.bus;
      if (freshBus) {
        setAssignedBus((prev) => ({
          ...(prev || {}),
          ...freshBus,
          current_lat: freshBus.current_lat ?? prev?.current_lat,
          current_lng: freshBus.current_lng ?? prev?.current_lng,
        } as BusType));
      }
    } catch (e) {
      console.warn('Failed to refresh operational status for driver:', e);
    }
  };

  const startGpsTracking = (busId?: string) => {
    const targetBusId = busId || assignedBus?.bus_id || driver.assigned_bus_id;
    if (!targetBusId || !driver?.driver_id) return;

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported on this device.');
      return;
    }

    setGpsError(null);
    setIsGpsActive(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || null,
          timestamp: pos.timestamp,
        };
        setCurrentCoords(coords);
        setGpsError(null);

        // Stream Driver mobile GPS as the Live Bus GPS
        Api.updateDriverLocation(
          driver.driver_id,
          targetBusId,
          coords.lat,
          coords.lng,
          coords.accuracy
        ).catch(() => {});
      },
      (err) => {
        setIsGpsActive(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('Mobile GPS permission was denied.');
        } else {
          setGpsError('Could not acquire GPS location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 2000,
      }
    );
  };

  const stopGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsActive(false);
  };

  const handleStartTrip = async () => {
    const targetBusId = assignedBus?.bus_id || driver.assigned_bus_id;
    if (!targetBusId || !driver?.driver_id) return;

    setIsStartingTrip(true);
    try {
      const res = await Api.startTrip(driver.driver_id, targetBusId);
      if (res?.trip) {
        setActiveTrip(res.trip);
        startGpsTracking(targetBusId);
      }
      if (assignedBus) {
        setAssignedBus({ ...assignedBus, bus_status: 'ON_TRIP' });
      }
      await loadDriverData();
    } catch (e: any) {
      console.warn(`Could not start trip: ${e.message}`);
    } finally {
      setIsStartingTrip(false);
    }
  };

  const handleEndTrip = async () => {
    const targetBusId = assignedBus?.bus_id || driver.assigned_bus_id;
    if (!driver?.driver_id || !targetBusId) return;

    setIsEndingTrip(true);
    try {
      await Api.endTrip(driver.driver_id, targetBusId);
      if (activeTrip) {
        setCompletedTrips((prev) => [
          {
            ...activeTrip,
            status: 'COMPLETED',
            end_time: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
      setActiveTrip(null);
      stopGpsTracking();
      if (assignedBus) {
        setAssignedBus({ ...assignedBus, bus_status: 'IDLE' });
      }
      await loadDriverData();
    } catch (e: any) {
      console.warn(`Could not end trip: ${e.message}`);
    } finally {
      setIsEndingTrip(false);
    }
  };

  const handleMarkBoarded = async (studentId: string) => {
    const targetBusId = assignedBus?.bus_id || driver.assigned_bus_id;
    if (!driver?.driver_id || !targetBusId) return;
    try {
      await Api.markStudentBoarded(driver.driver_id, targetBusId, studentId);
      setStudents((prev) =>
        prev.map((s) => (s.student_id === studentId ? { ...s, today_status: 'BOARDED' } : s))
      );
      await refreshLiveStatuses();
    } catch (e: any) {
      console.warn('Failed to mark student boarded:', e);
    }
  };

  // Real-Time Student Counts
  const waitingCount = students.filter(
    (s) => s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT'
  ).length;
  const boardedCount = students.filter((s) => s.today_status === 'BOARDED').length;
  const absentCount = students.filter(
    (s) => s.today_status === 'ABSENT' || s.today_status === 'NOT_COMING'
  ).length;
  const notSetCount = students.filter(
    (s) => !s.today_status || s.today_status === 'NOT_SET'
  ).length;

  return {
    driver,
    driverData,
    assignedBus,
    assignedRoute,
    operationalBoardingPoints,
    routeWaypoints,
    activeTrip,
    currentCoords,
    gpsError,
    isGpsActive,
    students,
    completedTrips,
    isStartingTrip,
    isEndingTrip,
    waitingCount,
    boardedCount,
    absentCount,
    notSetCount,
    handleStartTrip,
    handleEndTrip,
    handleMarkBoarded,
    startGpsTracking,
    stopGpsTracking,
    loadDriverData,
    refreshLiveStatuses,
  };
}
