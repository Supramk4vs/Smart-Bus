import React, { useState } from 'react';
import { User, MapPin, Bus, Shield, Phone, Mail, Award, QrCode } from 'lucide-react';
import { StudentUser, Bus as BusType } from '../../types/index.ts';
import { QRModal } from '../../components/QRModal.tsx';

interface StudentProfileProps {
  student: StudentUser;
  assignedBus: BusType | null;
  onNavigate: (tab: string) => void;
}

export const StudentProfile: React.FC<StudentProfileProps> = ({
  student,
  assignedBus,
  onNavigate,
}) => {
  const [showIdQr, setShowIdQr] = useState<boolean>(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2">
            <span>👤 Student Transport Profile</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered credentials, assigned boarding location, and campus transit authorization
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowIdQr(true)}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <QrCode className="h-4 w-4" />
          <span>Show ID Pass QR</span>
        </button>
      </div>

      {/* ID Card Display */}
      <div className="rounded-3xl bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 p-8 text-white shadow-xl shadow-purple-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 transform skew-x-12 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
          <div className="h-24 w-24 rounded-3xl bg-purple-600 text-white flex items-center justify-center font-black text-3xl shadow-lg ring-4 ring-purple-400/30">
            {student.full_name?.charAt(0) || 'S'}
          </div>

          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/30 border border-purple-400/30 text-[10px] font-black uppercase tracking-wider text-purple-200">
              <Shield className="h-3 w-3" />
              <span>Aalim Muhammed Salegh College of Engineering</span>
            </div>
            <h2 className="text-2xl font-black">{student.full_name}</h2>
            <div className="text-xs text-purple-200 font-mono">
              Student ID: <strong className="text-white">{student.student_id}</strong>
            </div>
            <p className="text-xs text-purple-300">
              {student.department || 'Engineering'} &bull; {student.year || '3rd Year'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-white/10 text-left">
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Bus Assigned
            </span>
            <div className="text-sm font-black mt-0.5">{assignedBus?.bus_number || student.bus_number}</div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Boarding Stop
            </span>
            <div className="text-sm font-black mt-0.5 truncate">{student.boarding_point}</div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Transit Route
            </span>
            <div className="text-sm font-black mt-0.5">{assignedBus?.route_name || 'Campus Transit'}</div>
          </div>
          <div>
            <span className="text-[10px] text-purple-300 uppercase tracking-wider font-bold">
              Pass Status
            </span>
            <div className="text-sm font-black text-emerald-400 mt-0.5">ACTIVE &bull; VERIFIED</div>
          </div>
        </div>
      </div>

      {/* Profile Details List */}
      <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 pb-2 border-b border-slate-100">
          Account & Contact Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <Mail className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Email Address</span>
              <span className="font-bold text-slate-800">{student.email || `${student.student_id.toLowerCase()}@ams.edu.in`}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <Phone className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Contact Phone</span>
              <span className="font-bold text-slate-800">{student.phone || '+91 98765 00000'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <MapPin className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">Stop Coordinates</span>
              <span className="font-bold font-mono text-slate-800">
                {student.boarding_lat?.toFixed(4)}, {student.boarding_lng?.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center space-x-3">
            <Award className="h-4 w-4 text-slate-400" />
            <div>
              <span className="text-slate-400 text-[10px] block">College Institute</span>
              <span className="font-bold text-slate-800">Aalim Muhammed Salegh College of Eng.</span>
            </div>
          </div>
        </div>
      </div>

      {showIdQr && (
        <QRModal
          isOpen={showIdQr}
          onClose={() => setShowIdQr(false)}
          title={`${student.full_name}'s Student ID`}
          subtitle="Pre-registered Student Transit Pass"
          token={JSON.stringify({
            student_id: student.student_id,
            name: student.full_name,
            bus_number: student.bus_number,
            boarding_point: student.boarding_point,
          })}
        />
      )}
    </div>
  );
};
