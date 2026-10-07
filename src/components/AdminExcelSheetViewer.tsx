import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  Calendar,
  Bus,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  FileText,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  Bus as BusType,
  StudentUser,
  DriverUser,
  Route,
  AttendanceRecord,
  StudentDailyStatus,
  Trip,
} from '../types/index.ts';

interface AdminExcelSheetViewerProps {
  buses: BusType[];
  students: StudentUser[];
  drivers: DriverUser[];
  routes: Route[];
  attendance: AttendanceRecord[];
  studentStatuses?: StudentDailyStatus[];
  trips?: Trip[];
  onRefresh?: () => void;
}

type SheetTab = 'ATTENDANCE' | 'BUSES' | 'STUDENTS' | 'TODAY_MANIFEST';

export const AdminExcelSheetViewer: React.FC<AdminExcelSheetViewerProps> = ({
  buses,
  students,
  drivers,
  routes,
  attendance,
  studentStatuses = [],
  trips = [],
  onRefresh,
}) => {
  const [activeSheet, setActiveSheet] = useState<SheetTab>('ATTENDANCE');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBus, setFilterBus] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortField, setSortField] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);

  // Helper date & time formatters
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return `${d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })} ${d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })}`;
    } catch {
      return isoString;
    }
  };

  // Build Route Lookup Map
  const routeMap = useMemo(() => {
    const map = new Map<string, Route>();
    routes.forEach((r) => map.set(r.route_id, r));
    return map;
  }, [routes]);

  // Build Bus Lookup Map
  const busMap = useMemo(() => {
    const map = new Map<string, BusType>();
    buses.forEach((b) => map.set(b.bus_id, b));
    return map;
  }, [buses]);

  // Build Driver Lookup Map
  const driverMap = useMemo(() => {
    const map = new Map<string, DriverUser>();
    drivers.forEach((d) => map.set(d.driver_id, d));
    return map;
  }, [drivers]);

  // Build Student Lookup Map
  const studentMap = useMemo(() => {
    const map = new Map<string, StudentUser>();
    students.forEach((s) => map.set(s.student_id, s));
    return map;
  }, [students]);

  // 1. DATA PREPARATION: Attendance & Boarding Logs
  const attendanceSheetData = useMemo(() => {
    return attendance.map((rec, index) => {
      const student = studentMap.get(rec.student_id);
      const bus = busMap.get(rec.bus_id);
      const route = routeMap.get(rec.route_id || student?.route_id || bus?.route_id || '');
      const driver = driverMap.get(rec.driver_id || bus?.assigned_driver_id || '');

      return {
        '#': index + 1,
        'Attendance ID': rec.attendance_id,
        'Student ID': rec.student_id,
        'Student Name': rec.student_name || student?.full_name || 'Student',
        'Department': student?.department || 'Engineering',
        'Year': student?.year || 'N/A',
        'Student Phone': student?.phone || 'N/A',
        'Bus Number': rec.bus_number || bus?.bus_number || 'College Bus',
        'Bus ID': rec.bus_id || 'N/A',
        'Route Name': rec.route_name || route?.route_name || bus?.route_name || 'Campus Route',
        'Route ID': rec.route_id || student?.route_id || bus?.route_id || 'R-02',
        'Boarding Stop': rec.boarding_point || student?.boarding_point || 'Designated Stop',
        'Date': rec.date,
        'Boarded Timestamp': formatTimestamp(rec.timestamp),
        'Raw Timestamp': rec.timestamp,
        'Proximity': rec.distance_meters !== undefined && rec.distance_meters !== null ? `${rec.distance_meters} meters` : 'GPS Verified (<= 30m)',
        'Verification Status': rec.verification_status,
        'Boarding Latitude': rec.latitude ?? 'N/A',
        'Boarding Longitude': rec.longitude ?? 'N/A',
        'Trip ID': rec.trip_id || 'N/A',
        'Driver Name': driver?.driver_name || bus?.assigned_driver_name || 'Assigned Driver',
        'Driver Phone': driver?.phone || 'N/A',
      };
    });
  }, [attendance, studentMap, busMap, routeMap, driverMap]);

  // 2. DATA PREPARATION: Bus Fleet Details
  const busesSheetData = useMemo(() => {
    return buses.map((b, index) => {
      const driver = driverMap.get(b.assigned_driver_id || '');
      const route = routeMap.get(b.route_id || '');
      const assignedStudentsCount = students.filter((s) => s.bus_id === b.bus_id).length;
      const todayBoardedCount = attendance.filter((a) => a.bus_id === b.bus_id && a.date === new Date().toISOString().split('T')[0]).length;

      return {
        '#': index + 1,
        'Bus ID': b.bus_id,
        'Bus Number': b.bus_number,
        'Route ID': b.route_id || 'N/A',
        'Route Name': b.route_name || route?.route_name || 'Campus Route',
        'Destination': b.destination || 'Aalim Muhammed Salegh Campus',
        'Assigned Driver ID': b.assigned_driver_id || 'Unassigned',
        'Assigned Driver Name': b.assigned_driver_name || driver?.driver_name || 'Pending Driver Induction',
        'Driver Contact Phone': driver?.phone || 'N/A',
        'Driver Email': driver?.email || 'N/A',
        'Operational Status': b.bus_status,
        'Location Source': b.location_source || 'MOBILE_DRIVER_GPS',
        'Assigned Students Count': assignedStudentsCount,
        'Today Boarded Count': todayBoardedCount,
        'Current Latitude': b.current_lat ?? 'Pending broadcast',
        'Current Longitude': b.current_lng ?? 'Pending broadcast',
        'GPS Accuracy (m)': b.gps_accuracy ? `±${b.gps_accuracy.toFixed(1)}m` : 'N/A',
        'Last GPS Broadcast': formatTimestamp(b.last_gps_update),
      };
    });
  }, [buses, driverMap, routeMap, students, attendance]);

  // 3. DATA PREPARATION: Student Directory & Transit Profiles
  const studentsSheetData = useMemo(() => {
    return students.map((s, index) => {
      const bus = busMap.get(s.bus_id || '');
      const route = routeMap.get(s.route_id || bus?.route_id || '');
      const studentAttendanceLogs = attendance.filter((a) => a.student_id === s.student_id);
      const lastBoardingLog = studentAttendanceLogs[0];

      return {
        '#': index + 1,
        'Student ID': s.student_id,
        'Full Name': s.full_name,
        'Department': s.department || 'Engineering',
        'Year': s.year || 'N/A',
        'Contact Phone': s.phone || 'N/A',
        'Email Address': s.email || 'N/A',
        'Assigned Bus Number': s.bus_number || bus?.bus_number || 'N/A',
        'Assigned Bus ID': s.bus_id || 'N/A',
        'Route Name': route?.route_name || bus?.route_name || 'N/A',
        'Route ID': s.route_id || bus?.route_id || 'N/A',
        'Boarding Stop': s.boarding_point || 'Not specified',
        'Account Status': s.account_status,
        'Total Verified Rides': studentAttendanceLogs.length,
        'Last Boarded Time': lastBoardingLog ? formatTimestamp(lastBoardingLog.timestamp) : 'Never boarded',
        'Last Boarded Bus': lastBoardingLog ? lastBoardingLog.bus_number : 'N/A',
        'QR Identity Token': s.qr_identity || 'N/A',
      };
    });
  }, [students, busMap, routeMap, attendance]);

  // 4. DATA PREPARATION: Today's Live Passenger & Boarding Manifest
  const todayManifestSheetData = useMemo(() => {
    const todayDate = new Date().toISOString().split('T')[0];

    // Combine all students with their today's status or attendance
    return students.map((s, index) => {
      const bus = busMap.get(s.bus_id || '');
      const statusRecord = studentStatuses.find((st) => st.student_id === s.student_id && st.date === todayDate);
      const attendanceToday = attendance.find((a) => a.student_id === s.student_id && a.date === todayDate);

      let computedStatus = 'NOT_SET';
      if (attendanceToday || statusRecord?.status === 'BOARDED') {
        computedStatus = 'BOARDED';
      } else if (statusRecord?.status === 'WAITING' || statusRecord?.status === 'PLEASE_WAIT') {
        computedStatus = 'WAITING';
      } else if (statusRecord?.status === 'NOT_COMING' || statusRecord?.status === 'NOT_RETURNING') {
        computedStatus = 'ABSENT';
      }

      return {
        '#': index + 1,
        'Student Name': s.full_name,
        'Student ID': s.student_id,
        'Department': s.department || 'Engineering',
        'Contact Phone': s.phone || 'N/A',
        'Assigned Bus': s.bus_number || bus?.bus_number || 'N/A',
        'Boarding Stop': s.boarding_point || 'Stop Pending',
        'Today Status': computedStatus,
        'Boarded Verified': attendanceToday ? 'YES (🟢 Verified)' : 'NO',
        'Exact Boarded Time': attendanceToday ? formatTimestamp(attendanceToday.timestamp) : (statusRecord?.updated_at ? formatTimestamp(statusRecord.updated_at) : 'N/A'),
        'Boarding Proximity': attendanceToday?.distance_meters ? `${attendanceToday.distance_meters}m` : 'N/A',
        'Student GPS Lat': statusRecord?.latitude ?? attendanceToday?.latitude ?? 'N/A',
        'Student GPS Lng': statusRecord?.longitude ?? attendanceToday?.longitude ?? 'N/A',
        'Attendance ID': attendanceToday?.attendance_id || 'N/A',
      };
    });
  }, [students, busMap, studentStatuses, attendance]);

  // Filter & Search active sheet data
  const currentSheetRawData = useMemo(() => {
    switch (activeSheet) {
      case 'ATTENDANCE':
        return attendanceSheetData;
      case 'BUSES':
        return busesSheetData;
      case 'STUDENTS':
        return studentsSheetData;
      case 'TODAY_MANIFEST':
        return todayManifestSheetData;
      default:
        return attendanceSheetData;
    }
  }, [activeSheet, attendanceSheetData, busesSheetData, studentsSheetData, todayManifestSheetData]);

  // Apply Search, Bus Filter, and Date Filter
  const filteredData = useMemo(() => {
    let result = [...currentSheetRawData];

    // Bus filter
    if (filterBus !== 'ALL') {
      result = result.filter((row: any) => {
        const busVal = String(row['Bus Number'] || row['Assigned Bus Number'] || row['Assigned Bus'] || row['Bus ID'] || '');
        return busVal.includes(filterBus);
      });
    }

    // Date filter (primarily for Attendance and Manifest)
    if (filterDate !== 'ALL' && activeSheet === 'ATTENDANCE') {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      if (filterDate === 'TODAY') {
        result = result.filter((row: any) => row['Date'] === todayStr);
      } else if (filterDate === 'WEEK') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        result = result.filter((row: any) => new Date(row['Raw Timestamp'] || row['Date']) >= sevenDaysAgo);
      } else if (filterDate === 'MONTH') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        result = result.filter((row: any) => new Date(row['Raw Timestamp'] || row['Date']) >= thirtyDaysAgo);
      }
    }

    // Universal text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row: any) => {
        return Object.values(row).some((val) => String(val).toLowerCase().includes(term));
      });
    }

    // Sorting
    if (sortField) {
      result.sort((a: any, b: any) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [currentSheetRawData, filterBus, filterDate, searchTerm, sortField, sortAsc, activeSheet]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Columns for the currently active sheet
  const columns = useMemo(() => {
    if (!currentSheetRawData.length) return [];
    // Omit internal helper fields like 'Raw Timestamp'
    return Object.keys(currentSheetRawData[0]).filter((col) => col !== 'Raw Timestamp');
  }, [currentSheetRawData]);

  // --- EXPORT FUNCTION: MASTER MULTI-SHEET EXCEL WORKBOOK (.xlsx) ---
  const handleExportMasterExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Boarding Attendance Sheet
    const cleanAttendance = attendanceSheetData.map(({ 'Raw Timestamp': _, ...rest }) => rest);
    const wsAttendance = XLSX.utils.json_to_sheet(cleanAttendance);
    setWorksheetColWidths(wsAttendance, cleanAttendance);
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Boarding Attendance');

    // 2. Bus Fleet Details Sheet
    const wsBuses = XLSX.utils.json_to_sheet(busesSheetData);
    setWorksheetColWidths(wsBuses, busesSheetData);
    XLSX.utils.book_append_sheet(wb, wsBuses, 'Bus Fleet Allocation');

    // 3. Student Transit Register Sheet
    const wsStudents = XLSX.utils.json_to_sheet(studentsSheetData);
    setWorksheetColWidths(wsStudents, studentsSheetData);
    XLSX.utils.book_append_sheet(wb, wsStudents, 'Student Directory');

    // 4. Today's Passenger Status Manifest
    const wsManifest = XLSX.utils.json_to_sheet(todayManifestSheetData);
    setWorksheetColWidths(wsManifest, todayManifestSheetData);
    XLSX.utils.book_append_sheet(wb, wsManifest, "Today's Live Manifest");

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Campus_Transport_Master_Report_${todayStr}.xlsx`);
  };

  // --- EXPORT FUNCTION: CURRENT SHEET ONLY (.xlsx) ---
  const handleExportCurrentSheet = () => {
    if (!filteredData.length) return;
    const cleanData = filteredData.map((row: any) => {
      const copy = { ...row };
      delete copy['Raw Timestamp'];
      return copy;
    });

    const wb = XLSX.utils.book_new();
    const sheetNameMap: Record<SheetTab, string> = {
      ATTENDANCE: 'Boarding Attendance',
      BUSES: 'Bus Fleet Details',
      STUDENTS: 'Student Transit Directory',
      TODAY_MANIFEST: "Today's Passenger Manifest",
    };

    const ws = XLSX.utils.json_to_sheet(cleanData);
    setWorksheetColWidths(ws, cleanData);
    XLSX.utils.book_append_sheet(wb, ws, sheetNameMap[activeSheet]);

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${sheetNameMap[activeSheet].replace(/\s+/g, '_')}_${todayStr}.xlsx`);
  };

  // --- EXPORT FUNCTION: FORMATTED CSV WITH UTF-8 BOM (.csv) ---
  const handleExportCSV = () => {
    if (!filteredData.length) return;
    const cleanData = filteredData.map((row: any) => {
      const copy = { ...row };
      delete copy['Raw Timestamp'];
      return copy;
    });

    const headers = columns;
    const csvRows = [
      headers.join(','),
      ...cleanData.map((row: any) =>
        headers
          .map((header) => {
            const val = row[header] ?? '';
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          })
          .join(',')
      ),
    ];

    // Prepend UTF-8 BOM (\uFEFF) so Excel natively opens it with correct encoding
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeSheet.toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- COPY TAB-SEPARATED TSV TO CLIPBOARD (for Excel / Google Sheets Ctrl+V) ---
  const handleCopyForExcel = () => {
    if (!filteredData.length) return;
    const cleanData = filteredData.map((row: any) => {
      const copy = { ...row };
      delete copy['Raw Timestamp'];
      return copy;
    });

    const headers = columns;
    const tsvContent = [
      headers.join('\t'),
      ...cleanData.map((row: any) => headers.map((h) => String(row[h] ?? '')).join('\t')),
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 3000);
    });
  };

  // Helper to compute dynamic column widths for SheetJS
  function setWorksheetColWidths(ws: XLSX.WorkSheet, data: any[]) {
    if (!data.length) return;
    const colKeys = Object.keys(data[0]);
    ws['!cols'] = colKeys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.slice(0, 200).map((r) => String(r[key] ?? '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
    });
  }

  const handleHeaderSort = (col: string) => {
    if (sortField === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(col);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Excel Engine Header */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 text-white shadow-xl border border-emerald-700/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center space-x-1.5 rounded-md bg-emerald-500/30 px-3 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Transport Analytics &amp; Excel Exporter</span>
              </span>
              <span className="text-xs text-emerald-300 font-mono">&bull; Multi-Sheet Workbook (.xlsx)</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>Campus Transport Excel Sheets &amp; Manifests</span>
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 max-w-2xl leading-relaxed">
              Retrieve, filter, and export comprehensive spreadsheets for bus allocations, student directories, live passenger boarding manifests, and exact attendance timestamps.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportMasterExcel}
              className="inline-flex items-center space-x-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 px-5 py-3 text-xs font-black shadow-lg shadow-emerald-500/30 transition cursor-pointer border border-emerald-400"
              title="Download 4-in-1 Complete Master Excel Workbook"
            >
              <Download className="h-4 w-4" />
              <span>Download Master Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCurrentSheet}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white px-4 py-3 text-xs font-bold transition border border-white/20 cursor-pointer"
              title="Download active sheet only"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
              <span>Export Sheet (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-1.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white px-3.5 py-3 text-xs font-bold transition border border-white/20 cursor-pointer"
              title="Download UTF-8 CSV"
            >
              <FileText className="h-4 w-4 text-amber-300" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleCopyForExcel}
              className={`inline-flex items-center space-x-1.5 rounded-2xl px-3.5 py-3 text-xs font-bold transition border cursor-pointer ${
                copiedNotice
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300 font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title="Copy table to paste directly into Google Sheets or Excel"
            >
              {copiedNotice ? <Check className="h-4 w-4 text-slate-950" /> : <Copy className="h-4 w-4 text-emerald-300" />}
              <span>{copiedNotice ? 'Copied TSV!' : 'Copy for Excel'}</span>
            </button>
          </div>
        </div>

        {/* Quick Telemetry Cards */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-emerald-800/60 text-xs">
          <div className="rounded-2xl bg-emerald-950/60 p-3 border border-emerald-700/40">
            <span className="text-emerald-300 block text-[10px] font-semibold uppercase">Bus Fleet Size</span>
            <span className="font-black text-xl text-white mt-0.5 block">{buses.length} Buses</span>
          </div>

          <div className="rounded-2xl bg-emerald-950/60 p-3 border border-emerald-700/40">
            <span className="text-emerald-300 block text-[10px] font-semibold uppercase">Registered Students</span>
            <span className="font-black text-xl text-white mt-0.5 block">{students.length} Students</span>
          </div>

          <div className="rounded-2xl bg-emerald-950/60 p-3 border border-emerald-700/40">
            <span className="text-emerald-300 block text-[10px] font-semibold uppercase">Verified Boarding Logs</span>
            <span className="font-black text-xl text-emerald-300 mt-0.5 block">{attendance.length} Records</span>
          </div>

          <div className="rounded-2xl bg-emerald-950/60 p-3 border border-emerald-700/40">
            <span className="text-emerald-300 block text-[10px] font-semibold uppercase">Active Sheet Rows</span>
            <span className="font-black text-xl text-amber-300 mt-0.5 block">{filteredData.length} Rows</span>
          </div>
        </div>
      </div>

      {/* Main Excel Console Container */}
      <div className="rounded-3xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        {/* Excel Tab Bar */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              {
                id: 'ATTENDANCE',
                label: 'Boarding & Attendance Logs',
                icon: ShieldCheck,
                badge: attendance.length,
              },
              {
                id: 'BUSES',
                label: 'Bus Fleet Details & Drivers',
                icon: Bus,
                badge: buses.length,
              },
              {
                id: 'STUDENTS',
                label: 'Student Directory & Routes',
                icon: Users,
                badge: students.length,
              },
              {
                id: 'TODAY_MANIFEST',
                label: "Today's Passenger Manifest",
                icon: CheckCircle2,
                badge: students.length,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSheet === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSheet(tab.id as SheetTab);
                    setCurrentPage(1);
                  }}
                  className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-emerald-700'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
              <span>Refresh Sheet Data</span>
            </button>
          )}
        </div>

        {/* Toolbar: Search, Filters, Page Size */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeSheet.toLowerCase()} sheet by any column (name, ID, bus, route, stop, timestamp)...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bus Filter */}
            <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
              <Bus className="h-3.5 w-3.5 text-slate-500" />
              <select
                value={filterBus}
                onChange={(e) => {
                  setFilterBus(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
              >
                <option value="ALL">All Buses</option>
                {buses.map((b) => (
                  <option key={b.bus_id} value={b.bus_number}>
                    {b.bus_number} ({b.bus_id})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter (for Attendance logs) */}
            {activeSheet === 'ATTENDANCE' && (
              <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <select
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                >
                  <option value="ALL">All Dates</option>
                  <option value="TODAY">Today Only</option>
                  <option value="WEEK">Past 7 Days</option>
                  <option value="MONTH">Past 30 Days</option>
                </select>
              </div>
            )}

            {/* Rows Per Page */}
            <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>
        </div>

        {/* Excel Spreadsheet Table View */}
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            {/* Header with Sort indicators */}
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10 shadow-xs">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleHeaderSort(col)}
                    className="py-3 px-3.5 whitespace-nowrap cursor-pointer hover:bg-slate-200/80 transition select-none border-r border-slate-200 last:border-r-0"
                    title={`Click to sort by ${col}`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>{col}</span>
                      <ArrowUpDown
                        className={`h-3 w-3 ${
                          sortField === col ? 'text-emerald-700 font-black' : 'text-slate-400 opacity-60'
                        }`}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 1} className="py-16 text-center text-slate-400">
                    <FileSpreadsheet className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-sm text-slate-700">No matching records found in this sheet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try resetting your search query or adjusting the bus/date filter.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row: any, rIdx) => {
                  const isEven = rIdx % 2 === 0;
                  return (
                    <tr
                      key={rIdx}
                      className={`hover:bg-emerald-50/40 transition ${
                        isEven ? 'bg-white' : 'bg-slate-50/60'
                      }`}
                    >
                      {columns.map((col) => {
                        const cellVal = row[col];

                        // Special styling for key columns
                        if (col === 'Boarded Timestamp' || col === 'Last Boarded Time') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              <span className="font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center space-x-1 w-max">
                                <Clock className="h-3 w-3 text-purple-600" />
                                <span>{cellVal}</span>
                              </span>
                            </td>
                          );
                        }

                        if (col === 'Verification Status' || col === 'Boarded Verified') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>{cellVal}</span>
                              </span>
                            </td>
                          );
                        }

                        if (col === 'Today Status') {
                          const isBoarded = cellVal === 'BOARDED';
                          const isWaiting = cellVal === 'WAITING';
                          const isAbsent = cellVal === 'ABSENT';

                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-100 last:border-r-0">
                              <span
                                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  isBoarded
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : isWaiting
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : isAbsent
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <span>{isBoarded ? '🟢 BOARDED' : isWaiting ? '🟡 WAITING' : isAbsent ? '🔴 ABSENT' : cellVal}</span>
                              </span>
                            </td>
                          );
                        }

                        if (col === 'Student Name' || col === 'Full Name') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-sans font-bold text-slate-900 border-r border-slate-100 last:border-r-0">
                              {cellVal}
                            </td>
                          );
                        }

                        if (col === 'Bus Number' || col === 'Assigned Bus Number' || col === 'Assigned Bus') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-sans font-bold text-emerald-800 border-r border-slate-100 last:border-r-0">
                              {cellVal}
                            </td>
                          );
                        }

                        if (col === 'Route Name') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-sans font-medium text-slate-700 border-r border-slate-100 last:border-r-0">
                              {cellVal}
                            </td>
                          );
                        }

                        if (col === 'Boarding Stop') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-sans text-slate-600 border-r border-slate-100 last:border-r-0">
                              {cellVal}
                            </td>
                          );
                        }

                        if (col === 'Proximity' || col === 'Boarding Proximity') {
                          return (
                            <td key={col} className="py-2.5 px-3.5 whitespace-nowrap font-sans font-semibold text-emerald-700 border-r border-slate-100 last:border-r-0">
                              {cellVal}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col}
                            className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 border-r border-slate-100 last:border-r-0"
                          >
                            {cellVal ?? '-'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination Strip */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center space-x-2">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(currentPage * pageSize, filteredData.length)}
              </strong>{' '}
              of <strong className="text-slate-900">{filteredData.length}</strong> records in active sheet
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <span className="font-bold text-xs px-2">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
