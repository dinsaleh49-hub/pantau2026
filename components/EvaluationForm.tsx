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
import { SparklesIcon } from '@heroicons/react/24/outline';

interface Props {
  onSubmit: (record: EvaluationRecord) => void;
  lecturers: { name: string; department: string }[];
  userDept: string;
  isAdmin: boolean;
  username?: string;
  initialData?: EvaluationRecord;
  onNotification?: (message: string, type: 'success' | 'error') => void;
}

export const EvaluationForm: React.FC<Props> = ({ onSubmit, lecturers, userDept, isAdmin, username, initialData, onNotification }) => {
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

      setScores(initialData.scores);
      setItemRemarks(initialData.itemRemarks);
      if (initialData.lecturerSignature) setLecturerSig(initialData.lecturerSignature);
      if (initialData.evaluatorSignature) setEvaluatorSig(initialData.evaluatorSignature);
    }
  }, [initialData]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const missingCriteria = EVALUATION_CRITERIA.filter(c => !scores[c.id]);
    if (missingCriteria.length > 0) {
      if (onNotification) {
        onNotification(`Sila lengkapkan semua kriteria penilaian. (${missingCriteria.length} lagi)`, 'error');
      } else {
        alert('Sila lengkapkan semua kriteria penilaian.');
      }
      return;
    }

    if (!lecturerSig || !evaluatorSig) {
      if (onNotification) {
        onNotification('Sila pastikan kedua-dua pihak telah menurunkan tandatangan digital.', 'error');
      } else {
        alert('Sila pastikan kedua-dua pihak telah menurunkan tandatangan digital.');
      }
      return;
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
    
    // Simulate a small delay for better UX feedback
    setTimeout(() => {
      try {
        onSubmit(record);
      } catch (error) {
        console.error("Error in onSubmit:", error);
        if (onNotification) {
          onNotification('Ralat semasa menyimpan rekod.', 'error');
        }
      } finally {
        setIsSubmitting(false);
      }
    }, 800);
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
                      <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SignaturePad 
            label="Tandatangan Pensyarah" 
            onSave={(data) => setLecturerSig(data)}
            onClear={() => setLecturerSig('')}
            initialSignature={initialData?.lecturerSignature}
          />
          <SignaturePad 
            label="Tandatangan Pemantau" 
            onSave={(data) => setEvaluatorSig(data)}
            onClear={() => setEvaluatorSig('')}
            initialSignature={initialData?.evaluatorSignature}
          />
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button 
          type="button" 
          onClick={handleViewPDF}
          className="bg-white border border-indigo-600 text-indigo-600 px-10 py-4 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-md"
        >
          Lihat PDF
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`bg-indigo-600 text-white px-10 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Menyimpan...
            </>
          ) : (
            initialData ? 'Kemaskini' : 'Simpan'
          )}
        </button>
      </div>
    </form>
  );
};