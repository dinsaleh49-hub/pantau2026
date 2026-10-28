import React from 'react';
import { EvaluationRecord } from '../types';
import { generatePDF } from '../services/pdfService';
import { 
  CheckCircleIcon, 
  EyeIcon, 
  ArrowDownTrayIcon, 
  XMarkIcon, 
  ClipboardDocumentCheckIcon,
  BuildingOfficeIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

interface Props {
  record: EvaluationRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onNewEvaluation: () => void;
  isEdit?: boolean;
}

export const SavedRecordSuccessModal: React.FC<Props> = ({
  record,
  isOpen,
  onClose,
  onNewEvaluation,
  isEdit = false
}) => {
  if (!isOpen || !record) return null;

  const scoreValues = Object.values(record.scores || {}) as number[];
  const totalScore = scoreValues.reduce((a, b) => a + b, 0);
  const avgScore = scoreValues.length > 0 ? (totalScore / scoreValues.length).toFixed(2) : '0.00';
  const percentage = scoreValues.length > 0 ? ((parseFloat(avgScore) / 5) * 100).toFixed(1) : '0.0';
  
  const getRating = (avg: number) => {
    if (avg >= 4.5) return { label: 'Cemerlang', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (avg >= 3.5) return { label: 'Baik', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    if (avg >= 2.5) return { label: 'Memuaskan', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Perlu Bimbingan', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const rating = getRating(parseFloat(avgScore));
  const hasBothSignatures = !!record.lecturerSignature && !!record.evaluatorSignature;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Top Header Banner */}
        <div className={`px-6 py-5 text-white flex items-center justify-between ${
          isEdit 
            ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600' 
            : 'bg-gradient-to-r from-emerald-600 to-teal-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <CheckCircleIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  {isEdit ? 'Rekod Penilaian Berjaya Dikemaskini' : 'Penilaian Baharu Berjaya Disimpan'}
                </h3>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {isEdit ? 'Dikemaskini' : 'Baru'}
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                {isEdit 
                  ? 'Perubahan skor, ulasan dan maklumat telah selamat disimpan ke sistem' 
                  : 'Rekod pemantauan pensyarah kini selamat dalam sistem'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nama Pensyarah</p>
                <h4 className="text-base font-black text-slate-800">{record.lecturerName}</h4>
              </div>
              <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${rating.color}`}>
                {rating.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 text-slate-600">
                <BuildingOfficeIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-medium">{record.department}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <CalendarDaysIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium">{record.date}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-slate-600">
                <AcademicCapIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate font-medium">{record.code ? `${record.code} - ${record.course}` : record.course}</span>
              </div>
            </div>

            {/* Score Pill */}
            <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Skor Keseluruhan:</span>
                <p className="text-xl font-black text-indigo-700">{avgScore} <span className="text-xs text-slate-400 font-bold">/ 5.00</span></p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pencapaian:</span>
                <p className="text-lg font-black text-emerald-600">{percentage}%</p>
              </div>
            </div>
          </div>

          {/* Verification Badges */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2">
              <CheckBadgeIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">Tersimpan selamat secara setempat dan pangkalan data pelayan.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              <ClipboardDocumentCheckIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="font-semibold">
                {hasBothSignatures 
                  ? 'Kedua-dua tandatangan (pensyarah & pemantau) disahkan dan disimpan.' 
                  : 'Tandatangan pengesahan disimpan.'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => generatePDF(record, 'view')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <EyeIcon className="w-4 h-4 text-indigo-600" />
                Lihat & Cetak PDF
              </button>
              <button
                type="button"
                onClick={() => generatePDF(record, 'save')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <ArrowDownTrayIcon className="w-4 h-4 text-emerald-600" />
                Muat Turun PDF
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onNewEvaluation}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-2xl text-xs font-bold transition-all shadow-sm"
              >
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-slate-500" />
                Nilai Pensyarah Lain
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Ke Papan Pemuka
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
