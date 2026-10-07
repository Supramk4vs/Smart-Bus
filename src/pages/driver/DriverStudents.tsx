import React, { useState } from 'react';
import { Users, Phone, MapPin, CheckCircle2, Clock, Search, Filter } from 'lucide-react';
import { DriverStudentRow } from './useDriverTransportState.ts';
import { DRIVER_SPECIFIED_STOPS } from '../../types/index.ts';

interface DriverStudentsProps {
  students: DriverStudentRow[];
  onMarkBoarded?: (studentId: string) => void;
  busNumber?: string | null;
}

export const DriverStudents: React.FC<DriverStudentsProps> = ({
  students,
  onMarkBoarded,
  busNumber,
}) => {
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'BOARDED' | 'ABSENT'>('ALL');

  const getStopDetails = (boardingPointName?: string) => {
    if (!boardingPointName) return null;
    return DRIVER_SPECIFIED_STOPS.find(
      (st) =>
        st.name.toLowerCase() === boardingPointName.toLowerCase() ||
        boardingPointName.toLowerCase().includes(st.name.toLowerCase()) ||
        st.name.toLowerCase().includes(boardingPointName.toLowerCase())
    );
  };

  const filtered = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase()) ||
      (s.boarding_point && s.boarding_point.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'WAITING') return s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
    if (statusFilter === 'BOARDED') return s.today_status === 'BOARDED';
    if (statusFilter === 'ABSENT') return s.today_status === 'ABSENT' || s.today_status === 'NOT_COMING';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>👥 Assigned Students Passenger Roster</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time boarding status, stop locations, and passenger contact directory {busNumber ? `• Assigned Bus: ${busNumber}` : ''}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {busNumber && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-50 text-purple-900 border border-purple-200">
              🚌 {busNumber}
            </span>
          )}
          <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 self-start sm:self-auto">
            {students.length} Assigned Students
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search student name, ID, or boarding stop..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs focus:outline-hidden focus:border-purple-600"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'WAITING', 'BOARDED', 'ABSENT'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === filter
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {filter === 'ALL'
                ? `All (${students.length})`
                : filter === 'WAITING'
                ? `🟡 Waiting`
                : filter === 'BOARDED'
                ? `🟢 Boarded`
                : `🔴 Absent`}
            </button>
          ))}
        </div>
      </div>

      {/* Students List */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-1">
            <Users className="h-8 w-8 text-slate-300 mx-auto" />
            <p>No students match the current filter.</p>
          </div>
        ) : (
          filtered.map((s) => {
            const isWaiting = s.today_status === 'WAITING' || s.today_status === 'PLEASE_WAIT';
            const isBoarded = s.today_status === 'BOARDED';
            const isAbsent = s.today_status === 'ABSENT';

            return (
              <div
                key={s.student_id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition"
              >
                <div className="flex items-start space-x-3.5">
                  <div
                    className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                      isWaiting
                        ? 'bg-amber-100 text-amber-800'
                        : isBoarded
                        ? 'bg-emerald-100 text-emerald-800'
                        : isAbsent
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isWaiting ? '🟡' : isBoarded ? '🟢' : isAbsent ? '🔴' : '⚪'}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-xs text-slate-900">{s.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">&bull; {s.student_id}</span>
                    </div>

                    <div className="text-[11px] text-slate-600 mt-0.5 flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-purple-600" />
                      <span>{s.boarding_point || 'Stop Not Assigned'}</span>
                    </div>

                    {isWaiting && s.student_lat && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        📍 Live GPS Streaming: {s.student_lat.toFixed(4)}, {s.student_lng?.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      isWaiting
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : isBoarded
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : isAbsent
                        ? 'bg-rose-100 text-rose-900 border border-rose-300'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.today_status || 'NOT SET'}
                  </span>

                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition cursor-pointer font-bold text-xs"
                      title={`Call ${s.full_name}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      <span>Call</span>
                    </a>
                  )}

                  {!isBoarded && onMarkBoarded && (
                    <button
                      type="button"
                      onClick={() => onMarkBoarded(s.student_id)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer font-bold text-xs"
                      title="Manually verify passenger boarding"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Board</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
