import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Bus,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Cloud,
  ArrowUpDown,
  Navigation,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AttendanceRecord } from '../types/index.ts';

interface StudentBoardingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  records: AttendanceRecord[];
  isLoading: boolean;
  isFirestoreLive: boolean;
  onOpenScanner?: () => void;
}

export const StudentBoardingHistoryModal: React.FC<StudentBoardingHistoryModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  records,
  isLoading,
  isFirestoreLive,
  onOpenScanner,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST'>('NEWEST');

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Format time helper
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  // Filtered and sorted records
  const filteredRecords = useMemo(() => {
    let result = [...records];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.bus_number.toLowerCase().includes(term) ||
          (r.route_name && r.route_name.toLowerCase().includes(term)) ||
          (r.route_id && r.route_id.toLowerCase().includes(term)) ||
          (r.boarding_point && r.boarding_point.toLowerCase().includes(term)) ||
          r.attendance_id.toLowerCase().includes(term) ||
          r.date.includes(term)
      );
    }

    // Date range filter
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateFilter === 'TODAY') {
      result = result.filter((r) => r.date === todayStr);
    } else if (dateFilter === 'WEEK') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter((r) => new Date(r.timestamp) >= sevenDaysAgo);
    } else if (dateFilter === 'MONTH') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      result = result.filter((r) => new Date(r.timestamp) >= thirtyDaysAgo);
    }

    // Sort order
    result.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return sortOrder === 'NEWEST' ? tB - tA : tA - tB;
    });

    return result;
  }, [records, searchTerm, dateFilter, sortOrder]);

  // Download CSV export
  const handleExportCSV = () => {
    if (!filteredRecords.length) return;

    const headers = [
      'Attendance ID',
      'Date',
      'Time',
      'Bus Number',
      'Route Name',
      'Boarding Stop',
      'Proximity (Meters)',
      'Verification Status',
      'Latitude',
      'Longitude',
    ];

    const rows = filteredRecords.map((r) => [
      r.attendance_id,
      r.date,
      formatTime(r.timestamp),
      r.bus_number,
      `"${r.route_name || 'Campus Route'}"`,
      `"${r.boarding_point || 'Designated Stop'}"`,
      r.distance_meters !== undefined && r.distance_meters !== null ? `${r.distance_meters}m` : 'Verified',
      r.verification_status,
      r.latitude ?? '',
      r.longitude ?? '',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `boarding_history_${studentId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col border border-purple-100 overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-5 sm:p-6 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center space-x-1.5 rounded-full bg-purple-500/30 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-purple-200 border border-purple-400/30">
                  <History className="h-3 w-3" />
                  <span>Student Boarding Passports</span>
                </span>
                {isFirestoreLive ? (
                  <span className="flex items-center space-x-1.5 rounded-full bg-emerald-500/30 px-3 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-400/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <Cloud className="h-3 w-3" />
                    <span>Firestore Real-Time Stream</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5 rounded-full bg-amber-500/30 px-3 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-400/30">
                    <Cloud className="h-3 w-3" />
                    <span>Firestore Synced</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                <span>Past Boarding History</span>
              </h2>
              <p className="text-xs text-purple-200">
                Verified attendance records for <strong className="text-white">{studentName}</strong> ({studentId}) stored securely in Cloud Firestore
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-purple-300 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-purple-800/60 text-xs">
            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10">
              <span className="text-purple-300 block text-[10px] font-semibold uppercase">Total Rides</span>
              <span className="font-black text-lg text-white">{records.length}</span>
            </div>

            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10">
              <span className="text-purple-300 block text-[10px] font-semibold uppercase">Filtered Results</span>
              <span className="font-black text-lg text-amber-300">{filteredRecords.length}</span>
            </div>

            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10">
              <span className="text-purple-300 block text-[10px] font-semibold uppercase">Verification</span>
              <span className="font-bold text-xs text-emerald-300 flex items-center space-x-1 mt-1">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>GPS QR Proximity</span>
              </span>
            </div>

            <div className="rounded-xl bg-white/10 p-2.5 backdrop-blur-xs border border-white/10">
              <span className="text-purple-300 block text-[10px] font-semibold uppercase">Cloud Source</span>
              <span className="font-mono text-[11px] text-purple-200 block truncate mt-1">
                firestore/attendance
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Filter, Sort, Export */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by bus number, route name, boarding stop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date filter pills */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-0.5 text-[11px] font-bold text-slate-600">
              {(
                [
                  { key: 'ALL', label: 'All' },
                  { key: 'TODAY', label: 'Today' },
                  { key: 'WEEK', label: '7 Days' },
                  { key: 'MONTH', label: '30 Days' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDateFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    dateFilter === tab.key
                      ? 'bg-white text-purple-800 shadow-xs'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort toggle */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'NEWEST' ? 'OLDEST' : 'NEWEST'))}
              className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="h-3.5 w-3.5 text-purple-600" />
              <span>{sortOrder === 'NEWEST' ? 'Newest' : 'Oldest'}</span>
            </button>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!filteredRecords.length}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Content: List of Boarding Records */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 animate-spin">
                <Cloud className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-700">Connecting to Cloud Firestore...</p>
              <p className="text-[11px] text-slate-500">Retrieving your verified boarding logs and timestamps</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-purple-100 text-purple-700">
                <Bus className="h-7 w-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                {searchTerm || dateFilter !== 'ALL'
                  ? 'No matching boarding records found'
                  : 'No boarding history recorded yet'}
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || dateFilter !== 'ALL'
                  ? 'Try clearing your search query or adjusting the date range filters above.'
                  : 'When you scan the dynamic bus QR code upon entering, your verified boarding pass and GPS coordinates will appear here in real-time.'}
              </p>
              {onOpenScanner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenScanner();
                  }}
                  className="mt-2 inline-flex items-center space-x-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-md transition cursor-pointer"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Scan Bus QR Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((record, index) => {
                const isRecent = index === 0 && dateFilter === 'ALL' && !searchTerm;
                return (
                  <div
                    key={record.attendance_id || `${record.student_id}-${index}`}
                    className={`rounded-2xl border p-4 sm:p-5 transition hover:shadow-md ${
                      isRecent
                        ? 'bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/80 border-purple-300 ring-2 ring-purple-400/20'
                        : 'bg-white border-slate-200 hover:border-purple-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Bus & Route */}
                      <div className="flex items-start space-x-3.5">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                            isRecent
                              ? 'bg-purple-700 text-white shadow-purple-600/30'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          <Bus className="h-6 w-6" />
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-base text-slate-900">
                              Bus {record.bus_number}
                            </span>
                            {isRecent && (
                              <span className="rounded-full bg-purple-700 text-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                                Most Recent Ride
                              </span>
                            )}
                            <span className="rounded-md bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border border-emerald-200 flex items-center space-x-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{record.verification_status}</span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span className="flex items-center space-x-1 font-semibold text-purple-900">
                              <Navigation className="h-3.5 w-3.5 text-purple-600" />
                              <span>{record.route_name || 'Campus Route'}</span>
                            </span>

                            {record.boarding_point && (
                              <span className="flex items-center space-x-1 text-slate-600">
                                <MapPin className="h-3.5 w-3.5 text-rose-500" />
                                <span>Stop: {record.boarding_point}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Date, Time & Proximity */}
                      <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-1 shrink-0">
                        <div className="flex items-center space-x-1.5 text-xs font-black text-slate-900">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          <span>{formatDate(record.timestamp)}</span>
                        </div>

                        <div className="flex items-center space-x-1.5 text-xs font-semibold text-purple-700">
                          <Clock className="h-3.5 w-3.5 text-purple-500" />
                          <span>{formatTime(record.timestamp)}</span>
                        </div>

                        {record.distance_meters !== undefined && record.distance_meters !== null && (
                          <div className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            <span>Proximity: {record.distance_meters}m (&le; 30m)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Metadata Bar */}
                    <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                          ID: {record.attendance_id}
                        </span>
                        {record.trip_id && (
                          <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md">
                            Trip: {record.trip_id}
                          </span>
                        )}
                        {typeof record.latitude === 'number' && typeof record.longitude === 'number' && (
                          <span className="inline-flex items-center space-x-1 text-slate-500 font-mono">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span>
                              {record.latitude.toFixed(4)}°, {record.longitude.toFixed(4)}°
                            </span>
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-slate-400">
                        Synced with Cloud Firestore collection: <strong>attendance</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Digital Boarding Pass valid for campus transport audits</span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenScanner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold shadow-sm transition cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Scan New Ride</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-200 hover:bg-slate-300 px-4 py-2 text-xs font-bold text-slate-800 transition cursor-pointer"
            >
              Close History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
