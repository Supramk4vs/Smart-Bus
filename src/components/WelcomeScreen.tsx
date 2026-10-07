import React from 'react';
import { Bus, Sparkles, Compass, Shield, ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  role: 'STUDENT' | 'DRIVER' | 'ADMIN';
  userName?: string;
  onNavigate?: (tab: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ role, userName, onNavigate }) => {
  const mapNav = role === 'DRIVER' ? 'BUS_GPS' : role === 'ADMIN' ? 'FLEET_GPS' : 'LIVE_GPS';

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] p-4 sm:p-12 text-center animate-in fade-in duration-300">
      <div className="max-w-xl w-full mx-auto space-y-5 sm:space-y-6">
        {/* Animated Brand Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-100/90 text-purple-800 text-[11px] sm:text-xs font-bold border border-purple-200/80 shadow-xs max-w-full truncate">
          <Sparkles className="h-3.5 w-3.5 text-purple-600 animate-pulse shrink-0" />
          <span className="truncate">Aalim Muhammed Salegh College of Engineering</span>
        </div>

        {/* Big Icon */}
        <div className="mx-auto flex h-20 w-20 sm:h-28 sm:w-28 items-center justify-center rounded-3xl bg-gradient-to-tr from-purple-800 via-purple-700 to-indigo-600 text-white shadow-2xl shadow-purple-600/30 ring-6 sm:ring-8 ring-purple-100">
          <Bus className="h-10 w-10 sm:h-14 sm:w-14" />
        </div>

        {/* Welcome Typography */}
        <div className="space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Welcome to Sanchari 👋
          </h1>
          <p className="text-base sm:text-xl font-bold bg-gradient-to-r from-purple-700 to-indigo-600 bg-clip-text text-transparent">
            Smart Campus Transport
          </p>
          <p className="text-xs sm:text-base text-slate-500 max-w-md mx-auto italic pt-0.5">
            &ldquo;Your campus journey, smarter and safer.&rdquo;
          </p>
        </div>

        {/* User Identity Pill */}
        {userName && (
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs text-slate-700 max-w-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="truncate">Logged in as <strong>{userName}</strong> ({role})</span>
          </div>
        )}

        {/* Mobile Quick Start Actions */}
        {onNavigate && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 max-w-md mx-auto w-full">
            <button
              type="button"
              onClick={() => onNavigate('DASHBOARD')}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-lg shadow-purple-600/25 active:scale-95 transition cursor-pointer min-h-[46px]"
            >
              <span>Enter Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(mapNav)}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-sm active:scale-95 transition cursor-pointer min-h-[46px]"
            >
              <Compass className="h-4 w-4 text-purple-700" />
              <span>Open Live Map</span>
            </button>
          </div>
        )}

        {/* Helpful Prompt to select navigation */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/80 border border-purple-100 text-[11px] sm:text-xs text-purple-900 max-w-md mx-auto shadow-xs">
          <p className="font-semibold">
            Use the bottom navigation bar or menu drawer to access live GPS tracking, QR scanning, and fleet analytics.
          </p>
        </div>
      </div>
    </div>
  );
};
