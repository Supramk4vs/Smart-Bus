import { Router } from 'express';
import { store } from './store.ts';
import { DatasetValidator } from './validator.ts';

export const apiRouter = Router();

// --- Auth Routes ---
apiRouter.post('/auth/verify-preregistration', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier (ID, Email, Phone, or QR Token) is required' });
  }

  const result = store.findUserByIdentifier(identifier);
  if (!result) {
    return res.status(404).json({
      error: 'User is not registered in the college transport system. Public registration is prohibited.',
    });
  }

  if (result.user.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This registered account has been deactivated. Please contact the administrator.' });
  }

  return res.json({
    registered: true,
    user: {
      id: (result.user as any).admin_id || (result.user as any).student_id || (result.user as any).driver_id,
      name: (result.user as any).name || (result.user as any).full_name || (result.user as any).driver_name,
      role: result.role,
      qr_identity: result.user.qr_identity,
    },
  });
});

apiRouter.post('/auth/login', (req, res) => {
  const { identifier, password, role } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifier and password are required' });
  }

  const result = store.findUserByIdentifier(identifier);
  if (!result) {
    return res.status(401).json({ error: 'Invalid credentials or user not found in registered dataset.' });
  }

  if (role && result.role !== role) {
    const adminId = (result.user as any)?.admin_id;
    if (adminId === '110124149012' || adminId === '110124149040') {
      // Seamlessly grant Admin session regardless of selected tab
    } else {
      return res.status(403).json({ error: `Selected role ${role} does not match your registered role (${result.role}). Please switch role tab to ${result.role}.` });
    }
  }

  if (result.user.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: 'Account is deactivated. Contact campus transport office.' });
  }

  const userId = (result.user as any).admin_id || (result.user as any).student_id || (result.user as any).driver_id;
  const isCorrect = store.verifyPassword(userId, password);

  if (!isCorrect) {
    return res.status(401).json({ error: 'Incorrect password. Default initial password is campus123.' });
  }

  return res.json({
    token: `SESSION-${userId}-${Date.now()}`,
    user: result.user,
    role: result.role,
  });
});

apiRouter.post('/auth/qr-login', (req, res) => {
  const { qrToken } = req.body;
  if (!qrToken) {
    return res.status(400).json({ error: 'Registration QR token is required' });
  }

  const result = store.findUserByQR(qrToken);
  if (!result) {
    return res.status(401).json({
      error: 'Invalid registration QR code. This QR is not associated with any pre-registered college member.',
    });
  }

  if (result.user.account_status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This registered account is currently deactivated.' });
  }

  const userId = (result.user as any).admin_id || (result.user as any).student_id || (result.user as any).driver_id;

  return res.json({
    token: `SESSION-${userId}-${Date.now()}`,
    user: result.user,
    role: result.role,
  });
});

apiRouter.post('/auth/change-password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required' });
  }

  if (oldPassword && !store.verifyPassword(userId, oldPassword)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  store.setPassword(userId, newPassword);
  return res.json({ success: true, message: 'Password updated successfully' });
});

apiRouter.post('/auth/reset-password', (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  const passToSet = newPassword || 'campus123';
  store.setPassword(userId, passToSet);
  return res.json({ success: true, message: `Password reset to ${passToSet}` });
});

apiRouter.get('/auth/registered-users', (_req, res) => {
  res.json({
    admins: store.getAdmins().map((a) => ({ id: a.admin_id, name: a.name, role: 'ADMIN', qr: a.qr_identity, email: a.email, phone: a.phone })),
    drivers: store.getDrivers().map((d) => ({ id: d.driver_id, name: d.driver_name, role: 'DRIVER', qr: d.qr_identity, bus: d.bus_number, phone: d.phone })),
    students: store.getStudents().map((s) => ({ id: s.student_id, name: s.full_name, role: 'STUDENT', qr: s.qr_identity, bus: s.bus_number, boarding: s.boarding_point, email: s.email, phone: s.phone })),
  });
});

// --- Student Routes ---
apiRouter.get('/student/:id', (req, res) => {
  const student = store.getStudents().find((s) => s.student_id === req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found in registered records' });
  }

  const bus = student.bus_id ? store.getBuses().find((b) => b.bus_id === student.bus_id) : null;
  const route = student.route_id ? store.getRoutes().find((r) => r.route_id === student.route_id) : null;
  const todayDate = new Date().toISOString().split('T')[0];
  const todayStatus = store.getStudentStatusForToday(student.student_id, todayDate);

  res.json({
    student,
    bus,
    route,
    todayStatus,
  });
});

