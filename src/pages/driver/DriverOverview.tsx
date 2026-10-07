import React from 'react';
import {
  Bus,
  Play,
  Square,
  Users,
  Compass,
  Radio,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  MapPin,
} from 'lucide-react';
import {
  DriverUser,
  Bus as BusType,
  Trip,
  Route,
  OperationalBoardingPoint,
  DRIVER_SPECIFIED_STOPS,
  COLLEGE_DESTINATION,
} from '../../types/index.ts';

interface DriverOverviewProps {
  driver: DriverUser;
  assignedBus: BusType | null;
  assignedRoute?: Route | null;
  operationalBoardingPoints?: OperationalBoardingPoint[];
  activeTrip: Trip | null;
  waitingCount: number;
  boardedCount: number;
  absentCount: number;
  notSetCount: number;
  isStartingTrip: boolean;
  isEndingTrip: boolean;
  isGpsActive: boolean;
  onStartTrip: () => void;
  onEndTrip: () => void;
  onNavigate: (tab: string) => void;
}

export const DriverOverview: React.FC<DriverOverviewProps> = ({
  driver,
  assignedBus,
  assignedRoute,
  operationalBoardingPoints = [],
  activeTrip,
  waitingCount,
  boardedCount,
  absentCount,
  notSetCount,
  isStartingTrip,
  isEndingTrip,
  isGpsActive,
  onStartTrip,
  onEndTrip,
  onNavigate,
}) => {
  const isTripActive = !!activeTrip;

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Driver Identity Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-800 to-indigo-900 p-5 sm:p-8 text-white shadow-xl shadow-purple-900/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-700/60 border border-purple-400/30 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-purple-200">
              <Bus className="h-3.5 w-3.5" />
              <span>Pilot Dashboard &bull; {driver.driver_id}</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight">{driver.driver_name}</h1>
            <p className="text-xs sm:text-sm text-purple-200">
              Assigned Bus:{' '}
              <strong className="text-white">
                {assignedBus?.bus_number || driver.bus_number || 'Bus'}
              </strong>
              {assignedRoute?.route_name && (
                <>
                  {' '}&bull; Route:{' '}
                  <strong className="text-amber-200">{assignedRoute.route_name}</strong>
                </>
              )}
            </p>
          </div>

          {/* Quick Access to GPS Map */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => onNavigate('BUS_GPS')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-lg shadow-amber-400/20 active:scale-95 transition cursor-pointer min-h-[44px]"
            >
              <Compass className="h-4 w-4" />
              <span>Open Bus GPS</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary Trip Control Card */}
      <div className="rounded-3xl bg-white p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trip Navigation Status
            </span>
            <div className="text-base sm:text-xl font-black text-slate-900 flex items-center space-x-2 mt-0.5">
              <span>{isTripActive ? 'TRIP ACTIVE & BROADCASTING' : 'IDLE / NOT ON TRIP'}</span>
              {isTripActive && <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />}
            </div>
          </div>
        </div>

        {/* Start / End Trip Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          {!isTripActive ? (
            <button
              type="button"
              disabled={isStartingTrip}
              onClick={onStartTrip}
              className="flex-1 flex items-center justify-center space-x-3 py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/25 active:scale-95 transition cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>{isStartingTrip ? 'Starting Live Trip...' : 'START TRIP (Activate Mobile GPS)'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isEndingTrip}
              onClick={onEndTrip}
              className="flex-1 flex items-center justify-center space-x-3 py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-600/25 active:scale-95 transition cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              <Square className="h-5 w-5 fill-current" />
              <span>{isEndingTrip ? 'Ending Trip...' : 'END TRIP (Stop Tracking)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Student Status Summary Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Today&apos;s Student Attendance Status (Synchronized Real-Time)
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('STUDENTS')}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
          >
            View Full Students Roster &rarr;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Waiting Card */}
          <div className="rounded-3xl bg-amber-50 p-4 sm:p-6 border border-amber-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-800 uppercase tracking-wider">
                🟡 WAITING
              </span>
              <span className="text-xl sm:text-2xl">🟡</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-amber-950 mt-1 sm:mt-2">{waitingCount}</div>
            <p className="text-xs text-amber-700 mt-1 font-medium">
              Waiting at stops &bull; Live Mobile GPS displayed
            </p>
          </div>

          {/* Boarded Card */}
          <div className="rounded-3xl bg-emerald-50 p-4 sm:p-6 border border-emerald-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">
                🟢 BOARDED
              </span>
              <span className="text-xl sm:text-2xl">🟢</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-emerald-950 mt-1 sm:mt-2">{boardedCount}</div>
            <p className="text-xs text-emerald-700 mt-1 font-medium">
              Successfully scanned bus QR code / verified
            </p>
          </div>

          {/* Absent Card */}
          <div className="rounded-3xl bg-rose-50 p-4 sm:p-6 border border-rose-200/80 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-800 uppercase tracking-wider">
                🔴 ABSENT
              </span>
              <span className="text-xl sm:text-2xl">🔴</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-rose-950 mt-1 sm:mt-2">{absentCount}</div>
            <p className="text-xs text-rose-700 mt-1 font-medium">
              Not coming today &bull; Skip their stop
            </p>
          </div>
        </div>
      </div>

      {/* Sequenced Bus-Specific Operational Route Stops: All 6 Locations */}
      <div className="rounded-3xl bg-white p-4 sm:p-6 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <span>📍 Operational Route Sequence (6 Official Locations)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Stops ordered in verified travel sequence with precise GPS coordinates
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('BUS_GPS')}
            className="text-xs font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
          >
            View on GPS Map &rarr;
          </button>
        </div>

        <div className="space-y-2 pt-2">
          {DRIVER_SPECIFIED_STOPS.slice(0, 5).map((spec) => {
            const matchedBp = operationalBoardingPoints.find(
              (bp) =>
                bp.boarding_point_name.toLowerCase().includes(spec.name.toLowerCase()) ||
                spec.name.toLowerCase().includes(bp.boarding_point_name.toLowerCase()) ||
                bp.sequence === spec.stopNumber
            );

            return (
              <div
                key={spec.stopNumber}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs hover:border-purple-200 transition"
              >
                <div className="flex items-center space-x-3">
                  <span className="h-6 w-6 rounded-full bg-purple-700 text-white font-black text-xs flex items-center justify-center shrink-0">
                    {spec.stopNumber}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{spec.name}</span>
                      <span className="text-[10px] font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-sm">
                        {spec.dms}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {matchedBp ? `${matchedBp.assigned_student_count} registered passenger${matchedBp.assigned_student_count === 1 ? '' : 's'}` : 'Scheduled transit stop'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-bold text-[11px]">
                  <span className="text-amber-800" title="Waiting">
                    🟡 {matchedBp?.waiting_student_count || 0}
                  </span>
                  <span className="text-emerald-800" title="Boarded">
                    🟢 {matchedBp?.boarded_student_count || 0}
                  </span>
                  <span className="text-rose-800" title="Absent">
                    🔴 {matchedBp?.absent_student_count || 0}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Stop #6: CAMPUS Final Destination */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs">
            <div className="flex items-center space-x-3">
              <span className="h-6 w-6 rounded-full bg-purple-950 text-amber-300 font-black text-xs flex items-center justify-center shrink-0">
                6
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-black text-purple-950">CAMPUS</span>
                  <span className="text-[10px] font-mono text-indigo-800 bg-amber-200/70 px-1.5 py-0.5 rounded-sm font-semibold">
                    13°08&apos;49.9&quot;N 80°03&apos;30.7&quot;E
                  </span>
                </div>
                <span className="text-[11px] text-purple-700 block">
                  {COLLEGE_DESTINATION.name} • {COLLEGE_DESTINATION.shortAddress}
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-200 text-purple-950 font-extrabold text-[10px]">
              FINAL DESTINATION
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
