import React, { useState, useEffect } from 'react';
import { 
  EVALUATION_CRITERIA, 
  DEPARTMENTS, 
  CREDIT_OPTIONS, 
  CAMPUSES, 
  EVALUATORS,
  COMMON_COURSES
} from '../constants';
import { EvaluationRecord, Criterion } from '../types';
import { SignaturePad } from './SignaturePad';
import { generatePDF } from '../services/pdfService';
import { SparklesIcon, CheckBadgeIcon, PencilSquareIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  onSubmit: (record: EvaluationRecord) => Promise<void> | void;
  onCancel?: () => void;
  lecturers: { name: string; department: string }[];
  userDept: string;
  isAdmin: boolean;
  username?: string;
  initialData?: EvaluationRecord;
  onNotification?: (message: string, type: 'success' | 'error') => void;
  savedSignatures?: Record<string, string>;
  onSaveSignature?: (name: string, signatureData: string) => void;
  onDeleteSavedSignature?: (name: string) => void;
}

export const EvaluationForm: React.FC<Props> = ({ 
  onSubmit, 
  onCancel,
  lecturers, 
  userDept, 
  isAdmin, 
  username, 
  initialData, 
  onNotification,
  savedSignatures = {},
  onSaveSignature,
  onDeleteSavedSignature
}) => {
  const [formData, setFormData] = useState({
    campus: CAMPUSES[0],
    department: isAdmin ? '' : userDept,
    lecturerName: '',
    course: '',
    code: '',
    credit: '',
    date: new Date().toISOString().split('T')[0],
    evaluatorName: username || '',
    remarks: ''
  });

  const [isOtherCourse, setIsOtherCourse] = useState(false);
  const [isOtherLecturer, setIsOtherLecturer] = useState(false);
  const [isOtherDepartment, setIsOtherDepartment] = useState(false);
  const [isOtherEvaluator, setIsOtherEvaluator] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [itemRemarks, setItemRemarks] = useState<Record<string, string>>({});
  const [lecturerSig, setLecturerSig] = useState<string>('');
  const [evaluatorSig, setEvaluatorSig] = useState<string>('');
  const [autoSaveSignatures, setAutoSaveSignatures] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        campus: initialData.campus,
        department: initialData.department,
        lecturerName: initialData.lecturerName,
        course: initialData.course,
        code: initialData.code,
        credit: initialData.credit,
        date: initialData.date,
        evaluatorName: initialData.evaluatorName,
        remarks: initialData.remarks
      });
      
      const isKnownCourse = COMMON_COURSES.some(c => c.code === initialData.code && c.name === initialData.course);
      setIsOtherCourse(!isKnownCourse && !!initialData.code);

      const isKnownLecturer = lecturers.some(l => 
        l.name.toLowerCase() === initialData.lecturerName.toLowerCase() && 
        l.department === initialData.department
      );
      setIsOtherLecturer(!isKnownLecturer && !!initialData.lecturerName);
      
      const isKnownDept = DEPARTMENTS.includes(initialData.department);
      setIsOtherDepartment(!isKnownDept && !!initialData.department);

      const isKnownEvaluator = EVALUATORS.includes(initialData.evaluatorName);
      setIsOtherEvaluator(!isKnownEvaluator && !!initialData.evaluatorName);

      setScores(initialData.scores || {});
      setItemRemarks(initialData.itemRemarks || {});
      if (initialData.lecturerSignature) setLecturerSig(initialData.lecturerSignature);
      if (initialData.evaluatorSignature) setEvaluatorSig(initialData.evaluatorSignature);
    }
  }, [initialData]);

  // Auto-populate saved signature for evaluator if available
  useEffect(() => {
    if (!evaluatorSig && formData.evaluatorName?.trim() && savedSignatures[formData.evaluatorName.trim()]) {
      setEvaluatorSig(savedSignatures[formData.evaluatorName.trim()]);
    }
  }, [formData.evaluatorName, savedSignatures, evaluatorSig]);

  // Auto-populate saved signature for lecturer if available
  useEffect(() => {
    if (!lecturerSig && formData.lecturerName?.trim() && savedSignatures[formData.lecturerName.trim()]) {
      setLecturerSig(savedSignatures[formData.lecturerName.trim()]);
    }
  }, [formData.lecturerName, savedSignatures, lecturerSig]);

  const handleLecturerChange = (name: string) => {
    // Try to find a lecturer that matches both name and CURRENT department first
    let lecturer = lecturers.find(l => 
      l.name.toLowerCase() === name.toLowerCase() && 
      l.department === formData.department
    );
    
    // If not found, just find by name
    if (!lecturer) {
      lecturer = lecturers.find(l => l.name.toLowerCase() === name.toLowerCase());
    }

    if (lecturer) {
      setIsOtherLecturer(false);
      setIsOtherDepartment(false);
      setFormData((prev) => ({
        ...prev,
        lecturerName: lecturer.name, // Use the canonical name from the list
        department: lecturer.department
      }));
    } else {
      // If name is not in list, it's a "new" lecturer
      setIsOtherLecturer(name.trim().length > 0);
      setFormData((prev) => ({ ...prev, lecturerName: name }));
    }
  };

  const handleDepartmentChange = (dept: string) => {
    if (dept === 'OTHER') {
      setIsOtherDepartment(true);
      setFormData(prev => ({ ...prev, department: '' }));
    } else {
      setIsOtherDepartment(false);
      setFormData(prev => ({ ...prev, department: dept }));
    }
  };

  const handleEvaluatorChange = (evaluator: string) => {
    if (evaluator === 'OTHER') {
      setIsOtherEvaluator(true);
      setFormData(prev => ({ ...prev, evaluatorName: '' }));
    } else {
      setIsOtherEvaluator(false);
      setFormData(prev => ({ ...prev, evaluatorName: evaluator }));
    }
  };

  const handleCourseSelect = (code: string) => {
    if (code === 'OTHER') {
      setIsOtherCourse(true);
      setFormData(prev => ({ ...prev, code: '', course: '' }));
    } else {
      const course = COMMON_COURSES.find(c => c.code === code);
      if (course) {
        setIsOtherCourse(false);
        setFormData(prev => ({ ...prev, code: course.code, course: course.name }));
      }
    }
  };

  const handleScoreChange = (id: string, score: number) => {
    setScores((prev) => ({ ...prev, [id]: score }));
  };

  const handleItemRemarkChange = (id: string, remark: string) => {
    setItemRemarks((prev) => ({ ...prev, [id]: remark }));
  };

  const handleQuickFillScores = (val: number) => {
    const updated: Record<string, number> = {};
    EVALUATION_CRITERIA.forEach(c => {
      updated[c.id] = val;
    });
    setScores(updated);
    if (onNotification) {
      onNotification(`Semua ${EVALUATION_CRITERIA.length} kriteria penilaian telah diisi dengan skor ${val}.`, 'success');
    }
  };

  const handleClearScores = () => {
    setScores({});
    if (onNotification) {
      onNotification('Semua skor kriteria telah dikosongkan.', 'error');
    }
  };

  const executeSave = async (isDraft: boolean = false) => {
    if (!formData.lecturerName.trim()) {
      if (onNotification) {
        onNotification('Sila pilih atau masukkan nama pensyarah sebelum menyimpan.', 'error');
      }
      return;
    }

    if (!formData.department.trim()) {
      if (onNotification) {
        onNotification('Sila pilih jabatan pensyarah sebelum menyimpan.', 'error');
      }
      return;
    }

    const missingCriteria = EVALUATION_CRITERIA.filter(c => !scores[c.id]);
    if (!isDraft && missingCriteria.length > 0) {
      const firstMissing = missingCriteria[0];
      if (onNotification) {
        onNotification(`Sila lengkapkan semua kriteria penilaian (${missingCriteria.length} belum dinilai, cth: ${firstMissing.id}), atau klik "Simpan Draf".`, 'error');
      }
      // Scroll to the first missing criterion
      const element = document.getElementById(`criterion-${firstMissing.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
        setTimeout(() => element.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2'), 3000);
      }
      return;
    }

    // Auto-save signatures to library if checked
    if (autoSaveSignatures && onSaveSignature) {
      if (formData.lecturerName.trim() && lecturerSig) {
        onSaveSignature(formData.lecturerName.trim(), lecturerSig);
      }
      if (formData.evaluatorName.trim() && evaluatorSig) {
        onSaveSignature(formData.evaluatorName.trim(), evaluatorSig);
      }
    }

    const record: EvaluationRecord = {
      ...formData,
      id: initialData?.id || Math.random().toString(36).substr(2, 9),
      timestamp: initialData?.timestamp || Date.now(),
      scores,
      itemRemarks,
      remarks: formData.remarks,
      lecturerSignature: lecturerSig,
      evaluatorSignature: evaluatorSig
    };
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(record);
    } catch (error) {
      console.error("Error in onSubmit:", error);
      if (onNotification) {
        onNotification('Ralat semasa menyimpan rekod.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSave(false);
  };

  const handleViewPDF = () => {
    const missingCriteria = EVALUATION_CRITERIA.filter(c => !scores[c.id]);
    if (missingCriteria.length > 0) {
      if (onNotification) {
        onNotification(`Sila lengkapkan semua kriteria penilaian sebelum melihat PDF. (${missingCriteria.length} lagi)`, 'error');
      } else {
        alert('Sila lengkapkan semua kriteria penilaian sebelum melihat PDF.');
      }
      return;
    }

    const record: EvaluationRecord = {
      ...formData,
      id: initialData?.id || 'preview',
      timestamp: initialData?.timestamp || Date.now(),
      scores,
      itemRemarks,
      remarks: formData.remarks,
      lecturerSignature: lecturerSig,
      evaluatorSignature: evaluatorSig
    };
    
    generatePDF(record, 'view');
  };

  const groupedCriteria = EVALUATION_CRITERIA.reduce((acc: Record<string, Criterion[]>, curr: Criterion) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {} as Record<string, Criterion[]>);

  const parseCategory = (category: string) => {
    const match = category.match(/^(\d\.)\s*(.*)/);
    if (match) return { num: match[1], title: match[2] };
    return { num: '', title: category };
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {initialData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-900 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-200/70 flex items-center justify-center text-amber-800 shrink-0">
              <PencilSquareIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Mod Kemaskini Rekod
                </span>
                <span className="text-[11px] font-mono text-amber-800">
                  ID: #{initialData.id.slice(0, 8)}
                </span>
              </div>
              <p className="text-sm font-black text-slate-800 mt-1">
                Anda sedang mengubahsuai rekod pemantauan untuk <span className="text-indigo-700">{initialData.lecturerName}</span> ({initialData.date})
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Sebarang perubahan skor, catatan, maklumat kursus atau tandatangan akan dikemaskini.
              </p>
            </div>
          </div>
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="px-4 py-2 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
            >
              Batal Pengemaskinian
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Ubahsuai Penilaian' : 'Maklumat Pemantauan'}
          </h2>
          <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">LAM-PT-03-04</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Institut Pendidikan Guru Kampus</label>
              <select 
                required
                value={formData.campus} onChange={e => setFormData({...formData, campus: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {CAMPUSES.map(camp => <option key={camp} value={camp}>{camp}</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pensyarah</label>
                <div className="relative">
                  <input 
                    required
                    list="lecturer-list"
                    type="text"
                    placeholder="Cari atau Taip Nama Pensyarah..."
                    value={formData.lecturerName}
                    onChange={e => handleLecturerChange(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg text-sm outline-none transition-all ${isOtherLecturer ? 'border-indigo-300 bg-indigo-50/30 ring-2 ring-indigo-100' : 'border-slate-200 bg-white focus:ring-2 focus:ring-rose-500/20'}`}
                  />
                  <datalist id="lecturer-list">
                    {lecturers.map(lec => <option key={lec.name} value={lec.name}>{lec.name}</option>)}
                  </datalist>
                </div>
                {isOtherLecturer && !lecturers.some(l => l.name === formData.lecturerName) && (
                  <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-300">
                    <p className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                      <SparklesIcon className="h-3 w-3" /> NAMA BARU DIKESAN
                    </p>
                    <p className="text-[9px] text-slate-500 italic">
                      * Nama ini akan disimpan secara automatik ke dalam pangkalan data setelah borang dihantar.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Jabatan / Unit</label>
                <select 
                  required={!isOtherDepartment}
                  disabled={!isAdmin && !isOtherLecturer && !initialData}
                  value={isOtherDepartment ? 'OTHER' : (DEPARTMENTS.includes(formData.department) ? formData.department : '')} 
                  onChange={e => handleDepartmentChange(e.target.value)}
                  className={`w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-2 ${!isAdmin && !isOtherLecturer && !initialData ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                >
                  <option value="" disabled>Pilih Jabatan</option>
                  {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  <option value="OTHER">LAIN-LAIN (Tulis Manual)</option>
                </select>
                {isOtherDepartment && (
                  <input 
                    required
                    type="text"
                    placeholder="Masukkan Jabatan/Unit"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Tarikh Pemantauan</label>
              <input 
                required type="date"
                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm" 
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Pilih Kursus (Dari Senarai)</label>
              <select 
                value={isOtherCourse ? 'OTHER' : (COMMON_COURSES.some(c => c.code === formData.code) ? formData.code : '')}
                onChange={e => handleCourseSelect(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">-- Pilih Kursus --</option>
                {COMMON_COURSES.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
                <option value="OTHER">LAIN-LAIN (Tulis Manual)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kod Kursus</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Kod" 
                  readOnly={!isOtherCourse}
                  value={formData.code} 
                  onChange={e => setFormData({...formData, code: e.target.value})} 
                  className={`w-full px-4 py-2 border border-slate-200 rounded-lg text-sm ${!isOtherCourse ? 'bg-slate-50' : ''}`} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Kredit</label>
                <select required value={formData.credit} onChange={e => setFormData({...formData, credit: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white">
                  <option value="" disabled>Pilih</option>
                  {CREDIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Kursus</label>
              <input 
                required 
                type="text" 
                placeholder="Nama Kursus" 
                readOnly={!isOtherCourse}
                value={formData.course} 
                onChange={e => setFormData({...formData, course: e.target.value})} 
                className={`w-full px-4 py-2 border border-slate-200 rounded-lg text-sm ${!isOtherCourse ? 'bg-slate-50' : ''}`} 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nama Pemantau</label>
              <select 
                required={!isOtherEvaluator} 
                value={isOtherEvaluator ? 'OTHER' : (EVALUATORS.includes(formData.evaluatorName) ? formData.evaluatorName : '')} 
                onChange={e => handleEvaluatorChange(e.target.value)} 
                className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white mb-2"
              >
                <option value="" disabled>Pilih Pemantau</option>
                {EVALUATORS.map(evalu => <option key={evalu} value={evalu}>{evalu}</option>)}
                <option value="OTHER">LAIN-LAIN (Tulis Manual)</option>
              </select>
              {isOtherEvaluator && (
                <input 
                  required
                  type="text"
                  placeholder="Masukkan Nama Pemantau"
                  value={formData.evaluatorName}
                  onChange={e => setFormData({...formData, evaluatorName: e.target.value})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Scoring Toolbar and Completion Status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700">Kemajuan Penilaian Kriteria:</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                EVALUATION_CRITERIA.filter(c => !!scores[c.id]).length === EVALUATION_CRITERIA.length 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {EVALUATION_CRITERIA.filter(c => !!scores[c.id]).length} / {EVALUATION_CRITERIA.length} Kriteria
              </span>
              {Object.keys(scores).length > 0 && (
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  Purata Skor Semasa: {(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length).toFixed(2)}
                </span>
              )}
            </div>
            <div className="w-full sm:w-80 bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-indigo-600 h-full transition-all duration-300"
                style={{ width: `${(EVALUATION_CRITERIA.filter(c => !!scores[c.id]).length / EVALUATION_CRITERIA.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500">Isi Pantas:</span>
            <button 
              type="button" 
              onClick={() => handleQuickFillScores(4)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Isi semua kriteria dengan skor 4 (Baik)"
            >
              Semua Skor 4
            </button>
            <button 
              type="button" 
              onClick={() => handleQuickFillScores(5)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Isi semua kriteria dengan skor 5 (Cemerlang)"
            >
              Semua Skor 5
            </button>
            {Object.keys(scores).length > 0 && (
              <button 
                type="button" 
                onClick={handleClearScores}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                title="Kosongkan semua skor"
              >
                Kosongkan
              </button>
            )}
            <button
              type="button"
              onClick={() => executeSave(true)}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 flex items-center gap-1"
              title="Simpan draf penilaian ini pada bila-bila masa agar tidak hilang"
            >
              💾 Simpan Draf
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedCriteria).map(([category, criteria]) => {
          const { num, title } = parseCategory(category);
          return (
            <div key={category} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                      <th className="px-4 py-3 text-center w-12 border-r border-slate-100">Bil.</th>
                      <th className="px-6 py-3 text-left border-r border-slate-100">Perkara</th>
                      <th className="px-6 py-2 text-center">Skala (1-5)</th>
                      <th className="px-6 py-3 text-center w-64 border-l border-slate-100">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white border-b border-slate-100">
                      <td className="px-4 py-3 text-center text-sm font-bold text-slate-800 border-r border-slate-100">{num}</td>
                      <td className="px-6 py-3 text-left text-sm font-bold text-slate-800 border-r border-slate-100">{title}</td>
                      <td className="bg-slate-500"></td>
                      <td className="px-6 py-3 border-l border-slate-100"></td>
                    </tr>
                    {criteria.map((item) => (
                      <tr key={item.id} id={`criterion-${item.id}`} className="hover:bg-slate-50 border-b border-slate-100 transition-all duration-300">
                        <td className="px-4 py-4 text-center text-sm font-medium text-slate-400 border-r border-slate-100"></td>
                        <td className="px-6 py-4 border-r border-slate-100 text-sm font-medium text-slate-700">{item.text}</td>
                        <td className="px-2 py-4 border-r border-slate-100">
                          <div className="flex items-center justify-center gap-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleScoreChange(item.id, val)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center border text-xs font-bold transition-all ${
                                  scores[item.id] === val ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input type="text" value={itemRemarks[item.id] || ''} onChange={(e) => handleItemRemarkChange(item.id, e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-8 shadow-sm">
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-3">Pemerhatian Umum / Ulasan Lanjut</label>
          <textarea
            rows={4}
            value={formData.remarks}
            onChange={e => setFormData({...formData, remarks: e.target.value})}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none shadow-sm"
          />
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
            <div>
              <h4 className="text-sm font-black text-indigo-900 flex items-center gap-2">
                <SparklesIcon className="h-4 w-4 text-indigo-600" />
                Pengesahan Tandatangan Digital (Kedua-dua Pihak)
              </h4>
              <p className="text-xs text-indigo-700/80 mt-0.5">
                Setiap kotak tandatangan menyokong kedua-dua kaedah: tandatangan secara langsung menggunakan pen digital / skrin sentuh ATAU muat naik fail imej tandatangan.
              </p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-sm shrink-0">
              <input 
                type="checkbox" 
                checked={autoSaveSignatures} 
                onChange={e => setAutoSaveSignatures(e.target.checked)}
                className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-[11px] font-bold text-slate-700">
                Simpan ke Profil (Auto-Save)
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <SignaturePad 
              label="Tandatangan Pensyarah" 
              personName={formData.lecturerName}
              onSave={(data) => setLecturerSig(data)}
              onClear={() => setLecturerSig('')}
              initialSignature={initialData?.lecturerSignature}
              savedSignature={savedSignatures[formData.lecturerName.trim()]}
              onSaveToLibrary={(data) => onSaveSignature && onSaveSignature(formData.lecturerName.trim(), data)}
              onDeleteFromLibrary={() => onDeleteSavedSignature && onDeleteSavedSignature(formData.lecturerName.trim())}
            />
            <SignaturePad 
              label="Tandatangan Pemantau" 
              personName={formData.evaluatorName}
              onSave={(data) => setEvaluatorSig(data)}
              onClear={() => setEvaluatorSig('')}
              initialSignature={initialData?.evaluatorSignature}
              savedSignature={savedSignatures[formData.evaluatorName.trim()]}
              onSaveToLibrary={(data) => onSaveSignature && onSaveSignature(formData.evaluatorName.trim(), data)}
              onDeleteFromLibrary={() => onDeleteSavedSignature && onDeleteSavedSignature(formData.evaluatorName.trim())}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-200">
        <div>
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-all text-sm shadow-sm"
            >
              {initialData ? 'Batal Pengemaskinian' : 'Batal'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
          <button 
            type="button" 
            onClick={handleViewPDF}
            className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-6 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-sm"
          >
            Lihat PDF
          </button>
          <button 
            type="button" 
            onClick={() => executeSave(true)}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-6 py-3.5 rounded-xl font-black transition-all shadow-sm text-sm active:scale-95 flex items-center justify-center gap-1.5"
            title="Simpan data penilaian ini sebagai draf pada bila-bila masa"
          >
            <span>💾</span> Simpan Sebagai Draf
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={`w-full sm:w-auto bg-indigo-600 text-white px-9 py-3.5 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 text-sm ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'}`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan Rekod...
              </>
            ) : (
              <>
                <CheckBadgeIcon className="h-5 w-5" />
                {initialData ? 'Kemaskini Rekod Penilaian' : 'Simpan Rekod Penilaian'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};