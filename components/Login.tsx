import React, { useState, useEffect } from 'react';
import { ClipboardDocumentCheckIcon, LockClosedIcon, UserIcon, InformationCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { LECTURERS } from '../constants';

interface Props {
  onLogin: (user: { username: string; department: string; role: 'admin' | 'user' }, remember: boolean) => void;
  onShowGuide: () => void;
}

// Map of system accounts (Admin & Dept Heads)
const SYSTEM_ACCOUNTS: Record<string, { pass: string; dept: string; role: 'admin' | 'user' }> = {
  'admin': { pass: 'admin123', dept: 'SEMUA', role: 'admin' },
  'pengarah': { pass: 'ipgkpt', dept: 'SEMUA', role: 'admin' },
  'tp': { pass: 'tp123', dept: 'SEMUA', role: 'admin' },
  'pensyarah': { pass: 'pensyarah', dept: 'SEMUA', role: 'user' }, // Universal account changed to pensyarah
  'jmate': { pass: 'mate123', dept: 'Jabatan Matematik', role: 'user' },
  'jsains': { pass: 'sains123', dept: 'Jabatan Sains', role: 'user' },
  'jpi': { pass: 'jpi123', dept: 'Jabatan Pendidikan Islam', role: 'user' },
  'jip': { pass: 'jip123', dept: 'Jabatan Ilmu Pendidikan', role: 'user' },
  'jbahasa': { pass: 'bahasa123', dept: 'Jabatan Bahasa', role: 'user' },
  'jss': { pass: 'jss123', dept: 'Jabatan Sains Sosial', role: 'user' },
  'jptv': { pass: 'jptv123', dept: 'Jabatan Pendidikan Teknik dan Vokasional', role: 'user' },
  'jpm': { pass: 'jpm123', dept: 'Jabatan Pengajian Melayu', role: 'user' },
  'jpjk': { pass: 'jpjk123', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', role: 'user' }
};

export const Login: React.FC<Props> = ({ onLogin, onShowGuide }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedUsername = localStorage.getItem('ipgkpt_saved_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const lowerUsername = username.trim().toLowerCase();
      
      // 1. Check System Accounts (including the universal 'pensyarah' account)
      const sysAccount = SYSTEM_ACCOUNTS[lowerUsername];
      if (sysAccount && sysAccount.pass === password) {
        onLogin({
          username: username.trim(),
          department: sysAccount.dept,
          role: sysAccount.role
        }, remember);
        return;
      }

      // 2. Fallback for legacy lecturer name login via universal username
      const lecturer = LECTURERS.find(l => l.name.toLowerCase() === password.trim().toLowerCase());
      if (lowerUsername === 'pensyarah' && lecturer) {
         onLogin({
            username: lecturer.name,
            department: lecturer.department,
            role: 'user'
          }, remember);
          return;
      }

      setError('Username atau Password tidak sah. Sila gunakan akaun universal pensyarah.');
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl border border-slate-200 animate-in fade-in zoom-in duration-500 shadow-xl">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6">
            <ClipboardDocumentCheckIcon className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">ePantau v2.0</h2>
          <p className="mt-2 text-sm text-slate-500 font-bold uppercase tracking-widest leading-tight">
            SISTEM PEMANTAUAN PELAKSANAAN KURIKULUM
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold p-4 rounded-xl flex items-center gap-2 animate-shake">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white px-1 z-10">
                Username
              </label>
              <div className="flex items-center">
                <div className="absolute left-3 text-slate-400">
                  <UserIcon className="h-5 w-5" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Masukkan Username"
                />
              </div>
            </div>

            <div className="relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute -top-2 left-3 bg-white px-1 z-10">
                Password
              </label>
              <div className="flex items-center relative">
                <div className="absolute left-3 text-slate-400">
                  <LockClosedIcon className="h-5 w-5" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Masukkan Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
            <div className="flex gap-2">
              <InformationCircleIcon className="h-5 w-5 text-indigo-600 shrink-0" />
              <div className="text-[10px] text-indigo-700 leading-relaxed font-medium">
                <p className="font-bold uppercase mb-1 text-indigo-900">Akses Universal Pendaftaran Jadual:</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="bg-white/50 p-2 rounded-lg border border-indigo-200">
                    <p className="text-slate-500">Username</p>
                    <p className="text-sm font-black text-indigo-900">pensyarah</p>
                  </div>
                  <div className="bg-white/50 p-2 rounded-lg border border-indigo-200">
                    <p className="text-slate-500">Password</p>
                    <p className="text-sm font-black text-indigo-900">pensyarah</p>
                  </div>
                </div>
                <p className="mt-2 italic">* Sesuai untuk semua pensyarah mengisi jadual pemantauan.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-xs text-slate-600 font-medium cursor-pointer">
                Ingat saya
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-indigo-100"
          >
            {isLoading ? 'Menyambung...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center space-y-2">
          <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-relaxed">
            IPG Kampus Pendidikan Teknik<br/>© JKA2026
          </div>
          <p 
            onClick={onShowGuide}
            className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline cursor-pointer"
          >
            Lihat Panduan Pengguna
          </p>
        </div>
      </div>
    </div>
  );
};