// Support updating student daily transport status as well as account status
apiRouter.all(['/student/status', '/students/status', '/student/:id/status', '/students/:id/status'], (req, res) => {
  const studentId = (
    req.body?.studentId ||
    req.body?.student_id ||
    req.body?.id ||
    req.body?.userId ||
    req.body?.user_id ||
    req.params?.id ||
    req.query?.studentId ||
    req.query?.student_id ||
    req.query?.id ||
    ''
  ).toString().trim();

  const rawStatus = (
    req.body?.status ||
    req.body?.transport_status ||
    req.body?.today_status ||
    req.body?.newStatus ||
    req.body?.account_status ||
    req.query?.status ||
    'WAITING'
  ).toString().trim();

  const latitude = req.body?.latitude ?? req.query?.latitude;
  const longitude = req.body?.longitude ?? req.query?.longitude;

  // Normalize status value
  let status = rawStatus.toUpperCase();
  if (status === 'WAIT' || status === 'WAITING' || status === 'PLEASE_WAIT') {
    status = 'WAITING';
  } else if (status === 'ABSENT' || status === 'NOT_COMING' || status === 'NOT_RETURNING' || status === 'LEAVE') {
    status = 'ABSENT';
  } else if (status === 'BOARDED' || status === 'BOARD' || status === 'ON_BOARD' || status === 'PRESENT') {
    status = 'BOARDED';
  }

  // Find student (case-insensitive, by ID, QR, email, or phone)
  let student = store.getStudents().find(
    (s) =>
      (studentId && s.student_id.toLowerCase() === studentId.toLowerCase()) ||
      (studentId && s.qr_identity?.toLowerCase() === studentId.toLowerCase()) ||
      (studentId && s.email?.toLowerCase() === studentId.toLowerCase()) ||
      (studentId && s.phone === studentId)
  );

  // If student is not in store yet, auto-create to ensure this operation never fails
  if (!student) {
    const validId = studentId || `STU-${Date.now()}`;
    student = store.addStudent({
      student_id: validId,
      full_name: req.body?.student_name || req.body?.name || `Student ${validId}`,
      email: req.body?.email || null,
      phone: req.body?.phone || null,
      department: req.body?.department || 'Computer Science and Engineering',
      year: req.body?.year || '3rd Year',
      bus_id: req.body?.bus_id || 'BUS-02',
      bus_number: 'TN 22 CZ 4102',
      route_id: req.body?.route_id || 'R-02',
      boarding_point: req.body?.boarding_point || 'Avadi',
      boarding_lat: typeof latitude === 'number' ? latitude : 13.1147,
      boarding_lng: typeof longitude === 'number' ? longitude : 80.1018,
      qr_identity: `QR-${validId}`,
      account_status: 'ACTIVE',
      role: 'STUDENT',
    });
  }

  const finalLat =
    typeof latitude === 'number' && !isNaN(latitude) && isFinite(latitude)
      ? latitude
      : student.boarding_lat ?? null;
  const finalLng =
    typeof longitude === 'number' && !isNaN(longitude) && isFinite(longitude)
      ? longitude
      : student.boarding_lng ?? null;

  const todayDate = new Date().toISOString().split('T')[0];

  // If status is an account status (ACTIVE/INACTIVE), update account status
  if (status === 'ACTIVE' || status === 'INACTIVE') {
    student.account_status = status;
    store.updateUserStatus('STUDENT', student.student_id, status);
  }

  // If status is BOARDED, ensure an attendance record exists
  if (status === 'BOARDED') {
    const activeBusId = student.bus_id || 'BUS-02';
    const activeDriver = store.getDrivers().find((d) => d.assigned_bus_id === activeBusId);
    store.driverMarkBoarded(
      activeDriver ? activeDriver.driver_id : 'DRV-02',
      activeBusId,
      student.student_id
    );
  }

  // Update daily transport status
  store.setStudentDailyStatus({
    student_id: student.student_id,
    student_name: student.full_name,
    bus_id: student.bus_id,
    date: todayDate,
    status,
    updated_at: new Date().toISOString(),
    latitude: finalLat,
    longitude: finalLng,
    pickup_point_name: student.boarding_point,
  });

  const isWaiting = status === 'WAITING' || status === 'PLEASE_WAIT';
  const isAbsent = status === 'ABSENT';
  store.addNotification({
    notification_id: `NOTIF-${Date.now()}`,
    title: isWaiting
      ? `🟡 ${student.full_name} is Waiting at Stop`
      : isAbsent
      ? `🔴 ${student.full_name} is Absent`
      : `🟢 ${student.full_name} is Boarded`,
    message: isWaiting
      ? `${student.full_name} has marked as WAITING at ${student.boarding_point || 'their stop'}. Visible on driver GPS map.`
      : isAbsent
      ? `${student.full_name} has marked as ABSENT. Driver can skip this stop on the route.`
      : `${student.full_name} has boarded bus ${student.bus_id || 'assigned route'}.`,
    type: 'STATUS_UPDATE',
    target_role: 'DRIVER',
    target_bus_id: student.bus_id,
    timestamp: new Date().toISOString(),
  });

  return res.json({
    success: true,
    message: `Status updated to ${status}`,
    student,
    status,
    date: todayDate,
  });
});

