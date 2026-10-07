import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Navigation,
  Radio,
  MapPin,
  Bus,
  CheckCircle2,
} from 'lucide-react';
import { calculateDistanceMeters, formatDistance } from '../utils/geo.ts';

export interface BusArrivalCountdownProps {
  busNumber?: string;
  busStatus?: string;
  isTripActive?: boolean;
  isTripCompleted?: boolean;
  busLat?: number | null;
  busLng?: number | null;
  studentLat?: number | null;
  studentLng?: number | null;
  stopName?: string;
  routeName?: string;
  isCompact?: boolean;
  variant?: 'ABOVE_MAP' | 'CARD';
  onOpenMap?: () => void;
}

export const BusArrivalCountdown: React.FC<BusArrivalCountdownProps> = ({
  busNumber = 'Bus',
  busStatus = 'IDLE',
  isTripActive,
  isTripCompleted = false,
  busLat,
  busLng,
  studentLat,
  studentLng,
  stopName = 'Designated Boarding Stop',
  routeName = 'Campus Route',
  variant = 'ABOVE_MAP',
  onOpenMap,
}) => {
  // Determine if trip is actively running
  const activeTripRunning = isTripActive ?? (busStatus === 'ON_TRIP');

  // Check if bus GPS is currently valid and streaming
  const hasValidBusGps =
    typeof busLat === 'number' &&
    typeof busLng === 'number' &&
    !isNaN(busLat) &&
    !isNaN(busLng) &&
    busLat !== 0 &&
    busLng !== 0;

  // Check if student target stop coordinates are valid
  const hasValidTarget =
    typeof studentLat === 'number' &&
    typeof studentLng === 'number' &&
    !isNaN(studentLat) &&
    !isNaN(studentLng) &&
    studentLat !== 0 &&
    studentLng !== 0;

  // Calculate great-circle distance in meters using Haversine formula strictly from existing coordinates
  const liveDistanceMeters = useMemo(() => {
    if (!hasValidBusGps || !hasValidTarget) return null;
    return calculateDistanceMeters(busLat!, busLng!, studentLat!, studentLng!);
  }, [hasValidBusGps, hasValidTarget, busLat, busLng, studentLat, studentLng]);

  // Real transit calculation: average bus transit speed ~25 km/h ≈ 6.944 m/s
  const initialCalculatedSeconds = useMemo(() => {
    if (liveDistanceMeters === null || isNaN(liveDistanceMeters) || liveDistanceMeters === Infinity) {
      return null;
    }
    return Math.round(liveDistanceMeters / 6.944);
  }, [liveDistanceMeters]);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(initialCalculatedSeconds);

  // Sync state whenever new real GPS coordinates arrive from the server
  useEffect(() => {
    setRemainingSeconds(initialCalculatedSeconds);
  }, [initialCalculatedSeconds]);

  // Real-time smooth ticking countdown between GPS polling cycles
  useEffect(() => {
    if (remainingSeconds === null || !activeTripRunning) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds, activeTripRunning]);

  // Determine current lifecycle state
  let etaStatus: 'COMPLETED' | 'NOT_ON_TRIP' | 'NO_GPS' | 'ARRIVING_NOW' | 'ACTIVE_ETA';
  let primaryEtaText: string;
  let statusSubtitle: string;

  if (isTripCompleted) {
    etaStatus = 'COMPLETED';
    primaryEtaText = 'Trip completed';
    statusSubtitle = "Today's route completed";
  } else if (!activeTripRunning) {
    etaStatus = 'NOT_ON_TRIP';
    primaryEtaText = 'Bus not currently on trip';
    statusSubtitle = 'Waiting for driver start';
  } else if (!hasValidBusGps || !hasValidTarget || liveDistanceMeters === null) {
    etaStatus = 'NO_GPS';
    primaryEtaText = 'ETA unavailable';
    statusSubtitle = !hasValidBusGps ? 'Awaiting live GPS stream' : 'Stop coordinates pending';
  } else if (liveDistanceMeters <= 200 || (remainingSeconds !== null && remainingSeconds <= 30)) {
    etaStatus = 'ARRIVING_NOW';
    primaryEtaText = 'Arriving now';
    statusSubtitle = `Approaching ${stopName}`;
  } else {
    etaStatus = 'ACTIVE_ETA';
    const effectiveSecs = remainingSeconds ?? initialCalculatedSeconds ?? 0;
    const currentMins = Math.max(1, Math.round(effectiveSecs / 60));
    primaryEtaText = `Arriving in: ${currentMins} min`;
    statusSubtitle = 'Live GPS';
  }

  // Calculate clock time if active
  const arrivalClockTime = useMemo(() => {
    if (remainingSeconds === null || !activeTripRunning) return null;
    const now = new Date();
    const arrivalDate = new Date(now.getTime() + remainingSeconds * 1000);
    return arrivalDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [remainingSeconds, activeTripRunning]);

  // 1. ABOVE_MAP Variant (clean white/purple card as specified for Student Live GPS)
  if (variant === 'ABOVE_MAP') {
    return (
      <div className="w-full rounded-2xl bg-white border border-purple-200/90 shadow-xs p-3.5 sm:p-4 text-slate-900 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-900">
              <span className="text-base">🚌</span>
              <span className="font-extrabold uppercase tracking-wide">Bus Arrival</span>
            </div>

            <div className="text-lg sm:text-2xl font-black text-slate-900 mt-1 tracking-tight">
              {etaStatus === 'ARRIVING_NOW' ? (
                <span className="text-emerald-600 flex items-center space-x-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>Arriving now</span>
                </span>
              ) : etaStatus === 'COMPLETED' ? (
                <span className="text-slate-700">Trip completed</span>
              ) : etaStatus === 'NOT_ON_TRIP' ? (
                <span className="text-slate-600">Bus not currently on trip</span>
              ) : etaStatus === 'NO_GPS' ? (
                <span className="text-amber-700">ETA unavailable</span>
              ) : (
                <span className="text-purple-950 font-extrabold">{primaryEtaText}</span>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-semibold text-slate-700">Bus {busNumber}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center space-x-1.5 text-slate-600">
                {etaStatus === 'ACTIVE_ETA' && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                )}
                <span>{statusSubtitle}</span>
              </span>
              {liveDistanceMeters !== null && etaStatus === 'ACTIVE_ETA' && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-purple-700 font-semibold">{formatDistance(liveDistanceMeters)}</span>
                  {arrivalClockTime && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500">ETA: {arrivalClockTime}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right badge: Boarding Point & Route name */}
          <div className="hidden sm:flex flex-col items-end text-right shrink-0 pl-2">
            <span className="text-[11px] font-semibold text-slate-400">Boarding Point</span>
            <span className="text-xs font-bold text-purple-900 max-w-[200px] truncate">
              {stopName}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate">{routeName}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Full Dashboard Card Mode (Used in StudentOverview & Portal)
  return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950 to-indigo-950 text-white p-4 sm:p-7 shadow-xl border border-purple-500/30 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full bg-purple-600/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-56 h-56 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4 sm:space-y-5">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-purple-600/40 text-purple-300 border border-purple-400/30 shadow-lg shrink-0">
              <Clock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-purple-300">
                  Live Transport Telemetry
                </span>
                <span className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold border ${
                  activeTripRunning && hasValidBusGps
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-slate-700/50 text-slate-300 border-slate-600/40'
                }`}>
                  {activeTripRunning && hasValidBusGps && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping mr-0.5" />
                  )}
                  <span>
                    {isTripCompleted
                      ? 'TRIP COMPLETED'
                      : activeTripRunning
                      ? (hasValidBusGps ? 'GPS ACTIVE' : 'NO GPS')
                      : 'BUS IDLE'}
                  </span>
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                Bus Arrival &bull; {busNumber}
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 text-xs text-purple-200 font-medium pl-13 sm:pl-0">
            <MapPin className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <span className="truncate max-w-full sm:max-w-[200px]">{stopName}</span>
          </div>
        </div>

        {/* Main Countdown Centerpiece */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-center">
          <div className="md:col-span-2 rounded-2xl bg-black/40 border border-purple-400/20 p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-purple-300 uppercase tracking-wider block mb-1">
                Real-Time Arrival Status
              </span>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white drop-shadow-sm">
                {etaStatus === 'ARRIVING_NOW' ? (
                  <span className="text-emerald-400 flex items-center space-x-2">
                    <CheckCircle2 className="h-6 w-6 sm:h-8 sm:w-8" />
                    <span>ARRIVING NOW</span>
                  </span>
                ) : etaStatus === 'COMPLETED' ? (
                  <span className="text-slate-300">TRIP COMPLETED</span>
                ) : etaStatus === 'NOT_ON_TRIP' ? (
                  <span className="text-slate-400">BUS NOT ON TRIP</span>
                ) : etaStatus === 'NO_GPS' ? (
                  <span className="text-amber-400">ETA UNAVAILABLE</span>
                ) : (
                  <span className="text-white">{primaryEtaText}</span>
                )}
              </div>
            </div>

            {arrivalClockTime && etaStatus === 'ACTIVE_ETA' && (
              <div className="w-full sm:w-auto text-left sm:text-right bg-purple-900/40 border border-purple-400/30 rounded-xl px-3.5 py-2 flex sm:block items-center justify-between">
                <span className="text-[10px] text-purple-300 uppercase font-bold sm:block">
                  Estimated Arrival
                </span>
                <span className="text-sm sm:text-lg font-black text-emerald-400 font-mono sm:mt-0.5">
                  {arrivalClockTime}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-3.5 sm:p-4 space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-white/10">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Navigation className="h-3.5 w-3.5 text-purple-400" />
                <span>Live Distance:</span>
              </span>
              <span className="font-extrabold text-white text-xs sm:text-sm">
                {liveDistanceMeters !== null ? formatDistance(liveDistanceMeters) : 'Unavailable'}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-white/10">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Bus className="h-3.5 w-3.5 text-purple-400" />
                <span>Route:</span>
              </span>
              <span className="font-bold text-purple-300 truncate max-w-[130px]">
                {routeName}
              </span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Radio className="h-3.5 w-3.5 text-emerald-400" />
                <span>Status:</span>
              </span>
              <span className="font-bold text-emerald-400">
                {statusSubtitle}
              </span>
            </div>
          </div>
        </div>

        {onOpenMap && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-[11px] sm:text-xs text-purple-300/80">
              Coordinates update dynamically every 4 seconds from real mobile bus telemetry.
            </p>
            <button
              type="button"
              onClick={onOpenMap}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-600 active:scale-95 text-white font-bold text-xs shadow-md transition cursor-pointer border border-purple-400/40 min-h-[42px]"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Open Live GPS Map &rarr;</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
