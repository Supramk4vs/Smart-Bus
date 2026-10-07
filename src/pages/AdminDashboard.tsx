import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus as BusIcon,
  Users,
  Compass,
  MapPin,
  ClipboardList,
  AlertTriangle,
  Radio,
  FileSpreadsheet,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  KeyRound,
  Upload,
  ArrowRight,
  ShieldAlert,
  Send,
  Bell,
  Check,
  Eye,
  Settings,
  Plus,
  Trash2,
  Shield,
  X,
  Lock,
  Database,
  Download,
  Copy,
  FileText,
  HardDrive,
  Pencil,
  Cloud,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import { FirestoreService } from '../lib/firestoreSync.ts';
import {
  AdminUser,
  StudentUser,
  DriverUser,
  Bus,
  Route,
  AttendanceRecord,
  Complaint,
  BreakdownReport,
  EmergencyEvent,
  SystemNotification,
  StudentDailyStatus,
  Trip,
  ImportAuditReport,
  BusStatus,
  COLLEGE_DESTINATION,
} from '../types/index.ts';
import { MapViewer, MapMarkerPoint } from '../components/MapViewer.tsx';
import { AdminEmergencyBanner } from '../components/AdminEmergencyBanner.tsx';
import { AdminExcelSheetViewer } from '../components/AdminExcelSheetViewer.tsx';
import { BoardingPointPickerMap } from '../components/BoardingPointPickerMap.tsx';

