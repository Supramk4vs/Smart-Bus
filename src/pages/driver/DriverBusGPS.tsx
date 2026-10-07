import React, { useState } from 'react';
import { ArrowLeft, Play, Square, Compass, Radio, Users, AlertTriangle, MapPin, ChevronRight, Navigation } from 'lucide-react';
import { MapViewer, MapMarkerPoint } from '../../components/MapViewer.tsx';
import {
  DriverUser,
  Bus as BusType,
  Trip,
  Route,
  COLLEGE_DESTINATION,
  OperationalBoardingPoint,
  OperationalRouteWaypoint,
  DRIVER_SPECIFIED_STOPS,
} from '../../types/index.ts';
import { DriverStudentRow } from './useDriverTransportState.ts';
import { DriverSosButton } from '../../components/DriverSosButton.tsx';

interface DriverBusGPSProps {
  driver: DriverUser;
  assignedBus: BusType | null;
  assignedRoute?: Route | null;
  operationalBoardingPoints?: OperationalBoardingPoint[];
  routeWaypoints?: OperationalRouteWaypoint[];
  activeTrip: Trip | null;
  currentCoords: { lat: number; lng: number; accuracy: number | null } | null;
  students: DriverStudentRow[];
  waitingCount: number;
  boardedCount: number;
  absentCount: number;
  isStartingTrip: boolean;
  isEndingTrip: boolean;
  onStartTrip: () => void;
  onEndTrip: () => void;
  onBackToDashboard: () => void;
}