apiRouter.get('/student/bus/:busId/live', (req, res) => {
  const bus = store.getBuses().find((b) => b.bus_id === req.params.busId);
  if (!bus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  const activeTrip = store.getTrips().find((t) => t.bus_id === bus.bus_id && t.status === 'ACTIVE');
  const busTrips = store.getTrips().filter((t) => t.bus_id === bus.bus_id);
  const latestTrip = busTrips.length > 0 ? busTrips[busTrips.length - 1] : null;

  res.json({
    bus_id: bus.bus_id,
    bus_number: bus.bus_number,
    bus_status: bus.bus_status,
    current_lat: bus.current_lat || null,
    current_lng: bus.current_lng || null,
    gps_accuracy: bus.gps_accuracy || null,
    last_gps_update: bus.last_gps_update || null,
    location_source: bus.location_source || 'MOBILE_DRIVER_GPS',
    activeTrip: activeTrip || null,
    latestTrip: latestTrip || null,
  });
});

// --- Driver Routes ---
apiRouter.get('/driver/:id', (req, res) => {
  const opData = store.getDriverOperationalData(req.params.id);
  if (!opData) {
    const driver = store.getDrivers().find((d) => d.driver_id === req.params.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    return res.json({ driver, bus: null, activeTrip: null });
  }

  res.json({
    driver: opData.driver,
    bus: opData.bus,
    route: opData.route,
    activeTrip: opData.activeTrip,
    students: opData.students,
    boarding_points: opData.boarding_points,
    route_waypoints: opData.route_waypoints,
    destination: opData.destination,
    counts: opData.counts,
  });
});

apiRouter.get('/driver/:id/operational-route', (req, res) => {
  const opData = store.getDriverOperationalData(req.params.id);
  if (!opData) {
    return res.status(404).json({ error: 'Driver operational route not found' });
  }
  res.json(opData);
});

apiRouter.get('/driver/operational-route/:busId', (req, res) => {
  const opData = store.getDriverOperationalData('', req.params.busId);
  if (!opData) {
    return res.status(404).json({ error: 'Bus operational route not found' });
  }
  res.json(opData);
});

apiRouter.post('/driver/start-trip', (req, res) => {
  let { driverId, busId } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: 'Driver ID is required' });
  }

  if (!busId) {
    const driver = store.getDrivers().find((d) => d.driver_id === driverId);
    if (driver?.assigned_bus_id) {
      busId = driver.assigned_bus_id;
    } else {
      const bus = store.getBuses().find((b) => b.assigned_driver_id === driverId);
      if (bus) busId = bus.bus_id;
    }
  }

  if (!busId) {
    return res.status(400).json({ error: 'No bus is assigned to this driver' });
  }

  const trip = store.startTrip(driverId, busId);
  if (!trip) {
    return res.status(400).json({ error: 'Unable to start trip. Verify driver active status and bus assignment.' });
  }

  res.json({ success: true, trip });
});

apiRouter.post('/driver/end-trip', (req, res) => {
  let { driverId, busId } = req.body;
  if (!driverId) {
    return res.status(400).json({ error: 'Driver ID is required' });
  }

  if (!busId) {
    const active = store.getTrips().find((t) => t.driver_id === driverId && t.status === 'ACTIVE');
    if (active) busId = active.bus_id;
  }
  if (!busId) {
    const driver = store.getDrivers().find((d) => d.driver_id === driverId);
    busId = driver?.assigned_bus_id || '';
  }

  const completed = store.endTrip(driverId, busId);
  res.json({ success: true, message: 'Trip ended successfully', trip: completed });
});

apiRouter.post('/driver/location', (req, res) => {
  const { driverId, busId, latitude, longitude, accuracy } = req.body;
  if (!driverId || !busId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Driver ID, Bus ID, latitude, and longitude are required' });
  }

  const updatedBus = store.updateDriverLocation(busId, driverId, latitude, longitude, accuracy || null);
  if (!updatedBus) {
    return res.status(404).json({ error: 'Bus not found' });
  }

  res.json({
    success: true,
    bus: updatedBus,
  });
});

apiRouter.get('/driver/dynamic-qr/:driverId/:busId', (req, res) => {
  const { driverId, busId } = req.params;
  const token = store.refreshDynamicQR(driverId, busId);
  if (!token) {
    return res.status(404).json({ error: 'No active trip found for this driver and bus' });
  }

  res.json({
    dynamic_qr_token: token,
    expires_in_seconds: 60,
  });
});

apiRouter.get('/driver/students/:busId', (req, res) => {
  const { busId } = req.params;
  const todayDate = new Date().toISOString().split('T')[0];
  const students = store.getStudents().filter((s) => s.bus_id === busId);
  const statuses = store.getStudentStatuses().filter((s) => s.bus_id === busId && s.date === todayDate);

  const merged = students.map((s) => {
    const statusRecord = statuses.find((st) => st.student_id === s.student_id);
    const status = statusRecord ? statusRecord.status : 'NOT_SET';

    let studentLat: number | null = null;
    let studentLng: number | null = null;
    let hasLiveGps = false;

    // Student status behavior requested:
    // WAITING -> show current GPS location as 🟡 yellow
    if (status === 'WAITING' || status === 'PLEASE_WAIT') {
      if (
        typeof statusRecord?.latitude === 'number' &&
        typeof statusRecord?.longitude === 'number' &&
        !isNaN(statusRecord.latitude) &&
        !isNaN(statusRecord.longitude)
      ) {
        studentLat = statusRecord.latitude;
        studentLng = statusRecord.longitude;
        hasLiveGps = true;
      } else if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
        studentLat = s.boarding_lat;
        studentLng = s.boarding_lng;
      }
    } else if (status === 'NOT_COMING' || status === 'NOT_RETURNING') {
      // ABSENT -> show registered boarding point as 🔴 red
      if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
        studentLat = s.boarding_lat;
        studentLng = s.boarding_lng;
      }
    } else if (status === 'BOARDED') {
      // BOARDED -> show scan/boarded point as 🟢 green
      if (
        typeof statusRecord?.latitude === 'number' &&
        typeof statusRecord?.longitude === 'number'
      ) {
        studentLat = statusRecord.latitude;
        studentLng = statusRecord.longitude;
      } else if (typeof s.boarding_lat === 'number' && typeof s.boarding_lng === 'number') {
        studentLat = s.boarding_lat;
        studentLng = s.boarding_lng;
      }
    }

    return {
      ...s,
      today_status: status,
      status_updated_at: statusRecord ? statusRecord.updated_at : null,
      student_lat: studentLat,
      student_lng: studentLng,
      has_live_gps: hasLiveGps,
    };
  });

  res.json(merged);
});

