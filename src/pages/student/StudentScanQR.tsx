import React, { useState } from 'react';
import {
  QrCode,
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { StudentUser, Bus as BusType } from '../../types/index.ts';
import { Api } from '../../lib/api.ts';
import { QRScannerModal } from '../../components/QRScannerModal.tsx';
import { QRModal } from '../../components/QRModal.tsx';

interface StudentScanQRProps {
  student: StudentUser;
  assignedBus: BusType | null;
  onAttendanceVerified: () => void;
  onNavigate: (tab: string) => void;
}

export const StudentScanQR: React.FC<StudentScanQRProps> = ({
  student,
  assignedBus,
  onAttendanceVerified,
  onNavigate,
}) => {
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showIdQr, setShowIdQr] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');

  const handleScanSuccess = async (scannedPayload: string) => {
    setShowScanner(false);
    setIsVerifying(true);
    setScanResult(null);

    try {
      // Get current location if available
      let lat: number | null = null;
      let lng: number | null = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (_) {}
      }

      // Send scanned token to backend
      const res = await Api.scanBusQR(student.student_id, scannedPayload, lat, lng);
      if (res?.success) {
        setScanResult({
          success: true,
          message: res.message || 'Boarding verified successfully! Status updated to BOARDED 🟢',
          timestamp: new Date().toLocaleTimeString(),
        });
        onAttendanceVerified();
      } else {
        setScanResult({
          success: false,
          message: res?.message || 'Invalid bus QR token or expired session.',
        });
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Verification failed. Please scan the active bus QR code.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScanSuccess(manualCode.trim());
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>📷 Bus QR Attendance Verification</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Scan the dynamic QR code displayed on the bus device upon boarding to verify your attendance
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowIdQr(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
        >
          <QrCode className="h-4 w-4 text-purple-700" />
          <span>View My Student ID QR</span>
        </button>
      </div>

      {/* Result Banner */}
      {scanResult && (
        <div
          className={`p-5 rounded-3xl border flex items-start space-x-3.5 shadow-sm animate-in fade-in duration-200 ${
            scanResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          {scanResult.success ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <h3 className="font-black text-sm">
              {scanResult.success ? 'Attendance Verified!' : 'QR Verification Failed'}
            </h3>
            <p className="text-xs leading-relaxed opacity-90">{scanResult.message}</p>
            {scanResult.timestamp && (
              <span className="text-[11px] font-mono text-emerald-700">
                Logged at: {scanResult.timestamp}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Primary Scanner Action Box */}
      <div className="rounded-3xl bg-white p-8 border border-slate-200 shadow-sm text-center space-y-6">
        <div className="mx-auto h-24 w-24 rounded-3xl bg-purple-100 text-purple-800 flex items-center justify-center shadow-md shadow-purple-600/10 ring-4 ring-purple-50">
          <Camera className="h-12 w-12" />
        </div>

        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-xl font-black text-slate-900">
            Scan Bus Display QR
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Upon boarding, use your mobile camera to scan the dynamic digital QR displayed on the
            dedicated tablet mounted inside Bus{' '}
            <strong>{assignedBus?.bus_number || student.bus_number || ''}</strong>.
          </p>
        </div>

        <div>
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => setShowScanner(true)}
            className="inline-flex items-center space-x-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black text-sm shadow-xl shadow-purple-700/25 active:scale-95 transition cursor-pointer disabled:opacity-50"
          >
            {isVerifying ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
            <span>{isVerifying ? 'Verifying with Backend...' : 'Launch Camera Scanner'}</span>
          </button>
        </div>

        {/* Workflow Info Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 1</span>
            <div className="text-xs font-bold text-slate-800">Board Your Bus</div>
            <p className="text-[11px] text-slate-500">Board at your registered pickup stop</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 2</span>
            <div className="text-xs font-bold text-slate-800">Scan Tablet QR</div>
            <p className="text-[11px] text-slate-500">Scan with your personal mobile camera</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Step 3</span>
            <div className="text-xs font-bold text-emerald-700">Instant BOARDED 🟢</div>
            <p className="text-[11px] text-slate-500">Boarding time recorded in Firestore</p>
          </div>
        </div>
      </div>

      {/* Manual Verification Code Input (Fallback) */}
      <div className="rounded-3xl bg-slate-50 p-6 border border-slate-200 space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Manual Code Input (Fallback if camera unavailable)
        </h3>
        <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Paste or enter bus QR payload or code..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs bg-white focus:outline-hidden focus:border-purple-600"
          />
          <button
            type="submit"
            disabled={!manualCode.trim() || isVerifying}
            className="px-5 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            Verify Code
          </button>
        </form>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScannerModal
          isOpen={showScanner}
          title="Scan Bus Display Boarding QR"
          onClose={() => setShowScanner(false)}
          onScanSuccess={handleScanSuccess}
        />
      )}

      {/* Student ID QR Modal */}
      {showIdQr && (
        <QRModal
          isOpen={showIdQr}
          onClose={() => setShowIdQr(false)}
          title={`${student.full_name}'s Campus ID QR`}
          subtitle="Pre-registered Student Transit Pass"
          token={JSON.stringify({
            student_id: student.student_id,
            name: student.full_name,
            bus_number: student.bus_number,
            boarding_point: student.boarding_point,
          })}
        />
      )}
    </div>
  );
};
