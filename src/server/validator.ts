import type {
  AdminUser,
  StudentUser,
  DriverUser,
  Bus,
  Route,
  ImportAuditReport,
  ImportValidationIssue,
} from '../types/index.ts';

export type ImportMode = 'REPLACE' | 'APPEND' | 'UPDATE' | 'UPSERT';

export class DatasetValidator {
  /**
   * Validates and filters admin records
   */
  static validateAdmins(
    records: any[],
    existingAdmins: AdminUser[] = [],
    mode: ImportMode = 'REPLACE'
  ): { valid: AdminUser[]; report: ImportAuditReport } {
    const issues: ImportValidationIssue[] = [];
    const valid: AdminUser[] = [];
    const existingIds = new Set(existingAdmins.map((a) => a.admin_id));
    const batchSeenIds = new Set<string>();
    const seenQr = new Set(existingAdmins.map((a) => a.qr_identity));

    records.forEach((row, idx) => {
      const rowNum = idx + 1;
      const admin_id = String(row.admin_id || row.id || '').trim();
      const name = String(row.name || '').trim();
      const qr_identity = String(row.qr_identity || `QR-ADM-${admin_id}`).trim();
      const account_status = (row.account_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE';

      // 1. Required fields
      if (!admin_id) {
        issues.push({ type: 'ERROR', field: 'admin_id', message: `Row ${rowNum}: admin_id is required`, rowNumber: rowNum });
        return;
      }
      if (!name) {
        issues.push({ type: 'ERROR', field: 'name', message: `Row ${rowNum}: name is required`, rowNumber: rowNum, id: admin_id });
        return;
      }

      // Check within current batch
      if (batchSeenIds.has(admin_id)) {
        issues.push({ type: 'ERROR', field: 'admin_id', message: `Duplicate admin_id in import batch: ${admin_id}`, rowNumber: rowNum, id: admin_id });
        return;
      }

      // Check against existing dataset depending on mode
      if (mode === 'APPEND' && existingIds.has(admin_id)) {
        issues.push({ type: 'ERROR', field: 'admin_id', message: `Admin ID already exists: ${admin_id}`, rowNumber: rowNum, id: admin_id });
        return;
      }
      if (mode === 'UPDATE' && !existingIds.has(admin_id)) {
        issues.push({ type: 'ERROR', field: 'admin_id', message: `Cannot update non-existent admin ID: ${admin_id}`, rowNumber: rowNum, id: admin_id });
        return;
      }

      batchSeenIds.add(admin_id);

      valid.push({
        admin_id,
        name,
        email: row.email ? String(row.email).trim() : null,
        phone: row.phone ? String(row.phone).trim() : null,
        role: 'ADMIN',
        account_status,
        qr_identity,
        permissions: Array.isArray(row.permissions) ? row.permissions : ['ALL'],
      });
    });

    return {
      valid,
      report: {
        datasetType: 'admins',
        totalSubmitted: records.length,
        validCount: valid.length,
        invalidCount: records.length - valid.length,
        issues,
        importedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Validates and filters student records
   */
  static validateStudents(
    records: any[],
    availableBuses: Bus[] = [],
    availableRoutes: Route[] = [],
    existingStudents: StudentUser[] = [],
    mode: ImportMode = 'REPLACE'
  ): { valid: StudentUser[]; report: ImportAuditReport } {
    const issues: ImportValidationIssue[] = [];
    const valid: StudentUser[] = [];
    const existingIds = new Set(existingStudents.map((s) => s.student_id));
    const batchSeenIds = new Set<string>();
    const busIds = new Set(availableBuses.map((b) => b.bus_id));
    const routeIds = new Set(availableRoutes.map((r) => r.route_id));

    records.forEach((row, idx) => {
      const rowNum = idx + 1;
      const student_id = String(row.student_id || row.id || '').trim();
      const full_name = String(row.full_name || row.name || '').trim();
      const qr_identity = String(row.qr_identity || `QR-STU-${student_id}`).trim();
      const bus_id = row.bus_id ? String(row.bus_id).trim() : null;
      const route_id = row.route_id ? String(row.route_id).trim() : null;
      const account_status = (row.account_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE';

      // 1. Required fields
      if (!student_id) {
        issues.push({ type: 'ERROR', field: 'student_id', message: `Row ${rowNum}: student_id is required`, rowNumber: rowNum });
        return;
      }
      if (!full_name) {
        issues.push({ type: 'ERROR', field: 'full_name', message: `Row ${rowNum}: full_name is required`, rowNumber: rowNum, id: student_id });
        return;
      }

      // Check within current batch
      if (batchSeenIds.has(student_id)) {
        issues.push({ type: 'ERROR', field: 'student_id', message: `Duplicate student_id in import batch: ${student_id}`, rowNumber: rowNum, id: student_id });
        return;
      }

      // Check against existing dataset depending on mode
      if (mode === 'APPEND' && existingIds.has(student_id)) {
        issues.push({ type: 'ERROR', field: 'student_id', message: `Student ID already exists: ${student_id}`, rowNumber: rowNum, id: student_id });
        return;
      }
      if (mode === 'UPDATE' && !existingIds.has(student_id)) {
        issues.push({ type: 'ERROR', field: 'student_id', message: `Cannot update non-existent student ID: ${student_id}`, rowNumber: rowNum, id: student_id });
        return;
      }

      // Bus & Route checks
      if (bus_id && busIds.size > 0 && !busIds.has(bus_id)) {
        issues.push({ type: 'WARNING', field: 'bus_id', message: `Assigned bus_id "${bus_id}" not found in registered fleet`, rowNumber: rowNum, id: student_id });
      }
      if (route_id && routeIds.size > 0 && !routeIds.has(route_id)) {
        issues.push({ type: 'WARNING', field: 'route_id', message: `Assigned route_id "${route_id}" not found in registered routes`, rowNumber: rowNum, id: student_id });
      }

      batchSeenIds.add(student_id);

      const matchedBus = availableBuses.find((b) => b.bus_id === bus_id);

      valid.push({
        student_id,
        full_name,
        email: row.email ? String(row.email).trim() : null,
        phone: row.phone ? String(row.phone).trim() : null,
        department: row.department ? String(row.department).trim() : null,
        year: row.year ? String(row.year).trim() : null,
        bus_id: bus_id || null,
        bus_number: matchedBus ? matchedBus.bus_number : (row.bus_number ? String(row.bus_number).trim() : null),
        route_id: route_id || (matchedBus ? matchedBus.route_id : null),
        boarding_point: row.boarding_point ? String(row.boarding_point).trim() : null,
        boarding_lat: typeof row.boarding_lat === 'number' ? row.boarding_lat : null,
        boarding_lng: typeof row.boarding_lng === 'number' ? row.boarding_lng : null,
        qr_identity,
        account_status,
        role: 'STUDENT',
      });
    });

    return {
      valid,
      report: {
        datasetType: 'students',
        totalSubmitted: records.length,
        validCount: valid.length,
        invalidCount: records.length - valid.length,
        issues,
        importedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Validates and filters driver records
   */
  static validateDrivers(
    records: any[],
    availableBuses: Bus[] = [],
    existingDrivers: DriverUser[] = [],
    mode: ImportMode = 'REPLACE'
  ): { valid: DriverUser[]; report: ImportAuditReport } {
    const issues: ImportValidationIssue[] = [];
    const valid: DriverUser[] = [];
    const existingIds = new Set(existingDrivers.map((d) => d.driver_id));
    const batchSeenIds = new Set<string>();
    const busIds = new Set(availableBuses.map((b) => b.bus_id));

    records.forEach((row, idx) => {
      const rowNum = idx + 1;
      const driver_id = String(row.driver_id || row.id || '').trim();
      const driver_name = String(row.driver_name || row.name || '').trim();
      const qr_identity = String(row.qr_identity || `QR-DRV-${driver_id}`).trim();
      const assigned_bus_id = row.assigned_bus_id ? String(row.assigned_bus_id).trim() : null;
      const account_status = (row.account_status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE';

      // 1. Required fields
      if (!driver_id) {
        issues.push({ type: 'ERROR', field: 'driver_id', message: `Row ${rowNum}: driver_id is required`, rowNumber: rowNum });
        return;
      }
      if (!driver_name) {
        issues.push({ type: 'ERROR', field: 'driver_name', message: `Row ${rowNum}: driver_name is required`, rowNumber: rowNum, id: driver_id });
        return;
      }

      // Check within current batch
      if (batchSeenIds.has(driver_id)) {
        issues.push({ type: 'ERROR', field: 'driver_id', message: `Duplicate driver_id in import batch: ${driver_id}`, rowNumber: rowNum, id: driver_id });
        return;
      }

      // Check against existing dataset depending on mode
      if (mode === 'APPEND' && existingIds.has(driver_id)) {
        issues.push({ type: 'ERROR', field: 'driver_id', message: `Driver ID already exists: ${driver_id}`, rowNumber: rowNum, id: driver_id });
        return;
      }
      if (mode === 'UPDATE' && !existingIds.has(driver_id)) {
        issues.push({ type: 'ERROR', field: 'driver_id', message: `Cannot update non-existent driver ID: ${driver_id}`, rowNumber: rowNum, id: driver_id });
        return;
      }

      if (assigned_bus_id && busIds.size > 0 && !busIds.has(assigned_bus_id)) {
        issues.push({ type: 'WARNING', field: 'assigned_bus_id', message: `Assigned bus_id "${assigned_bus_id}" not found in registered buses`, rowNumber: rowNum, id: driver_id });
      }

      batchSeenIds.add(driver_id);

      const matchedBus = availableBuses.find((b) => b.bus_id === assigned_bus_id);

      valid.push({
        driver_id,
        driver_name,
        phone: row.phone ? String(row.phone).trim() : null,
        email: row.email ? String(row.email).trim() : null,
        assigned_bus_id,
        bus_number: matchedBus ? matchedBus.bus_number : (row.bus_number ? String(row.bus_number).trim() : null),
        route_id: row.route_id || (matchedBus ? matchedBus.route_id : null),
        qr_identity,
        account_status,
        role: 'DRIVER',
      });
    });

    return {
      valid,
      report: {
        datasetType: 'drivers',
        totalSubmitted: records.length,
        validCount: valid.length,
        invalidCount: records.length - valid.length,
        issues,
        importedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Validates and filters bus records
   */
  static validateBuses(
    records: any[],
    existingBuses: Bus[] = [],
    mode: ImportMode = 'REPLACE'
  ): { valid: Bus[]; report: ImportAuditReport } {
    const issues: ImportValidationIssue[] = [];
    const valid: Bus[] = [];
    const existingIds = new Set(existingBuses.map((b) => b.bus_id));
    const batchSeenIds = new Set<string>();

    records.forEach((row, idx) => {
      const rowNum = idx + 1;
      const bus_id = String(row.bus_id || row.id || '').trim();
      const bus_number = String(row.bus_number || '').trim();

      if (!bus_id) {
        issues.push({ type: 'ERROR', field: 'bus_id', message: `Row ${rowNum}: bus_id is required`, rowNumber: rowNum });
        return;
      }
      if (!bus_number) {
        issues.push({ type: 'ERROR', field: 'bus_number', message: `Row ${rowNum}: bus_number is required`, rowNumber: rowNum, id: bus_id });
        return;
      }

      if (batchSeenIds.has(bus_id)) {
        issues.push({ type: 'ERROR', field: 'bus_id', message: `Duplicate bus_id in import batch: ${bus_id}`, rowNumber: rowNum, id: bus_id });
        return;
      }

      if (mode === 'APPEND' && existingIds.has(bus_id)) {
        issues.push({ type: 'ERROR', field: 'bus_id', message: `Bus ID already exists: ${bus_id}`, rowNumber: rowNum, id: bus_id });
        return;
      }
      if (mode === 'UPDATE' && !existingIds.has(bus_id)) {
        issues.push({ type: 'ERROR', field: 'bus_id', message: `Cannot update non-existent bus ID: ${bus_id}`, rowNumber: rowNum, id: bus_id });
        return;
      }

      batchSeenIds.add(bus_id);

      valid.push({
        bus_id,
        bus_number,
        route_id: row.route_id ? String(row.route_id).trim() : null,
        route_name: row.route_name ? String(row.route_name).trim() : null,
        destination: row.destination ? String(row.destination).trim() : 'College Campus',
        assigned_driver_id: row.assigned_driver_id ? String(row.assigned_driver_id).trim() : null,
        assigned_driver_name: row.assigned_driver_name ? String(row.assigned_driver_name).trim() : null,
        bus_status: 'IDLE',
        location_source: 'MOBILE_DRIVER_GPS',
        current_lat: null,
        current_lng: null,
      });
    });

    return {
      valid,
      report: {
        datasetType: 'buses',
        totalSubmitted: records.length,
        validCount: valid.length,
        invalidCount: records.length - valid.length,
        issues,
        importedAt: new Date().toISOString(),
      },
    };
  }
}
