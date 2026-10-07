import React, { useState } from 'react';
import { Settings, KeyRound, Radio, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Api } from '../../lib/api.ts';

export const DriverSettings: React.FC = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [highAccuracyGps, setHighAccuracyGps] = useState<boolean>(true);
  const [autoBroadcast, setAutoBroadcast] = useState<boolean>(true);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const userId = (user as any).driver_id;
    if (!userId) return;

    setIsUpdating(true);
    setFeedback(null);

    try {
      await Api.changePassword(userId, oldPassword, newPassword);
      setFeedback({ type: 'success', text: 'Password successfully updated.' });
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
          <span>⚙️ Driver System Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Hardware GPS frequency, trip broadcast configurations, and security credentials
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
          <Settings className="h-4 w-4 text-purple-700" />
          <span>Trip GPS Telemetry Settings</span>
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">High-Precision Mobile GPS Stream</div>
              <p className="text-[11px] text-slate-500">
                Transmits 2-second interval coordinates to college transit live map
              </p>
            </div>
            <input
              type="checkbox"
              checked={highAccuracyGps}
              onChange={(e) => setHighAccuracyGps(e.target.checked)}
              className="h-5 w-5 rounded-md accent-purple-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">Automatic Geofence Arrival Broadcast</div>
              <p className="text-[11px] text-slate-500">
                Automatically notifies waiting students when the bus is within 500m of their stop
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoBroadcast}
              onChange={(e) => setAutoBroadcast(e.target.checked)}
              className="h-5 w-5 rounded-md accent-purple-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
          <KeyRound className="h-4 w-4 text-purple-700" />
          <span>Security & Password Update</span>
        </h2>

        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-purple-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:border-purple-600"
            />
          </div>

          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
