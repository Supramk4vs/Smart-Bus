import React from 'react';
import {
  Home,
  MapPin,
  Bus,
  QrCode,
  Users,
  Compass,
  Route,
  Menu,
} from 'lucide-react';
import { NavOption, StudentNavOption, DriverNavOption, AdminNavOption } from './Sidebar.tsx';

interface BottomNavProps {
  role: 'STUDENT' | 'DRIVER' | 'ADMIN';
  activeNav: NavOption;
  onSelectNav: (opt: NavOption) => void;
  onOpenMobileMenu: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  role,
  activeNav,
  onSelectNav,
  onOpenMobileMenu,
}) => {
  const getNavItems = () => {
    if (role === 'STUDENT') {
      return [
        { id: 'DASHBOARD' as StudentNavOption, label: 'Home', icon: Home },
        { id: 'LIVE_GPS' as StudentNavOption, label: 'Live GPS', icon: MapPin, isLive: true },
        { id: 'MY_BUS' as StudentNavOption, label: 'My Bus', icon: Bus },
        { id: 'SCAN_QR' as StudentNavOption, label: 'Scan QR', icon: QrCode },
      ];
    }
    if (role === 'DRIVER') {
      return [
        { id: 'DASHBOARD' as DriverNavOption, label: 'Home', icon: Home },
        { id: 'BUS_GPS' as DriverNavOption, label: 'Bus GPS', icon: MapPin, isLive: true },
        { id: 'MY_TRIP' as DriverNavOption, label: 'My Trip', icon: Route },
        { id: 'STUDENTS' as DriverNavOption, label: 'Students', icon: Users },
      ];
    }
    // ADMIN
    return [
      { id: 'DASHBOARD' as AdminNavOption, label: 'Home', icon: Home },
      { id: 'FLEET_GPS' as AdminNavOption, label: 'Fleet GPS', icon: Compass, isLive: true },
      { id: 'STUDENTS' as AdminNavOption, label: 'Students', icon: Users },
      { id: 'BUSES' as AdminNavOption, label: 'Buses', icon: Bus },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-purple-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] lg:hidden transition-all safe-area-pb"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNav(item.id)}
              className={`flex flex-col items-center justify-center h-full w-full py-1 text-center transition-all cursor-pointer relative group ${
                isActive ? 'text-purple-700 font-black' : 'text-slate-500 hover:text-slate-800 font-semibold'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-purple-100 text-purple-700 shadow-xs scale-105'
                      : 'text-slate-500 group-hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {item.isLive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight leading-tight mt-0.5 truncate max-w-[56px]">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 h-1 w-6 bg-purple-700 rounded-full" />
              )}
            </button>
          );
        })}

        {/* 5th slot: More / Menu Drawer Toggle */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center h-full w-full py-1 text-center text-slate-500 hover:text-purple-700 font-semibold transition-all cursor-pointer group"
        >
          <div className="p-1.5 rounded-xl text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-700 transition-all">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] tracking-tight leading-tight mt-0.5">
            More
          </span>
        </button>
      </div>
    </nav>
  );
};
