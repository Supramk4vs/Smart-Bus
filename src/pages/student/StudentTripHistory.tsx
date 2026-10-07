import React from 'react';
import { History, CheckCircle2, Clock, Calendar, Bus, MapPin, RefreshCw } from 'lucide-react';
import { AttendanceRecord } from '../../types/index.ts';

interface StudentTripHistoryProps {
  boardingRecords: AttendanceRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const StudentTripHistory: React.FC<StudentTripHistoryProps> = ({
  boardingRecords,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>📜 Boarding & Trip History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verified transit records synchronized with Cloud Firestore
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer shadow-xs"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-purple-700' : ''}`} />
          <span>Refresh Records</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Trips Boarded
          </span>
          <div className="text-3xl font-black text-slate-900 mt-1">{boardingRecords.length}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>QR-Verified Attendance</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Latest Boarding
          </span>
          <div className="text-lg font-black text-slate-900 mt-1">
            {boardingRecords[0]
              ? new Date(boardingRecords[0].timestamp).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })
              : 'None'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {boardingRecords[0]
              ? new Date(boardingRecords[0].timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'No records logged'}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Data Persistence
          </span>
          <div className="text-lg font-black text-purple-700 mt-1">Cloud Firestore</div>
          <div className="text-[11px] text-slate-500 mt-1">Synchronized across sessions</div>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <History className="h-4 w-4 text-purple-700" />
            <span>Chronological Attendance Log</span>
          </h2>
          <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-full">
            {boardingRecords.length} Entries
          </span>
        </div>

        {boardingRecords.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <History className="h-8 w-8 text-slate-300 mx-auto" />
            <p>No trip records recorded yet.</p>
            <p className="text-[11px] text-slate-400">
              When you scan the bus QR, verified attendance will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {boardingRecords.map((record) => (
              <div
                key={record.attendance_id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 flex items-center space-x-2">
                      <span>Bus {record.bus_number || 'College Bus'}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        VERIFIED BOARDED
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 flex items-center space-x-1.5">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <span>{record.boarding_point || 'Registered Stop'}</span>
                    </div>
                    {record.student_name && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Pass: {record.student_name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right sm:text-right text-xs">
                  <div className="font-bold text-slate-800 flex items-center sm:justify-end space-x-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {new Date(record.timestamp).toLocaleDateString([], {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-purple-700 font-semibold mt-0.5 flex items-center sm:justify-end space-x-1">
                    <Clock className="h-3 w-3 text-purple-500" />
                    <span>
                      {new Date(record.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
