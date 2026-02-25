import React from 'react';
import { 
  XMarkIcon, 
  InformationCircleIcon, 
  CheckBadgeIcon, 
  UsersIcon, 
  PencilSquareIcon, 
  SparklesIcon, 
  CloudArrowUpIcon, 
  PrinterIcon 
} from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UserGuideModal: React.FC<Props> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative bg-white rounded-3xl border border-slate-200 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in duration-300 shadow-2xl">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white">
              <InformationCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Panduan Pengguna ePantau v2.0</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Manual Pengoperasian Sistem</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <XMarkIcon className="h-6 w-6 text-slate-400" />
          </button>
        </div>
        <div className="p-8 overflow-y-auto space-y-8">
          <section>
            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <CheckBadgeIcon className="h-5 w-5" /> 1. Pengenalan
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              ePantau v2.0 adalah sistem digital untuk IPGKPT bagi menguruskan pemantauan kurikulum (LAM-PT-03-04). Sistem ini menyokong analisis AI, penjanaan laporan PDF, dan integrasi Google Drive.
            </p>
          </section>

          <section>
            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <UsersIcon className="h-5 w-5" /> 2. Peranan & Akses
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-1">Pentadbir (Admin)</p>
                <p className="text-[11px] text-slate-500">Akses penuh kepada semua data, analitis kampus, dan arkib Google Drive.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-1">Ketua Jabatan (KJ)</p>
                <p className="text-[11px] text-slate-500">Akses kepada data jabatan masing-masing dan status pemantauan staf.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-800 mb-1">Pensyarah</p>
                <p className="text-[11px] text-slate-500">Akses terhad untuk pendaftaran jadual dan melihat status pemantauan kendiri.</p>
              </div>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <PencilSquareIcon className="h-5 w-5" /> 3. Proses Penilaian
            </h4>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
                <p className="text-sm text-slate-600">Klik <strong>"Borang Penilaian"</strong> dan pilih nama pensyarah.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
                <p className="text-sm text-slate-600">Isi skor (1-5) bagi setiap kriteria LAM-PT-03-04.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</div>
                <p className="text-sm text-slate-600">Pastikan <strong>kedua-dua pihak</strong> menurunkan tandatangan digital.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</div>
                <p className="text-sm text-slate-600">Klik <strong>"Simpan"</strong> untuk merekodkan data.</p>
              </li>
            </ul>
          </section>

          <section>
            <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" /> 4. Ciri-ciri Utama
            </h4>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600 shrink-0 h-fit"><SparklesIcon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Rumusan AI</p>
                  <p className="text-[11px] text-slate-500">Gunakan ikon bintang untuk menjana rumusan prestasi pensyarah secara automatik menggunakan Gemini AI.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 shrink-0 h-fit"><CloudArrowUpIcon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Arkib Google Drive</p>
                  <p className="text-[11px] text-slate-500">Simpan rekod PDF terus ke folder arkib digital Admin untuk simpanan jangka panjang.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="p-2 bg-slate-800 rounded-xl text-white shrink-0 h-fit"><PrinterIcon className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Laporan PDF</p>
                  <p className="text-[11px] text-slate-500">Jana laporan individu, ringkasan jabatan, atau arkib penuh dalam format PDF yang profesional.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="p-6 border-t border-slate-100 bg-slate-50 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">IPG Kampus Pendidikan Teknik • © JKA2026</p>
        </div>
      </div>
    </div>
  );
};
