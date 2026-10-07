import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import { SystemNotification } from '../../types/index.ts';
import { Api } from '../../lib/api.ts';

export const DriverNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadNotifs();
  }, []);

  const loadNotifs = async () => {
    setIsLoading(true);
    try {
      const data = await Api.getNotifications();
      setNotifications(data || []);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>🔔 Pilot Transport Alerts</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch announcements, road diversions, and student schedule updates
          </p>
        </div>
        <button
          type="button"
          onClick={loadNotifs}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer shadow-xs"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-purple-700' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <Bell className="h-8 w-8 text-slate-300 mx-auto" />
            <p>No active driver dispatch alerts.</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div key={notif.notification_id} className="p-5 flex items-start space-x-4 hover:bg-slate-50 transition">
              <div className="h-10 w-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900">{notif.title}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
