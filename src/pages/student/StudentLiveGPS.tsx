import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { MapViewer, MapMarkerPoint } from '../../components/MapViewer.tsx';
import { BusArrivalCountdown } from '../../components/BusArrivalCountdown.tsx';
import { StudentUser, Bus as BusType, Route, StudentDailyStatus, COLLEGE_DESTINATION, Trip } from '../../types/index.ts';

interface StudentLiveGPSProps {
  student: StudentUser;
  studentData: StudentUser | null;
  assignedBus: BusType | null;
  assignedRoute: Route | null;
  todayStatus: StudentDailyStatus | null;
  studentCoords: { lat: number; lng: number; accuracy: number | null } | null;
  busLive: {
    bus_number: string;
    bus_status: string;
    current_lat: number | null;
    current_lng: number | null;
    gps_accuracy: number | null;
    last_gps_update: string | null;
    location_source: string;
    activeTrip?: Trip | null;
    latestTrip?: Trip | null;
  } | null;
  onUpdateStatus: (status: 'WAITING' | 'ABSENT') => void;
  onBackToDashboard?: () => void;
}

export const StudentLiveGPS: React.FC<StudentLiveGPSProps> = ({
  student,
  studentData,
  assignedBus,
  assignedRoute,
  todayStatus,
  studentCoords,
  busLive,
  onUpdateStatus,
  onBackToDashboard,
}) => {
  const currentStatus = todayStatus?.status || 'NOT_SET';
  const isWaiting = currentStatus === 'WAITING' || currentStatus === 'PLEASE_WAIT';
  const isAbsent = currentStatus === 'NOT_COMING' || (currentStatus as string) === 'ABSENT';
  const isBoarded = currentStatus === 'BOARDED';

  // Construct Map Markers
  const mapMarkers: MapMarkerPoint[] = [];

  // 1. Destination Marker (Aalim Muhammed Salegh College of Engineering)
  mapMarkers.push({
    id: 'ams-college-destination',
    lat: COLLEGE_DESTINATION.latitude,
    lng: COLLEGE_DESTINATION.longitude,
    type: 'DESTINATION',
    title: COLLEGE_DESTINATION.name,
    subtitle: COLLEGE_DESTINATION.address,
  });

  // 2. Bus Live Location Marker
  const busLat = busLive?.current_lat ?? assignedBus?.current_lat;
  const busLng = busLive?.current_lng ?? assignedBus?.current_lng;
  if (busLat && busLng) {
    mapMarkers.push({
      id: 'assigned-bus-marker',
      lat: busLat,
      lng: busLng,
      type: 'BUS',
      title: `${assignedBus?.bus_number || student.bus_number || 'College Bus'} (Live)`,
      subtitle: `Status: ${busLive?.bus_status || assignedBus?.bus_status || 'ON_TRIP'}`,
      accuracy: busLive?.gps_accuracy ?? undefined,
    });
  }

  // 3. Official Registered Boarding Point (Reference Stop)
  const officialBoardingLat = studentData?.boarding_lat ?? student.boarding_lat;
  const officialBoardingLng = studentData?.boarding_lng ?? student.boarding_lng;
  if (officialBoardingLat && officialBoardingLng) {
    mapMarkers.push({
      id: 'official-boarding-stop-marker',
      lat: officialBoardingLat,
      lng: officialBoardingLng,
      type: 'BOARDING_POINT',
      title: `Official Stop: ${student.boarding_point || 'Registered Stop'}`,
      subtitle: 'Official designated pickup location',
    });
  }

  // 4. Student Status Marker
  let studentPinLat: number | null = null;
  let studentPinLng: number | null = null;

  if (isWaiting && studentCoords?.lat && studentCoords?.lng) {
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
      title: `${student.full_name} (${isWaiting && studentCoords ? 'Live Mobile GPS' : 'Stop Location'})`,
      subtitle: student.boarding_point ? `Stop: ${student.boarding_point} • Status: ${todayStatus?.status || 'Not Set'}` : undefined,
      accuracy: studentCoords?.accuracy ?? undefined,
    });
  }

  const busNumberDisplay = assignedBus?.bus_number || student.bus_number || 'TN 22 CZ 4102';
  const routeNameDisplay = assignedRoute?.route_name || assignedBus?.route_name || 'Avadi to Campus';
  const isTripActive = !!busLive?.activeTrip || busLive?.bus_status === 'ON_TRIP' || assignedBus?.bus_status === 'ON_TRIP';
  const isTripCompleted = busLive?.latestTrip?.status === 'COMPLETED';

  return (
    <div className="w-full h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] flex flex-col bg-slate-50 overflow-hidden">
      {/* 1. Sanchari / Page Header (OUTSIDE & ABOVE THE MAP) */}
      <header className="shrink-0 bg-white border-b border-purple-100 px-3 sm:px-5 py-2.5 z-10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold border border-purple-200 transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-purple-50/70 border border-purple-200 font-bold text-purple-950 flex items-center space-x-1.5">
              <span className="text-purple-600 font-semibold">Assigned Bus:</span>
              <span className="font-extrabold">{busNumberDisplay}</span>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-700 flex items-center space-x-1.5">
              <span className="text-slate-400 font-semibold">Route:</span>
              <span className="font-bold text-slate-800 truncate max-w-[160px] sm:max-w-[220px]">
                {routeNameDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Student Status Controls */}
        <div className="flex items-center space-x-2 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => onUpdateStatus('WAITING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-xs cursor-pointer ${
              isWaiting
                ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300'
                : 'bg-white text-amber-900 border-amber-200 hover:bg-amber-50'
            }`}
          >
            🟡 WAITING
          </button>
          <button
            type="button"
            onClick={() => onUpdateStatus('ABSENT')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition border shadow-xs cursor-pointer ${
              isAbsent
                ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400'
                : 'bg-white text-rose-900 border-rose-200 hover:bg-rose-50'
            }`}
          >
            🔴 ABSENT
          </button>
        </div>
      </header>

      {/* 2. Bus Arrival Countdown Card (ABOVE THE MAP, visually separated) */}
      <section className="shrink-0 px-3 sm:px-5 py-2.5 bg-slate-50 border-b border-purple-100/60">
        <BusArrivalCountdown
          variant="ABOVE_MAP"
          busNumber={busNumberDisplay}
          busStatus={busLive?.bus_status || assignedBus?.bus_status || 'IDLE'}
          isTripActive={isTripActive}
          isTripCompleted={isTripCompleted}
          busLat={busLat}
          busLng={busLng}
          studentLat={studentPinLat}
          studentLng={studentPinLng}
          stopName={student.boarding_point || 'Designated Stop'}
          routeName={routeNameDisplay}
        />
      </section>

      {/* 3. Full Map (Clean Google Map, Full Height, No Overlapping Cards) */}
      <div className="flex-1 w-full h-full min-h-[300px] relative">
        <MapViewer
          markers={mapMarkers}
          centerLat={studentPinLat ?? busLat}
          centerLng={studentPinLng ?? busLng}
          viewMode="STUDENT"
          zoom={13}
          isFullScreen={true}
          activeBusNumber={assignedBus?.bus_number || student.bus_number || undefined}
        />
      </div>
    </div>
  );
};