export const DriverBusGPS: React.FC<DriverBusGPSProps> = ({
  driver,
  assignedBus,
  assignedRoute,
  operationalBoardingPoints = [],
  routeWaypoints = [],
  activeTrip,
  currentCoords,
  students,
  waitingCount,
  boardedCount,
  absentCount,
  isStartingTrip,
  isEndingTrip,
  onStartTrip,
  onEndTrip,
  onBackToDashboard,
}) => {
  const isTripActive = !!activeTrip;
  const [selectedStopPan, setSelectedStopPan] = useState<{ lat: number; lng: number } | null>(null);
  const [showStopsDirectory, setShowStopsDirectory] = useState<boolean>(false);

  // Map user-specified stops with operational student counts and exact coordinates
  const driverStops = DRIVER_SPECIFIED_STOPS.slice(0, 5).map((spec) => {
    // Exact sequence or normalized name match to prevent substring collisions
    const matchedOp = operationalBoardingPoints.find(
      (op) =>
        op.sequence === spec.stopNumber ||
        op.boarding_point_name.trim().toLowerCase() === spec.name.trim().toLowerCase()
    );

    return {
      sequence: spec.stopNumber,
      name: spec.name,
      dms: spec.dms,
      lat: spec.latitude,
      lng: spec.longitude,
      waitingCount: matchedOp?.waiting_student_count || 0,
      boardedCount: matchedOp?.boarded_student_count || 0,
      absentCount: matchedOp?.absent_student_count || 0,
      assignedCount: matchedOp?.assigned_student_count || 0,
      boardingPointId: matchedOp?.boarding_point_id || `BP-02-0${spec.stopNumber}`,
    };
  });

  // Build Driver Map Markers
  const mapMarkers: MapMarkerPoint[] = [];

  // 1. Destination Marker (Stop #6: CAMPUS - Aalim Muhammed Salegh College of Engineering)
  mapMarkers.push({
    id: 'destination-college',
    lat: COLLEGE_DESTINATION.latitude, // 13.147194
    lng: COLLEGE_DESTINATION.longitude, // 80.058528
    type: 'DESTINATION',
    sequence: 6,
    title: 'STOP #6: CAMPUS',
    subtitle: `${COLLEGE_DESTINATION.name} • 13°08'49.9"N 80°03'30.7"E • ${COLLEGE_DESTINATION.shortAddress}`,
  });

  // 2. Bus Marker (Driven by Driver's Mobile GPS or starts at Stop #1 AVADI)
  const busLat = currentCoords?.lat ?? assignedBus?.current_lat ?? driverStops[0]?.lat ?? 13.127556;
  const busLng = currentCoords?.lng ?? assignedBus?.current_lng ?? driverStops[0]?.lng ?? 80.114056;

  mapMarkers.push({
    id: 'driver-bus-marker',
    lat: busLat,
    lng: busLng,
    type: 'BUS',
    title: `${assignedBus?.bus_number || 'College Bus'} (My Bus Live)`,
    subtitle: isTripActive ? 'Pilot Mobile GPS Streaming' : 'Bus Idle (Ready at Stop #1 AVADI)',
    accuracy: currentCoords?.accuracy ?? undefined,
  });

  // 3. Operational Boarding Point Markers (Stops #1 to #5 with exact coordinates & guaranteed unique IDs)
  driverStops.forEach((stop) => {
    mapMarkers.push({
      id: `driver-stop-${stop.sequence}`,
      lat: stop.lat,
      lng: stop.lng,
      type: 'BOARDING_POINT',
      sequence: stop.sequence,
      title: stop.name,
      subtitle: `${stop.dms} • Assigned: ${stop.assignedCount} passenger${stop.assignedCount === 1 ? '' : 's'} • Waiting: ${stop.waitingCount} 🟡 • Boarded: ${stop.boardedCount} 🟢 • Absent: ${stop.absentCount} 🔴`,
    });
  });

  // 4. Student Markers strictly for students assigned to THIS BUS (backend filtered):
  students.forEach((s) => {
    const isWaiting = s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
    const isAbsent = s.today_status === 'NOT_COMING' || s.today_status === 'ABSENT';
    const isBoarded = s.today_status === 'BOARDED';

    let pinLat: number | null = null;
    let pinLng: number | null = null;
    let pinType: MapMarkerPoint['type'] = 'USER';

    if (isWaiting) {
      pinType = 'STUDENT_WAITING';
      pinLat = s.student_lat ?? s.boarding_lat ?? null;
      pinLng = s.student_lng ?? s.boarding_lng ?? null;
    } else if (isAbsent) {
      pinType = 'STUDENT_ABSENT';
      pinLat = s.boarding_lat ?? null;
      pinLng = s.boarding_lng ?? null;
    } else if (isBoarded) {
      pinType = 'STUDENT_BOARDED';
      pinLat = s.student_lat ?? s.boarding_lat ?? null;
      pinLng = s.student_lng ?? s.boarding_lng ?? null;
    }

    if (pinLat && pinLng) {
      mapMarkers.push({
        id: `student-${s.student_id}`,
        lat: pinLat,
        lng: pinLng,
        type: pinType,
        studentName: s.full_name,
        title: `${s.full_name} (${isWaiting ? '🟡 WAITING' : isAbsent ? '🔴 ABSENT' : '🟢 BOARDED'})`,
        subtitle: `Stop: ${s.boarding_point || 'Stop'}${s.phone ? ` • Ph: ${s.phone}` : ''}`,
      });
    }
  });

  // Ordered intermediate stops for Google Maps routing API: follows sequence 1, 2, 3, 4, 5
  const intermediateStopsForRouting = driverStops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
  }));

  const activeCenterLat = selectedStopPan ? selectedStopPan.lat : busLat;
  const activeCenterLng = selectedStopPan ? selectedStopPan.lng : busLng;

  return (
    <div className="w-full h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
      {/* Clean control/header area OUTSIDE the map in Sanchari purple design system */}
      <header className="shrink-0 bg-white border-b border-purple-100 shadow-xs px-3 sm:px-4 py-2.5 z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </button>

          {/* Bus & Route info */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs font-bold text-slate-800">
            <span className={`h-2 w-2 rounded-full ${isTripActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'} shrink-0`} />
            <span className="text-purple-950 font-extrabold">{assignedBus?.bus_number || 'College Bus'}</span>
            <span className="text-purple-300 font-normal">|</span>
            <span className="text-slate-700 font-medium hidden md:inline">
              {assignedRoute?.route_name || assignedBus?.route_name || 'Avadi to Campus'}
            </span>
            <span className="text-purple-300 font-normal hidden md:inline">|</span>
            <span className={isTripActive ? 'text-emerald-700 font-bold' : 'text-slate-500 font-medium'}>
              {isTripActive ? 'Trip Active' : 'Trip Idle'}
            </span>
          </div>

          {/* Real-Time Synchronized Counts Badge */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold shadow-2xs">
            <span className="text-amber-800" title="Waiting at stop">
              🟡 {waitingCount} Wait
            </span>
            <span className="text-slate-300 font-normal">|</span>
            <span className="text-emerald-800" title="Boarded & verified">
              🟢 {boardedCount} Boarded
            </span>
            <span className="text-slate-300 font-normal">|</span>
            <span className="text-rose-800" title="Marked absent">
              🔴 {absentCount} Absent
            </span>
            <span className="text-slate-300 font-normal hidden lg:inline">|</span>
            <span className="text-purple-900 hidden lg:inline font-semibold">
              📍 6 Sequenced Stops
            </span>
          </div>
        </div>

        {/* Start / End Trip & SOS buttons */}
        <div className="flex items-center space-x-2 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => setShowStopsDirectory((prev) => !prev)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
              showStopsDirectory
                ? 'bg-purple-700 text-white border-purple-800'
                : 'bg-white hover:bg-purple-50 text-purple-900 border-purple-200 shadow-2xs'
            }`}
          >
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            <span>6 Stops List</span>
          </button>

          {!isTripActive ? (
            <button
              type="button"
              disabled={isStartingTrip}
              onClick={onStartTrip}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isStartingTrip ? 'Starting...' : 'START TRIP'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isEndingTrip}
              onClick={onEndTrip}
              className="flex items-center space-x-2 px-3.5 sm:px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>{isEndingTrip ? 'Ending...' : 'END TRIP'}</span>
            </button>
          )}

          {assignedBus?.bus_id && (
            <DriverSosButton busId={assignedBus.bus_id} driverId={driver.driver_id} />
          )}
        </div>
      </header>

      {/* Driver Sequenced Stops Ribbon: 6 Official Locations */}
      <div className="shrink-0 bg-slate-900 text-white px-3 py-2 border-b border-slate-800 overflow-x-auto scrollbar-thin">
        <div className="flex items-center space-x-2 text-[11px] min-w-max">
          <span className="px-2 py-0.5 rounded-md bg-purple-700 text-white font-black text-[10px] tracking-wider uppercase shrink-0">
            DRIVER ROUTE
          </span>

          {driverStops.map((st) => (
            <button
              key={st.sequence}
              type="button"
              onClick={() => setSelectedStopPan({ lat: st.lat, lng: st.lng })}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 hover:bg-purple-900/80 border border-slate-700 hover:border-purple-500 transition cursor-pointer shrink-0"
              title={`${st.name} (${st.dms}) - Click to pan`}
            >
              <span className="h-4 w-4 rounded-full bg-purple-600 text-[10px] font-black flex items-center justify-center">
                {st.sequence}
              </span>
              <span className="font-bold text-slate-100">{st.name}</span>
              <span className="text-[9.5px] text-purple-300 font-mono hidden sm:inline">{st.dms}</span>
              {st.waitingCount > 0 && (
                <span className="text-amber-400 font-extrabold text-[10px]">🟡{st.waitingCount}</span>
              )}
              {st.boardedCount > 0 && (
                <span className="text-emerald-400 font-extrabold text-[10px]">🟢{st.boardedCount}</span>
              )}
              <ChevronRight className="h-3 w-3 text-slate-600" />
            </button>
          ))}

          {/* Stop #6: CAMPUS */}
          <button
            type="button"
            onClick={() => setSelectedStopPan({ lat: COLLEGE_DESTINATION.latitude, lng: COLLEGE_DESTINATION.longitude })}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-amber-400/60 text-amber-300 transition cursor-pointer shrink-0"
            title="Stop #6: CAMPUS (13°08'49.9&quot;N 80°03'30.7&quot;E)"
          >
            <span className="h-4 w-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
              6
            </span>
            <span className="font-black text-amber-200">CAMPUS</span>
            <span className="text-[9.5px] text-amber-300/80 font-mono hidden sm:inline">13°08&apos;49.9&quot;N 80°03&apos;30.7&quot;E</span>
            <span className="text-[10px]">🏫</span>
          </button>
        </div>
      </div>

      {/* Floating 6-Stops Detail Drawer */}
      {showStopsDirectory && (
        <div className="absolute top-24 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-purple-200 p-4 font-sans animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Official Route Locations (6 Stops)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowStopsDirectory(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {DRIVER_SPECIFIED_STOPS.map((st) => {
              const isCampus = st.stopNumber === 6;
              const matchedOp = operationalBoardingPoints.find(
                (op) =>
                  op.boarding_point_name.toLowerCase().includes(st.name.toLowerCase()) ||
                  st.name.toLowerCase().includes(op.boarding_point_name.toLowerCase()) ||
                  op.sequence === st.stopNumber
              );

              return (
                <div
                  key={st.stopNumber}
                  className={`p-2.5 rounded-2xl border transition text-xs ${
                    isCampus
                      ? 'bg-purple-50/80 border-purple-200'
                      : 'bg-slate-50 border-slate-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start space-x-2.5">
                      <span
                        className={`h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isCampus ? 'bg-amber-400 text-slate-950' : 'bg-purple-700 text-white'
                        }`}
                      >
                        {st.stopNumber}
                      </span>
                      <div>
                        <div className="font-extrabold text-slate-900 flex items-center space-x-1.5">
                          <span>{st.name}</span>
                          {isCampus && <span className="text-[10px]">🏫</span>}
                        </div>
                        <div className="text-[10.5px] font-mono text-purple-700 mt-0.5 font-semibold">
                          {st.dms}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {st.latitude.toFixed(6)}, {st.longitude.toFixed(6)}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStopPan({ lat: st.latitude, lng: st.longitude });
                        setShowStopsDirectory(false);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-[10.5px] font-bold shadow-xs cursor-pointer shrink-0"
                    >
                      Pan Pin
                    </button>
                  </div>

                  {!isCampus && matchedOp && (
                    <div className="flex items-center space-x-2 mt-2 pt-1.5 border-t border-slate-200/60 text-[10.5px] font-semibold text-slate-600">
                      <span>Passengers: {matchedOp.assigned_student_count}</span>
                      <span>&bull;</span>
                      <span className="text-amber-700">🟡 {matchedOp.waiting_student_count}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-700">🟢 {matchedOp.boarded_student_count}</span>
                      <span>&bull;</span>
                      <span className="text-rose-700">🔴 {matchedOp.absent_student_count}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Click &quot;Pan Pin&quot; to center map</span>
            <button
              type="button"
              onClick={() => {
                setSelectedStopPan(null); // Return to following bus
                setShowStopsDirectory(false);
              }}
              className="text-purple-700 font-bold hover:underline"
            >
              Reset to Live Bus GPS &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Clean Full-Screen Map with Bus-Specific Operational Route in Sequenced Order */}
      <div className="flex-1 w-full h-full relative">
        <MapViewer
          markers={mapMarkers}
          centerLat={activeCenterLat}
          centerLng={activeCenterLng}
          viewMode="DRIVER"
          zoom={13}
          isFullScreen={true}
          activeBusNumber={assignedBus?.bus_number}
          isTripActive={isTripActive}
          orderedIntermediateStops={intermediateStopsForRouting}
        />
      </div>
    </div>
  );
};
