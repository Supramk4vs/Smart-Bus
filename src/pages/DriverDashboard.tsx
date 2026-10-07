import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus as BusIcon,
  Play,
  Square,
  Radio,
  QrCode,
  AlertTriangle,
  Users,
  MapPin,
  RefreshCw,
  Compass,
  CheckCircle2,
  XCircle,
  Phone,
  Clock,
  ShieldCheck,
  AlertOctagon,
  X,
  Navigation,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import { DriverUser, Bus as BusType, Trip, StudentUser, COLLEGE_DESTINATION, EmergencyEvent } from '../types/index.ts';
import { MapViewer, MapMarkerPoint } from '../components/MapViewer.tsx';
import { QRModal } from '../components/QRModal.tsx';
import { DriverSosButton } from '../components/DriverSosButton.tsx';

interface DriverStudentRow extends StudentUser {
  today_status: string;
  status_updated_at: string | null;
  student_lat: number | null;
  student_lng: number | null;
  has_live_gps?: boolean;
}

export const DriverDashboard: React.FC = () => {
  const { user } = useAuth();
  const driver = user as DriverUser;

  const [driverData, setDriverData] = useState<DriverUser | null>(driver);
  const [assignedBus, setAssignedBus] = useState<BusType | null>(null);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  // Real Mobile GPS state (Driver phone = Bus GPS)
  const [currentCoords, setCurrentCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    timestamp: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsUpdatesCount, setGpsUpdatesCount] = useState<number>(0);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Dynamic QR state
  const [dynamicQrToken, setDynamicQrToken] = useState<string | null>(null);
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const [showQrModal, setShowQrModal] = useState<boolean>(false);

  // Assigned students list
  const [students, setStudents] = useState<DriverStudentRow[]>([]);
  const [studentFilter, setStudentFilter] = useState<'ALL' | 'WAITING' | 'ABSENT' | 'BOARDED'>('ALL');

  // Breakdown modal
  const [showBreakdownModal, setShowBreakdownModal] = useState<boolean>(false);
  const [breakdownDesc, setBreakdownDesc] = useState<string>('');
  const [isSubmittingBreakdown, setIsSubmittingBreakdown] = useState<boolean>(false);
  const [breakdownSuccess, setBreakdownSuccess] = useState<boolean>(false);

  // End Trip confirmation modal
  const [showEndTripModal, setShowEndTripModal] = useState<boolean>(false);
  const [tripSummaryNotice, setTripSummaryNotice] = useState<string | null>(null);

  // Trip action loading
  const [isTripActionLoading, setIsTripActionLoading] = useState<boolean>(false);

  // Live trip elapsed timer
  const [tripElapsedSeconds, setTripElapsedSeconds] = useState<number>(0);

  // Recent student status alert toast
  const [statusAlertToast, setStatusAlertToast] = useState<{ message: string; type: 'WAITING' | 'ABSENT' } | null>(null);
  const previousStatusMapRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!driver?.driver_id) return;
    loadDriverData();

    // Fast polling (every 3 seconds) for instant student status and GPS updates
    const interval = setInterval(() => {
      refreshData();
    }, 3000);

    return () => {
      clearInterval(interval);
      stopGpsTracking();
    };
  }, [driver?.driver_id]);

  // Dynamic QR auto-refresh countdown
  useEffect(() => {
    if (!activeTrip) return;

    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchDynamicQR();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeTrip?.trip_id]);

  // Trip elapsed timer
  useEffect(() => {
    if (!activeTrip) {
      setTripElapsedSeconds(0);
      return;
    }

    const startTimestamp = activeTrip.start_time ? new Date(activeTrip.start_time).getTime() : Date.now();
    const updateElapsed = () => {
      const now = Date.now();
      const secs = Math.max(0, Math.floor((now - startTimestamp) / 1000));
      setTripElapsedSeconds(secs);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeTrip?.trip_id]);

  const loadDriverData = async () => {
    try {
      const data = await Api.getDriverData(driver.driver_id);
      setDriverData(data.driver);

      let resolvedBus = data.bus;
      if (!resolvedBus) {
        // Fallback: look up available buses
        try {
          const allBuses = await Api.getAdminBuses();
          resolvedBus =
            allBuses.find((b) => b.assigned_driver_id === driver.driver_id) ||
            allBuses.find((b) => b.bus_id === driver.assigned_bus_id) ||
            allBuses[0] ||
            null;
        } catch (_) {}
      }

      setAssignedBus(resolvedBus);
      setActiveTrip(data.activeTrip);

      if (resolvedBus?.bus_id) {
        loadStudents(resolvedBus.bus_id);
        // Automatically initiate mobile GPS tracking
        if (!isGpsActive) {
          startGpsTracking(data.driver.driver_id, resolvedBus.bus_id);
        }
      }

      if (data.activeTrip) {
        setDynamicQrToken(data.activeTrip.dynamic_qr_token);
      }
    } catch (e) {
      console.warn('Failed to load driver data:', e);
    }
  };

  const refreshData = async () => {
    try {
      const busId = assignedBus?.bus_id || driverData?.assigned_bus_id;
      if (busId) {
        await loadStudents(busId);
      }
    } catch (e) {
      console.warn('refreshData error caught:', e);
    }
  };

  const loadStudents = async (busId: string) => {
    try {
      const list = await Api.getDriverStudents(busId);
      
      // Check for live status changes to notify the driver
      list.forEach((s) => {
        const prev = previousStatusMapRef.current[s.student_id];
        if (prev && prev !== s.today_status) {
          if (s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT') {
            setStatusAlertToast({
              message: `🟡 ${s.full_name} marked as WAITING at ${s.boarding_point || 'Stop'}. Visible on GPS map!`,
              type: 'WAITING',
            });
            setTimeout(() => setStatusAlertToast(null), 6000);
          } else if (s.today_status === 'NOT_COMING' || s.today_status === 'NOT_RETURNING') {
            setStatusAlertToast({
              message: `🔴 ${s.full_name} marked as ABSENT. You can skip this boarding stop.`,
              type: 'ABSENT',
            });
            setTimeout(() => setStatusAlertToast(null), 6000);
          }
        }
        previousStatusMapRef.current[s.student_id] = s.today_status;
      });

      setStudents(list);
    } catch (e) {
      console.warn('Failed to load students:', e);
    }
  };

  const fetchDynamicQR = async () => {
    const busId = assignedBus?.bus_id || driverData?.assigned_bus_id;
    if (!driver?.driver_id || !busId) return;
    try {
      const res = await Api.getDynamicQR(driver.driver_id, busId);
      setDynamicQrToken(res.dynamic_qr_token);
    } catch (e) {
      console.warn('Error fetching dynamic QR:', e);
    }
  };

  // Haversine distance calculator
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

  // --- Real Device GPS Tracking ---
  const startGpsTracking = (dId: string, bId: string) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your mobile browser.');
      return;
    }

    setGpsError(null);
    setIsGpsActive(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentCoords({
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || null,
          timestamp: position.timestamp,
        });
        setGpsUpdatesCount((c) => c + 1);
        setGpsError(null);

        // Transmit coordinates to backend
        try {
          await Api.updateDriverLocation(dId, bId, latitude, longitude, accuracy || null);
        } catch (err) {
          console.warn('Network error transmitting GPS update:', err);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError('GPS permission was denied in your mobile browser. Tap Retry or use Test Location.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError('Mobile GPS signal is temporarily acquiring lock...');
        } else {
          setGpsError('Mobile GPS request timed out. Retrying automatically...');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
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

  // Toggle Mobile GPS tracking
  const handleToggleGps = async () => {
    const busId = assignedBus?.bus_id || driverData?.assigned_bus_id || 'BUS-02';
    if (isGpsActive) {
      stopGpsTracking();
    } else {
      if (!activeTrip) {
        await handleStartTrip();
      } else {
        startGpsTracking(driver.driver_id, busId);
      }
    }
  };

  // Simulate or advance location slightly (Super helpful for desktop/demonstration testing)
  const handleSimulateMovement = async () => {
    const busId = assignedBus?.bus_id || driverData?.assigned_bus_id || 'BUS-02';
    const baseLat = currentCoords?.lat || assignedBus?.current_lat || COLLEGE_DESTINATION.latitude;
    const baseLng = currentCoords?.lng || assignedBus?.current_lng || COLLEGE_DESTINATION.longitude;

    // Shift location slightly north-east along route (~150 meters)
    const newLat = baseLat + (Math.random() - 0.3) * 0.002;
    const newLng = baseLng + (Math.random() - 0.3) * 0.002;

    setCurrentCoords({
      lat: newLat,
      lng: newLng,
      accuracy: 6,
      timestamp: Date.now(),
    });
    setGpsUpdatesCount((c) => c + 1);

    try {
      await Api.updateDriverLocation(driver.driver_id, busId, newLat, newLng, 6);
      refreshData();
    } catch (e) {
      console.warn('Simulated location transmission failed:', e);
    }
  };

  // --- START TRIP ---
  const handleStartTrip = async () => {
    setIsTripActionLoading(true);
    setGpsError(null);
    setTripSummaryNotice(null);

    const busId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02';

    try {
      // 1. Start trip on backend to generate active trip and dynamic QR code
      const res = await Api.startTrip(driver.driver_id, busId);
      setActiveTrip(res.trip);
      setDynamicQrToken(res.trip.dynamic_qr_token);
      setQrSecondsLeft(60);

      // 2. Start continuous mobile GPS broadcasting
      startGpsTracking(driver.driver_id, busId);
      await loadDriverData();
    } catch (err: any) {
      alert(err.message || 'Failed to start trip.');
    } finally {
      setIsTripActionLoading(false);
    }
  };

  // --- END TRIP ---
  const handleConfirmEndTrip = async () => {
    const busId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02';
    setIsTripActionLoading(true);

    try {
      await Api.endTrip(driver.driver_id, busId);
      stopGpsTracking();

      const formatMin = Math.floor(tripElapsedSeconds / 60);
      const formatSec = tripElapsedSeconds % 60;
      setTripSummaryNotice(
        `Trip completed successfully! Total duration: ${formatMin}m ${formatSec}s. Attendance records logged.`
      );

      setActiveTrip(null);
      setDynamicQrToken(null);
      setShowEndTripModal(false);
      await loadDriverData();
    } catch (err: any) {
      setTripSummaryNotice(err.message || 'Failed to end trip.');
    } finally {
      setIsTripActionLoading(false);
    }
  };

  // --- MANUAL MARK BOARDED (for waiting students) ---
  const handleMarkStudentBoarded = async (studentId: string, studentName: string) => {
    const busId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02';
    try {
      const res = await Api.markStudentBoarded(driver.driver_id, busId, studentId);
      setStudents((prev) =>
        prev.map((s) => (s.student_id === studentId ? { ...s, today_status: 'BOARDED' } : s))
      );
      if (res.message) {
        refreshData();
      }
    } catch (err: any) {
      setStatusAlertToast({
        message: err.message || `Failed to mark ${studentName} as boarded.`,
        type: 'ABSENT',
      });
    }
  };

  // --- REPORT BREAKDOWN ---
  const handleReportBreakdown = async () => {
    const busId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02';
    setIsSubmittingBreakdown(true);

    try {
      await Api.reportBreakdown(
        driver.driver_id,
        busId,
        currentCoords?.lat || null,
        currentCoords?.lng || null,
        breakdownDesc.trim() || 'Bus breakdown reported by driver.'
      );
      setBreakdownSuccess(true);
      setTimeout(() => {
        setShowBreakdownModal(false);
        setBreakdownSuccess(false);
        setBreakdownDesc('');
        loadDriverData();
      }, 2000);
    } catch (err: any) {
      setBreakdownDesc((prev) => `${prev} (${err.message || 'Failed to record breakdown'})`);
    } finally {
      setIsSubmittingBreakdown(false);
    }
  };

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (studentFilter === 'ALL') return true;
    if (studentFilter === 'WAITING') return s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
    if (studentFilter === 'ABSENT') return s.today_status === 'NOT_COMING' || s.today_status === 'NOT_RETURNING';
    if (studentFilter === 'BOARDED') return s.today_status === 'BOARDED';
    return true;
  });

  const waitingCount = students.filter((s) => s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT').length;
  const absentCount = students.filter((s) => s.today_status === 'NOT_COMING' || s.today_status === 'NOT_RETURNING').length;
  const boardedCount = students.filter((s) => s.today_status === 'BOARDED').length;

  // Build map markers
  const mapMarkers: MapMarkerPoint[] = [];

  // 1. Driver's Bus Marker
  const busLat = currentCoords?.lat ?? assignedBus?.current_lat ?? null;
  const busLng = currentCoords?.lng ?? assignedBus?.current_lng ?? null;

  if (busLat !== null && busLng !== null) {
    mapMarkers.push({
      id: 'driver-bus-marker',
      lat: busLat,
      lng: busLng,
      type: 'BUS',
      title: `Bus ${assignedBus?.bus_number || driver.bus_number || 'My Bus'}`,
      subtitle: isGpsActive
        ? `Driver Mobile GPS (${gpsUpdatesCount} live updates)`
        : `Bus Location (${assignedBus?.bus_status || 'IDLE'})`,
      accuracy: currentCoords?.accuracy || assignedBus?.gps_accuracy || null,
    });
  }

  // 2. Student Markers (Waiting, Absent, Boarded)
  students.forEach((s) => {
    if (s.student_lat && s.student_lng) {
      const isWaiting = s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
      const isAbsent = s.today_status === 'NOT_COMING' || s.today_status === 'NOT_RETURNING';
      const isBoarded = s.today_status === 'BOARDED';

      // Respect studentFilter for map markers if filtered
      if (studentFilter === 'WAITING' && !isWaiting) return;
      if (studentFilter === 'ABSENT' && !isAbsent) return;
      if (studentFilter === 'BOARDED' && !isBoarded) return;

      let markerType: MapMarkerPoint['type'] = 'STUDENT_WAITING';
      let statusTag = 'WAITING (PICKUP)';

      if (isBoarded) {
        markerType = 'STUDENT_BOARDED';
        statusTag = 'BOARDED';
      } else if (isAbsent) {
        markerType = 'STUDENT_ABSENT';
        statusTag = 'ABSENT (SKIP STOP)';
      }

      const dist = currentCoords
        ? calculateDistanceKm(currentCoords.lat, currentCoords.lng, s.student_lat, s.student_lng)
        : null;

      const distText = dist !== null
        ? dist < 1
          ? ` • ${(dist * 1000).toFixed(0)}m from bus`
          : ` • ${dist.toFixed(2)}km from bus`
        : '';

      const gpsSource = s.has_live_gps ? '📱 Live Mobile GPS' : '📍 Boarding Stop Location';

      mapMarkers.push({
        id: `stu-${s.student_id}`,
        lat: s.student_lat,
        lng: s.student_lng,
        type: markerType,
        title: s.full_name,
        subtitle: `${gpsSource} • Stop: ${s.boarding_point || 'Not specified'}${distText} • Status: ${statusTag}`,
        phone: s.phone,
        phoneLabel: 'Call Student',
      });
    }
  });

  // 3. Official College Campus Destination
  mapMarkers.push({
    id: COLLEGE_DESTINATION.id,
    lat: COLLEGE_DESTINATION.latitude,
    lng: COLLEGE_DESTINATION.longitude,
    type: 'DESTINATION',
    title: COLLEGE_DESTINATION.name,
    subtitle: COLLEGE_DESTINATION.address,
  });

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Live Alert Toast for Student Status Changes */}
      {statusAlertToast && (
        <div
          className={`rounded-2xl p-4 text-xs font-bold shadow-lg border flex items-center justify-between transition-all animate-bounce ${
            statusAlertToast.type === 'WAITING'
              ? 'bg-amber-50 text-amber-900 border-amber-300 ring-4 ring-amber-300/40'
              : 'bg-rose-50 text-rose-900 border-rose-300 ring-4 ring-rose-300/40'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Radio className="h-4 w-4 shrink-0 animate-pulse text-purple-700" />
            <span>{statusAlertToast.message}</span>
          </div>
          <button
            onClick={() => setStatusAlertToast(null)}
            className="p-1 rounded-lg hover:bg-black/10 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Trip Completed Summary Toast */}
      {tripSummaryNotice && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-300 p-4 text-xs text-emerald-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{tripSummaryNotice}</span>
          </div>
          <button
            onClick={() => setTripSummaryNotice(null)}
            className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Driver Header & Trip Control Console */}
      <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="rounded-md bg-purple-500/30 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-300 border border-purple-400/20">
                Driver Navigation Console
              </span>
              <span className="text-slate-400 text-xs font-mono">&bull; {driver.driver_id}</span>
              {activeTrip && (
                <span className="inline-flex items-center space-x-1 rounded-md bg-emerald-500/30 px-2 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>TRIP ACTIVE ({formatTimer(tripElapsedSeconds)})</span>
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{driver.driver_name}</h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Assigned Bus: <strong className="text-purple-300">{assignedBus?.bus_number || driver.bus_number || 'TN 22 CZ 4102'}</strong> &bull; Route: {assignedBus?.route_name || 'Campus Route'}
            </p>
          </div>

          {/* Primary Action Buttons for Driver Mobile Touch */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Direct Mobile GPS Toggle */}
            <button
              type="button"
              onClick={handleToggleGps}
              className={`inline-flex items-center space-x-2 rounded-2xl px-4 py-3 text-xs font-bold transition shadow-md border ${
                isGpsActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Radio className={`h-4 w-4 ${isGpsActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span>{isGpsActive ? 'GPS: Broadcasting' : 'Turn On Mobile GPS'}</span>
            </button>

            {/* Simulated GPS progress (for desktop/demonstration testing) */}
            <button
              type="button"
              onClick={handleSimulateMovement}
              title="Test bus movement along route"
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3.5 py-3 text-xs font-semibold transition"
            >
              <Navigation className="h-4 w-4 text-purple-400" />
              <span>Shift Bus Location</span>
            </button>

            {/* START TRIP / END TRIP BUTTONS */}
            {!activeTrip ? (
              <button
                type="button"
                onClick={handleStartTrip}
                disabled={isTripActionLoading}
                className="inline-flex items-center space-x-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-500/30 transition disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>{isTripActionLoading ? 'Starting Trip...' : 'START TRIP'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="inline-flex items-center space-x-2 rounded-2xl bg-purple-600 hover:bg-purple-700 px-4 py-3 text-xs font-bold text-white shadow-md transition"
                >
                  <QrCode className="h-5 w-5" />
                  <span>Show Dynamic QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEndTripModal(true)}
                  disabled={isTripActionLoading}
                  className="inline-flex items-center space-x-2 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-95 px-5 py-3 text-xs font-black text-white shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                  <span>END TRIP</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live GPS Telemetry Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-800 text-xs">
          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Trip Status</span>
            <span className="font-bold text-sm flex items-center space-x-1.5 mt-0.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  activeTrip ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              <span className={activeTrip ? 'text-emerald-400' : 'text-slate-300'}>
                {activeTrip ? `ON ROUTE • ${formatTimer(tripElapsedSeconds)}` : 'IDLE / NOT STARTED'}
              </span>
            </span>
          </div>

          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">GPS Broadcast Feed</span>
            <span className="font-bold text-sm text-purple-300 flex items-center space-x-1 mt-0.5">
              {isGpsActive ? (
                <>
                  <Radio className="h-3.5 w-3.5 text-emerald-400 animate-ping" />
                  <span>STREAMING ({gpsUpdatesCount} updates)</span>
                </>
              ) : (
                <span className="text-slate-400">GPS Standby</span>
              )}
            </span>
          </div>

          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Bus Coordinates</span>
            <span className="font-mono text-xs text-slate-200 mt-0.5 block truncate">
              {busLat !== null && busLng !== null
                ? `${busLat.toFixed(5)}, ${busLng.toFixed(5)}`
                : 'GPS Standby (Not Streaming)'}
            </span>
          </div>

          <div className="rounded-xl bg-slate-800/80 p-3 border border-slate-700">
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">GPS Accuracy</span>
            <span className="font-bold text-xs text-slate-200 mt-0.5 block">
              {currentCoords?.accuracy ? `±${currentCoords.accuracy.toFixed(0)} meters` : 'High Accuracy Ready'}
            </span>
          </div>
        </div>

        {/* Destination Information */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
              Destination
            </span>
            <span className="font-bold text-white">{COLLEGE_DESTINATION.name}</span>
          </div>
          <span className="text-slate-400 text-[11px]">{COLLEGE_DESTINATION.address}</span>
        </div>
      </div>

      {/* FEATURE 3: Driver SOS & Emergency System (2-Second Press-and-Hold) */}
      <div className="rounded-3xl bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 p-6 text-white border-2 border-rose-600/70 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1.5 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span className="rounded-full bg-rose-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md animate-pulse">
              🚨 DRIVER EMERGENCY SOS
            </span>
            <span className="text-xs text-rose-300 font-bold">&bull; 2-Second Hold Guard</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">Instant Breakdown &amp; Incident Dispatch</h3>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            In case of accident, technical failure, or medical emergency, press and hold the button for 2 seconds. Your exact GPS coordinates and vehicle telemetry will instantly trigger red alert sirens on the Admin Dashboard.
          </p>
        </div>

        <div className="shrink-0">
          <DriverSosButton
            busId={assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02'}
            driverId={driver.driver_id}
            busNumber={assignedBus?.bus_number || driver.bus_number || 'College Bus'}
            currentCoords={currentCoords}
            onEmergencyTriggered={() => {
              loadDriverData();
            }}
          />
        </div>
      </div>

      {/* GPS Error Notification if Denied */}
      {gpsError && (
        <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-xs text-amber-900 flex items-start justify-between space-x-3">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">GPS Permission Notice</h4>
              <p className="mt-0.5 text-amber-800">{gpsError}</p>
            </div>
          </div>
          <button
            onClick={() => startGpsTracking(driver.driver_id, assignedBus?.bus_id || 'BUS-02')}
            className="rounded-xl bg-amber-200 hover:bg-amber-300 px-3.5 py-1.5 font-bold text-amber-900 text-xs transition shrink-0"
          >
            Retry GPS
          </button>
        </div>
      )}

      {/* Live Map & Student Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Driver Map (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            {/* Map Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center space-x-2">
                  <span>Driver GPS Navigation Map</span>
                  {isGpsActive && (
                    <span className="flex items-center space-x-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      <Radio className="h-3 w-3 animate-pulse text-emerald-600" />
                      <span>GPS LIVE</span>
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Displays waiting students (🟡 Pickup) and absent students (🔴 Skip stop) along your assigned route
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {/* Breakdown button */}
                <button
                  type="button"
                  onClick={() => setShowBreakdownModal(true)}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 text-xs font-bold transition"
                >
                  <AlertOctagon className="h-3.5 w-3.5" />
                  <span>Breakdown</span>
                </button>

                {/* Refresh Data button */}
                <button
                  type="button"
                  onClick={refreshData}
                  className="inline-flex items-center space-x-1 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-xl font-bold border border-purple-200 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Student Status Summary Bar Directly Above Map */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center space-x-2 font-bold text-slate-700">
                <span className="flex items-center space-x-1 bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping mr-1" />
                  <span>{waitingCount} Waiting for Pickup</span>
                </span>
                <span className="flex items-center space-x-1 bg-rose-100 text-rose-900 px-2.5 py-1 rounded-lg border border-rose-300">
                  <span>🔴 {absentCount} Absent (Skip Stop)</span>
                </span>
                <span className="flex items-center space-x-1 bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-300">
                  <span>🟢 {boardedCount} Boarded</span>
                </span>
              </div>

              {/* Map Filter Controls */}
              <div className="flex items-center space-x-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStudentFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    studentFilter === 'ALL'
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All ({students.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentFilter('WAITING')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    studentFilter === 'WAITING'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  🟡 Waiting ({waitingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStudentFilter('ABSENT')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    studentFilter === 'ABSENT'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                  }`}
                >
                  🔴 Absent ({absentCount})
                </button>
              </div>
            </div>

            {/* College Campus Destination Marker Indicator */}
            <div className="mb-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-900 text-amber-300 text-sm font-bold shrink-0 shadow-sm">
                  🏛️
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-indigo-950 text-xs">Route Destination:</span>
                    <span className="font-bold text-indigo-900">{COLLEGE_DESTINATION.name}</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 mt-0.5">{COLLEGE_DESTINATION.address}</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded-md font-bold self-start sm:self-center">
                13.1474° N, 80.0591° E
              </span>
            </div>

            {/* Map Viewer */}
            <MapViewer
              viewMode="DRIVER"
              markers={mapMarkers}
              centerLat={busLat}
              centerLng={busLng}
              heightClass="h-[380px] sm:h-[460px] lg:h-[520px]"
              emptyStateMessage="Press START TRIP above to activate your phone's GPS and stream live bus coordinates."
            />

            {/* Instructions Strip */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>💡 Tip: Click any student pin on the map to see their stop, distance from your bus, and contact info.</span>
              <span className="font-mono text-purple-700 font-semibold">{mapMarkers.length} markers plotted</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Bus QR & Students Attendance Summary */}
        <div className="space-y-6">
          {/* Dynamic Bus QR Panel (Students scan this on the driver's phone) */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-900 to-indigo-950 p-6 text-white shadow-sm border border-purple-800">
            <div className="flex items-center justify-between pb-3 border-b border-purple-800 mb-3">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5 text-purple-300" />
                <h3 className="font-bold text-sm">Dynamic Bus Boarding QR</h3>
              </div>
              {activeTrip ? (
                <span className="text-[11px] font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Live &bull; {formatTimer(tripElapsedSeconds)}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/30">
                  Trip Idle
                </span>
              )}
            </div>

            {activeTrip && dynamicQrToken ? (
              <div className="text-center">
                <p className="text-xs text-purple-200 mb-3">
                  Students scan this QR code with their phone camera to verify boarding attendance.
                </p>
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="w-full py-3 bg-white text-purple-900 font-bold rounded-2xl shadow-lg hover:bg-purple-50 transition text-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Enlarge Boarding QR Code</span>
                </button>
                <div className="mt-2.5 flex items-center justify-center space-x-1.5 text-[11px] text-purple-300 font-mono">
                  <RefreshCw className="h-3 w-3 animate-spin text-purple-400" />
                  <span>Auto-refreshes in {qrSecondsLeft}s</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-purple-200">
                <QrCode className="mx-auto h-9 w-9 text-purple-400/60 mb-2" />
                <p>Start your trip to generate the live dynamic bus boarding QR code.</p>
                <button
                  type="button"
                  onClick={handleStartTrip}
                  disabled={isTripActionLoading}
                  className="mt-3.5 w-full py-2.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black rounded-xl transition text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>{isTripActionLoading ? 'Starting...' : 'START TRIP & SHOW QR'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Student Status Summary Cards */}
          <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Student Manifest ({students.length} Total)
              </h4>
              <button
                onClick={refreshData}
                className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center space-x-1"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Sync</span>
              </button>
            </div>

            {/* Waiting Alert Ribbon */}
            {waitingCount > 0 && (
              <div className="mb-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
                <span className="font-bold flex items-center space-x-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span>{waitingCount} Student{waitingCount > 1 ? 's' : ''} Waiting at Stops</span>
                </span>
                <button
                  type="button"
                  onClick={() => setStudentFilter('WAITING')}
                  className="text-[11px] font-black text-amber-900 underline hover:text-amber-950 cursor-pointer"
                >
                  View Waiting
                </button>
              </div>
            )}

            {/* Interactive Stat Cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div
                onClick={() => setStudentFilter('WAITING')}
                className={`p-2.5 rounded-2xl border text-center cursor-pointer transition ${
                  studentFilter === 'WAITING' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300' : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <span className="block text-[10px] font-bold text-amber-800 uppercase">Waiting</span>
                <span className="text-xl font-black text-amber-900">{waitingCount}</span>
              </div>

              <div
                onClick={() => setStudentFilter('ABSENT')}
                className={`p-2.5 rounded-2xl border text-center cursor-pointer transition ${
                  studentFilter === 'ABSENT' ? 'bg-rose-100 border-rose-400 ring-2 ring-rose-300' : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/50'
                }`}
              >
                <span className="block text-[10px] font-bold text-rose-800 uppercase">Absent</span>
                <span className="text-xl font-black text-rose-900">{absentCount}</span>
              </div>

              <div
                onClick={() => setStudentFilter('BOARDED')}
                className={`p-2.5 rounded-2xl border text-center cursor-pointer transition ${
                  studentFilter === 'BOARDED' ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300' : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/50'
                }`}
              >
                <span className="block text-[10px] font-bold text-emerald-800 uppercase">Boarded</span>
                <span className="text-xl font-black text-emerald-900">{boardedCount}</span>
              </div>
            </div>

            {/* Filter Reset Button */}
            {studentFilter !== 'ALL' && (
              <div className="mb-2 text-right">
                <button
                  onClick={() => setStudentFilter('ALL')}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline font-semibold"
                >
                  Clear Filter (Show All {students.length})
                </button>
              </div>
            )}

            {/* Students Checklist */}
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredStudents.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  {students.length === 0 ? 'No students assigned to this bus.' : 'No students matching this filter.'}
                </p>
              ) : (
                filteredStudents.map((s) => {
                  const dist = currentCoords && s.student_lat && s.student_lng
                    ? calculateDistanceKm(currentCoords.lat, currentCoords.lng, s.student_lat, s.student_lng)
                    : null;
                  const isWaiting = s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
                  const isAbsent = s.today_status === 'NOT_COMING' || s.today_status === 'NOT_RETURNING';
                  const isBoarded = s.today_status === 'BOARDED';

                  return (
                    <div
                      key={s.student_id}
                      className={`p-3 rounded-2xl border text-xs flex flex-col space-y-2 transition ${
                        isWaiting
                          ? 'border-amber-300 bg-amber-50/60 shadow-xs ring-1 ring-amber-200'
                          : isAbsent
                          ? 'border-rose-200 bg-rose-50/40'
                          : isBoarded
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="font-black text-slate-900 truncate flex items-center space-x-2">
                            <span className="truncate">{s.full_name}</span>
                            {s.phone && (
                              <a
                                href={`tel:${s.phone}`}
                                className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 text-[10px] font-bold transition shrink-0 border border-purple-200"
                                title={`Direct call ${s.full_name}: ${s.phone}`}
                              >
                                <Phone className="h-2.5 w-2.5" />
                                <span>Call</span>
                              </a>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate mt-0.5">
                            Stop: <strong>{s.boarding_point || 'Not assigned'}</strong>
                            {dist !== null && (
                              <span className="font-black text-purple-800 ml-1.5">
                                • {dist < 1 ? `${(dist * 1000).toFixed(0)}m from bus` : `${dist.toFixed(2)}km from bus`}
                              </span>
                            )}
                          </div>
                          {s.has_live_gps && (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1 mt-0.5">
                              <Radio className="h-2.5 w-2.5 animate-pulse text-emerald-600" />
                              <span>Live Mobile GPS Active</span>
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isBoarded
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isWaiting
                                ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                                : isAbsent
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {isWaiting ? '🟡 WAITING' : isAbsent ? '🔴 ABSENT' : isBoarded ? '🟢 BOARDED' : 'NOT SET'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons if waiting */}
                      {isWaiting && (
                        <div className="flex items-center justify-end space-x-2 pt-1 border-t border-amber-200/60">
                          <span className="text-[10px] text-amber-800 italic mr-auto">Waiting for pickup</span>
                          <button
                            type="button"
                            onClick={() => handleMarkStudentBoarded(s.student_id, s.full_name)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center space-x-1 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Mark Boarded</span>
                          </button>
                        </div>
                      )}

                      {/* Notice if absent */}
                      {isAbsent && (
                        <div className="text-[10px] text-rose-700 font-semibold pt-0.5">
                          ℹ️ Marked absent: Driver can skip this stop on the route.
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic QR Modal */}
      {dynamicQrToken && (
        <QRModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          title={`Bus ${assignedBus?.bus_number || ''} Boarding QR`}
          subtitle="Dynamic temporary token for verified attendance"
          token={dynamicQrToken}
          isDynamic={true}
          refreshSecondsLeft={qrSecondsLeft}
          onRefresh={fetchDynamicQR}
        />
      )}

      {/* End Trip Confirmation Modal */}
      {showEndTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-rose-600">
                <Square className="h-5 w-5 fill-current" />
                <h3 className="font-black text-base text-slate-900">End Active Bus Trip?</h3>
              </div>
              <button
                onClick={() => setShowEndTripModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Ending this trip will conclude mobile GPS broadcasting, lock today&apos;s attendance session, and reset the bus status to <strong>IDLE</strong>.
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Trip Duration:</span>
                  <span className="font-bold text-slate-900">{formatTimer(tripElapsedSeconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verified Boarded Students:</span>
                  <span className="font-bold text-emerald-700">{boardedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Students Still Waiting:</span>
                  <span className="font-bold text-amber-700">{waitingCount}</span>
                </div>
              </div>

              {waitingCount > 0 && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                  ⚠️ Note: {waitingCount} student{waitingCount > 1 ? 's are' : ' is'} still marked as WAITING. Ensure all passengers have boarded or made alternative transit arrangements before concluding.
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndTripModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Continue Trip
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndTrip}
                  disabled={isTripActionLoading}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>{isTripActionLoading ? 'Concluding...' : 'Confirm End Trip'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown Reporting Modal */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-rose-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2 text-rose-700">
                <AlertOctagon className="h-6 w-6" />
                <h3 className="font-bold text-base text-slate-900">Report Bus Breakdown</h3>
              </div>
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {breakdownSuccess ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600 mb-2" />
                <h4 className="font-bold text-sm text-slate-900">Breakdown Alert Broadcasted</h4>
                <p className="text-xs text-slate-500 mt-1">
                  College transport management and students have been immediately alerted.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                  Reporting a breakdown will immediately update bus status to <strong>BREAKDOWN</strong>, transmit your current mobile GPS coordinates, and broadcast an emergency notice to students and administration.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Breakdown Details</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the vehicle condition, location landmark, tyre puncture, engine issue..."
                    value={breakdownDesc}
                    onChange={(e) => setBreakdownDesc(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs focus:border-rose-600 focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBreakdownModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReportBreakdown}
                    disabled={isSubmittingBreakdown}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition disabled:opacity-50"
                  >
                    {isSubmittingBreakdown ? 'Broadcasting...' : 'Confirm Breakdown Alert'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
