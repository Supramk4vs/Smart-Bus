import React from 'react';
import {
  Home,
  MapPin,
  Bus,
  QrCode,
  History,
  AlertTriangle,
  Bell,
  User,
  Settings,
  LogOut,
  Users,
  AlertOctagon,
  FileText,
  BarChart3,
  Route as RouteIcon,
  Compass,
} from 'lucide-react';

export type StudentNavOption =
  | 'WELCOME'
  | 'DASHBOARD'
  | 'LIVE_GPS'
  | 'MY_BUS'
  | 'SCAN_QR'
  | 'TRIP_HISTORY'
  | 'COMPLAINTS'
  | 'NOTIFICATIONS'
  | 'PROFILE'
  | 'SETTINGS';

export type DriverNavOption =
  | 'WELCOME'
  | 'DASHBOARD'
  | 'BUS_GPS'
  | 'MY_TRIP'
  | 'STUDENTS'
  | 'TRIP_HISTORY'
  | 'BREAKDOWN'
  | 'NOTIFICATIONS'
  | 'PROFILE'
  | 'SETTINGS';

export type AdminNavOption =
  | 'WELCOME'
  | 'DASHBOARD'
  | 'FLEET_GPS'
  | 'STUDENTS'
  | 'DRIVERS'
  | 'BUSES'
  | 'BOARDING_POINTS'
  | 'TRIPS'
  | 'REPORTS'
  | 'COMPLAINTS'
  | 'NOTIFICATIONS'
  | 'PROFILE'
  | 'SETTINGS';

export type NavOption = StudentNavOption | DriverNavOption | AdminNavOption;

interface SidebarProps {
  role: 'STUDENT' | 'DRIVER' | 'ADMIN';
  activeNav: NavOption;
  onSelectNav: (option: NavOption) => void;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  activeNav,
  onSelectNav,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const getMenuItems = () => {
    if (role === 'STUDENT') {
      return [
        { id: 'DASHBOARD', label: 'Dashboard', icon: Home, emoji: '🏠' },
        { id: 'LIVE_GPS', label: 'Live GPS', icon: MapPin, emoji: '📍' },
        { id: 'MY_BUS', label: 'My Bus', icon: Bus, emoji: '🚌' },
        { id: 'SCAN_QR', label: 'Scan QR', icon: QrCode, emoji: '📷' },
        { id: 'TRIP_HISTORY', label: 'Trip History', icon: History, emoji: '📜' },
        { id: 'COMPLAINTS', label: 'Complaints', icon: AlertTriangle, emoji: '⚠️' },
        { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, emoji: '🔔' },
        { id: 'PROFILE', label: 'Profile', icon: User, emoji: '👤' },
        { id: 'SETTINGS', label: 'Settings', icon: Settings, emoji: '⚙️' },
      ];
    }

    if (role === 'DRIVER') {
      return [
        { id: 'DASHBOARD', label: 'Dashboard', icon: Home, emoji: '🏠' },
        { id: 'BUS_GPS', label: 'Bus GPS', icon: MapPin, emoji: '📍' },
        { id: 'MY_TRIP', label: 'My Trip', icon: RouteIcon, emoji: '🚌' },
        { id: 'STUDENTS', label: 'Students', icon: Users, emoji: '👥' },
        { id: 'TRIP_HISTORY', label: 'Trip History', icon: History, emoji: '📜' },
        { id: 'BREAKDOWN', label: 'Breakdown', icon: AlertOctagon, emoji: '⚠️' },
        { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, emoji: '🔔' },
        { id: 'PROFILE', label: 'Profile', icon: User, emoji: '👤' },
        { id: 'SETTINGS', label: 'Settings', icon: Settings, emoji: '⚙️' },
      ];
    }

    // ADMIN
    return [
      { id: 'DASHBOARD', label: 'Dashboard', icon: Home, emoji: '🏠' },
      { id: 'FLEET_GPS', label: 'Fleet GPS', icon: Compass, emoji: '🗺️' },
      { id: 'STUDENTS', label: 'Students', icon: Users, emoji: '👨‍🎓' },
      { id: 'DRIVERS', label: 'Drivers', icon: Bus, emoji: '🚌' },
      { id: 'BUSES', label: 'Buses', icon: Bus, emoji: '🚍' },
      { id: 'BOARDING_POINTS', label: 'Boarding Points', icon: MapPin, emoji: '📍' },
      { id: 'TRIPS', label: 'Trips', icon: RouteIcon, emoji: '📜' },
      { id: 'REPORTS', label: 'Reports', icon: BarChart3, emoji: '📊' },
      { id: 'COMPLAINTS', label: 'Complaints', icon: AlertTriangle, emoji: '⚠️' },
      { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, emoji: '🔔' },
      { id: 'PROFILE', label: 'Profile', icon: User, emoji: '👤' },
      { id: 'SETTINGS', label: 'Settings', icon: Settings, emoji: '⚙️' },
    ];
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Fixed Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-950 text-white flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 bg-slate-950 shrink-0">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectNav('WELCOME')}>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-700 to-indigo-600 text-white shadow-md shadow-purple-600/30">
              <Bus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight text-white flex items-center space-x-1">
                <span>SANCHARI</span>
              </div>
              <p className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">
                Smart Campus Transport
              </p>
            </div>
          </div>
        </div>

        {/* Role Indicator Banner */}
        <div className="px-6 py-2.5 bg-slate-900/80 border-b border-slate-800/60 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Portal Access:</span>
          <span className="font-extrabold px-2 py-0.5 rounded-md bg-purple-900/60 text-purple-300 border border-purple-700/50 uppercase tracking-wider text-[10px]">
            {role}
          </span>
        </div>

        {/* Scrollable Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectNav(item.id as NavOption);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer group ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/90'
                }`}
              >
                <span className="text-base leading-none select-none">{item.emoji}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Fixed Area: Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-300 hover:text-white hover:bg-rose-950/60 border border-transparent hover:border-rose-800/60 transition cursor-pointer"
          >
            <span className="text-base select-none">🚪</span>
            <span className="flex-1">Logout</span>
            <LogOut className="h-4 w-4 text-rose-400" />
          </button>
        </div>
      </aside>
    </>
  );
};
