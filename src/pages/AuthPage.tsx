import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Bus,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { UserRole, COLLEGE_DESTINATION } from '../types/index.ts';

export const AuthPage: React.FC = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRoleSelect = (r: UserRole) => {
    setSelectedRole(r);
    setErrorMsg(null);
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Please enter your pre-registered Student ID, Driver ID, Admin ID, Email, or Phone.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await login(identifier.trim(), password, selectedRole);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Verify your registered credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-slate-50 to-indigo-50/40 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-700 text-white shadow-xl shadow-purple-600/30 ring-4 ring-purple-100">
            <Bus className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Smart Campus Transport Intelligence &amp; GPS Tracking
          </h2>
          <p className="mt-1.5 text-xs text-slate-600 font-medium max-w-sm mx-auto">
            {COLLEGE_DESTINATION.name} &bull; {COLLEGE_DESTINATION.address}
          </p>
        </div>

        {/* Security Rule Notice */}
        <div className="mt-4 rounded-xl bg-purple-100/70 border border-purple-200/80 p-3 text-xs text-purple-900 flex items-start space-x-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-purple-700 mt-0.5" />
          <p className="leading-tight">
            <strong>Pre-Registered Access Only:</strong> Public signup is prohibited. Only members listed in the official college transport database can authenticate.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-6 px-6 sm:px-8 shadow-xl shadow-purple-900/5 rounded-3xl border border-purple-100/80">
          {/* Role Tabs */}
          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Your College Transport Role
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(['STUDENT', 'DRIVER', 'ADMIN'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRoleSelect(r)}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    selectedRole === r
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {r === 'STUDENT' ? 'Student' : r === 'DRIVER' ? 'Driver' : 'Admin'}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Credentials Login Form */}
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Registered Identifier ({selectedRole === 'STUDENT' ? 'Student Email / ID' : selectedRole === 'DRIVER' ? 'Driver Email / ID' : 'Admin Email / ID'})
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <UserCheck className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={
                    selectedRole === 'STUDENT'
                      ? 'student@gmail.com'
                      : selectedRole === 'DRIVER'
                      ? 'driver.murugan@campus.edu'
                      : '110124149012@aalimec.ac.in'
                  }
                  className="block w-full rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
              </div>
              <div className="relative rounded-xl shadow-xs">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password (e.g. campus123)"
                  className="block w-full rounded-xl border border-slate-300 pl-10 pr-3 py-2.5 text-xs text-slate-900 focus:border-purple-600 focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 rounded-xl bg-purple-700 py-3 text-xs font-bold text-white shadow-md shadow-purple-600/20 hover:bg-purple-800 disabled:opacity-50 transition cursor-pointer"
            >
              {isSubmitting
                ? 'Authenticating with Dataset...'
                : `Login as ${selectedRole === 'STUDENT' ? 'Student' : selectedRole === 'DRIVER' ? 'Driver' : 'Admin'}`}
            </button>
          </form>

          {/* Quick Fill Test Accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2.5">
              Quick Fill Test Accounts
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('ADMIN');
                  setIdentifier('110124149040@aalimec.ac.in');
                  setPassword('campus123');
                  setErrorMsg(null);
                }}
                className="p-2.5 text-left rounded-xl bg-purple-50/70 border border-purple-200 hover:bg-purple-100/80 text-purple-950 font-semibold text-[11px] transition shadow-2xs cursor-pointer truncate"
              >
                👤 Officer (110124149040)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('STUDENT');
                  setIdentifier('student@gmail.com');
                  setPassword('campus123');
                  setErrorMsg(null);
                }}
                className="p-2.5 text-left rounded-xl bg-slate-50 border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-800 font-semibold text-[11px] transition shadow-2xs cursor-pointer truncate"
              >
                🎓 Student (STU-100)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('DRIVER');
                  setIdentifier('driver.murugan@campus.edu');
                  setPassword('campus123');
                  setErrorMsg(null);
                }}
                className="p-2.5 text-left rounded-xl bg-slate-50 border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-800 font-semibold text-[11px] transition shadow-2xs cursor-pointer truncate"
              >
                🚌 Driver (Murugan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('ADMIN');
                  setIdentifier('110124149012@aalimec.ac.in');
                  setPassword('campus123');
                  setErrorMsg(null);
                }}
                className="p-2.5 text-left rounded-xl bg-slate-50 border border-slate-200 hover:bg-purple-50 hover:border-purple-200 text-slate-800 font-semibold text-[11px] transition shadow-2xs cursor-pointer truncate"
              >
                🛡️ Admin (Dharshana)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
