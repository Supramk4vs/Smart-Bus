import React from 'react';
import { Bus, MapPin, Phone, Users, Shield, Compass } from 'lucide-react';
import { StudentUser, Bus as BusType, Route } from '../../types/index.ts';

interface StudentMyBusProps {
  student: StudentUser;
  assignedBus: BusType | null;
  assignedRoute: Route | null;
  busLive: {
    bus_number: string;
    bus_status: string;
    current_lat: number | null;
    current_lng: number | null;
    gps_accuracy: number | null;
    last_gps_update: string | null;
  } | null;
  onNavigate: (tab: string) => void;
}

export const StudentMyBus: React.FC<StudentMyBusProps> = ({
  student,
  assignedBus,
  assignedRoute,
  busLive,
  onNavigate,
}) => {
  const driverName = assignedBus?.assigned_driver_name || assignedRoute?.driver_name || 'Designated Driver';
  const driverPhone = assignedRoute?.driver_phone || '+91 98765 43210';
  const boardingPoints = assignedRoute?.boarding_points || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>🚌 My Bus Details</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assigned college transit vehicle, route trajectory, and designated stop points
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('LIVE_GPS')}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-md transition cursor-pointer"
        >
          <Compass className="h-4 w-4" />
          <span>Track on Live GPS</span>
        </button>
      </div>

      {/* Bus Specs & Driver Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Bus Card */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Bus className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
                Vehicle Roster
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {assignedBus?.bus_number || student.bus_number || 'Campus Bus'}
              </h2>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Bus Identifier:</span>
              <span className="font-bold font-mono text-slate-800">
                {assignedBus?.bus_id || 'BUS-01'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Bus Status:</span>
              <span className="font-extrabold text-purple-700 uppercase">
                {busLive?.bus_status || assignedBus?.bus_status || 'IDLE'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">College Destination:</span>
              <span className="font-bold text-slate-800">
                Aalim Muhammed Salegh College of Engineering
              </span>
            </div>
          </div>
        </div>

        {/* Driver Contact Card */}
        <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Assigned Pilot
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {driverName}
              </h2>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Pilot ID:</span>
              <span className="font-bold font-mono text-slate-800">
                {assignedBus?.assigned_driver_id || 'DRV-101'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Verified Contact:</span>
              <span className="font-bold text-slate-800">
                {driverPhone}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Safety Verification:</span>
              <span className="font-bold text-emerald-600 flex items-center space-x-1">
                <Shield className="h-3.5 w-3.5" />
                <span>Certified Campus Transport Driver</span>
              </span>
            </div>
          </div>

          {driverPhone && (
            <a
              href={`tel:${driverPhone}`}
              className="w-full inline-flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm"
            >
              <Phone className="h-4 w-4" />
              <span>Call Driver</span>
            </a>
          )}
        </div>
      </div>

      {/* Route Stops Sequence */}
      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5 text-purple-700" />
            <h2 className="text-base font-bold text-slate-900">
              Route Stops: {assignedRoute?.route_name || 'Campus Transit Network'}
            </h2>
          </div>
          <span className="text-xs bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full">
            {boardingPoints.length} Stops
          </span>
        </div>

        {boardingPoints.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No stops configured for this bus route yet.
          </p>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-purple-200">
            {boardingPoints.map((stopName: string, index: number) => {
              const isMyStop =
                student.boarding_point?.toLowerCase().trim() ===
                stopName.toLowerCase().trim();

              return (
                <div key={stopName + index} className="relative flex items-center space-x-3">
                  <div
                    className={`absolute -left-6 h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 bg-white ${
                      isMyStop
                        ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div
                    className={`flex-1 p-3.5 rounded-2xl border transition ${
                      isMyStop
                        ? 'bg-purple-50/70 border-purple-300 shadow-xs ring-1 ring-purple-200'
                        : 'bg-slate-50/50 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 flex items-center space-x-2">
                        <span>{stopName}</span>
                        {isMyStop && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 text-[10px] font-black">
                            YOUR REGISTERED STOP 📍
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
