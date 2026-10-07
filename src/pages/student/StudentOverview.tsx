import React from 'react';
import {
  QrCode,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { BusArrivalCountdown } from '../../components/BusArrivalCountdown.tsx';
import { StudentUser, Bus as BusType, Route, StudentDailyStatus, Trip } from '../../types/index.ts';

interface StudentOverviewProps {
  student: StudentUser;
  studentData: StudentUser | null;
  assignedBus: BusType | null;
  assignedRoute: Route | null;
  todayStatus: StudentDailyStatus | null;
  busLive: {
    bus_number: string;
    bus_status: string;
    current_lat: number | null;
    current_lng: number | null;
    gps_accuracy: number | null;
    activeTrip?: Trip | null;
    latestTrip?: Trip | null;
  } | null;
  isUpdatingStatus: boolean;
  statusFeedbackBanner: { text: string; type: 'WAITING' | 'ABSENT' | 'BOARDED' | 'INFO' } | null;
  onUpdateStatus: (status: 'WAITING' | 'ABSENT') => void;
  onNavigate: (tab: string) => void;
}

export const StudentOverview: React.FC<StudentOverviewProps> = ({
  student,
  assignedBus,
  assignedRoute,
  busLive,
  statusFeedbackBanner,
  onNavigate,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Student Welcome Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 to-indigo-900 p-5 sm:p-8 text-white shadow-xl shadow-purple-900/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-700/60 border border-purple-400/30 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-200 max-w-full truncate">
              <span>Smart Campus Transport</span>
              <span>&bull;</span>
              <span>{student.student_id}</span>
              {student.bus_number && (
                <>
                  <span>&bull;</span>
                  <span>Bus: {student.bus_number}</span>
                </>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight">
              {student.full_name}
            </h1>
            <p className="text-xs sm:text-sm text-purple-200 font-medium">
              {student.department || 'Department of Engineering'} &bull; {student.year || '3rd Year'}
            </p>
          </div>

          {/* Quick Access Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('LIVE_GPS')}
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-lg shadow-amber-400/20 active:scale-95 transition cursor-pointer min-h-[44px] w-full sm:w-auto"
            >
              <Compass className="h-4 w-4" />
              <span>Live GPS Map</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('SCAN_QR')}
              className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 active:scale-95 transition cursor-pointer min-h-[44px] w-full sm:w-auto"
            >
              <QrCode className="h-4 w-4 text-purple-300" />
              <span>Scan Bus QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-Time Next Scheduled Bus Arrival Countdown */}
      <BusArrivalCountdown
        variant="CARD"
        busNumber={assignedBus?.bus_number || student.bus_number || 'Bus'}
        busStatus={busLive?.bus_status || assignedBus?.bus_status || 'IDLE'}
        isTripActive={!!busLive?.activeTrip || busLive?.bus_status === 'ON_TRIP' || assignedBus?.bus_status === 'ON_TRIP'}
        isTripCompleted={busLive?.latestTrip?.status === 'COMPLETED'}
        busLat={busLive?.current_lat ?? assignedBus?.current_lat}
        busLng={busLive?.current_lng ?? assignedBus?.current_lng}
        studentLat={student.boarding_lat}
        studentLng={student.boarding_lng}
        stopName={student.boarding_point || 'Registered Stop'}
        routeName={assignedRoute?.route_name || assignedBus?.route_name || 'Campus Transit Route'}
        onOpenMap={() => onNavigate('LIVE_GPS')}
      />

      {/* Status Feedback Banner */}
      {statusFeedbackBanner && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-3 border shadow-xs animate-in fade-in duration-200 ${
            statusFeedbackBanner.type === 'WAITING'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : statusFeedbackBanner.type === 'ABSENT'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : statusFeedbackBanner.type === 'BOARDED'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-purple-50 border-purple-200 text-purple-900'
          }`}
        >
          <div className="h-2 w-2 rounded-full bg-current shrink-0 animate-ping" />
          <span className="flex-1">{statusFeedbackBanner.text}</span>
        </div>
      )}
    </div>
  );
};
