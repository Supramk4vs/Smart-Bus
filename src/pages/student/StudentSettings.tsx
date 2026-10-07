import React, { useState } from 'react';
import { Settings, KeyRound, Bell, MapPin, Shield, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Api } from '../../lib/api.ts';

export const StudentSettings: React.FC = () => {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Preference Toggles
  const [highAccuracyGps, setHighAccuracyGps] = useState<boolean>(true);
  const [arrivalPushAlerts, setArrivalPushAlerts] = useState<boolean>(true);
  const [soundFeedback, setSoundFeedback] = useState<boolean>(true);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const userId = (user as any).student_id;
    if (!userId) return;

    setIsUpdating(true);
    setFeedback(null);

    try {
      await Api.changePassword(userId, oldPassword, newPassword);
      setFeedback({ type: 'success', text: 'Password successfully changed!' });
      setOldPassword('');
      setNewPassword('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to update password. Check your current password.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
          <span>⚙️ Student Portal Settings</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Customize notifications, GPS tracking accuracy, and account security credentials
        </p>
      </div>

      {/* Preferences Section */}
      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100 flex items-center space-x-2">
          <Settings className="h-4 w-4 text-purple-700" />
          <span>Mobile Device & Tracking Preferences</span>
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">High-Accuracy Mobile GPS</div>
              <p className="text-[11px] text-slate-500">
                Uses hardware satellite GPS for precision stop-waiting pin
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
              <div className="text-xs font-bold text-slate-800">Bus Arrival Geofence Alerts</div>
              <p className="text-[11px] text-slate-500">
                Notify me when the bus is within 500 meters of my stop
              </p>
            </div>
            <input
              type="checkbox"
              checked={arrivalPushAlerts}
              onChange={(e) => setArrivalPushAlerts(e.target.checked)}
              className="h-5 w-5 rounded-md accent-purple-700 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">Audio & Haptic Feedback</div>
              <p className="text-[11px] text-slate-500">
                Play sound or vibrate upon QR scan attendance confirmation
              </p>
            </div>
            <input
              type="checkbox"
              checked={soundFeedback}
              onChange={(e) => setSoundFeedback(e.target.checked)}
              className="h-5 w-5 rounded-md accent-purple-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Password Change Section */}
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
            {isUpdating ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>
    </div>
  );
};
