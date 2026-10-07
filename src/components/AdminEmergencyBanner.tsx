import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Phone,
  MapPin,
  CheckCircle2,
  X,
  Radio,
  Clock,
  Navigation,
  ShieldAlert,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import { EmergencyEvent } from '../types/index.ts';

interface AdminEmergencyBannerProps {
  onViewLocation: (emergency: EmergencyEvent) => void;
  onEmergencyResolved?: (emergencyId: string) => void;
}

export const AdminEmergencyBanner: React.FC<AdminEmergencyBannerProps> = ({
  onViewLocation,
  onEmergencyResolved,
}) => {
  const [emergencies, setEmergencies] = useState<EmergencyEvent[]>([]);
  const [isResolving, setIsResolving] = useState<string | null>(null);

  // Poll for active emergencies every 3 seconds
  useEffect(() => {
    fetchActiveEmergencies();
    const interval = setInterval(fetchActiveEmergencies, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveEmergencies = async () => {
    try {
      const res = await Api.getActiveEmergencies();
      if (res.activeEmergencies) {
        setEmergencies(res.activeEmergencies);
      }
    } catch (e) {
      console.warn('Failed to poll active emergencies:', e);
    }
  };

  const handleResolve = async (emergencyId: string) => {
    setIsResolving(emergencyId);
    try {
      await Api.resolveEmergency(emergencyId);
      setEmergencies((prev) => prev.filter((e) => e.emergency_id !== emergencyId));
      if (onEmergencyResolved) {
        onEmergencyResolved(emergencyId);
      }
    } catch (e) {
      console.warn('Failed to resolve emergency:', e);
    } finally {
      setIsResolving(null);
    }
  };

  if (emergencies.length === 0) return null;

  return (
    <div className="space-y-3 z-30">
      {emergencies.map((emg) => (
        <div
          key={emg.emergency_id}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-5 sm:p-6 shadow-2xl border-2 border-red-400 ring-4 ring-rose-500/30 animate-pulse"
        >
          {/* Animated flashing background warning line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-300 via-white to-amber-300 animate-ping opacity-75" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Siren & Alert Message */}
            <div className="flex items-start space-x-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-xl border-2 border-amber-300 animate-bounce">
                <AlertTriangle className="h-7 w-7" />
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300 border border-amber-400/40">
                    HIGH-PRIORITY SOS DISPATCH
                  </span>
                  <span className="text-[11px] font-mono text-rose-200">
                    ID: {emg.emergency_id}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>🚨 EMERGENCY: Bus {emg.bus_number} needs immediate assistance!</span>
                </h3>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-rose-100 font-medium">
                  <span>
                    Driver: <strong className="text-white font-bold">{emg.driver_name}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Phone:{' '}
                    <strong className="text-white font-bold">{emg.driver_phone || 'N/A'}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Reported:{' '}
                    <strong className="text-white font-bold">
                      {new Date(emg.timestamp).toLocaleTimeString()}
                    </strong>
                  </span>
                  {typeof emg.latitude === 'number' && typeof emg.longitude === 'number' && (
                    <>
                      <span>&bull;</span>
                      <span className="font-mono text-amber-200">
                        GPS: {emg.latitude.toFixed(4)}°, {emg.longitude.toFixed(4)}°
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
              {/* Action 1: Call Driver */}
              {emg.driver_phone && (
                <a
                  href={`tel:${emg.driver_phone}`}
                  className="inline-flex items-center space-x-1.5 rounded-2xl bg-white hover:bg-slate-100 text-rose-700 px-4 py-2.5 text-xs font-black shadow-lg transition active:scale-95"
                >
                  <Phone className="h-4 w-4" />
                  <span>Call Driver</span>
                </a>
              )}

              {/* Action 2: View Location on Map */}
              <button
                type="button"
                onClick={() => onViewLocation(emg)}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-slate-900/90 hover:bg-slate-900 text-white px-4 py-2.5 text-xs font-black shadow-lg transition border border-rose-300 active:scale-95 cursor-pointer"
              >
                <MapPin className="h-4 w-4 text-rose-400 animate-pulse" />
                <span>View Location</span>
              </button>

              {/* Action 3: Dismiss Alert / Resolve Emergency */}
              <button
                type="button"
                disabled={isResolving === emg.emergency_id}
                onClick={() => handleResolve(emg.emergency_id)}
                className="inline-flex items-center space-x-1.5 rounded-2xl bg-rose-950/70 hover:bg-rose-950 text-rose-100 hover:text-white px-4 py-2.5 text-xs font-bold shadow-md transition border border-rose-400/50 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>{isResolving === emg.emergency_id ? 'Resolving...' : 'Dismiss Alert'}</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
