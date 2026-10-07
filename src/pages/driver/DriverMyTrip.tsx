import React, { useState, useEffect } from 'react';
import {
  Bus,
  Play,
  Square,
  QrCode,
  Users,
  Compass,
  MapPin,
  Clock,
  Radio,
  ArrowRight,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { DriverUser, Bus as BusType, Trip, DRIVER_SPECIFIED_STOPS } from '../../types/index.ts';
import { QRModal } from '../../components/QRModal.tsx';
import { Api } from '../../lib/api.ts';

interface DriverMyTripProps {
  driver: DriverUser;
  assignedBus: BusType | null;
  activeTrip: Trip | null;
  waitingCount: number;
  boardedCount: number;
  absentCount: number;
  isStartingTrip: boolean;
  isEndingTrip: boolean;
  onStartTrip: () => void;
  onEndTrip: () => void;
  onNavigate: (tab: string) => void;
}

export const DriverMyTrip: React.FC<DriverMyTripProps> = ({
  driver,
  assignedBus,
  activeTrip,
  waitingCount,
  boardedCount,
  absentCount,
  isStartingTrip,
  isEndingTrip,
  onStartTrip,
  onEndTrip,
  onNavigate,
}) => {
  const [showBusQr, setShowBusQr] = useState<boolean>(false);
  const [dynamicQrToken, setDynamicQrToken] = useState<string | null>(
    activeTrip?.dynamic_qr_token || null
  );
  const [qrSecondsLeft, setQrSecondsLeft] = useState<number>(60);
  const isTripActive = !!activeTrip;

  const targetBusId = assignedBus?.bus_id || driver.assigned_bus_id || 'BUS-02';

  const fetchFreshQR = async () => {
    if (!driver?.driver_id || !targetBusId) return;
    try {
      const res = await Api.getDynamicQR(driver.driver_id, targetBusId);
      if (res?.dynamic_qr_token) {
        setDynamicQrToken(res.dynamic_qr_token);
        setQrSecondsLeft(res.expires_in_seconds || 60);
      }
    } catch (_e) {
      // Fallback
    }
  };

  useEffect(() => {
    if (activeTrip?.dynamic_qr_token) {
      setDynamicQrToken(activeTrip.dynamic_qr_token);
    }
  }, [activeTrip?.dynamic_qr_token]);

  // Countdown timer for dynamic QR code refresh
  useEffect(() => {
    if (!isTripActive) return;

    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchFreshQR();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTripActive, driver?.driver_id, targetBusId]);

  // Real dynamic token or fallback
  const activeQrPayload =
    dynamicQrToken ||
    activeTrip?.dynamic_qr_token ||
    JSON.stringify({
      bus_id: targetBusId,
      bus_number: assignedBus?.bus_number || 'College Bus',
      timestamp: Date.now(),
      type: 'CAMPUS_BUS_BOARDING_TOKEN',
    });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>🚌 My Trip &amp; Dynamic Boarding QR</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Active navigation session, dynamic 60s rotating QR code broadcaster, and passenger attendance
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowBusQr(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-md transition cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>Open Fullscreen QR Modal</span>
          </button>
        </div>
      </div>

      {/* Main Trip Status Box */}
      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trip Status
            </span>
            <div className="text-2xl font-black text-slate-900 flex items-center space-x-2 mt-0.5">
              <span>{isTripActive ? 'ACTIVE TRANSIT TRIP' : 'NO ACTIVE TRIP'}</span>
              {isTripActive && <span className="h-3 w-3 rounded-full bg-emerald-500 animate-ping" />}
            </div>
            {activeTrip?.start_time && (
              <span className="text-xs text-slate-500 mt-1 block">
                Started at {new Date(activeTrip.start_time).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {!isTripActive ? (
              <button
                type="button"
                disabled={isStartingTrip}
                onClick={onStartTrip}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>{isStartingTrip ? 'Starting...' : 'START TRIP & ACTIVATE QR'}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isEndingTrip}
                onClick={onEndTrip}
                className="inline-flex items-center space-x-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>{isEndingTrip ? 'Ending...' : 'END TRIP'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic QR Showcase Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-50 via-indigo-50/40 to-slate-50 border border-purple-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 max-w-md">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold">
              <QrCode className="h-3.5 w-3.5" />
              <span>DYNAMIC BUS BOARDING QR</span>
            </div>
            <h3 className="text-lg font-black text-slate-900">
              Display on Bus Dashboard Tablet
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Students scan this Dynamic QR code using their mobile phone to verify their attendance upon boarding.
              The security token automatically refreshes every 60 seconds to prevent proxy attendance and screenshot sharing.
            </p>
            {isTripActive ? (
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-xl inline-flex">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Active token refreshes in {qrSecondsLeft}s</span>
              </div>
            ) : (
              <div className="text-xs font-semibold text-amber-800 bg-amber-100/70 px-3 py-1.5 rounded-xl inline-flex">
                Click &quot;START TRIP&quot; above to activate the live GPS session &amp; dynamic security tokens.
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowBusQr(true)}
              className="p-4 rounded-2xl bg-white border-2 border-purple-300 shadow-md hover:shadow-lg hover:border-purple-500 transition group cursor-pointer flex flex-col items-center"
            >
              <div className="h-28 w-28 bg-purple-900 rounded-xl flex items-center justify-center text-white shadow-inner group-hover:scale-105 transition">
                <QrCode className="h-16 w-16" />
              </div>
              <span className="text-[11px] font-black text-purple-800 mt-2.5">
                Click to Expand Fullscreen &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* Live Trip Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Bus Number</span>
            <div className="text-lg font-black text-slate-900 mt-1">
              {assignedBus?.bus_number || 'Bus'}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <span className="text-[10px] font-bold text-amber-700 uppercase">Waiting Students</span>
            <div className="text-lg font-black text-amber-950 mt-1">{waitingCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-700 uppercase">Boarded Safely</span>
            <div className="text-lg font-black text-emerald-950 mt-1">{boardedCount}</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-700 uppercase">Absent (Skip)</span>
            <div className="text-lg font-black text-rose-950 mt-1">{absentCount}</div>
          </div>
        </div>

        {/* Action Link to GPS */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onNavigate('BUS_GPS')}
            className="w-full py-3.5 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-black text-xs transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Compass className="h-4 w-4" />
            <span>Open Live Road Route &amp; GPS Navigation Map &rarr;</span>
          </button>
        </div>

        {/* 6 Sequenced Official Stops Overview */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
              <span>📍 Route Stops &amp; Coordinates (6 Sequenced Stops)</span>
            </h4>
            <span className="text-[10.5px] font-bold text-purple-700">Avadi to Campus</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {DRIVER_SPECIFIED_STOPS.map((st) => (
              <div
                key={st.stopNumber}
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center space-x-2.5"
              >
                <span
                  className={`h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                    st.stopNumber === 6 ? 'bg-amber-400 text-slate-950' : 'bg-purple-700 text-white'
                  }`}
                >
                  {st.stopNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate flex items-center space-x-1">
                    <span>{st.name}</span>
                    {st.stopNumber === 6 && <span className="text-[10px]">🏫</span>}
                  </div>
                  <div className="text-[10px] font-mono text-purple-700 font-semibold truncate">
                    {st.dms}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bus Dynamic QR Code Display Modal */}
      {showBusQr && (
        <QRModal
          isOpen={showBusQr}
          onClose={() => setShowBusQr(false)}
          title={`Bus ${assignedBus?.bus_number || ''} Boarding QR`}
          subtitle="Display this on the bus dashboard screen for student boarding verification"
          token={activeQrPayload}
          isDynamic={isTripActive}
          refreshSecondsLeft={isTripActive ? qrSecondsLeft : undefined}
          onRefresh={fetchFreshQR}
        />
      )}
    </div>
  );
};
