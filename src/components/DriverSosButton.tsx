import React, { useState, useRef, useEffect } from 'react';
import { AlertOctagon, ShieldAlert, CheckCircle2, Phone, X, Radio } from 'lucide-react';
import { Api } from '../lib/api.ts';
import { EmergencyEvent } from '../types/index.ts';

interface DriverSosButtonProps {
  busId: string;
  driverId: string;
  busNumber?: string;
  currentCoords?: { lat: number; lng: number } | null;
  onEmergencyTriggered?: (emergency: EmergencyEvent) => void;
}

const HOLD_DURATION_MS = 2000; // Required 2-second continuous hold to prevent accidental triggers

export const DriverSosButton: React.FC<DriverSosButtonProps> = ({
  busId,
  driverId,
  busNumber = 'Bus',
  currentCoords,
  onEmergencyTriggered,
}) => {
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0); // 0 to 100
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyEvent | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isTriggeredRef = useRef<boolean>(false);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const startHold = (e: React.SyntheticEvent) => {
    // Prevent default context menu or scrolling during touch
    if (e.type === 'touchstart') {
      // touch handling
    }
    if (isSubmitting || activeEmergency) return;

    setIsPressing(true);
    isTriggeredRef.current = false;
    startTimeRef.current = performance.now();
    setErrorMessage(null);

    // Initial subtle haptic click
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(30);
      } catch (_) {}
    }

    const updateLoop = () => {
      if (!startTimeRef.current) return;
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(progress);

      if (progress >= 100 && !isTriggeredRef.current) {
        isTriggeredRef.current = true;
        handleTriggerSos();
        return;
      }

      if (!isTriggeredRef.current) {
        animFrameRef.current = requestAnimationFrame(updateLoop);
      }
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);
  };

  const cancelHold = () => {
    if (isTriggeredRef.current) return; // Already fired

    setIsPressing(false);
    startTimeRef.current = null;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setHoldProgress(0);
  };

  const handleTriggerSos = async () => {
    setIsPressing(false);
    setIsSubmitting(true);
    setHoldProgress(100);

    // Strong vibration pattern on trigger
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch (_) {}
    }

    try {
      // Get current location, with fallback to props coordinates or browser GPS
      let lat = currentCoords?.lat ?? null;
      let lng = currentCoords?.lng ?? null;

      if ((lat === null || lng === null) && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 3000,
            });
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch (_) {
          // If browser timeout, fallback gracefully
        }
      }

      const timestamp = new Date().toISOString();
      const res = await Api.sendDriverSos({
        busId,
        driverId,
        currentGpsLocation: lat && lng ? { latitude: lat, longitude: lng } : undefined,
        latitude: lat,
        longitude: lng,
        timestamp,
        reason: 'Driver pressed & held Emergency SOS button for 2 seconds.',
      });

      setActiveEmergency(res.emergency);
      setShowConfirmModal(true);
      if (onEmergencyTriggered) {
        onEmergencyTriggered(res.emergency);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch SOS alert. Please retry or call administration.');
    } finally {
      setIsSubmitting(false);
      setHoldProgress(0);
    }
  };

  // SVG circular progress parameters
  const size = 110;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (holdProgress / 100) * circumference;

  return (
    <>
      <div className="relative flex flex-col items-center">
        {/* The 2-Second Press-and-Hold Button */}
        <div className="relative flex items-center justify-center select-none touch-none">
          {/* Circular SVG Progress Ring */}
          <svg className="w-[124px] h-[124px] -rotate-90 pointer-events-none">
            <circle
              cx="62"
              cy="62"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-rose-950/40"
              fill="transparent"
            />
            <circle
              cx="62"
              cy="62"
              r={radius}
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-rose-500 transition-all duration-75 ease-linear"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>

          {/* Interactive Core Button */}
          <button
            type="button"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onTouchCancel={cancelHold}
            disabled={isSubmitting}
            className={`absolute flex flex-col items-center justify-center w-[96px] h-[96px] rounded-full text-white font-black shadow-2xl transition-transform active:scale-95 cursor-pointer focus:outline-none select-none ${
              isPressing
                ? 'bg-gradient-to-tr from-rose-700 via-rose-600 to-red-500 ring-4 ring-rose-400/80 scale-95 shadow-rose-600/60'
                : 'bg-gradient-to-tr from-rose-800 via-rose-700 to-red-600 hover:from-rose-700 hover:to-red-500 ring-2 ring-rose-500/40 shadow-rose-900/50'
            }`}
          >
            <AlertOctagon className={`h-8 w-8 mb-0.5 ${isPressing ? 'animate-bounce text-white' : 'text-rose-100'}`} />
            <span className="text-[12px] font-black tracking-wider leading-none">
              {isSubmitting ? 'SENDING' : 'SOS'}
            </span>
            <span className="text-[9px] font-extrabold uppercase text-rose-200/90 tracking-tight mt-0.5">
              EMERGENCY
            </span>
          </button>
        </div>

        {/* Hold Progress Instruction Badge */}
        <div className="mt-2 text-center">
          {isPressing ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-bold shadow-md animate-pulse">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>
                HOLDING: {Math.max(0, (2 - (holdProgress / 100) * 2)).toFixed(1)}s remaining...
              </span>
            </div>
          ) : (
            <p className="text-[11px] font-semibold text-rose-300/90">
              Press &amp; Hold for <strong className="text-white font-extrabold">2 seconds</strong> to trigger SOS
            </p>
          )}

          {errorMessage && (
            <p className="mt-1 text-[11px] font-semibold text-rose-400 bg-rose-950/80 px-2 py-1 rounded-lg border border-rose-800">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Confirmation Modal when SOS is successfully broadcast */}
      {showConfirmModal && activeEmergency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border-2 border-rose-600 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600/30 border border-rose-500 animate-pulse">
                <AlertOctagon className="h-7 w-7 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Emergency SOS Activated!</h3>
                <p className="text-xs text-rose-300">Incident dispatched to Campus Admin Command</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-xs space-y-2">
              <div className="flex justify-between items-center pb-2 border-b border-rose-900/60 font-semibold">
                <span className="text-slate-400">Emergency ID:</span>
                <span className="font-mono text-white">{activeEmergency.emergency_id}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-rose-900/60 font-semibold">
                <span className="text-slate-400">Assigned Bus:</span>
                <span className="font-bold text-amber-300">{busNumber}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-rose-900/60 font-semibold">
                <span className="text-slate-400">Broadcast Coordinates:</span>
                <span className="font-mono text-emerald-400">
                  {activeEmergency.latitude?.toFixed(4) ?? 'N/A'}, {activeEmergency.longitude?.toFixed(4) ?? 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center font-semibold">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-300">{new Date(activeEmergency.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ⚠️ The administration dashboard is now flashing red with high-priority sirens and map tracking for your bus. Relief vehicles and support staff have been alerted.
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <a
                href="tel:04426842627"
                className="flex-1 inline-flex items-center justify-center space-x-2 rounded-2xl bg-purple-700 hover:bg-purple-800 px-4 py-3 text-xs font-bold text-white transition shadow-md"
              >
                <Phone className="h-4 w-4" />
                <span>Call Transport Desk</span>
              </a>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-2xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-xs font-bold text-white transition border border-slate-700"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