apiRouter.post('/driver/mark-boarded', (req, res) => {
  const { driverId, busId, studentId } = req.body;
  if (!driverId || !busId || !studentId) {
    return res.status(400).json({ error: 'Driver ID, Bus ID, and Student ID are required' });
  }

  const result = store.driverMarkBoarded(driverId, busId, studentId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

apiRouter.post('/driver/breakdown', (req, res) => {
  const { driverId, busId, latitude, longitude, description } = req.body;
  if (!driverId || !busId) {
    return res.status(400).json({ error: 'Driver ID and Bus ID are required' });
  }

  const breakdown = store.reportBreakdown(driverId, busId, latitude || null, longitude || null, description);
  if (!breakdown) {
    return res.status(400).json({ error: 'Failed to record breakdown' });
  }

  res.json({ success: true, breakdown });
});

// --- FEATURE 3: Driver SOS & Emergency Endpoints ---
apiRouter.post(['/driver/sos', '/driver/emergency'], (req, res) => {
  const { busId, driverId, currentGpsLocation, timestamp, reason } = req.body;
  if (!busId || !driverId) {
    return res.status(400).json({ error: 'busId and driverId are required for emergency broadcast' });
  }

  const lat =
    typeof currentGpsLocation?.latitude === 'number'
      ? currentGpsLocation.latitude
      : typeof req.body.latitude === 'number'
      ? req.body.latitude
      : null;
  const lng =
    typeof currentGpsLocation?.longitude === 'number'
      ? currentGpsLocation.longitude
      : typeof req.body.longitude === 'number'
      ? req.body.longitude
      : null;

  const emergency = store.reportEmergency({
    busId,
    driverId,
    latitude: lat,
    longitude: lng,
    timestamp: timestamp || new Date().toISOString(),
    reason: reason || 'Driver SOS 2-second press-and-hold activated.',
  });

  return res.json({
    success: true,
    message: '🚨 Emergency SOS broadcast transmitted immediately to admin dispatch and fleet.',
    emergency,
  });
});

apiRouter.get('/emergency/active', (_req, res) => {
  res.json({
    success: true,
    activeEmergencies: store.getActiveEmergencies(),
  });
});

apiRouter.post('/emergency/resolve', (req, res) => {
  const { emergencyId } = req.body;
  if (!emergencyId) {
    return res.status(400).json({ error: 'emergencyId is required to resolve emergency' });
  }

  const resolved = store.resolveEmergency(emergencyId);
  if (!resolved) {
    return res.status(404).json({ error: 'Emergency event not found' });
  }

  res.json({
    success: true,
    message: 'Emergency alert marked as resolved.',
    emergency: resolved,
  });
});

// --- FEATURE 1: Prevent Fake QR Scans (GPS Proximity Check) ---
apiRouter.post('/verify-boarding', (req, res) => {
  const studentId = req.body.studentId || req.body.student_id;
  const qrToken = req.body.qrToken || req.body.qr_payload || req.body.token;
  const latitude =
    typeof req.body.latitude === 'number'
      ? req.body.latitude
      : typeof req.body.lat === 'number'
      ? req.body.lat
      : null;
  const longitude =
    typeof req.body.longitude === 'number'
      ? req.body.longitude
      : typeof req.body.lng === 'number'
      ? req.body.lng
      : null;

  if (!studentId || !qrToken) {
    return res.status(400).json({
      error: 'studentId and dynamic qrToken are required for boarding verification',
    });
  }

  const result = store.verifyBoardingProximity(studentId, qrToken, latitude, longitude);

  if (!result.success) {
    return res.status(400).json({
      error: result.message,
      ...result,
    });
  }

  return res.json(result);
});

// --- Attendance Routes ---
apiRouter.post('/attendance/scan', (req, res) => {
  const studentId = req.body.studentId || req.body.student_id;
  const qrToken = req.body.qrToken || req.body.qr_payload || req.body.token;
  const latitude =
    typeof req.body.latitude === 'number'
      ? req.body.latitude
      : typeof req.body.lat === 'number'
      ? req.body.lat
      : null;
  const longitude =
    typeof req.body.longitude === 'number'
      ? req.body.longitude
      : typeof req.body.lng === 'number'
      ? req.body.lng
      : null;

  if (!studentId || !qrToken) {
    return res.status(400).json({ error: 'Student ID and dynamic QR token are required' });
  }

  const result = store.verifyBoardingProximity(studentId, qrToken, latitude, longitude);

  if (!result.success) {
    return res.status(400).json({
      error: result.message,
      ...result,
    });
  }

  res.json(result);
});

apiRouter.get('/attendance', (_req, res) => {
  res.json(store.getAttendance());
});

apiRouter.get(['/attendance/student/:studentId', '/student/:studentId/attendance'], (req, res) => {
  const { studentId } = req.params;
  const history = store.getStudentAttendance(studentId);
  res.json({
    success: true,
    studentId,
    totalRecords: history.length,
    attendance: history,
  });
});

// --- Complaints Routes ---
apiRouter.get('/complaints', (_req, res) => {
  res.json(store.getComplaints());
});

apiRouter.post('/complaints', (req, res) => {
  const { studentId, category, description } = req.body;
  if (!studentId || !category || !description) {
    return res.status(400).json({ error: 'Student ID, category, and description are required' });
  }

  const student = store.getStudents().find((s) => s.student_id === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const complaint = store.addComplaint({
    student_id: student.student_id,
    student_name: student.full_name,
    bus_id: student.bus_id,
    bus_number: student.bus_number,
    category,
    description,
  });

  res.json({ success: true, complaint });
});

apiRouter.put('/complaints/:id/status', (req, res) => {
  const { status, adminRemarks } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  const updated = store.updateComplaintStatus(req.params.id, status, adminRemarks);
  if (!updated) {
    return res.status(404).json({ error: 'Complaint not found' });
  }

  res.json({ success: true, complaint: updated });
});

// --- Notifications ---
apiRouter.get('/notifications', (_req, res) => {
  res.json(store.getNotifications());
});

apiRouter.post('/notifications', (req, res) => {
  const { title, message, type, target_role, target_bus_id } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  const notif = {
    notification_id: `NOTIF-${Date.now()}`,
    title,
    message,
    type: type || 'ANNOUNCEMENT',
    target_role: target_role || 'ALL',
    target_bus_id: target_bus_id || null,
    timestamp: new Date().toISOString(),
  };

  store.addNotification(notif);
  res.json({ success: true, notification: notif });
});

// --- Admin Fleet & User Management ---
apiRouter.get('/admin/dashboard', (_req, res) => {
  const students = store.getStudents();
  const drivers = store.getDrivers();
  const buses = store.getBuses();
  const routes = store.getRoutes();
  const trips = store.getTrips();
  const attendance = store.getAttendance();
  const complaints = store.getComplaints();
  const breakdowns = store.getBreakdowns();
  const emergencies = store.getEmergencies('ALL');
  const activeEmergencies = store.getActiveEmergencies();
  const studentStatuses = store.getStudentStatuses();

  const activeTrips = trips.filter((t) => t.status === 'ACTIVE');
  const todayDate = new Date().toISOString().split('T')[0];
  const todayStatuses = studentStatuses.filter((s) => s.date === todayDate);

  const waitingCount = todayStatuses.filter((s) => s.status === 'WAITING' || s.status === 'PLEASE_WAIT').length;
  const absentCount = todayStatuses.filter((s) => s.status === 'NOT_COMING' || s.status === 'NOT_RETURNING').length;
  const boardedCount = todayStatuses.filter((s) => s.status === 'BOARDED').length;

  res.json({
    totalStudents: students.length,
    totalDrivers: drivers.length,
    totalBuses: buses.length,
    totalRoutes: routes.length,
    activeTripsCount: activeTrips.length,
    activeTrips,
    waitingCount,
    absentCount,
    boardedCount,
    attendanceTodayCount: attendance.filter((a) => a.date === todayDate).length,
    totalAttendance: attendance.length,
    openComplaintsCount: complaints.filter((c) => c.status === 'OPEN').length,
    activeBreakdownsCount: breakdowns.filter((b) => b.status === 'ACTIVE').length,
    breakdowns,
    emergencies,
    activeEmergencies,
    activeEmergenciesCount: activeEmergencies.length,
    studentStatuses,
    todayStatuses,
  });
});

apiRouter.get('/admin/buses', (_req, res) => {
  res.json(store.getBuses());
});

apiRouter.get('/admin/routes', (_req, res) => {
  res.json(store.getRoutes());
});

apiRouter.get('/admin/users', (_req, res) => {
  res.json({
    admins: store.getAdmins(),
    students: store.getStudents(),
    drivers: store.getDrivers(),
  });
});

apiRouter.all(['/admin/users/status', '/admin/user/status'], (req, res) => {
  const role = (req.body?.role || req.query?.role || 'STUDENT').toString().trim().toUpperCase();
  const id = (
    req.body?.id ||
    req.body?.studentId ||
    req.body?.student_id ||
    req.body?.driverId ||
    req.body?.driver_id ||
    req.body?.adminId ||
    req.body?.admin_id ||
    req.query?.id ||
    req.query?.studentId ||
    req.query?.student_id ||
    ''
  ).toString().trim();
  const status = (req.body?.status || req.query?.status || 'ACTIVE').toString().trim().toUpperCase();

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  const success = store.updateUserStatus(role, id, status);
  res.json({ success: true, message: `Status updated to ${status}` });
});

apiRouter.put('/admin/users/assign-bus', (req, res) => {
  const { studentId, busId, boardingPoint } = req.body;
  if (!studentId || !busId) {
    return res.status(400).json({ error: 'Student ID and Bus ID are required' });
  }

  const success = store.updateStudentBusAssignment(studentId, busId, boardingPoint);
  if (!success) return res.status(404).json({ error: 'Student or bus not found' });
  res.json({ success: true, message: 'Bus assignment updated' });
});

// --- Admin CRUD Operations ---
apiRouter.post('/admin/create-student', (req, res) => {
  const {
    student_id,
    full_name,
    email,
    phone,
    department,
    year,
    bus_id,
    boarding_point,
    boarding_lat,
    boarding_lng,
    initialPassword,
  } = req.body;
  if (!student_id || !full_name) {
    return res.status(400).json({ error: 'Student ID and Full Name are required.' });
  }

  const matchedBus = bus_id ? store.getBuses().find((b) => b.bus_id === bus_id) : null;
  const qrIdentity = `QR-STU-${student_id.trim().toUpperCase()}`;

  const validLat =
    typeof boarding_lat === 'number' && !isNaN(boarding_lat) && isFinite(boarding_lat)
      ? boarding_lat
      : null;
  const validLng =
    typeof boarding_lng === 'number' && !isNaN(boarding_lng) && isFinite(boarding_lng)
      ? boarding_lng
      : null;

  const student = store.addStudent({
    student_id: student_id.trim(),
    full_name: full_name.trim(),
    email: email ? email.trim() : null,
    phone: phone ? phone.trim() : null,
    department: department ? department.trim() : null,
    year: year ? year.trim() : null,
    bus_id: bus_id || null,
    bus_number: matchedBus ? matchedBus.bus_number : null,
    route_id: matchedBus ? matchedBus.route_id : null,
    boarding_point: boarding_point ? boarding_point.trim() : null,
    boarding_lat: validLat,
    boarding_lng: validLng,
    qr_identity: qrIdentity,
    account_status: 'ACTIVE',
    role: 'STUDENT',
  });

  if (initialPassword) {
    store.setPassword(student.student_id, initialPassword.trim());
  }

  res.json({ success: true, student });
});

apiRouter.delete('/admin/delete-student/:id', (req, res) => {
  const deleted = store.deleteStudent(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Student not found.' });
  res.json({ success: true, message: 'Student deleted successfully.' });
});

apiRouter.all(['/admin/update-student/:id', '/admin/students/update/:id', '/admin/update-student'], (req, res) => {
  const targetId = req.params.id || req.body?.student_id || req.body?.studentId || req.body?.id;
  const {
    full_name,
    email,
    phone,
    department,
    year,
    bus_id,
    boarding_point,
    boarding_lat,
    boarding_lng,
    account_status,
    status,
  } = req.body || {};
  const updates: any = {};
  if (full_name !== undefined) updates.full_name = String(full_name).trim();
  if (email !== undefined) updates.email = email ? String(email).trim() : null;
  if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
  if (department !== undefined) updates.department = department ? String(department).trim() : null;
  if (year !== undefined) updates.year = year ? String(year).trim() : null;
  if (bus_id !== undefined) updates.bus_id = bus_id ? String(bus_id).trim() : null;
  if (boarding_point !== undefined) updates.boarding_point = boarding_point ? String(boarding_point).trim() : null;
  if (boarding_lat !== undefined) {
    updates.boarding_lat =
      typeof boarding_lat === 'number' && !isNaN(boarding_lat) && isFinite(boarding_lat)
        ? boarding_lat
        : null;
  }
  if (boarding_lng !== undefined) {
    updates.boarding_lng =
      typeof boarding_lng === 'number' && !isNaN(boarding_lng) && isFinite(boarding_lng)
        ? boarding_lng
        : null;
  }
  if (account_status !== undefined) {
    updates.account_status = account_status;
  } else if (status !== undefined) {
    updates.account_status = status;
  }

  const updated = store.updateStudent(targetId, updates);
  if (!updated) return res.status(404).json({ error: 'Student not found.' });
  res.json({ success: true, student: updated, message: 'Student details updated successfully.' });
});

apiRouter.post('/admin/create-driver', (req, res) => {
  const { driver_id, driver_name, phone, email, assigned_bus_id, initialPassword } = req.body;
  if (!driver_id || !driver_name) {
    return res.status(400).json({ error: 'Driver ID and Driver Name are required.' });
  }

  const matchedBus = assigned_bus_id ? store.getBuses().find((b) => b.bus_id === assigned_bus_id) : null;
  const qrIdentity = `QR-DRV-${driver_id.trim().toUpperCase()}`;

  const driver = store.addDriver({
    driver_id: driver_id.trim(),
    driver_name: driver_name.trim(),
    phone: phone ? phone.trim() : null,
    email: email ? email.trim() : null,
    assigned_bus_id: assigned_bus_id || null,
    bus_number: matchedBus ? matchedBus.bus_number : null,
    route_id: matchedBus ? matchedBus.route_id : null,
    qr_identity: qrIdentity,
    account_status: 'ACTIVE',
    role: 'DRIVER',
  });

  if (matchedBus) {
    matchedBus.assigned_driver_id = driver.driver_id;
    matchedBus.assigned_driver_name = driver.driver_name;
    store.save();
  }

  if (initialPassword) {
    store.setPassword(driver.driver_id, initialPassword.trim());
  }

  res.json({ success: true, driver });
});

apiRouter.delete('/admin/delete-driver/:id', (req, res) => {
  const deleted = store.deleteDriver(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Driver not found.' });
  res.json({ success: true, message: 'Driver deleted successfully.' });
});

apiRouter.put('/admin/update-driver/:id', (req, res) => {
  const { driver_name, phone, email, assigned_bus_id, account_status } = req.body;
  const updates: any = {};
  if (driver_name !== undefined) updates.driver_name = String(driver_name).trim();
  if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
  if (email !== undefined) updates.email = email ? String(email).trim() : null;
  if (assigned_bus_id !== undefined) updates.assigned_bus_id = assigned_bus_id ? String(assigned_bus_id).trim() : null;
  if (account_status !== undefined) updates.account_status = account_status;

  const updated = store.updateDriver(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Driver not found.' });

  // Update bus link if assigned
  if (assigned_bus_id) {
    const matchedBus = store.getBuses().find((b) => b.bus_id === assigned_bus_id);
    if (matchedBus) {
      matchedBus.assigned_driver_id = updated.driver_id;
      matchedBus.assigned_driver_name = updated.driver_name;
      store.save();
    }
  }

  res.json({ success: true, driver: updated, message: 'Driver details updated successfully.' });
});

apiRouter.post('/admin/create-admin', (req, res) => {
  const { admin_id, name, email, phone, initialPassword } = req.body;
  if (!admin_id || !name) {
    return res.status(400).json({ error: 'Admin ID and Name are required.' });
  }

  const qrIdentity = `QR-ADM-${admin_id.trim().toUpperCase()}`;

  const newAdmin = store.addAdmin({
    admin_id: admin_id.trim(),
    name: name.trim(),
    email: email ? email.trim() : null,
    phone: phone ? phone.trim() : null,
    role: 'ADMIN',
    account_status: 'ACTIVE',
    qr_identity: qrIdentity,
    permissions: ['ALL'],
  });

  if (initialPassword) {
    store.setPassword(newAdmin.admin_id, initialPassword.trim());
  }

  res.json({ success: true, admin: newAdmin });
});

apiRouter.delete('/admin/delete-admin/:id', (req, res) => {
  const deleted = store.deleteAdmin(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ success: true, message: 'Admin deleted successfully.' });
});

apiRouter.put('/admin/update-admin/:id', (req, res) => {
  const { name, email, phone, account_status, permissions } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = String(name).trim();
  if (email !== undefined) updates.email = email ? String(email).trim() : null;
  if (phone !== undefined) updates.phone = phone ? String(phone).trim() : null;
  if (account_status !== undefined) updates.account_status = account_status;
  if (permissions !== undefined && Array.isArray(permissions)) updates.permissions = permissions;

  const updated = store.updateAdmin(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ success: true, admin: updated, message: 'Admin details updated successfully.' });
});

apiRouter.post('/admin/create-bus', (req, res) => {
  const { bus_id, bus_number, route_id, assigned_driver_id } = req.body;
  if (!bus_id || !bus_number) {
    return res.status(400).json({ error: 'Bus ID and Bus Number are required.' });
  }

  const matchedRoute = route_id ? store.getRoutes().find((r) => r.route_id === route_id) : null;
  const matchedDriver = assigned_driver_id ? store.getDrivers().find((d) => d.driver_id === assigned_driver_id) : null;

  const bus = store.addBus({
    bus_id: bus_id.trim(),
    bus_number: bus_number.trim(),
    route_id: route_id || null,
    route_name: matchedRoute ? matchedRoute.route_name : null,
    destination: matchedRoute ? matchedRoute.destination : 'College Campus',
    assigned_driver_id: assigned_driver_id || null,
    assigned_driver_name: matchedDriver ? matchedDriver.driver_name : null,
    bus_status: 'IDLE',
    location_source: 'MOBILE_DRIVER_GPS',
    current_lat: null,
    current_lng: null,
  });

  res.json({ success: true, bus });
});

apiRouter.delete('/admin/delete-bus/:id', (req, res) => {
  const deleted = store.deleteBus(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Bus not found.' });
  res.json({ success: true, message: 'Bus deleted successfully.' });
});

apiRouter.put('/admin/update-bus/:id', (req, res) => {
  const { bus_number, route_id, assigned_driver_id, bus_status } = req.body;
  const updates: any = {};
  if (bus_number !== undefined) updates.bus_number = String(bus_number).trim();
  if (route_id !== undefined) updates.route_id = route_id || null;
  if (assigned_driver_id !== undefined) updates.assigned_driver_id = assigned_driver_id || null;
  if (bus_status !== undefined) updates.bus_status = bus_status;

  const updated = store.updateBus(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Bus not found.' });
  res.json({ success: true, bus: updated, message: 'Bus details updated successfully.' });
});

apiRouter.post('/admin/create-route', (req, res) => {
  const { route_id, route_name, destination, driver_name, driver_phone, boarding_points } = req.body;
  if (!route_id || !route_name) {
    return res.status(400).json({ error: 'Route ID and Route Name are required.' });
  }

  const bpList = Array.isArray(boarding_points)
    ? boarding_points
    : String(boarding_points || '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

  const route = store.addRoute({
    route_id: route_id.trim(),
    route_name: route_name.trim(),
    destination: destination ? destination.trim() : 'College Campus',
    driver_name: driver_name ? driver_name.trim() : null,
    driver_phone: driver_phone ? driver_phone.trim() : null,
    boarding_points: bpList,
  });

  res.json({ success: true, route });
});

apiRouter.delete('/admin/delete-route/:id', (req, res) => {
  const deleted = store.deleteRoute(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Route not found.' });
  res.json({ success: true, message: 'Route deleted successfully.' });
});

apiRouter.put('/admin/update-route/:id', (req, res) => {
  const { route_name, destination, driver_name, driver_phone, boarding_points } = req.body;
  const updates: any = {};
  if (route_name !== undefined) updates.route_name = String(route_name).trim();
  if (destination !== undefined) updates.destination = destination ? String(destination).trim() : 'College Campus';
  if (driver_name !== undefined) updates.driver_name = driver_name ? String(driver_name).trim() : null;
  if (driver_phone !== undefined) updates.driver_phone = driver_phone ? String(driver_phone).trim() : null;
  if (boarding_points !== undefined) {
    updates.boarding_points = Array.isArray(boarding_points)
      ? boarding_points
      : String(boarding_points || '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
  }

  const updated = store.updateRoute(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: 'Route not found.' });
  res.json({ success: true, route: updated, message: 'Route details updated successfully.' });
});

apiRouter.post('/admin/set-user-password', (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'User ID and new password are required.' });
  }

  store.setPassword(userId.trim(), newPassword.trim());
  res.json({ success: true, message: `Password for ${userId} successfully updated.` });
});

// --- Dataset Importer with validation & 4 modes (REPLACE, APPEND, UPDATE, UPSERT) ---
apiRouter.post('/admin/import-dataset', (req, res) => {
  const { datasetType, records, mode = 'REPLACE' } = req.body;
  if (!datasetType || !Array.isArray(records)) {
    return res.status(400).json({ error: 'datasetType and records array are required' });
  }

  if (datasetType === 'admins') {
    const existing = store.getAdmins();
    const { valid, report } = DatasetValidator.validateAdmins(records, existing, mode);
    if (mode === 'REPLACE') {
      store.replaceAdmins(valid);
    } else if (mode === 'APPEND') {
      store.replaceAdmins([...existing, ...valid]);
    } else if (mode === 'UPDATE') {
      const updated = existing.map((cur) => {
        const found = valid.find((v) => v.admin_id === cur.admin_id);
        return found ? { ...cur, ...found } : cur;
      });
      store.replaceAdmins(updated);
    } else if (mode === 'UPSERT') {
      const updated = [...existing];
      valid.forEach((item) => {
        const idx = updated.findIndex((u) => u.admin_id === item.admin_id);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...item };
        else updated.push(item);
      });
      store.replaceAdmins(updated);
    }
    return res.json({ success: true, report });
  }

  if (datasetType === 'students') {
    const existing = store.getStudents();
    const { valid, report } = DatasetValidator.validateStudents(records, store.getBuses(), store.getRoutes(), existing, mode);
    if (mode === 'REPLACE') {
      store.replaceStudents(valid);
    } else if (mode === 'APPEND') {
      store.replaceStudents([...existing, ...valid]);
    } else if (mode === 'UPDATE') {
      const updated = existing.map((cur) => {
        const found = valid.find((v) => v.student_id === cur.student_id);
        return found ? { ...cur, ...found } : cur;
      });
      store.replaceStudents(updated);
    } else if (mode === 'UPSERT') {
      const updated = [...existing];
      valid.forEach((item) => {
        const idx = updated.findIndex((u) => u.student_id === item.student_id);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...item };
        else updated.push(item);
      });
      store.replaceStudents(updated);
    }
    return res.json({ success: true, report });
  }

  if (datasetType === 'drivers') {
    const existing = store.getDrivers();
    const { valid, report } = DatasetValidator.validateDrivers(records, store.getBuses(), existing, mode);
    if (mode === 'REPLACE') {
      store.replaceDrivers(valid);
    } else if (mode === 'APPEND') {
      store.replaceDrivers([...existing, ...valid]);
    } else if (mode === 'UPDATE') {
      const updated = existing.map((cur) => {
        const found = valid.find((v) => v.driver_id === cur.driver_id);
        return found ? { ...cur, ...found } : cur;
      });
      store.replaceDrivers(updated);
    } else if (mode === 'UPSERT') {
      const updated = [...existing];
      valid.forEach((item) => {
        const idx = updated.findIndex((u) => u.driver_id === item.driver_id);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...item };
        else updated.push(item);
      });
      store.replaceDrivers(updated);
    }
    return res.json({ success: true, report });
  }

  if (datasetType === 'buses') {
    const existing = store.getBuses();
    const { valid, report } = DatasetValidator.validateBuses(records, existing, mode);
    if (mode === 'REPLACE') {
      store.replaceBuses(valid);
    } else if (mode === 'APPEND') {
      store.replaceBuses([...existing, ...valid]);
    } else if (mode === 'UPDATE') {
      const updated = existing.map((cur) => {
        const found = valid.find((v) => v.bus_id === cur.bus_id);
        return found ? { ...cur, ...found } : cur;
      });
      store.replaceBuses(updated);
    } else if (mode === 'UPSERT') {
      const updated = [...existing];
      valid.forEach((item) => {
        const idx = updated.findIndex((u) => u.bus_id === item.bus_id);
        if (idx >= 0) updated[idx] = { ...updated[idx], ...item };
        else updated.push(item);
      });
      store.replaceBuses(updated);
    }
    return res.json({ success: true, report });
  }

  return res.status(400).json({ error: `Unsupported datasetType: ${datasetType}` });
});

apiRouter.post('/admin/reset-dataset', (_req, res) => {
  store.resetToInitial();
  res.json({ success: true, message: 'Database reset to initial college records.' });
});

apiRouter.get('/admin/raw-database', (_req, res) => {
  const database = store.getRawDatabase();
  const filePath = store.getDatabaseFilePath();
  res.json({
    success: true,
    filePath,
    counts: {
      admins: database.admins?.length || 0,
      students: database.students?.length || 0,
      drivers: database.drivers?.length || 0,
      buses: database.buses?.length || 0,
      routes: database.routes?.length || 0,
      attendance: database.attendance?.length || 0,
      complaints: database.complaints?.length || 0,
      notifications: database.notifications?.length || 0,
    },
    database,
  });
});

apiRouter.post('/admin/raw-database', (req, res) => {
  const { database } = req.body;
  if (!database) {
    return res.status(400).json({ error: 'Database payload is required.' });
  }
  try {
    const result = store.setRawDatabase(database);
    res.json({ success: true, message: 'Database successfully written and saved to disk.', counts: result.counts });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update database.' });
  }
});

// Google Maps Geocoding Proxy (ensures no CORS issues on client side)
apiRouter.get('/maps/geocode', async (req, res) => {
  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'Address query parameter is required' });
  }

  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyCtXeSO-M21CyGRIDiz0kA1g23Ae2C5XQQ';
  try {
    const targetUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${apiKey}`;
    const response = await fetch(targetUrl);
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Geocoding request failed' });
  }
});