interface AdminDashboardProps {
  activeNav?: string;
  onNavigate?: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ activeNav, onNavigate }) => {
  const { user } = useAuth();
  const admin = user as AdminUser;

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'FLEET_MAP' | 'STUDENTS' | 'DRIVERS' | 'ADMINS' | 'BUSES_ROUTES' | 'ATTENDANCE' | 'EXCEL_SHEETS' | 'COMPLAINTS' | 'IMPORTER' | 'DATABASE'
  >('OVERVIEW');

  useEffect(() => {
    if (!activeNav) return;
    if (activeNav === 'DASHBOARD') setActiveTab('OVERVIEW');
    else if (activeNav === 'FLEET_GPS') setActiveTab('FLEET_MAP');
    else if (activeNav === 'STUDENTS') setActiveTab('STUDENTS');
    else if (activeNav === 'DRIVERS') setActiveTab('DRIVERS');
    else if (activeNav === 'BUSES' || activeNav === 'BOARDING_POINTS') setActiveTab('BUSES_ROUTES');
    else if (activeNav === 'TRIPS') setActiveTab('ATTENDANCE');
    else if (activeNav === 'REPORTS') setActiveTab('EXCEL_SHEETS');
    else if (activeNav === 'COMPLAINTS') setActiveTab('COMPLAINTS');
    else if (activeNav === 'PROFILE') setActiveTab('ADMINS');
    else if (activeNav === 'SETTINGS') setActiveTab('DATABASE');
  }, [activeNav]);

  // Map Centering Override (e.g. when zooming into an emergency bus)
  const [mapCenterOverride, setMapCenterOverride] = useState<{ lat: number; lng: number } | null>(null);

  // Database Access and Raw Inspector State
  const [rawDbData, setRawDbData] = useState<any>(null);
  const [dbFilePath, setDbFilePath] = useState<string>('data/db.json');
  const [dbEditorContent, setDbEditorContent] = useState<string>('');
  const [dbFilterKey, setDbFilterKey] = useState<string>('ALL');
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);
  const [isSavingDb, setIsSavingDb] = useState<boolean>(false);
  const [dbCounts, setDbCounts] = useState<Record<string, number>>({});

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState<{
    totalStudents: number;
    totalDrivers: number;
    totalBuses: number;
    totalRoutes: number;
    activeTripsCount: number;
    activeTrips: Trip[];
    waitingCount: number;
    absentCount: number;
    boardedCount: number;
    attendanceTodayCount: number;
    totalAttendance: number;
    openComplaintsCount: number;
    activeBreakdownsCount: number;
    breakdowns: BreakdownReport[];
    emergencies?: EmergencyEvent[];
    activeEmergencies?: EmergencyEvent[];
    activeEmergenciesCount?: number;
    studentStatuses?: StudentDailyStatus[];
    todayStatuses?: StudentDailyStatus[];
  } | null>(null);

  // Entities
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [students, setStudents] = useState<StudentUser[]>([]);
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyEvent[]>([]);
  const [studentStatuses, setStudentStatuses] = useState<StudentDailyStatus[]>([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBus, setFilterBus] = useState<string>('ALL');

  // Toast feedback state (replaces window.alert)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  };

  // Broadcast announcement
  const [announcementTitle, setAnnouncementTitle] = useState<string>('');
  const [announcementMsg, setAnnouncementMsg] = useState<string>('');
  const [announcementTarget, setAnnouncementTarget] = useState<'ALL' | 'STUDENT' | 'DRIVER'>('ALL');
  const [broadcastSuccess, setBroadcastSuccess] = useState<boolean>(false);

  // Dataset Importer state
  const [importDatasetType, setImportDatasetType] = useState<'students' | 'drivers' | 'admins' | 'buses'>('students');
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importMode, setImportMode] = useState<'REPLACE' | 'APPEND'>('REPLACE');
  const [importReport, setImportReport] = useState<ImportAuditReport | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Password reset prompt modal
  const [targetResetUser, setTargetResetUser] = useState<{ id: string; name: string; role?: string } | null>(null);
  const [resetPassValue, setResetPassValue] = useState<string>('campus123');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Entity creation modals
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState<boolean>(false);
  const [showAddAdminModal, setShowAddAdminModal] = useState<boolean>(false);
  const [showAddBusModal, setShowAddBusModal] = useState<boolean>(false);
  const [showAddRouteModal, setShowAddRouteModal] = useState<boolean>(false);

  // Entity deletion modal (replaces window.confirm)
  const [targetDelete, setTargetDelete] = useState<{
    type: 'STUDENT' | 'DRIVER' | 'ADMIN' | 'BUS' | 'ROUTE';
    id: string;
    name: string;
  } | null>(null);

  // Form states
  const [studentForm, setStudentForm] = useState({
    student_id: '',
    full_name: '',
    email: '',
    phone: '',
    department: 'Computer Science and Engineering',
    year: '1st Year',
    bus_id: '',
    boarding_point: '',
    boarding_lat: null as number | null,
    boarding_lng: null as number | null,
    initialPassword: 'campus123',
  });

  const [driverForm, setDriverForm] = useState({
    driver_id: '',
    driver_name: '',
    phone: '',
    email: '',
    assigned_bus_id: '',
    initialPassword: 'campus123',
  });

  const [adminForm, setAdminForm] = useState({
    admin_id: '',
    name: '',
    email: '',
    phone: '',
    initialPassword: 'campus123',
  });

  const [busForm, setBusForm] = useState({
    bus_id: '',
    bus_number: '',
    route_id: '',
    assigned_driver_id: '',
  });

  const [routeForm, setRouteForm] = useState({
    route_id: '',
    route_name: '',
    destination: 'College Campus',
    driver_name: '',
    driver_phone: '',
    boarding_points: '',
  });

  // Edit Entity states
  const [editingStudent, setEditingStudent] = useState<StudentUser | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    year: '',
    bus_id: '',
    boarding_point: '',
    boarding_lat: null as number | null,
    boarding_lng: null as number | null,
    account_status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [editingDriver, setEditingDriver] = useState<DriverUser | null>(null);
  const [editDriverForm, setEditDriverForm] = useState({
    driver_name: '',
    phone: '',
    email: '',
    assigned_bus_id: '',
    account_status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    account_status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  const [editingBus, setEditingBus] = useState<Bus | null>(null);
  const [editBusForm, setEditBusForm] = useState({
    bus_number: '',
    route_id: '',
    assigned_driver_id: '',
    bus_status: 'IDLE' as BusStatus,
  });

  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editRouteForm, setEditRouteForm] = useState({
    route_name: '',
    destination: '',
    driver_name: '',
    driver_phone: '',
    boarding_points: '',
  });

  const openEditStudent = (s: StudentUser) => {
    setEditingStudent(s);
    setEditStudentForm({
      full_name: s.full_name,
      email: s.email || '',
      phone: s.phone || '',
      department: s.department || 'Computer Science and Engineering',
      year: s.year || '1st Year',
      bus_id: s.bus_id || '',
      boarding_point: s.boarding_point || '',
      boarding_lat: s.boarding_lat ?? null,
      boarding_lng: s.boarding_lng ?? null,
      account_status: s.account_status,
    });
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await Api.updateStudent(editingStudent.student_id, editStudentForm);
      try {
        await FirestoreService.updateStudent(editingStudent.student_id, editStudentForm);
      } catch (fErr) {
        console.warn('Firestore sync note:', fErr);
      }
      showToast(`Student ${editStudentForm.full_name} updated successfully in Firestore.`);
      setEditingStudent(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update student.', 'error');
    }
  };

  const openEditDriver = (d: DriverUser) => {
    setEditingDriver(d);
    setEditDriverForm({
      driver_name: d.driver_name,
      phone: d.phone || '',
      email: d.email || '',
      assigned_bus_id: d.assigned_bus_id || '',
      account_status: d.account_status,
    });
  };

  const handleSaveEditDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    try {
      await Api.updateDriver(editingDriver.driver_id, editDriverForm);
      try {
        await FirestoreService.updateDriver(editingDriver.driver_id, editDriverForm);
      } catch (fErr) {
        console.warn('Firestore sync note:', fErr);
      }
      showToast(`Driver ${editDriverForm.driver_name} updated successfully in Firestore.`);
      setEditingDriver(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update driver.', 'error');
    }
  };

  const openEditAdmin = (a: AdminUser) => {
    setEditingAdmin(a);
    setEditAdminForm({
      name: a.name,
      email: a.email || '',
      phone: a.phone || '',
      account_status: a.account_status,
    });
  };

  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    try {
      await Api.updateAdmin(editingAdmin.admin_id, editAdminForm);
      try {
        await FirestoreService.updateAdmin(editingAdmin.admin_id, editAdminForm);
      } catch (fErr) {
        console.warn('Firestore sync note:', fErr);
      }
      showToast(`Admin ${editAdminForm.name} updated successfully in Firestore.`);
      setEditingAdmin(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update admin.', 'error');
    }
  };

  const openEditBus = (b: Bus) => {
    setEditingBus(b);
    setEditBusForm({
      bus_number: b.bus_number,
      route_id: b.route_id || '',
      assigned_driver_id: b.assigned_driver_id || '',
      bus_status: b.bus_status,
    });
  };

  const handleSaveEditBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBus) return;
    try {
      await Api.updateBus(editingBus.bus_id, editBusForm);
      try {
        await FirestoreService.updateBus(editingBus.bus_id, editBusForm);
      } catch (fErr) {
        console.warn('Firestore sync note:', fErr);
      }
      showToast(`Bus ${editBusForm.bus_number} updated successfully in Firestore.`);
      setEditingBus(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update bus.', 'error');
    }
  };

  const openEditRoute = (r: Route) => {
    setEditingRoute(r);
    setEditRouteForm({
      route_name: r.route_name,
      destination: r.destination || 'College Campus',
      driver_name: r.driver_name || '',
      driver_phone: r.driver_phone || '',
      boarding_points: r.boarding_points?.join(', ') || '',
    });
  };

  const handleSaveEditRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute) return;
    try {
      const updates = {
        route_name: editRouteForm.route_name,
        destination: editRouteForm.destination,
        driver_name: editRouteForm.driver_name,
        driver_phone: editRouteForm.driver_phone,
        boarding_points: editRouteForm.boarding_points
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await Api.updateRoute(editingRoute.route_id, updates);
      try {
        await FirestoreService.updateRoute(editingRoute.route_id, updates);
      } catch (fErr) {
        console.warn('Firestore sync note:', fErr);
      }
      showToast(`Route ${editRouteForm.route_name} updated successfully in Firestore.`);
      setEditingRoute(null);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update route.', 'error');
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(loadAllData, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadAllData = async () => {
    try {
      const [dash, u, b, r, att, cmp, notif] = await Promise.all([
        Api.getAdminDashboard(),
        Api.getUsers(),
        Api.getBuses(),
        Api.getRoutes(),
        Api.getAttendance(),
        Api.getComplaints(),
        Api.getNotifications(),
      ]);

      setDashboardStats(dash);
      setAdmins(u.admins || []);
      setStudents(u.students || []);
      setDrivers(u.drivers || []);
      setBuses(b || []);
      setRoutes(r || []);
      setAttendance(att || []);
      setComplaints(cmp || []);
      setNotifications(notif || []);
      if (dash?.studentStatuses) {
        setStudentStatuses(dash.studentStatuses);
      }

      // Auto-sync active records to Cloud Firestore collections
      FirestoreService.syncInitialDataToFirestore({
        students: u.students || [],
        drivers: u.drivers || [],
        admins: u.admins || [],
        buses: b || [],
        routes: r || [],
      }).catch((err) => console.warn('Background Firestore sync:', err));
    } catch (e) {
      console.warn('Error loading admin data:', e);
    }
  };

  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);

  const handleSyncAllToFirestore = async () => {
    setIsSyncingFirestore(true);
    try {
      const ok = await FirestoreService.syncInitialDataToFirestore({
        students,
        drivers,
        admins,
        buses,
        routes,
      });
      if (ok) {
        showToast('All collections (students, drivers, admins, buses, routes) synchronized to Cloud Firestore!');
      } else {
        showToast('Cloud Firestore synchronization completed.');
      }
    } catch (err: any) {
      showToast(`Firestore sync notice: ${err.message}`, 'error');
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const loadRawDatabase = async () => {
    setIsLoadingDb(true);
    try {
      const res = await Api.getRawDatabase();
      // Sanitize database copy: never expose passwords or authentication secrets!
      const sanitized = { ...res.database };
      delete sanitized.passwords;
      setRawDbData(sanitized);
      setDbFilePath(res.filePath || 'Cloud Firestore / vital-hall-jwh4c');
      setDbCounts(res.counts || {});
      if (dbFilterKey === 'ALL') {
        setDbEditorContent(JSON.stringify(sanitized, null, 2));
      } else {
        setDbEditorContent(JSON.stringify(sanitized[dbFilterKey] || [], null, 2));
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load database records.', 'error');
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DATABASE') {
      loadRawDatabase();
    }
  }, [activeTab]);

  const handleDbFilterChange = (key: string) => {
    setDbFilterKey(key);
    if (!rawDbData) return;
    const sanitized = { ...rawDbData };
    delete sanitized.passwords;
    if (key === 'ALL') {
      setDbEditorContent(JSON.stringify(sanitized, null, 2));
    } else {
      setDbEditorContent(JSON.stringify(sanitized[key] || [], null, 2));
    }
  };

  const handleSaveDbChanges = async () => {
    setIsSavingDb(true);
    try {
      let parsed = JSON.parse(dbEditorContent);
      let payloadToSave: any;
      if (dbFilterKey === 'ALL') {
        payloadToSave = parsed;
      } else {
        payloadToSave = {
          ...rawDbData,
          [dbFilterKey]: parsed,
        };
      }
      const res = await Api.updateRawDatabase(payloadToSave);
      showToast(res.message || 'Database changes successfully written to data/db.json!');
      await loadRawDatabase();
      loadAllData();
    } catch (err: any) {
      showToast(`Invalid JSON syntax or save failed: ${err.message}`, 'error');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleDownloadDatabase = () => {
    if (!rawDbData) return;
    const blob = new Blob([JSON.stringify(rawDbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campus-transport-db-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Database file downloaded.');
  };

  const handleUploadDatabaseFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const res = await Api.updateRawDatabase(parsed);
        showToast(`Database restored from ${file.name}!`);
        await loadRawDatabase();
        loadAllData();
      } catch (err: any) {
        showToast(`Failed to parse file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCopyDbToClipboard = () => {
    navigator.clipboard.writeText(dbEditorContent);
    showToast('Database JSON copied to clipboard!');
  };

  const handleToggleUserStatus = async (role: string, id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await Api.updateUserStatus(role, id, nextStatus);
      if (role === 'STUDENT') {
        try {
          await FirestoreService.updateStudent(id, { account_status: nextStatus as any });
        } catch (_) {}
      }
      showToast(`User ${id} status updated to ${nextStatus}.`);
      loadAllData();
    } catch (e: any) {
      showToast(e?.message || `User ${id} status updated to ${nextStatus}.`);
      loadAllData();
    }
  };

  const handleSetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetResetUser) return;
    try {
      await Api.setUserPassword(targetResetUser.id, resetPassValue);
      setResetSuccessMsg(`Password successfully set to "${resetPassValue}" for ${targetResetUser.name}`);
      showToast(`Password updated for ${targetResetUser.name} (${targetResetUser.id}).`);
      setTimeout(() => {
        setTargetResetUser(null);
        setResetSuccessMsg(null);
        setResetPassValue('campus123');
      }, 1500);
    } catch (e: any) {
      showToast(e.message || 'Failed to set password', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!targetDelete) return;
    try {
      if (targetDelete.type === 'STUDENT') {
        await Api.deleteStudent(targetDelete.id);
        try { await FirestoreService.deleteStudent(targetDelete.id); } catch (e) {}
        showToast(`Student ${targetDelete.name} (${targetDelete.id}) removed from database & Firestore.`);
      } else if (targetDelete.type === 'DRIVER') {
        await Api.deleteDriver(targetDelete.id);
        try { await FirestoreService.deleteDriver(targetDelete.id); } catch (e) {}
        showToast(`Driver ${targetDelete.name} (${targetDelete.id}) removed from database & Firestore.`);
      } else if (targetDelete.type === 'ADMIN') {
        if (targetDelete.id === admin.admin_id) {
          showToast('Cannot delete your own active admin account.', 'error');
          setTargetDelete(null);
          return;
        }
        await Api.deleteAdmin(targetDelete.id);
        try { await FirestoreService.deleteAdmin(targetDelete.id); } catch (e) {}
        showToast(`Admin ${targetDelete.name} (${targetDelete.id}) removed from database & Firestore.`);
      } else if (targetDelete.type === 'BUS') {
        await Api.deleteBus(targetDelete.id);
        try { await FirestoreService.deleteBus(targetDelete.id); } catch (e) {}
        showToast(`Bus ${targetDelete.name} (${targetDelete.id}) deleted from database & Firestore.`);
      } else if (targetDelete.type === 'ROUTE') {
        await Api.deleteRoute(targetDelete.id);
        try { await FirestoreService.deleteRoute(targetDelete.id); } catch (e) {}
        showToast(`Route ${targetDelete.name} (${targetDelete.id}) deleted from database & Firestore.`);
      }
      setTargetDelete(null);
      loadAllData();
    } catch (e: any) {
      showToast(e.message || 'Failed to delete record.', 'error');
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.student_id.trim() || !studentForm.full_name.trim()) {
      showToast('Student ID and Full Name are required.', 'error');
      return;
    }
    try {
      await Api.createStudent(studentForm);
      showToast(`Student ${studentForm.full_name} created successfully.`);
      setShowAddStudentModal(false);
      setStudentForm({
        student_id: '',
        full_name: '',
        email: '',
        phone: '',
        department: 'Computer Science and Engineering',
        year: '1st Year',
        bus_id: '',
        boarding_point: '',
        boarding_lat: null,
        boarding_lng: null,
        initialPassword: 'campus123',
      });
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create student.', 'error');
    }
  };

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverForm.driver_id.trim() || !driverForm.driver_name.trim()) {
      showToast('Driver ID and Driver Name are required.', 'error');
      return;
    }
    try {
      await Api.createDriver(driverForm);
      showToast(`Driver ${driverForm.driver_name} created successfully.`);
      setShowAddDriverModal(false);
      setDriverForm({
        driver_id: '',
        driver_name: '',
        phone: '',
        email: '',
        assigned_bus_id: '',
        initialPassword: 'campus123',
      });
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create driver.', 'error');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.admin_id.trim() || !adminForm.name.trim()) {
      showToast('Admin ID and Name are required.', 'error');
      return;
    }
    try {
      await Api.createAdmin(adminForm);
      showToast(`Admin ${adminForm.name} created successfully.`);
      setShowAddAdminModal(false);
      setAdminForm({
        admin_id: '',
        name: '',
        email: '',
        phone: '',
        initialPassword: 'campus123',
      });
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create admin.', 'error');
    }
  };

  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busForm.bus_id.trim() || !busForm.bus_number.trim()) {
      showToast('Bus ID and Bus Number are required.', 'error');
      return;
    }
    try {
      await Api.createBus(busForm);
      showToast(`Bus ${busForm.bus_number} created successfully.`);
      setShowAddBusModal(false);
      setBusForm({
        bus_id: '',
        bus_number: '',
        route_id: '',
        assigned_driver_id: '',
      });
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create bus.', 'error');
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeForm.route_id.trim() || !routeForm.route_name.trim()) {
      showToast('Route ID and Route Name are required.', 'error');
      return;
    }
    try {
      await Api.createRoute(routeForm);
      showToast(`Route ${routeForm.route_name} created successfully.`);
      setShowAddRouteModal(false);
      setRouteForm({
        route_id: '',
        route_name: '',
        destination: 'College Campus',
        driver_name: '',
        driver_phone: '',
        boarding_points: '',
      });
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create route.', 'error');
    }
  };

  const handleUpdateComplaintStatus = async (id: string, status: string) => {
    try {
      await Api.updateComplaintStatus(id, status);
      showToast(`Complaint status updated to ${status}.`);
      loadAllData();
    } catch (e: any) {
      showToast(e.message || 'Failed to update complaint status', 'error');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementMsg.trim()) return;

    try {
      await Api.sendNotification(announcementTitle.trim(), announcementMsg.trim(), 'ANNOUNCEMENT', announcementTarget);
      setBroadcastSuccess(true);
      setAnnouncementTitle('');
      setAnnouncementMsg('');
      loadAllData();
      setTimeout(() => setBroadcastSuccess(false), 2500);
    } catch (e: any) {
      showToast(e.message || 'Failed to send announcement', 'error');
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportReport(null);
    setIsImporting(true);

    try {
      let parsed: any[];
      try {
        parsed = JSON.parse(importJsonText);
        if (!Array.isArray(parsed)) {
          throw new Error('Import data must be a valid JSON array of records.');
        }
      } catch (err: any) {
        throw new Error('Invalid JSON format: Ensure data is an array: [{"field": "value"}, ...]');
      }

      const res = await Api.importDataset(importDatasetType, parsed, importMode);
      setImportReport(res.report);
      loadAllData();
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetToInitial = async () => {
    try {
      await Api.resetDataset();
      showToast('Database reset to official college records.', 'success');
      loadAllData();
    } catch (e: any) {
      showToast(e.message || 'Failed to reset database', 'error');
    }
  };

  // Build live fleet markers for Admin Map
  const fleetMarkers: MapMarkerPoint[] = [];

  // Official College Campus Destination
  fleetMarkers.push({
    id: COLLEGE_DESTINATION.id,
    lat: COLLEGE_DESTINATION.latitude,
    lng: COLLEGE_DESTINATION.longitude,
    type: 'DESTINATION',
    title: COLLEGE_DESTINATION.name,
    subtitle: COLLEGE_DESTINATION.address,
  });

  buses.forEach((b) => {
    if (b.current_lat && b.current_lng) {
      const assignedDriver = drivers.find((d) => d.driver_id === b.assigned_driver_id);
      const driverPhone = assignedDriver?.phone || null;
      const isEmergency =
        b.bus_status === 'BREAKDOWN' ||
        activeEmergencies.some((e) => e.bus_id === b.bus_id) ||
        (dashboardStats?.activeEmergencies &&
          dashboardStats.activeEmergencies.some((e) => e.bus_id === b.bus_id));

      fleetMarkers.push({
        id: `fleet-${b.bus_id}`,
        lat: b.current_lat,
        lng: b.current_lng,
        type: isEmergency ? 'EMERGENCY_BUS' : 'BUS',
        title: isEmergency ? `Bus ${b.bus_number} [🚨 SOS ACTIVE]` : `Bus ${b.bus_number}`,
        subtitle: isEmergency
          ? `🚨 EMERGENCY SOS ACTIVE! Driver: ${b.assigned_driver_name || 'Driver'} • Phone: ${driverPhone || 'N/A'}`
          : `Route: ${b.route_name || 'Campus'} &bull; Driver: ${b.assigned_driver_name || 'Unassigned'} &bull; Status: ${b.bus_status}`,
        accuracy: b.gps_accuracy,
        timestamp: b.last_gps_update,
        phone: driverPhone,
        phoneLabel: 'Call Driver',
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner */}
      <div className="rounded-3xl bg-purple-950 p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="rounded-md bg-purple-600/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-purple-200 border border-purple-400/20">
              Campus Transport Command
            </span>
            <span className="text-purple-300 text-xs font-mono">&bull; {admin.admin_id}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">{admin.name}</h2>
          <p className="text-xs sm:text-sm text-purple-200">
            Real-Time College Transport Intelligence, Fleet Oversight &amp; Attendance Analytics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('EXCEL_SHEETS')}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition border border-emerald-500 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Excel Sheets &amp; Reports</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('IMPORTER')}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-800 hover:bg-purple-700 px-4 py-2 text-xs font-bold text-white transition border border-purple-700 shadow-sm cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>Dataset Importer</span>
          </button>
          <button
            type="button"
            onClick={loadAllData}
            className="inline-flex items-center space-x-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold backdrop-blur-xs border border-white/20 transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* FEATURE 3: Admin Real-Time Emergency SOS Listener Banner */}
      <AdminEmergencyBanner
        onViewLocation={(emergency) => {
          setActiveTab('FLEET_MAP');
          if (typeof emergency.latitude === 'number' && typeof emergency.longitude === 'number') {
            setMapCenterOverride({ lat: emergency.latitude, lng: emergency.longitude });
          }
        }}
        onEmergencyResolved={() => {
          loadAllData();
        }}
      />

      {/* Toast Alert */}
      {toast && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation (Shown only if not navigating from fixed sidebar) */}
      {!activeNav && (
        <div className="flex overflow-x-auto border-b border-slate-200 gap-1 pb-1 scrollbar-none">
          {[
            { key: 'OVERVIEW', label: 'Overview', icon: ClipboardList },
            { key: 'FLEET_MAP', label: 'Live Fleet Map', icon: Compass },
            { key: 'STUDENTS', label: `Students (${students.length})`, icon: Users },
            { key: 'DRIVERS', label: `Drivers (${drivers.length})`, icon: BusIcon },
            { key: 'ADMINS', label: `Admins (${admins.length})`, icon: Shield },
            { key: 'BUSES_ROUTES', label: `Buses & Routes (${buses.length})`, icon: MapPin },
            { key: 'ATTENDANCE', label: `Attendance Logs (${attendance.length})`, icon: CheckCircle2 },
            { key: 'EXCEL_SHEETS', label: 'Excel Sheets & Manifests', icon: FileSpreadsheet },
            { key: 'COMPLAINTS', label: `Complaints (${complaints.length})`, icon: AlertTriangle },
            { key: 'IMPORTER', label: 'Dataset Importer', icon: Upload },
            { key: 'DATABASE', label: 'Database & Storage', icon: Database },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Today's Student Transport Intent vs Attendance */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl bg-amber-50 p-3.5 sm:p-4 border border-amber-200">
              <span className="text-[11px] sm:text-xs font-bold text-amber-800 uppercase tracking-wide">Waiting at Stops</span>
              <div className="mt-1 text-xl sm:text-2xl font-black text-amber-950">{dashboardStats?.waitingCount ?? 0}</div>
              <p className="text-[10px] sm:text-[11px] text-amber-700 mt-0.5 sm:mt-1">Students marked as waiting</p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-3.5 sm:p-4 border border-emerald-200">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wide">Verified Boarded</span>
              <div className="mt-1 text-xl sm:text-2xl font-black text-emerald-950">{dashboardStats?.boardedCount ?? 0}</div>
              <p className="text-[10px] sm:text-[11px] text-emerald-700 mt-0.5 sm:mt-1">Verified via QR scan</p>
            </div>

            <div className="rounded-2xl bg-rose-50 p-3.5 sm:p-4 border border-rose-200">
              <span className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wide">Marked Absent</span>
              <div className="mt-1 text-xl sm:text-2xl font-black text-rose-950">{dashboardStats?.absentCount ?? 0}</div>
              <p className="text-[10px] sm:text-[11px] text-rose-700 mt-0.5 sm:mt-1">Reported not coming</p>
            </div>

            <div className="rounded-2xl bg-purple-50 p-3.5 sm:p-4 border border-purple-200">
              <span className="text-[11px] sm:text-xs font-bold text-purple-800 uppercase tracking-wide">Open Complaints</span>
              <div className="mt-1 text-xl sm:text-2xl font-black text-purple-950">{dashboardStats?.openComplaintsCount ?? 0}</div>
              <p className="text-[10px] sm:text-[11px] text-purple-700 mt-0.5 sm:mt-1">Awaiting resolution</p>
            </div>
          </div>

          {/* Active Breakdowns Alert Banner */}
          {dashboardStats && dashboardStats.activeBreakdownsCount > 0 && (
            <div className="rounded-3xl bg-rose-600 p-5 text-white shadow-lg space-y-2">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-6 w-6 text-white animate-bounce" />
                <h4 className="font-bold text-base">EMERGENCY: {dashboardStats.activeBreakdownsCount} Active Bus Breakdown(s) Reported</h4>
              </div>
              {dashboardStats.breakdowns
                .filter((b) => b.status === 'ACTIVE')
                .map((b) => (
                  <div key={b.breakdown_id} className="p-3 bg-rose-700/80 rounded-2xl border border-rose-500 text-xs">
                    <strong>Bus {b.bus_number}</strong> &bull; Driver: {b.driver_name} &bull; Time: {new Date(b.timestamp).toLocaleTimeString()}
                    <p className="mt-1 text-rose-100">{b.description}</p>
                  </div>
                ))}
            </div>
          )}

          {/* Broadcast Announcement to Fleet */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-1">Broadcast Transport Announcement</h3>
            <p className="text-xs text-slate-500 mb-4">Send a high-priority notification to students, drivers, or all members</p>

            {broadcastSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Notification successfully broadcasted across the campus transport system.</span>
              </div>
            )}

            <form onSubmit={handleBroadcast} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Route 02 Delay Notice or Evening Departure Reschedule"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience</label>
                  <select
                    value={announcementTarget}
                    onChange={(e) => setAnnouncementTarget(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                  >
                    <option value="ALL">All Members (Students &amp; Drivers)</option>
                    <option value="STUDENT">Students Only</option>
                    <option value="DRIVER">Drivers Only</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Message Content</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Provide precise details for passengers and staff..."
                  value={announcementMsg}
                  onChange={(e) => setAnnouncementMsg(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center space-x-2 rounded-xl bg-purple-700 hover:bg-purple-800 px-5 py-2 text-xs font-bold text-white transition shadow-sm"
                >
                  <Send className="h-4 w-4" />
                  <span>Transmit Broadcast</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE FLEET MAP */}
      {activeTab === 'FLEET_MAP' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center space-x-2">
                  <span>Live College Bus Fleet Tracking</span>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800">
                    {fleetMarkers.length} Active Bus GPS Feeds
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Real GPS coordinates streamed directly from driver mobile phones while on active trips
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Buses on trip:</span>
                <span className="font-bold text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {buses.filter((b) => b.bus_status === 'ON_TRIP').length} / {buses.length}
                </span>
              </div>
            </div>

            {/* College Campus Destination Marker Indicator */}
            <div className="mb-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-3">
              <div className="flex items-center space-x-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-900 text-amber-300 text-lg font-bold shrink-0 shadow-md">
                  🏛️
                </span>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-indigo-950 text-sm">Official College Destination Terminal:</span>
                    <span className="font-bold text-indigo-900">{COLLEGE_DESTINATION.name}</span>
                  </div>
                  <p className="text-xs text-indigo-700 mt-0.5">{COLLEGE_DESTINATION.address}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="text-xs font-mono bg-indigo-200/80 text-indigo-900 px-2.5 py-1 rounded-lg font-bold">
                  13.1474° N, 80.0591° E
                </span>
                <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg border border-amber-300">
                  Campus Main Gate
                </span>
              </div>
            </div>

            {/* Reset Focus Banner if focused on an emergency */}
            {mapCenterOverride && (
              <div className="mb-3 p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center justify-between shadow-sm animate-pulse">
                <span className="font-bold">
                  🎯 Map camera focused directly on Emergency SOS location ({mapCenterOverride.lat.toFixed(4)}°, {mapCenterOverride.lng.toFixed(4)}°).
                </span>
                <button
                  type="button"
                  onClick={() => setMapCenterOverride(null)}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1 font-bold text-xs transition cursor-pointer"
                >
                  Reset Campus View
                </button>
              </div>
            )}

            <MapViewer
              viewMode="ADMIN"
              markers={fleetMarkers}
              centerLat={mapCenterOverride ? mapCenterOverride.lat : COLLEGE_DESTINATION.latitude}
              centerLng={mapCenterOverride ? mapCenterOverride.lng : COLLEGE_DESTINATION.longitude}
              zoom={mapCenterOverride ? 16 : 12}
              heightClass="h-[380px] sm:h-[480px] lg:h-[540px]"
              emptyStateMessage="No college buses are actively broadcasting GPS coordinates at this moment. Drivers must log in and press START TRIP to transmit live bus locations."
            />
          </div>
        </div>
      )}

      {/* TAB 3: STUDENTS MANAGEMENT */}
      {activeTab === 'STUDENTS' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Registered Students Directory</h3>
              <p className="text-xs text-slate-500">Only pre-registered students in the college database have system access</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('EXCEL_SHEETS')}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Open in Excel Sheets</span>
              </button>
              <button
                onClick={() => {
                  setStudentForm({
                    student_id: `STU-${Date.now().toString().slice(-4)}`,
                    full_name: '',
                    email: '',
                    phone: '',
                    department: 'Computer Science and Engineering',
                    year: '1st Year',
                    bus_id: buses[0]?.bus_id || 'BUS-01',
                    boarding_point: '',
                    boarding_lat: null,
                    boarding_lng: null,
                    initialPassword: 'campus123',
                  });
                  setShowAddStudentModal(true);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Student</span>
              </button>

              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, ID, stop..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-slate-300 pl-9 pr-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <select
                value={filterBus}
                onChange={(e) => setFilterBus(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
              >
                <option value="ALL">All Buses</option>
                {buses.map((b) => (
                  <option key={b.bus_id} value={b.bus_id}>
                    {b.bus_number}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">Student ID</th>
                  <th className="py-3 px-3">Full Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Department &amp; Year</th>
                  <th className="py-3 px-3">Assigned Bus</th>
                  <th className="py-3 px-3">Boarding Point</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">QR Identity</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students
                  .filter((s) => {
                    const matchSearch =
                      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.student_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.boarding_point && s.boarding_point.toLowerCase().includes(searchQuery.toLowerCase()));
                    const matchBus = filterBus === 'ALL' || s.bus_id === filterBus;
                    return matchSearch && matchBus;
                  })
                  .map((s) => (
                    <tr key={s.student_id} className="hover:bg-purple-50/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-purple-900">{s.student_id}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{s.full_name}</div>
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-600">
                        <div>{s.email || 'No email provided'}</div>
                        <div className="text-purple-700 font-mono text-[10px]">{s.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {s.department || 'Not available'} &bull; {s.year || 'Not available'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {s.bus_number || s.bus_id || 'Not assigned'}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-bold text-slate-900">{s.boarding_point || 'Not assigned'}</div>
                        {typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number' ? (
                          <div className="flex items-center space-x-1 text-[10px] text-purple-700 font-mono mt-0.5 font-semibold">
                            <MapPin className="h-3 w-3 text-purple-600 shrink-0" />
                            <span>{s.boarding_lat.toFixed(4)}, {s.boarding_lng.toFixed(4)}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditStudent(s)}
                            className="text-[10px] text-purple-700 hover:text-purple-900 font-bold underline mt-0.5 inline-flex items-center space-x-0.5 cursor-pointer"
                          >
                            <span>Set Stop on Map</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.account_status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.account_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                        {s.qr_identity}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditStudent(s)}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition inline-flex items-center space-x-1"
                          title="Edit Student Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus('STUDENT', s.student_id, s.account_status)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                            s.account_status === 'ACTIVE'
                              ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                          title="Toggle Status"
                        >
                          {s.account_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => setTargetResetUser({ id: s.student_id, name: s.full_name, role: 'Student' })}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition inline-flex items-center space-x-1"
                          title="Set / Reset Password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>Set Pwd</span>
                        </button>
                        <button
                          onClick={() => setTargetDelete({ type: 'STUDENT', id: s.student_id, name: s.full_name })}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition inline-flex items-center space-x-1"
                          title="Delete Student Record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DRIVERS MANAGEMENT */}
      {activeTab === 'DRIVERS' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Registered Drivers Details</h3>
              <p className="text-xs text-slate-500">Drivers transmit live bus GPS through their mobile devices</p>
            </div>

            <button
              onClick={() => {
                setDriverForm({
                  driver_id: `DRV-${Date.now().toString().slice(-3)}`,
                  driver_name: '',
                  phone: '',
                  email: '',
                  assigned_bus_id: buses[0]?.bus_id || '',
                  initialPassword: 'campus123',
                });
                setShowAddDriverModal(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Driver</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">Driver ID</th>
                  <th className="py-3 px-3">Driver Name</th>
                  <th className="py-3 px-3">Contact Details</th>
                  <th className="py-3 px-3">Assigned Bus</th>
                  <th className="py-3 px-3">Route</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3">QR Identity</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.map((d) => (
                  <tr key={d.driver_id} className="hover:bg-purple-50/30 transition">
                    <td className="py-3 px-3 font-mono font-bold text-purple-900">{d.driver_id}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{d.driver_name}</td>
                    <td className="py-3 px-3 text-[11px] text-slate-600">
                      <div>{d.phone || 'Phone pending'}</div>
                      <div className="text-[10px] text-slate-400">{d.email || 'No email'}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {d.bus_number || d.assigned_bus_id || 'Not assigned'}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{d.route_id || 'Not assigned'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          d.account_status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.account_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{d.qr_identity}</td>
                    <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openEditDriver(d)}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition inline-flex items-center space-x-1"
                        title="Edit Driver Details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus('DRIVER', d.driver_id, d.account_status)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                          d.account_status === 'ACTIVE'
                            ? 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        }`}
                      >
                        {d.account_status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => setTargetResetUser({ id: d.driver_id, name: d.driver_name, role: 'Driver' })}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition inline-flex items-center space-x-1"
                        title="Set / Reset Password"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        <span>Set Pwd</span>
                      </button>
                      <button
                        onClick={() => setTargetDelete({ type: 'DRIVER', id: d.driver_id, name: d.driver_name })}
                        className="px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition inline-flex items-center space-x-1"
                        title="Delete Driver Record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: ADMINS MANAGEMENT */}
      {activeTab === 'ADMINS' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Campus Transport Administrators</h3>
              <p className="text-xs text-slate-500">Authorized administrative officers with system access &amp; control</p>
            </div>

            <button
              onClick={() => {
                setAdminForm({
                  admin_id: `ADM-${Date.now().toString().slice(-3)}`,
                  name: '',
                  email: '',
                  phone: '',
                  initialPassword: 'campus123',
                });
                setShowAddAdminModal(true);
              }}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Admin</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">Admin ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Official Email</th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3">Permissions</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">QR Identity</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {admins.map((a) => {
                  const isCurrentAdmin = a.admin_id === admin.admin_id;
                  return (
                    <tr key={a.admin_id} className={`hover:bg-purple-50/30 transition ${isCurrentAdmin ? 'bg-purple-50/40 font-medium' : ''}`}>
                      <td className="py-3 px-3 font-mono font-bold text-purple-900">
                        {a.admin_id}
                        {isCurrentAdmin && (
                          <span className="ml-1.5 text-[9px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full uppercase font-bold">
                            You
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{a.name}</td>
                      <td className="py-3 px-3 text-slate-700 font-mono text-[11px]">{a.email || 'Not specified'}</td>
                      <td className="py-3 px-3 text-slate-600">{a.phone || 'Not available'}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {a.permissions?.map((p, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            a.account_status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {a.account_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{a.qr_identity}</td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openEditAdmin(a)}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition inline-flex items-center space-x-1"
                          title="Edit Admin Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setTargetResetUser({ id: a.admin_id, name: a.name, role: 'Admin' })}
                          className="px-2 py-1 rounded-lg text-[10px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 transition inline-flex items-center space-x-1"
                          title="Set / Reset Password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          <span>Set Pwd</span>
                        </button>
                        {!isCurrentAdmin && (
                          <button
                            onClick={() => setTargetDelete({ type: 'ADMIN', id: a.admin_id, name: a.name })}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition inline-flex items-center space-x-1"
                            title="Delete Admin Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: BUSES & ROUTES */}
      {activeTab === 'BUSES_ROUTES' && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">College Bus Fleet Status</h3>
                <p className="text-xs text-slate-500">Official buses mapped to routes and assigned drivers</p>
              </div>

              <button
                onClick={() => {
                  setBusForm({
                    bus_id: `BUS-${(buses.length + 1).toString().padStart(2, '0')}`,
                    bus_number: '',
                    route_id: routes[0]?.route_id || '',
                    assigned_driver_id: drivers[0]?.driver_id || '',
                  });
                  setShowAddBusModal(true);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Bus</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {buses.map((b) => (
                <div key={b.bus_id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 text-xs space-y-2 relative group">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-purple-950">{b.bus_number}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        b.bus_status === 'ON_TRIP'
                          ? 'bg-emerald-100 text-emerald-800'
                          : b.bus_status === 'BREAKDOWN'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {b.bus_status}
                    </span>
                  </div>

                  <div className="text-slate-600">
                    <div>Route: <strong className="text-slate-800">{b.route_name || b.route_id || 'Not assigned'}</strong></div>
                    <div>Driver: <span className="text-slate-800">{b.assigned_driver_name || 'Not assigned'}</span></div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                    <span>GPS Source: <strong className="text-purple-800">{b.location_source || 'MOBILE_DRIVER_GPS'}</strong></span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => openEditBus(b)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition"
                        title="Edit Bus Details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setTargetDelete({ type: 'BUS', id: b.bus_id, name: b.bus_number })}
                        className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Bus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Routes Table */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">College Transit Routes &amp; Boarding Points</h3>
                <p className="text-xs text-slate-500">Official campus routes with scheduled boarding stops</p>
              </div>

              <button
                onClick={() => {
                  setRouteForm({
                    route_id: `R-${(routes.length + 1).toString().padStart(2, '0')}`,
                    route_name: '',
                    destination: 'College Campus',
                    driver_name: '',
                    driver_phone: '',
                    boarding_points: '',
                  });
                  setShowAddRouteModal(true);
                }}
                className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Route</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {routes.map((r) => (
                <div key={r.route_id} className="py-3 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-purple-900">{r.route_id} &bull; {r.route_name}</span>
                      <span className="text-[11px] text-slate-400">({r.destination})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Boarding Stops: <span className="text-slate-700">{r.boarding_points.join(' &rarr; ')}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right text-[11px]">
                      <div className="font-semibold text-slate-800">Driver: {r.driver_name || 'To be assigned'}</div>
                      <div className="text-purple-700 font-mono">{r.driver_phone || 'Contact pending'}</div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => openEditRoute(r)}
                        className="text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-50 transition"
                        title="Edit Route Details"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTargetDelete({ type: 'ROUTE', id: r.route_id, name: `${r.route_id} - ${r.route_name}` })}
                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 transition"
                        title="Delete Route"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ATTENDANCE LOGS */}
      {activeTab === 'ATTENDANCE' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">QR Boarding Attendance Records</h3>
              <p className="text-xs text-slate-500">
                Audited logs recorded exclusively through camera scanning of active dynamic bus QR codes
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('EXCEL_SHEETS')}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Open in Excel Sheets</span>
              </button>
              <span className="text-xs font-bold text-purple-900 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                {attendance.length} Total Verified Boardings
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">Log ID</th>
                  <th className="py-3 px-3">Student Name</th>
                  <th className="py-3 px-3">Student ID</th>
                  <th className="py-3 px-3">Bus Number</th>
                  <th className="py-3 px-3">Trip ID</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3">Student GPS Coordinates</th>
                  <th className="py-3 px-3">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No attendance records logged yet. Students record attendance by scanning the driver&apos;s dynamic trip QR code.
                    </td>
                  </tr>
                ) : (
                  attendance.map((a) => (
                    <tr key={a.attendance_id} className="hover:bg-purple-50/30 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-600">{a.attendance_id}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{a.student_name}</td>
                      <td className="py-3 px-3 font-mono text-purple-800">{a.student_id}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{a.bus_number}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{a.trip_id}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {new Date(a.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                        {a.latitude && a.longitude ? `${a.latitude.toFixed(4)}, ${a.longitude.toFixed(4)}` : 'Location not shared'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                          {a.verification_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: EXCEL SHEETS & MANIFESTS */}
      {activeTab === 'EXCEL_SHEETS' && (
        <AdminExcelSheetViewer
          buses={buses}
          students={students}
          drivers={drivers}
          routes={routes}
          attendance={attendance}
          studentStatuses={studentStatuses}
          trips={dashboardStats?.activeTrips || []}
          onRefresh={loadAllData}
        />
      )}

      {/* TAB 7: COMPLAINTS */}
      {activeTab === 'COMPLAINTS' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Student Complaints &amp; Service Reports</h3>
              <p className="text-xs text-slate-500">Review student feedback across cleanliness, speeding, condition, etc.</p>
            </div>
          </div>

          <div className="space-y-3">
            {complaints.length === 0 ? (
              <p className="text-center py-10 text-xs text-slate-400">No transport complaints on file.</p>
            ) : (
              complaints.map((c) => (
                <div key={c.complaint_id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-slate-900">{c.category}</span>
                      <span className="text-[11px] text-purple-700 font-semibold font-mono">({c.complaint_id})</span>
                      <span className="text-slate-400 text-xs">&bull; Bus {c.bus_number || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(c.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-700 text-xs leading-relaxed">{c.description}</p>
                  <div className="text-[11px] text-slate-500">
                    Submitted by: <strong>{c.student_name}</strong> ({c.student_id})
                  </div>

                  {c.admin_remarks && (
                    <div className="p-2.5 rounded-xl bg-purple-50 text-[11px] text-purple-900 border border-purple-200">
                      <strong>Admin Action / Remarks:</strong> {c.admin_remarks}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end space-x-2">
                    {c.status !== 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleUpdateComplaintStatus(c.complaint_id, 'IN_PROGRESS')}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-900 hover:bg-amber-200 transition"
                      >
                        Mark In Progress
                      </button>
                    )}
                    {c.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleUpdateComplaintStatus(c.complaint_id, 'RESOLVED')}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-900 hover:bg-emerald-200 transition"
                      >
                        Resolve Complaint
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 8: DATASET IMPORTER */}
      {activeTab === 'IMPORTER' && (
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Safe College Dataset Importer &amp; Validator</h3>
              <p className="text-xs text-slate-500">
                10-point validation engine enforcing strict field requirements, duplicate detection, and assignment checks
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetToInitial}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-1.5 text-xs font-bold border border-rose-200 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset to College Dataset</span>
            </button>
          </div>

          {/* Validation Rules Card */}
          <div className="rounded-2xl bg-purple-50/70 p-4 border border-purple-200 text-xs text-purple-950 space-y-1">
            <span className="font-bold block text-sm text-purple-900">10-Point Safe Import Validation Engine</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-purple-900/80">
              <div>1. Validates required ID &amp; name fields</div>
              <div>2. Rejects duplicate primary identifiers</div>
              <div>3. Flags duplicate emails and phone numbers</div>
              <div>4. Strictly enforces registered roles</div>
              <div>5. Enforces ACTIVE / INACTIVE account status</div>
              <div>6. Verifies student-to-bus relationship</div>
              <div>7. Verifies driver-to-route assignment</div>
              <div>8. Validates unique QR identity tokens</div>
              <div>9. Generates detailed audit issue report</div>
              <div>10. Imports only valid conforming records</div>
            </div>
          </div>

          {/* Import Form */}
          <form onSubmit={handleImportSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Dataset Type</label>
                <select
                  value={importDatasetType}
                  onChange={(e) => setImportDatasetType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                >
                  <option value="students">Students (student_id, full_name, email, bus_id, boarding_point...)</option>
                  <option value="drivers">Drivers (driver_id, driver_name, phone, assigned_bus_id...)</option>
                  <option value="admins">Admins (admin_id, name, email, phone, permissions...)</option>
                  <option value="buses">Buses (bus_id, bus_number, route_id, destination...)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Import Mode</label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                >
                  <option value="REPLACE">Replace Entire Dataset / Table</option>
                  <option value="APPEND">Append New Records Only</option>
                  <option value="UPDATE">Update Existing Records (Matched by Unique ID)</option>
                  <option value="UPSERT">Upsert Records (Update if ID exists, insert if new)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  JSON Records Array (Paste dataset text)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (importDatasetType === 'students') {
                      setImportJsonText(
                        JSON.stringify(
                          [
                            {
                              student_id: 'STU-112',
                              full_name: 'Praveen K.',
                              email: 'praveen.k@student.campus.edu',
                              phone: '+91 98402 11012',
                              department: 'Civil Engineering',
                              year: '2nd Year',
                              bus_id: 'BUS-01',
                              boarding_point: 'Tambaram Sanatorium',
                              account_status: 'ACTIVE',
                            },
                          ],
                          null,
                          2
                        )
                      );
                    } else if (importDatasetType === 'drivers') {
                      setImportJsonText(
                        JSON.stringify(
                          [
                            {
                              driver_id: 'DRV-08',
                              driver_name: 'V. Natarajan',
                              phone: '+91 98401 23458',
                              assigned_bus_id: 'BUS-08',
                              account_status: 'ACTIVE',
                            },
                          ],
                          null,
                          2
                        )
                      );
                    } else if (importDatasetType === 'buses') {
                      setImportJsonText(
                        JSON.stringify(
                          [
                            {
                              bus_id: 'BUS-09',
                              bus_number: 'TN 22 CZ 4109',
                              route_id: 'R-01',
                              route_name: 'Tambaram to Campus',
                              destination: 'College Campus',
                            },
                          ],
                          null,
                          2
                        )
                      );
                    }
                  }}
                  className="text-[11px] text-purple-700 font-semibold hover:underline"
                >
                  Insert Sample Record
                </button>
              </div>
              <textarea
                rows={7}
                required
                placeholder='[ { "student_id": "...", "full_name": "...", "bus_id": "..." } ]'
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 p-3 font-mono text-xs focus:border-purple-600 focus:outline-hidden"
              />
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {importError}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isImporting || !importJsonText.trim()}
                className="inline-flex items-center space-x-2 rounded-xl bg-purple-700 hover:bg-purple-800 px-6 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 shadow-md"
              >
                <Upload className="h-4 w-4" />
                <span>{isImporting ? 'Auditing & Validating...' : 'Validate and Import Dataset'}</span>
              </button>
            </div>
          </form>

          {/* Import Audit Report */}
          {importReport && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-slate-800">Validation Audit Report ({importReport.datasetType})</h4>
                <span className="text-[11px] text-slate-400">
                  {new Date(importReport.importedAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Submitted</span>
                  <span className="text-base font-black text-slate-800">{importReport.totalSubmitted}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block uppercase font-bold">Valid &amp; Imported</span>
                  <span className="text-base font-black text-emerald-800">{importReport.validCount}</span>
                </div>
                <div className="p-2 bg-rose-50 rounded-xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 block uppercase font-bold">Rejected / Invalid</span>
                  <span className="text-base font-black text-rose-800">{importReport.invalidCount}</span>
                </div>
              </div>

              {importReport.issues.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-[11px] text-slate-700 block">Issues &amp; Warnings Encountered:</span>
                  {importReport.issues.map((iss, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg text-[11px] flex items-center justify-between ${
                        iss.type === 'ERROR'
                          ? 'bg-rose-100 text-rose-900 border border-rose-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      <span>
                        <strong>{iss.type}:</strong> {iss.message}
                      </span>
                      {iss.field && <span className="font-mono text-[10px] text-slate-600">[{iss.field}]</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: DATABASE ACCESS & STORAGE */}
      {activeTab === 'DATABASE' && (
        <div className="space-y-6">
          {/* Database System Header & Storage Info */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-start space-x-3">
                <div className="p-3 rounded-2xl bg-amber-100 text-amber-800 shrink-0">
                  <Cloud className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                    <span>Cloud Firestore &amp; Firebase Storage Engine</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Live Realtime Connected
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Application Source of Truth: Cloud Firestore (NoSQL) &amp; Firebase Authentication. Admin edits update Firestore documents in real time.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSyncAllToFirestore}
                  disabled={isSyncingFirestore}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
                  title="Push and sync all current data directly to Cloud Firestore collections"
                >
                  <Cloud className={`h-3.5 w-3.5 ${isSyncingFirestore ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingFirestore ? 'Syncing...' : 'Sync to Cloud Firestore'}</span>
                </button>

                <button
                  onClick={loadRawDatabase}
                  disabled={isLoadingDb}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition"
                  title="Reload current database records"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingDb ? 'animate-spin' : ''}`} />
                  <span>Reload</span>
                </button>

                <button
                  onClick={handleDownloadDatabase}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
                  title="Download sanitized dataset in JSON format"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Dataset (.json)</span>
                </button>

                <label className="inline-flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload / Restore</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadDatabaseFile}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={async () => {
                    try {
                      await Api.resetDataset();
                      showToast('Database reset to official college seed records.');
                      await loadRawDatabase();
                      loadAllData();
                    } catch (e: any) {
                      showToast(e.message || 'Failed to reset dataset', 'error');
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 px-3 py-1.5 text-xs font-semibold transition"
                  title="Reset to default college seed data"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Reset to Seed</span>
                </button>
              </div>
            </div>

            {/* Architecture Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                  <Cloud className="h-4 w-4 text-amber-700" />
                  <span>Cloud Firestore (Source of Truth)</span>
                </div>
                <div className="font-mono text-[11px] font-bold text-amber-950 truncate">
                  vital-hall-jwh4c
                </div>
                <p className="text-[10px] text-amber-800 leading-tight">
                  Primary cloud NoSQL document store with realtime synchronization across all connected dashboards.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs">
                  <RefreshCw className="h-4 w-4 text-indigo-700" />
                  <span>Real-Time Sync Pipeline</span>
                </div>
                <div className="font-mono text-xs font-bold text-indigo-950">
                  Admin Edit &rarr; Firestore &rarr; Clients
                </div>
                <p className="text-[10px] text-indigo-800 leading-tight">
                  Every change updates the existing Firestore document directly and streams to students and drivers.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold text-xs">
                  <Shield className="h-4 w-4 text-emerald-700" />
                  <span>Zero Secrets Guarantee</span>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-950">
                  Passwords Sanitized &amp; Isolated
                </div>
                <p className="text-[10px] text-emerald-800 leading-tight">
                  Authentication hashes and secrets are strictly excluded and never exposed in the data inspector.
                </p>
              </div>
            </div>

            {/* Entity Counts Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
              {[
                { label: 'Students', count: dbCounts.students ?? students.length, color: 'text-purple-900' },
                { label: 'Drivers', count: dbCounts.drivers ?? drivers.length, color: 'text-blue-900' },
                { label: 'Admins', count: dbCounts.admins ?? admins.length, color: 'text-emerald-900' },
                { label: 'Buses', count: dbCounts.buses ?? buses.length, color: 'text-amber-900' },
                { label: 'Routes', count: dbCounts.routes ?? routes.length, color: 'text-indigo-900' },
                { label: 'Attendance', count: dbCounts.attendance ?? attendance.length, color: 'text-teal-900' },
                { label: 'Complaints', count: dbCounts.complaints ?? complaints.length, color: 'text-rose-900' },
                { label: 'Notifications', count: dbCounts.notifications ?? notifications.length, color: 'text-slate-900' },
              ].map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.label}</div>
                  <div className={`text-base font-black ${item.color}`}>{item.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Live Database Editor & Inspector */}
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Interactive Firestore Document Inspector &amp; Editor</h4>
                <p className="text-xs text-slate-500">
                  Select a collection to inspect or edit records directly. Changes commit to Firestore in real time.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyDbToClipboard}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
                  title="Copy current editor content to clipboard"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy JSON</span>
                </button>

                <button
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(dbEditorContent);
                      setDbEditorContent(JSON.stringify(parsed, null, 2));
                      showToast('JSON formatted successfully.');
                    } catch (e: any) {
                      showToast(`Invalid JSON: ${e.message}`, 'error');
                    }
                  }}
                  className="inline-flex items-center space-x-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition"
                  title="Format JSON with 2-space indentation"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Format</span>
                </button>

                <button
                  onClick={handleSaveDbChanges}
                  disabled={isSavingDb}
                  className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white px-4 py-1.5 text-xs font-bold transition shadow-sm disabled:opacity-50"
                  title="Commit changes and sync to Cloud Firestore"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isSavingDb ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: 'All Collections' },
                { key: 'students', label: `Students (${students.length})` },
                { key: 'drivers', label: `Drivers (${drivers.length})` },
                { key: 'admins', label: `Admins (${admins.length})` },
                { key: 'buses', label: `Buses (${buses.length})` },
                { key: 'routes', label: `Routes (${routes.length})` },
                { key: 'attendance', label: `Attendance (${attendance.length})` },
                { key: 'complaints', label: `Complaints (${complaints.length})` },
                { key: 'trips', label: `Trips (${dashboardStats?.activeTrips?.length || 0})` },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => handleDbFilterChange(p.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    dbFilterKey === p.key
                      ? 'bg-purple-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Monospace JSON Code Area */}
            <div className="relative">
              <textarea
                value={dbEditorContent}
                onChange={(e) => setDbEditorContent(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full rounded-2xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs text-emerald-400 focus:border-purple-600 focus:outline-hidden leading-relaxed shadow-inner"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center space-x-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Cloud Firestore Active (Zero Passwords Exposed)</span>
              </span>
              <span>Viewing: <strong>{dbFilterKey === 'ALL' ? 'Full Firestore Schema' : `collection "${dbFilterKey}"`}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Admin Set Password Modal */}
      {targetResetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Set Member Password</h3>
                  <p className="text-[11px] text-slate-500">{targetResetUser.name} &bull; <span className="font-mono text-purple-700">{targetResetUser.id}</span></p>
                </div>
              </div>
              <button onClick={() => setTargetResetUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {resetSuccessMsg ? (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{resetSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSetUserPassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <Lock className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={resetPassValue}
                      onChange={(e) => setResetPassValue(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Default initial password is campus123</p>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetResetUser(null)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-purple-700 text-white text-xs font-bold hover:bg-purple-800 transition shadow-sm"
                  >
                    Save Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {targetDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Confirm Deletion</h3>
                <p className="text-xs text-slate-500">Delete {targetDelete.type.toLowerCase()} record</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete <strong>{targetDelete.name}</strong> ({targetDelete.id})? This will immediately revoke their access.
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm inline-flex items-center space-x-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Student</h3>
                  <p className="text-[11px] text-slate-500">Register new student and designate their official boarding point</p>
                </div>
              </div>
              <button onClick={() => setShowAddStudentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student ID *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.student_id}
                    onChange={(e) => setStudentForm({ ...studentForm, student_id: e.target.value })}
                    placeholder="e.g. STU-215"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={studentForm.full_name}
                    onChange={(e) => setStudentForm({ ...studentForm, full_name: e.target.value })}
                    placeholder="e.g. Priya R"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    placeholder="student@gmail.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    placeholder="9876543210"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={studentForm.department}
                    onChange={(e) => setStudentForm({ ...studentForm, department: e.target.value })}
                    placeholder="CSE / IT / ECE"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Year</label>
                  <select
                    value={studentForm.year}
                    onChange={(e) => setStudentForm({ ...studentForm, year: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Bus</label>
                  <select
                    value={studentForm.bus_id}
                    onChange={(e) => setStudentForm({ ...studentForm, bus_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                  >
                    <option value="">Unassigned</option>
                    {buses.map((b) => (
                      <option key={b.bus_id} value={b.bus_id}>
                        {b.bus_number} ({b.route_name || b.bus_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Initial Password</label>
                  <input
                    type="text"
                    value={studentForm.initialPassword}
                    onChange={(e) => setStudentForm({ ...studentForm, initialPassword: e.target.value })}
                    placeholder="campus123"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Official Google Maps Boarding Point Selector */}
              <div className="pt-2 border-t border-slate-100">
                <BoardingPointPickerMap
                  initialPointName={studentForm.boarding_point}
                  initialLat={studentForm.boarding_lat}
                  initialLng={studentForm.boarding_lng}
                  onSelectLocation={(loc) => {
                    setStudentForm((prev) => ({
                      ...prev,
                      boarding_point: loc.name,
                      boarding_lat: loc.lat,
                      boarding_lng: loc.lng,
                    }));
                    showToast(`Official Boarding Point locked: "${loc.name}" (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`);
                  }}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Create Student with Boarding Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <BusIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Bus Driver</h3>
                  <p className="text-[11px] text-slate-500">Register new driver to transmit mobile GPS</p>
                </div>
              </div>
              <button onClick={() => setShowAddDriverModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDriver} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver ID *</label>
                  <input
                    type="text"
                    required
                    value={driverForm.driver_id}
                    onChange={(e) => setDriverForm({ ...driverForm, driver_id: e.target.value })}
                    placeholder="e.g. DRV-08"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Name *</label>
                  <input
                    type="text"
                    required
                    value={driverForm.driver_name}
                    onChange={(e) => setDriverForm({ ...driverForm, driver_name: e.target.value })}
                    placeholder="e.g. R. Subramanian"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    placeholder="+91 98401 23458"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={driverForm.email}
                    onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })}
                    placeholder="driver@campus.edu"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign to Bus</label>
                <select
                  value={driverForm.assigned_bus_id}
                  onChange={(e) => setDriverForm({ ...driverForm, assigned_bus_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {buses.map((b) => (
                    <option key={b.bus_id} value={b.bus_id}>
                      {b.bus_number} ({b.route_name || b.bus_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Password</label>
                <input
                  type="text"
                  value={driverForm.initialPassword}
                  onChange={(e) => setDriverForm({ ...driverForm, initialPassword: e.target.value })}
                  placeholder="campus123"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm"
                >
                  Create Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Administrator</h3>
                  <p className="text-[11px] text-slate-500">Create officer credentials for transport management</p>
                </div>
              </div>
              <button onClick={() => setShowAddAdminModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Admin ID *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.admin_id}
                    onChange={(e) => setAdminForm({ ...adminForm, admin_id: e.target.value })}
                    placeholder="e.g. ADM-06"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="e.g. Dr. Ramesh Kumar"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@aalimec.ac.in"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  placeholder="+91 98402 11005"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Set Password</label>
                <input
                  type="text"
                  value={adminForm.initialPassword}
                  onChange={(e) => setAdminForm({ ...adminForm, initialPassword: e.target.value })}
                  placeholder="campus123"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm"
                >
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Bus Modal */}
      {showAddBusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Bus</h3>
                  <p className="text-[11px] text-slate-500">Register new bus to college fleet</p>
                </div>
              </div>
              <button onClick={() => setShowAddBusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBus} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bus ID *</label>
                  <input
                    type="text"
                    required
                    value={busForm.bus_id}
                    onChange={(e) => setBusForm({ ...busForm, bus_id: e.target.value })}
                    placeholder="e.g. BUS-09"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bus Number / Reg *</label>
                  <input
                    type="text"
                    required
                    value={busForm.bus_number}
                    onChange={(e) => setBusForm({ ...busForm, bus_number: e.target.value })}
                    placeholder="e.g. TN 22 CZ 4109"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign to Route</label>
                <select
                  value={busForm.route_id}
                  onChange={(e) => setBusForm({ ...busForm, route_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {routes.map((r) => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.route_id} - {r.route_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign Driver</label>
                <select
                  value={busForm.assigned_driver_id}
                  onChange={(e) => setBusForm({ ...busForm, assigned_driver_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_name} ({d.driver_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddBusModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm"
                >
                  Create Bus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Route Modal */}
      {showAddRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Add New Route</h3>
                  <p className="text-[11px] text-slate-500">Configure new transit route and stops</p>
                </div>
              </div>
              <button onClick={() => setShowAddRouteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Route ID *</label>
                  <input
                    type="text"
                    required
                    value={routeForm.route_id}
                    onChange={(e) => setRouteForm({ ...routeForm, route_id: e.target.value })}
                    placeholder="e.g. R-09"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Route Name *</label>
                  <input
                    type="text"
                    required
                    value={routeForm.route_name}
                    onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })}
                    placeholder="e.g. Koyambedu to Campus"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Destination</label>
                <input
                  type="text"
                  value={routeForm.destination}
                  onChange={(e) => setRouteForm({ ...routeForm, destination: e.target.value })}
                  placeholder="College Campus"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Driver Name</label>
                  <input
                    type="text"
                    value={routeForm.driver_name}
                    onChange={(e) => setRouteForm({ ...routeForm, driver_name: e.target.value })}
                    placeholder="Driver Name"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Phone</label>
                  <input
                    type="text"
                    value={routeForm.driver_phone}
                    onChange={(e) => setRouteForm({ ...routeForm, driver_phone: e.target.value })}
                    placeholder="+91 98401..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Boarding Stops (comma-separated)</label>
                <input
                  type="text"
                  value={routeForm.boarding_points}
                  onChange={(e) => setRouteForm({ ...routeForm, boarding_points: e.target.value })}
                  placeholder="Stop 1, Stop 2, Stop 3, Campus"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddRouteModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm"
                >
                  Create Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-blue-100 space-y-4 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Edit Student Details & Official Boarding Stop</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                      {editingStudent.student_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update student profile and designate their official Google Maps boarding point</p>
                </div>
              </div>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editStudentForm.full_name}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, full_name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Student Email</label>
                  <input
                    type="email"
                    value={editStudentForm.email}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, email: e.target.value })}
                    placeholder="student@aalimec.ac.in"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={editStudentForm.phone}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
                    placeholder="+91 98401 23456"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={editStudentForm.department}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, department: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Year</label>
                  <select
                    value={editStudentForm.year}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, year: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Bus</label>
                  <select
                    value={editStudentForm.bus_id}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, bus_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="">Unassigned</option>
                    {buses.map((b) => (
                      <option key={b.bus_id} value={b.bus_id}>
                        {b.bus_number} ({b.route_name || b.bus_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Status</label>
                  <select
                    value={editStudentForm.account_status}
                    onChange={(e) => setEditStudentForm({ ...editStudentForm, account_status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                  >
                    <option value="ACTIVE">ACTIVE - Allowed access</option>
                    <option value="INACTIVE">INACTIVE - Suspended</option>
                  </select>
                </div>
              </div>

              {/* Official Google Maps Boarding Point Selector */}
              <div className="pt-2 border-t border-slate-100">
                <BoardingPointPickerMap
                  initialPointName={editStudentForm.boarding_point}
                  initialLat={editStudentForm.boarding_lat}
                  initialLng={editStudentForm.boarding_lng}
                  onSelectLocation={(loc) => {
                    setEditStudentForm((prev) => ({
                      ...prev,
                      boarding_point: loc.name,
                      boarding_lat: loc.lat,
                      boarding_lng: loc.lng,
                    }));
                    showToast(`Official Boarding Point updated: "${loc.name}" (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`);
                  }}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>Save Student & Boarding Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-blue-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Edit Bus Driver</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                      {editingDriver.driver_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update driver name, contact, and bus assignment</p>
                </div>
              </div>
              <button onClick={() => setEditingDriver(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDriver} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Name *</label>
                <input
                  type="text"
                  required
                  value={editDriverForm.driver_name}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, driver_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={editDriverForm.phone}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editDriverForm.email}
                    onChange={(e) => setEditDriverForm({ ...editDriverForm, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assigned Bus</label>
                <select
                  value={editDriverForm.assigned_bus_id}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, assigned_bus_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {buses.map((b) => (
                    <option key={b.bus_id} value={b.bus_id}>
                      {b.bus_number} ({b.route_name || b.bus_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editDriverForm.account_status}
                  onChange={(e) => setEditDriverForm({ ...editDriverForm, account_status: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-blue-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Edit Administrator</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                      {editingAdmin.admin_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update administrative officer details</p>
                </div>
              </div>
              <button onClick={() => setEditingAdmin(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAdmin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editAdminForm.name}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Official Email</label>
                <input
                  type="email"
                  value={editAdminForm.email}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editAdminForm.phone}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, phone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editAdminForm.account_status}
                  onChange={(e) => setEditAdminForm({ ...editAdminForm, account_status: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bus Modal */}
      {editingBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-blue-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Edit Bus</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                      {editingBus.bus_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update bus registration and assignments</p>
                </div>
              </div>
              <button onClick={() => setEditingBus(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBus} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bus Number / Plate *</label>
                <input
                  type="text"
                  required
                  value={editBusForm.bus_number}
                  onChange={(e) => setEditBusForm({ ...editBusForm, bus_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign to Route</label>
                <select
                  value={editBusForm.route_id}
                  onChange={(e) => setEditBusForm({ ...editBusForm, route_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {routes.map((r) => (
                    <option key={r.route_id} value={r.route_id}>
                      {r.route_id} - {r.route_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Assign Driver</label>
                <select
                  value={editBusForm.assigned_driver_id}
                  onChange={(e) => setEditBusForm({ ...editBusForm, assigned_driver_id: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="">Unassigned</option>
                  {drivers.map((d) => (
                    <option key={d.driver_id} value={d.driver_id}>
                      {d.driver_name} ({d.driver_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Bus Status</label>
                <select
                  value={editBusForm.bus_status}
                  onChange={(e) => setEditBusForm({ ...editBusForm, bus_status: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden bg-white"
                >
                  <option value="IDLE">IDLE - Parked / Waiting</option>
                  <option value="ON_TRIP">ON_TRIP - Active transit</option>
                  <option value="BREAKDOWN">BREAKDOWN - Maintenance</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBus(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Route Modal */}
      {editingRoute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-blue-100 space-y-4 my-8">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-800">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                    <span>Edit Route</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                      {editingRoute.route_id}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">Update route name, destination, driver, and stops</p>
                </div>
              </div>
              <button onClick={() => setEditingRoute(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditRoute} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  value={editRouteForm.route_name}
                  onChange={(e) => setEditRouteForm({ ...editRouteForm, route_name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Destination</label>
                <input
                  type="text"
                  value={editRouteForm.destination}
                  onChange={(e) => setEditRouteForm({ ...editRouteForm, destination: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={editRouteForm.driver_name}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, driver_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Phone</label>
                  <input
                    type="text"
                    value={editRouteForm.driver_phone}
                    onChange={(e) => setEditRouteForm({ ...editRouteForm, driver_phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Boarding Stops (comma-separated)</label>
                <textarea
                  rows={2}
                  value={editRouteForm.boarding_points}
                  onChange={(e) => setEditRouteForm({ ...editRouteForm, boarding_points: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition shadow-sm flex items-center space-x-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
