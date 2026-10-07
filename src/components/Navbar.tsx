import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus,
  Bell,
  LogOut,
  KeyRound,
  Menu,
  X,
  User,
  Shield,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import { SystemNotification } from '../types/index.ts';

interface NavbarProps {
  onToggleSidebarMobile?: () => void;
  onSelectNav?: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebarMobile, onSelectNav }) => {
  const { user, role, logout } = useAuth();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifs, setShowNotifs] = useState<boolean>(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await Api.getNotifications();
      setNotifications(data);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    }
  };

  const getUserName = () => {
    if (!user) return 'User';
    return (user as any).name || (user as any).full_name || (user as any).driver_name || 'User';
  };

  const getUserId = () => {
    if (!user) return '';
    return (user as any).admin_id || (user as any).student_id || (user as any).driver_id || '';
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-xs">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-2">
          {/* Left: Mobile hamburger & College Branding */}
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            {onToggleSidebarMobile && (
              <button
                type="button"
                onClick={onToggleSidebarMobile}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
                title="Toggle Navigation Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-purple-700 text-white shadow-md shadow-purple-500/20 shrink-0">
                <Bus className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 leading-tight">
                    SANCHARI
                  </h1>
                  <span className="hidden sm:inline-block rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-purple-800">
                    Smart Campus Transport
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 hidden sm:block truncate max-w-md">
                  Aalim Muhammed Salegh College of Engineering &bull; Chennai
                </p>
              </div>
            </div>
          </div>

          {/* Right: Notifications & Profile Quick Access */}
          <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => {
                  if (onSelectNav) {
                    onSelectNav('NOTIFICATIONS');
                  } else {
                    setShowNotifs(!showNotifs);
                  }
                }}
                className="relative rounded-xl p-2 text-slate-600 hover:bg-purple-50 hover:text-purple-700 transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                  </span>
                )}
              </button>

              {/* Notifications Dropdown (fallback if onSelectNav not passed) */}
              {showNotifs && !onSelectNav && (
                <div className="absolute right-0 mt-2 w-72 sm:w-96 rounded-2xl bg-white shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-purple-700" />
                      <h4 className="font-bold text-sm text-slate-800">Transport Alerts</h4>
                    </div>
                    <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full">
                      {notifications.length}
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-center py-6 text-xs text-slate-400">No recent transport alerts.</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.notification_id}
                          className="p-3 rounded-xl border text-xs bg-slate-50 border-slate-200 text-slate-800"
                        >
                          <div className="flex items-center justify-between font-semibold mb-1">
                            <span>{n.title}</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile User Pill */}
            <button
              type="button"
              onClick={() => onSelectNav && onSelectNav('PROFILE')}
              className="flex items-center space-x-2 bg-purple-50/80 hover:bg-purple-100/80 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-purple-200 transition cursor-pointer text-left"
              title="View Profile"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-700 text-white font-bold text-xs shrink-0">
                {role === 'ADMIN' ? 'A' : role === 'DRIVER' ? 'D' : 'S'}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-bold text-slate-800 leading-none truncate max-w-[130px]">
                  {getUserName()}
                </div>
                <div className="text-[10px] text-purple-700 font-semibold uppercase mt-0.5">
                  {role} &bull; {getUserId()}
                </div>
              </div>
            </button>

            {/* Sign Out Button */}
            <button
              onClick={logout}
              className="rounded-xl p-1.5 sm:p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
