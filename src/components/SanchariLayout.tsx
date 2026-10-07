import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus,
  Bell,
  LogOut,
  KeyRound,
  Shield,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  Menu,
  ChevronRight,
  Radio,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { Api } from '../lib/api.ts';
import { SystemNotification } from '../types/index.ts';

export interface SanchariNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  badgeColor?: string;
}

interface SanchariLayoutProps {
  navItems: SanchariNavItem[];
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  children: React.ReactNode;
  isFullScreenMap?: boolean;
  onBackToDashboard?: () => void;
}

export const SanchariLayout: React.FC<SanchariLayoutProps> = ({
  navItems,
  activeTab,
  onSelectTab,
  children,
  isFullScreenMap = false,
  onBackToDashboard,
}) => {
  const { user, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifsDropdown, setShowNotifsDropdown] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isChangingPass, setIsChangingPass] = useState<boolean>(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await Api.getNotifications();
      setNotifications(data || []);
    } catch (e) {
      console.warn('Failed to load notifications in SanchariLayout:', e);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const userId = (user as any).admin_id || (user as any).student_id || (user as any).driver_id;
    setIsChangingPass(true);
    setPasswordMsg(null);

    try {
      await Api.changePassword(userId, oldPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password successfully updated.' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setPasswordMsg(null);
      }, 1500);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to update password' });
    } finally {
      setIsChangingPass(false);
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

  const getRoleLabel = () => {
    if (role === 'STUDENT') return 'Student';
    if (role === 'DRIVER') return 'Driver';
    if (role === 'ADMIN') return 'Administrator';
    return 'Portal';
  };

  const unreadNotifsCount = notifications.slice(0, 5).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
      {/* 1. TOP HEADER (Fixed Across All Dashboards) */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Left: Mobile hamburger & Sanchari branding */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="flex items-center space-x-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-800 to-indigo-700 text-white shadow-md shadow-purple-600/30">
                  <Bus className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                      SANCHARI
                    </span>
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-purple-100 text-purple-800 border border-purple-200">
                      Smart Campus Transport
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 hidden md:block">
                    Aalim Muhammed Salegh College of Engineering
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Notifications & User Profile */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Notifications Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifsDropdown((prev) => !prev)}
                  className="relative p-2 rounded-xl text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadNotifsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9.5px] font-black text-white shadow-xs animate-pulse">
                      {unreadNotifsCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotifsDropdown && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white p-4 shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center space-x-1.5">
                        <Bell className="h-4 w-4 text-purple-700" />
                        <h4 className="font-extrabold text-xs text-slate-900">
                          Sanchari Notifications
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {notifications.length} alerts
                      </span>
                    </div>

                    <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
                      {notifications.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.slice(0, 6).map((n) => (
                          <div
                            key={n.notification_id}
                            className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                              n.type === 'EMERGENCY' || n.type === 'BREAKDOWN'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : n.type === 'BUS_ARRIVAL'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="font-bold flex items-center justify-between">
                              <span>{n.title}</span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {new Date(n.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-600">
                              {n.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowNotifsDropdown(false);
                          onSelectTab('NOTIFICATIONS');
                        }}
                        className="text-[11px] font-bold text-purple-700 hover:text-purple-900 cursor-pointer"
                      >
                        View All Alerts &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Pill */}
              <div
                onClick={() => onSelectTab('PROFILE')}
                className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-2xl bg-slate-100 hover:bg-purple-50 transition border border-slate-200 cursor-pointer group"
                title="View Profile"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-700 text-white font-black text-xs shadow-xs group-hover:scale-105 transition-transform">
                  {getUserName().charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                    {getUserName()}
                  </div>
                  <div className="text-[10px] text-purple-700 font-semibold uppercase tracking-wider">
                    {getRoleLabel()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY (Fixed Sidebar + Dynamic Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* DESKTOP FIXED SIDEBAR */}
        <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
              <span>Navigation Menu</span>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition cursor-pointer ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-md shadow-purple-700/20'
                      : 'text-slate-600 hover:bg-purple-50 hover:text-purple-900'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive
                          ? 'bg-white text-purple-900'
                          : item.badgeColor || 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Settings & Logout */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/50 space-y-1">
            <button
              type="button"
              onClick={() => onSelectTab('SETTINGS')}
              className={`w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'SETTINGS'
                  ? 'bg-purple-700 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <KeyRound className="h-4 w-4" />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </aside>

        {/* MOBILE SLIDE-OUT DRAWER */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <div className="relative w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-700 text-white font-bold">
                    <Bus className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-black text-sm text-slate-900">SANCHARI</div>
                    <div className="text-[10px] text-purple-700 font-bold">{getRoleLabel()}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl font-bold text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-purple-700 text-white shadow-md'
                          : 'text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={isActive ? 'text-white' : 'text-slate-500'}>
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-3 border-t border-slate-200 bg-slate-50 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectTab('SETTINGS');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. MAIN CONTENT CONTAINER */}
        <main
          className={`flex-1 overflow-y-auto ${
            isFullScreenMap ? 'p-0 h-[calc(100vh-4rem)] relative' : 'p-4 sm:p-6 lg:p-8'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-purple-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-800">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Update Password</h3>
                  <p className="text-[11px] text-slate-500">Change your portal login credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs focus:border-purple-600 focus:outline-hidden"
                />
              </div>

              {passwordMsg && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {passwordMsg.text}
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isChangingPass}
                  className="px-4 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isChangingPass ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
