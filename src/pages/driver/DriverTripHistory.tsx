import React from 'react';
import { History, Calendar, Clock, Bus, CheckCircle2 } from 'lucide-react';
import { Trip } from '../../types/index.ts';

interface DriverTripHistoryProps {
  completedTrips: Trip[];
}

export const DriverTripHistory: React.FC<DriverTripHistoryProps> = ({ completedTrips }) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>📜 Completed Trips Log</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Historical driving logs, route completion timestamps, and operational sessions
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 self-start sm:self-auto">
          {completedTrips.length} Finished Trips
        </span>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
        {completedTrips.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <History className="h-8 w-8 text-slate-300 mx-auto" />
            <p>No completed trips recorded yet.</p>
          </div>
        ) : (
          completedTrips.map((trip) => (
            <div
              key={trip.trip_id}
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
            >
              <div className="flex items-start space-x-3.5">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 flex items-center space-x-2">
                    <span>Trip {trip.trip_id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      COMPLETED
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Route: {trip.route_id || 'Campus Transit Network'} &bull; Bus: {trip.bus_id}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 sm:text-right font-mono">
                <div>
                  Start: {trip.start_time ? new Date(trip.start_time).toLocaleTimeString() : '—'}
                </div>
                <div className="text-slate-400 text-[10px]">
                  End: {trip.end_time ? new Date(trip.end_time).toLocaleTimeString() : '—'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
