import React from 'react';
import { User, Bus, Phone, ShieldCheck, Mail, Award, Clock } from 'lucide-react';
import { DriverUser, Bus as BusType } from '../../types/index.ts';

interface DriverProfileProps {
  driver: DriverUser;
  assignedBus: BusType | null;
}

export const DriverProfile: React.FC<DriverProfileProps> = ({ driver, assignedBus }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
          <span>👤 Pilot Credentials & Profile</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Registered commercial driver credentials, vehicle assignment, and licensing authorization
        </p>
      </div>

      <div className="rounded-3xl bg-gradient-to-tr from-slate-900 via-purple-950 to-indigo-950 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
          <div className="h-24 w-24 rounded-3xl bg-purple-600 text-white flex items-center justify-center font-black text-3xl shadow-lg ring-4 ring-purple-400/30">
            {driver.driver_name?.charAt(0) || 'D'}
          </div>

          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              <span>Certified College Transit Pilot</span>
            </div>
            <h2 className="text-2xl font-black">{driver.driver_name}</h2>
            <div className="text-xs text-purple-200 font-mono">
              Driver ID: <strong className="text-white">{driver.driver_id}</strong>
            </div>
            <p className="text-xs text-purple-300">
              License ID: DL-TN-02-{driver.driver_id}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10 text-left">
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Assigned Vehicle
            </span>
            <div className="text-sm font-black mt-0.5">
              {assignedBus?.bus_number || driver.bus_number || 'Bus'}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Vehicle ID
            </span>
            <div className="text-sm font-black mt-0.5">{assignedBus?.bus_id || 'BUS-01'}</div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Transit Route
            </span>
            <div className="text-sm font-black mt-0.5">{assignedBus?.route_name || 'Transit Route'}</div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Account Status
            </span>
            <div className="text-sm font-black text-emerald-400 mt-0.5">ACTIVE &bull; VERIFIED</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
          Pilot Contact & Emergency Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <Phone className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Contact Mobile</span>
              <span className="font-bold text-slate-800">{driver.phone || '+91 98765 43210'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <Award className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Transport Authority</span>
              <span className="font-bold text-slate-800">Aalim Muhammed Salegh College of Eng.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
