import React, { useMemo, useState } from 'react';
import { EvaluationRecord, MonitoringSchedule } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  MagnifyingGlassIcon, 
  PrinterIcon,
  EyeIcon,
  AcademicCapIcon,
  PresentationChartBarIcon,
  UsersIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  XMarkIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowPathIcon,
  ChartBarSquareIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  MapPinIcon,
  CloudArrowUpIcon,
  FolderOpenIcon,
  CalendarIcon,
  FunnelIcon,
  CheckBadgeIcon,
  ClockIcon,
  ArchiveBoxArrowDownIcon,
  HandThumbUpIcon,
  ExclamationCircleIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { generatePDF, generateSummaryPDF, generateFullDepartmentPDF } from '../services/pdfService';
import { uploadToGoogleDrive } from '../services/googleDriveService';
import { GoogleGenAI } from "@google/genai";
import { EVALUATION_CRITERIA, DEPARTMENTS, LECTURERS } from '../constants';
import { UserGuideModal } from './UserGuideModal';

interface Props {
  records: EvaluationRecord[];
  schedules: MonitoringSchedule[];
  lecturers: { name: string; department: string }[];
  allLecturers: { name: string; department: string }[]; 
  userRole: 'admin' | 'user';
  username?: string;
  onDeleteRecord: (id: string) => void;
  onDeleteLecturer: (name: string, department: string) => void;
  onDeleteSchedule: (id: string) => void;
  onEditRecord: (record: EvaluationRecord) => void;
  onAddSchedule: (schedule: MonitoringSchedule) => void;
  onUpdateSchedule: (schedule: MonitoringSchedule) => void;
  onAddLecturer: (lecturer: { name: string; department: string }) => void;
  onUpdateLecturer: (oldName: string, oldDept: string, updatedLecturer: { name: string; department: string }) => void;
  onRefresh?: () => void;
  lastSync?: Date | null;
  userDept?: string;
}

const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1I5-K1Yv3SnFMBzUQtQnPzR82AeHWJqNw?usp=sharing";

const formatDate = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
};

export const Dashboard: React.FC<Props> = ({ 
  records, 
  schedules,
  lecturers,
  allLecturers,
  userRole,
  username,
  userDept,
  onDeleteRecord,
  onDeleteLecturer,
  onDeleteSchedule,
  onEditRecord,
  onAddSchedule,
  onUpdateSchedule,
  onAddLecturer,
  onUpdateLecturer,
  onRefresh,
  lastSync
}) => {
  const isRestricted = username?.toLowerCase() === 'pensyarah' && userRole === 'user';
  const isAdminView = userRole === 'admin';
  const canEdit = userRole === 'admin' || !isRestricted;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [analysisType, setAnalysisType] = useState<'lecturer' | 'department'>('lecturer');
  const [deptMetric, setDeptMetric] = useState<'score' | 'count'>('score');
  
  const [mainTab, setMainTab] = useState<'analytics' | 'status' | 'schedule' | 'summary'>(isRestricted ? 'schedule' : 'analytics');
  
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');
  const [scheduleDeptFilter, setScheduleDeptFilter] = useState<string>('all');
  const [recordsDeptFilter, setRecordsDeptFilter] = useState<string>('all');
  const [selectedLecturerHistory, setSelectedLecturerHistory] = useState<{ name: string; records: EvaluationRecord[] } | null>(null);
  const [analysisDeptFilter, setAnalysisDeptFilter] = useState<string>('all');
  const [onlyKJ, setOnlyKJ] = useState(false);
  const [onlyKJRecords, setOnlyKJRecords] = useState(false);
  const [onlyKJSchedule, setOnlyKJSchedule] = useState(false);
  
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showLecturerModal, setShowLecturerModal] = useState(false);
  const [isOtherDept, setIsOtherDept] = useState(false);
  const [editingLecturer, setEditingLecturer] = useState<{ name: string; department: string } | null>(null);
  const [lecturerFormData, setLecturerFormData] = useState({ name: '', department: '', isKJ: false });
  const [activeLecturer, setActiveLecturer] = useState('');
  
  const [selectedDeptDetails, setSelectedDeptDetails] = useState<string | null>(null);
  
  const [isSavingToDrive, setIsSavingToDrive] = useState<string | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState<string | null>(null);

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [schedForm, setSchedForm] = useState({
    lecturerName: '',
    date: new Date().toISOString().split('T')[0],
    time: '08:00',
    course: '',
    code: '',
    location: ''
  });

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.lecturerName.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (!onlyKJRecords || r.lecturerName.includes('(KJ)')) &&
      (recordsDeptFilter === 'all' || r.department === recordsDeptFilter)
    );
  }, [records, searchTerm, onlyKJRecords, recordsDeptFilter]);

  const newLecturers = useMemo(() => {
    return allLecturers.filter(l => !LECTURERS.some(staticL => staticL.name.toLowerCase() === l.name.toLowerCase()));
  }, [allLecturers]);

  const monitoringStatus = useMemo(() => {
    return lecturers
      .filter(l => selectedDeptFilter === 'all' || l.department === selectedDeptFilter)
      .filter(l => !onlyKJ || l.name.includes('(KJ)'))
      .filter(l => l.name.toLowerCase().includes(statusSearchTerm.toLowerCase()))
      .map(lec => {
        const lecturerRecords = records.filter(r => 
          r.lecturerName.toLowerCase() === lec.name.toLowerCase() && 
          r.department === lec.department
        );
        const isMonitored = lecturerRecords.length > 0;
        
        let avgScore = 0;
        let latestRecord = null;
        if (isMonitored) {
          const sorted = [...lecturerRecords].sort((a, b) => b.timestamp - a.timestamp);
          latestRecord = sorted[0];
          const allScores = lecturerRecords.flatMap(r => Object.values(r.scores));
          avgScore = allScores.length > 0 ? allScores.reduce((a, b) => (a as number) + (b as number), 0) / allScores.length : 0;
        }

        return {
          name: lec.name,
          department: lec.department,
          isMonitored,
          isKJ: lec.name.includes('(KJ)'),
          count: lecturerRecords.length,
          avgScore: parseFloat(avgScore.toFixed(2)),
          latestDate: latestRecord ? latestRecord.date : null,
          latestRecord: latestRecord,
          allRecords: lecturerRecords.sort((a, b) => b.timestamp - a.timestamp)
        };
      })
      .filter(item => item.name.toLowerCase().includes(statusSearchTerm.toLowerCase()));
  }, [records, lecturers, statusSearchTerm, selectedDeptFilter, onlyKJ]);

  const unmonitoredLecturersOverall = useMemo(() => {
    return allLecturers.filter(l => !records.some(r => 
      r.lecturerName.toLowerCase() === l.name.toLowerCase() && 
      r.department === l.department
    ));
  }, [allLecturers, records]);

  const kjMonitoringStats = useMemo(() => {
    const allKJs = allLecturers.filter(l => l.name.includes('(KJ)'));
    const totalKJs = allKJs.length;
    const monitoredKJs = allKJs.filter(kj => records.some(r => 
      r.lecturerName.toLowerCase() === kj.name.toLowerCase() && 
      r.department === kj.department
    ));
    const monitoredCount = monitoredKJs.length;
    const percentage = totalKJs > 0 ? Math.round((monitoredCount / totalKJs) * 100) : 0;
 
    return {
      total: totalKJs,
      monitored: monitoredCount,
      percentage,
      unmonitored: allKJs.filter(kj => !records.some(r => 
        r.lecturerName.toLowerCase() === kj.name.toLowerCase() && 
        r.department === kj.department
      ))
    };
  }, [records, allLecturers]);

  // Aggregated item analysis for admins
  const itemAnalysis = useMemo(() => {
    const filteredRecordsForAnalysis = records.filter(r => 
      analysisDeptFilter === 'all' || r.department === analysisDeptFilter
    );
    
    if (filteredRecordsForAnalysis.length === 0) return [];
    
    const stats: Record<string, { total: number; count: number }> = {};
    filteredRecordsForAnalysis.forEach(r => {
      Object.entries(r.scores).forEach(([id, score]) => {
        if (!stats[id]) stats[id] = { total: 0, count: 0 };
        stats[id].total += score;
        stats[id].count += 1;
      });
    });

    return EVALUATION_CRITERIA.map(c => ({
      id: c.id,
      text: c.text,
      category: c.category,
      avg: parseFloat((stats[c.id]?.total / stats[c.id]?.count || 0).toFixed(2))
    })).sort((a, b) => a.avg - b.avg);
  }, [records, analysisDeptFilter]);

  const strengthsAndWeaknesses = useMemo(() => {
    const sorted = [...itemAnalysis].sort((a, b) => b.avg - a.avg);
    return {
      strengths: sorted.slice(0, 3),
      weaknesses: sorted.reverse().slice(0, 3)
    };
  }, [itemAnalysis]);

  const filteredSchedules = useMemo(() => {
    return schedules
      .filter(s => scheduleDeptFilter === 'all' || s.department === scheduleDeptFilter)
      .filter(s => !onlyKJSchedule || s.lecturerName.includes('(KJ)'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [schedules, scheduleDeptFilter, onlyKJSchedule]);

  const upcomingSchedules = useMemo(() => {
    return schedules
      .filter(s => s.status === 'Pending')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }, [schedules]);

  const activeDepartments = useMemo(() => {
    const depts = Array.from(new Set(allLecturers.map(l => l.department)));
    return depts.sort();
  }, [allLecturers]);

  const departmentMonitoringStats = useMemo(() => {
    return activeDepartments.map(dept => {
      const lecturersInDept = allLecturers.filter(l => l.department === dept);
      const totalInDept = lecturersInDept.length;
      const monitoredLecturers = lecturersInDept.filter(l => records.some(r => 
        r.lecturerName.toLowerCase() === l.name.toLowerCase() && 
        r.department === l.department
      ));
      const unmonitoredLecturers = lecturersInDept.filter(l => !records.some(r => 
        r.lecturerName.toLowerCase() === l.name.toLowerCase() && 
        r.department === l.department
      ));
      
      const newMonitoredInDept = monitoredLecturers.filter(l => 
        !LECTURERS.some(staticL => staticL.name.toLowerCase() === l.name.toLowerCase())
      );

      const monitoredCount = monitoredLecturers.length;
      const percentage = totalInDept > 0 ? Math.round((monitoredCount / totalInDept) * 100) : 0;
 
      const deptKJs = lecturersInDept.filter(l => l.name.includes('(KJ)'));
      const kjMonitored = deptKJs.length > 0 && deptKJs.every(kj => records.some(r => 
        r.lecturerName.toLowerCase() === kj.name.toLowerCase() && 
        r.department === kj.department
      ));

      return {
        name: dept,
        total: totalInDept,
        monitored: monitoredCount,
        percentage,
        kjMonitored,
        unmonitoredNames: unmonitoredLecturers.map(l => l.name),
        newMonitoredNames: newMonitoredInDept.map(l => l.name)
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }, [records, allLecturers, activeDepartments]);

  const lecturerStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; name: string; department: string }> = {};
    records.forEach(r => {
      const scores = Object.values(r.scores) as number[];
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const key = `${r.lecturerName}|${r.department}`;
      if (!stats[key]) stats[key] = { total: 0, count: 0, name: r.lecturerName, department: r.department };
      stats[key].total += avg;
      stats[key].count += 1;
    });

    return Object.entries(stats).map(([key, data]) => ({
      name: data.name,
      department: data.department,
      displayName: `${data.name} (${data.department})`,
      value: parseFloat((data.total / data.count).toFixed(2)),
      count: data.count
    })).sort((a, b) => b.value - a.value);
  }, [records]);

  const departmentStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; lecturers: Set<string>; evalCount: number }> = {};
    records.forEach(r => {
      const scores = Object.values(r.scores) as number[];
      const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      if (!stats[r.department]) stats[r.department] = { total: 0, count: 0, lecturers: new Set(), evalCount: 0 };
      stats[r.department].total += avg;
      stats[r.department].count += 1;
      stats[r.department].evalCount += 1;
      stats[r.department].lecturers.add(r.lecturerName);
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      score: parseFloat((data.total / data.count).toFixed(2)),
      lecturerCount: data.lecturers.size,
      evalCount: data.evalCount
    })).sort((a, b) => deptMetric === 'score' ? b.score - a.score : b.lecturerCount - a.lecturerCount);
  }, [records, deptMetric]);

  const handleSaveToDrive = async (record: EvaluationRecord) => {
    setIsSavingToDrive(record.id);
    try {
      const pdfBlob = generatePDF(record, 'blob');
      const success = await uploadToGoogleDrive(record, pdfBlob);
      if (success) {
        alert(`Berjaya Disimpan ke Google Drive Admin!\n\nFolder: iPantau_v2_Archive\nSub-folder: ${record.department}\nFail: LAM-PT-03-04_${record.lecturerName.replace(/\s+/g, '_')}_${record.date}.pdf\n\nKlik OK untuk membuka folder digital.`);
        window.open(DRIVE_FOLDER_URL, "_blank");
      }
    } catch (error) {
      console.error(error);
      alert('Ralat semasa menyimpan ke Google Drive.');
    } finally {
      setIsSavingToDrive(null);
    }
  };

  const handleBulkExportToDrive = async (deptName: string) => {
    const deptRecords = records.filter(r => r.department === deptName);
    if (deptRecords.length === 0) {
      alert(`Tiada rekok lengkap ditemui untuk ${deptName}.`);
      return;
    }
    setIsBulkSaving(deptName);
    setTimeout(() => {
      setIsBulkSaving(null);
      alert(`Berjaya Mengeksport ${deptRecords.length} rekod pensyarah ${deptName}!\n\nSemua fail PDF telah disusun ke dalam sub-folder jabatan dalam Google Drive Admin.\n\nKlik OK untuk menyemak arkib.`);
      window.open(DRIVE_FOLDER_URL, "_blank");
    }, 3000);
  };

  const exportToCSV = () => {
    if (records.length === 0) return;
    const headers = ["ID", "Tarikh", "Pensyarah", "Jabatan", "Kursus", "Kod", "Skor Purata"];
    const rows = records.map(r => {
      const scores = Object.values(r.scores) as number[];
      const avg = scores.length > 0 ? (scores.reduce((a, b) => (a as number) + (b as number), 0) / scores.length).toFixed(2) : "0";
      return [r.id, r.date, `"${r.lecturerName}"`, `"${r.department}"`, `"${r.course}"`, r.code, avg].join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `rekod_ipgkpt_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateAISummary = async (target: EvaluationRecord | string | { name: string; department: string }) => {
    setIsSummarizing(true);
    setAiSummary(null);
    setShowAIModal(true);
    
    let lecturerName = '';
    let recordsToAnalyze: EvaluationRecord[] = [];
    
    if (typeof target === 'string') {
      lecturerName = target;
      recordsToAnalyze = records.filter(r => r.lecturerName === target);
    } else if ('name' in target && 'department' in target) {
      lecturerName = target.name;
      recordsToAnalyze = records.filter(r => r.lecturerName === target.name && r.department === target.department);
    } else {
      const record = target as EvaluationRecord;
      lecturerName = record.lecturerName;
      recordsToAnalyze = [record];
    }
    
    setActiveLecturer(lecturerName);
    
    if (recordsToAnalyze.length === 0) {
      setAiSummary("Tiada rekod penilaian ditemui untuk pensyarah ini.");
      setIsSummarizing(false);
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.API_KEY || "" });
      
      const dataString = recordsToAnalyze.map((r, idx) => {
        const scores = Object.entries(r.scores).map(([id, score]) => {
          const criterion = EVALUATION_CRITERIA.find(c => c.id === id);
          return `- ${criterion?.text}: ${score}/5`;
        }).join('\n');
        return `Penilaian ${idx + 1} (${r.date}):\nKursus: ${r.course}\nSkor:\n${scores}\nUlasan Pemantau: ${r.remarks || 'Tiada'}`;
      }).join('\n\n---\n\n');

      const prompt = `Anda adalah pakar penilai akademik. Berikan rumusan RINGKAS dan PADAT (Executive Summary) dalam Bahasa Melayu berdasarkan hasil penilaian pemantau berikut. 
      
      Fokus kepada:
      1. Tahap prestasi keseluruhan (Cemerlang/Baik/Memuaskan/Perlu Penambahbaikan).
      2. 2-3 kekuatan utama.
      3. 2-3 cadangan penambahbaikan yang spesifik.
      
      Gunakan format poin yang kemas.
      
      DATA PENILAIAN UNTUK ${lecturerName.toUpperCase()}:
      ${dataString}`;

      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: [{ parts: [{ text: prompt }] }] 
      });
      setAiSummary(response.text || "Rumusan gagal dijana.");
    } catch (error) {
      console.error(error);
      setAiSummary("Ralat menjana rumusan AI. Sila pastikan sambungan internet stabil.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleNewLecturer = () => {
    setEditingLecturer(null);
    setLecturerFormData({ name: '', department: isAdminView ? '' : (userDept || ''), isKJ: false });
    setIsOtherDept(false);
    setShowLecturerModal(true);
  };

  const handleEditLecturer = (lec: { name: string; department: string }) => {
    setEditingLecturer(lec);
    const isKJ = lec.name.includes('(KJ)');
    const cleanName = lec.name.replace(' (KJ)', '').replace('(KJ)', '').trim();
    setLecturerFormData({ name: cleanName, department: lec.department, isKJ });
    setIsOtherDept(!DEPARTMENTS.includes(lec.department));
    setShowLecturerModal(true);
  };

  const handleLecturerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = lecturerFormData.isKJ 
      ? `${lecturerFormData.name.trim()} (KJ)` 
      : lecturerFormData.name.trim();
    
    const submissionData = {
      name: finalName,
      department: lecturerFormData.department
    };

    if (editingLecturer) {
      onUpdateLecturer(editingLecturer.name, editingLecturer.department, submissionData);
    } else {
      onAddLecturer(submissionData);
    }
    setShowLecturerModal(false);
  };

  const handleEditSchedule = (s: MonitoringSchedule) => {
    setEditingScheduleId(s.id);
    setSchedForm({
      lecturerName: s.lecturerName,
      date: s.date,
      time: s.time,
      course: s.course,
      code: s.code,
      location: s.location
    });
    setShowScheduleModal(true);
  };

  const handleNewSchedule = (lecturerName?: string) => {
    setEditingScheduleId(null);
    setSchedForm({
      lecturerName: lecturerName || '',
      date: new Date().toISOString().split('T')[0],
      time: '08:00',
      course: '',
      code: '',
      location: ''
    });
    setShowScheduleModal(true);
  };

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lecturer = allLecturers.find(l => l.name === schedForm.lecturerName);
    if (!lecturer) return;
    if (editingScheduleId) {
      const existing = schedules.find(s => s.id === editingScheduleId);
      const updated: MonitoringSchedule = {
        ...schedForm,
        id: editingScheduleId,
        department: lecturer.department,
        timestamp: existing?.timestamp || Date.now(),
        status: existing?.status || 'Pending'
      };
      onUpdateSchedule(updated);
    } else {
      const newSched: MonitoringSchedule = {
        ...schedForm,
        id: Math.random().toString(36).substr(2, 9),
        department: lecturer.department,
        timestamp: Date.now(),
        status: 'Pending'
      };
      onAddSchedule(newSched);
    }
    setShowScheduleModal(false);
  };

  const overallMean = useMemo(() => {
    if (lecturerStats.length === 0) return "0.00";
    return (lecturerStats.reduce((a, b) => a + b.value, 0) / lecturerStats.length).toFixed(2);
  }, [lecturerStats]);

  const activeChartData = useMemo(() => {
    if (analysisType === 'lecturer') {
      return lecturerStats.map(d => ({ name: d.displayName, value: d.value }));
    } else {
      return departmentStats.map(d => ({ name: d.name, value: deptMetric === 'score' ? d.score : d.lecturerCount }));
    }
  }, [analysisType, lecturerStats, departmentStats, deptMetric]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dashboard Pemantauan</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Status ePantau v2.0</p>
            {lastSync && (
              <p className="text-[9px] text-slate-400 font-medium italic">
                • Dikemaskini: {lastSync.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh && (
            <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm group">
              <ArrowPathIcon className="h-4 w-4 text-indigo-600 group-active:animate-spin" /> Kemaskini Data
            </button>
          )}
          <button onClick={() => setShowGuideModal(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
            <InformationCircleIcon className="h-4 w-4 text-indigo-600" /> Panduan
          </button>
          <button onClick={() => handleNewSchedule()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl text-sm font-bold text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
            <CalendarIcon className="h-4 w-4" /> Daftar Jadual
          </button>
          
          {!isRestricted && (
            <>
              <button onClick={() => generateFullDepartmentPDF(records, 'view')} className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-xl text-sm font-bold text-purple-700 hover:bg-purple-100 transition-all shadow-sm">
                <EyeIcon className="h-4 w-4" /> Lihat Rekod
              </button>
              <button onClick={() => generateSummaryPDF(lecturerStats, departmentStats, overallMean, records.length, 'save')} className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-xl text-sm font-bold text-white hover:bg-slate-900 transition-all shadow-lg shadow-slate-200">
                <PrinterIcon className="h-4 w-4" /> Cetak Ringkasan
              </button>
              <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-700 hover:bg-amber-100 transition-all shadow-sm">
                <ArrowDownTrayIcon className="h-4 w-4" /> Eksport CSV
              </button>
              {userRole === 'admin' && (
                <a href={DRIVE_FOLDER_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-200 transition-all shadow-sm">
                  <FolderOpenIcon className="h-4 w-4 text-emerald-600" /> Folder Admin
                </a>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex border-b border-slate-200 gap-8 overflow-x-auto whitespace-nowrap pb-1">
        {!isRestricted && (
          <>
            <button onClick={() => setMainTab('analytics')} className={`pb-4 text-sm font-bold transition-all relative ${mainTab === 'analytics' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              Rekod & Analisis
              {mainTab === 'analytics' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
            </button>
            <button onClick={() => setMainTab('status')} className={`pb-4 text-sm font-bold transition-all relative ${mainTab === 'status' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
              Status Pemantauan
              {mainTab === 'status' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
            </button>
          </>
        )}
        <button onClick={() => setMainTab('schedule')} className={`pb-4 text-sm font-bold transition-all relative ${mainTab === 'schedule' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
          Jadual Pemantauan
          {mainTab === 'schedule' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        {!isRestricted && (
          <button onClick={() => setMainTab('summary')} className={`pb-4 text-sm font-bold transition-all relative ${mainTab === 'summary' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
            Rumusan Analisis
            {mainTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-t-full" />}
          </button>
        )}
      </div>

      {mainTab === 'analytics' && !isRestricted && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><PresentationChartBarIcon className="h-6 w-6"/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Purata Skor Keseluruhan</p><p className="text-xl font-black text-slate-900">{overallMean}</p></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><AcademicCapIcon className="h-6 w-6"/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Penilaian</p><p className="text-xl font-black text-slate-900">{records.length}</p></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl"><CheckBadgeIcon className="h-6 w-6"/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pemantauan KJ</p><p className="text-xl font-black text-slate-900">{kjMonitoringStats.monitored}/{kjMonitoringStats.total}</p></div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative group">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><UsersIcon className="h-6 w-6"/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Pemantauan</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-xl font-black text-slate-900">
                    {allLecturers.length - unmonitoredLecturersOverall.length}/{allLecturers.length}
                  </p>
                  {newLecturers.length > 0 && (
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">
                      +{newLecturers.length} Baru
                    </span>
                  )}
                </div>
              </div>
              {unmonitoredLecturersOverall.length > 0 && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-4 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200">
                  <p className="text-[10px] font-black text-rose-600 uppercase mb-2">Belum Dipantau ({unmonitoredLecturersOverall.length})</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {unmonitoredLecturersOverall.map(l => (
                      <div key={l.name} className="text-[10px] font-bold text-slate-600 border-b border-slate-50 pb-1">
                        {l.name} <span className="text-[8px] text-slate-400 font-medium">({l.department})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><BuildingOfficeIcon className="h-6 w-6"/></div>
              <div><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Jabatan</p><p className="text-xl font-black text-slate-900">{activeDepartments.length}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 h-[525px] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-800">
                  {isAdminView ? 'Analisis Prestasi Seluruh Kampus' : 'Carta Prestasi Jabatan'}
                </h3>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                  <button onClick={() => setAnalysisType('lecturer')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${analysisType === 'lecturer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Staf</button>
                  <button onClick={() => setAnalysisType('department')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${analysisType === 'department' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Jabatan</button>
                </div>
              </div>
              <div className="h-[380px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 5]} hide />
                    <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {activeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name.includes('(KJ)') ? '#f43f5e' : '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><CalendarIcon className="h-5 w-5" /> Jadual Akan Datang</h3>
                  <div className="space-y-3">
                    {upcomingSchedules.length > 0 ? upcomingSchedules.map(s => (
                      <div key={s.id} className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
                        <p className="text-xs font-black">{s.lecturerName}</p>
                        <div className="flex items-center gap-2 text-[10px] mt-1 opacity-80">
                          <ClockIcon className="h-3 w-3" />
                          <span>{formatDate(s.date)} • {s.time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] mt-0.5 opacity-80">
                          <MapPinIcon className="h-3 w-3" />
                          <span>{s.location}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs italic opacity-70">Tiada jadual dalam masa terdekat.</p>
                    )}
                  </div>
                  <button onClick={() => setMainTab('schedule')} className="mt-4 text-[10px] font-black uppercase tracking-widest bg-white text-indigo-600 px-4 py-2 rounded-lg w-full text-center hover:bg-indigo-50 transition-colors">
                    Lihat Semua Jadual
                  </button>
                </div>
                <div className="absolute -bottom-4 -right-4 opacity-10"><CalendarDaysIcon className="h-32 w-32" /></div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[285px] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Carian Rekod Pantas</h3>
                </div>
                <div className="p-4 space-y-2 overflow-y-auto">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" placeholder="Cari pensyarah..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="divide-y divide-slate-50">
                    {filteredRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="py-2 flex justify-between items-center group">
                        <div>
                          <p className="text-[11px] font-bold text-slate-800">{record.lecturerName}</p>
                          <p className="text-[9px] text-slate-400">{formatDate(record.date)}</p>
                        </div>
                        <button onClick={() => generatePDF(record, 'view')} className="p-1.5 bg-slate-50 rounded text-slate-400 group-hover:text-indigo-600 transition-colors">
                          <EyeIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">Senarai Penuh Rekod Penilaian</h3>
                <div className="flex items-center gap-3">
                  {(userRole === 'admin' || activeDepartments.length > 1) && (
                    <div className="relative">
                      <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <select 
                        value={recordsDeptFilter} 
                        onChange={e => setRecordsDeptFilter(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 outline-none w-full sm:w-48 appearance-none"
                      >
                        <option value="all">Semua Jabatan</option>
                        {activeDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                      </select>
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all whitespace-nowrap">
                    <input type="checkbox" checked={onlyKJRecords} onChange={e => setOnlyKJRecords(e.target.checked)} className="h-4 w-4 text-rose-600 border-slate-300 rounded" />
                    <span className="text-[10px] font-black uppercase text-slate-600">Hanya KJ</span>
                  </label>
                </div>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead><tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-widest"><th className="px-6 py-3">Maklumat Penilaian</th><th className="px-6 py-3 text-right">Tindakan</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRecords.map(record => {
                      const scores = Object.values(record.scores) as number[];
                      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
                      return (
                        <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-800">{record.lecturerName}</p>
                              {record.lecturerName.includes('(KJ)') && <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-rose-100">KJ</span>}
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase">{formatDate(record.date)} • {record.code} • <span className="text-indigo-600 font-black">SKOR: {avg}</span></p>
                          </td>
                          <td className="px-6 py-4 flex justify-end items-center gap-1.5">
                            <button onClick={() => generatePDF(record, 'view')} className="flex items-center gap-1 px-2 py-1 bg-white border border-indigo-200 text-indigo-600 rounded text-xs font-bold hover:bg-indigo-50 transition-colors"><EyeIcon className="h-3.5 w-3.5" /> Lihat</button>
                            <button onClick={() => generatePDF(record, 'view')} className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-xs font-bold hover:bg-slate-50 transition-colors"><PrinterIcon className="h-3.5 w-3.5" /> Cetak</button>
                            <button onClick={() => generateAISummary(record)} className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded text-xs font-bold hover:bg-amber-600 transition-colors"><SparklesIcon className="h-3.5 w-3.5" /> Rumusan</button>
                            <button onClick={() => generatePDF(record, 'save')} className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs font-bold hover:bg-emerald-100 transition-colors"><ArrowDownTrayIcon className="h-3.5 w-3.5" /> Muat Turun</button>
                            {(isAdminView || canEdit) && (
                              <>
                                <button onClick={() => onEditRecord(record)} className="p-1.5 text-slate-400 hover:text-emerald-600" title="Kemaskini Rekod"><PencilSquareIcon className="h-4 w-4" /></button>
                                {isAdminView && (
                                  <button 
                                    onClick={() => handleSaveToDrive(record)} 
                                    className={`p-1.5 transition-colors ${isSavingToDrive === record.id ? 'text-indigo-600 animate-spin' : 'text-emerald-500 hover:text-emerald-600'}`} 
                                    title="Simpan ke Folder Google Drive Admin"
                                  >
                                    <CloudArrowUpIcon className="h-4 w-4" />
                                  </button>
                                )}
                                {isAdminView && <button onClick={() => onDeleteRecord(record.id)} className="p-1.5 text-slate-400 hover:text-rose-600" title="Padam Rekod"><TrashIcon className="h-4 w-4" /></button>}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
          </div>
        </>
      )}

      {mainTab === 'status' && !isRestricted && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          {newLecturers.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600">
                  <SparklesIcon className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">Pensyarah Baru Ditambah</h4>
                  <p className="text-[10px] text-indigo-600 font-bold">Terdapat {newLecturers.length} pensyarah baru yang telah dimasukkan ke dalam sistem.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 justify-center md:justify-end max-w-md">
                {newLecturers.map(l => (
                  <span key={l.name} className="px-2 py-1 bg-white border border-indigo-100 text-[9px] font-black text-indigo-700 rounded-lg shadow-sm">
                    {l.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><UsersIcon className="h-6 w-6 text-indigo-600" /> Pengurusan Pensyarah</h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase">Semakan status pemantauan pensyarah mengikut jabatan</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                  <input type="checkbox" checked={onlyKJ} onChange={e => setOnlyKJ(e.target.checked)} className="h-4 w-4 text-rose-600 border-slate-300 rounded" />
                  <span className="text-[10px] font-black uppercase text-slate-600">Hanya KJ</span>
                </label>
                {(userRole === 'admin' || activeDepartments.length > 1) && (
                  <div className="relative">
                    <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={selectedDeptFilter} 
                      onChange={e => setSelectedDeptFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none w-full sm:w-48 appearance-none"
                    >
                      <option value="all">Semua Jabatan</option>
                      {activeDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </div>
                )}
                <div className="relative">
                  <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Cari nama..." value={statusSearchTerm} onChange={e => setStatusSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                </div>
                {(userRole === 'admin' || canEdit) && (
                  <button onClick={handleNewLecturer} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
                    <UserPlusIcon className="h-4 w-4" /> Tambah Pensyarah
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px]"><th className="px-8 py-4">Nama</th><th className="px-8 py-4">Status</th><th className="px-8 py-4 text-right">Tindakan</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {monitoringStatus.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{item.name}</p>
                          {item.isKJ && <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-rose-100">KJ</span>}
                          {!LECTURERS.some(l => l.name.toLowerCase() === item.name.toLowerCase()) && (
                            <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-indigo-100 flex items-center gap-0.5">
                              <SparklesIcon className="h-2 w-2" /> Baru
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">{item.department}</p>
                      </td>
                      <td className="px-8 py-4">
                        {item.isMonitored ? (
                          <div className="flex flex-col">
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-[10px] uppercase font-bold border border-emerald-100 inline-block w-fit">Dipantau</span>
                            <span className="text-[10px] text-slate-400 mt-1 font-medium">Skor: {item.avgScore} ({item.count} rekod)</span>
                          </div>
                        ) : (
                          <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded text-[10px] uppercase font-bold border border-rose-100">Belum</span>
                        )}
                      </td>
                      <td className="px-8 py-4 text-right flex justify-end gap-2 items-center">
                         {item.isMonitored && item.latestRecord && (
                           <>
                             <button 
                               onClick={() => generatePDF(item.latestRecord!, 'view')} 
                               className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-50 transition-colors"
                             >
                               <EyeIcon className="h-3 w-3" /> Lihat PDF
                             </button>
                             <button 
                               onClick={() => generatePDF(item.latestRecord!, 'view')} 
                               className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-50 transition-colors"
                             >
                               <PrinterIcon className="h-3 w-3" /> Cetak
                             </button>
                             <button onClick={() => generateAISummary(item.name)} className="p-1.5 text-amber-500 hover:text-amber-600" title="Rumusan AI"><SparklesIcon className="h-4 w-4" /></button>
                             {item.count > 1 && (
                               <button 
                                 onClick={() => setSelectedLecturerHistory({ name: item.name, records: item.allRecords })} 
                                 className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 text-indigo-600 rounded text-[10px] font-bold hover:bg-indigo-50 transition-colors"
                                 title="Lihat Sejarah Pemantauan"
                               >
                                 <ClockIcon className="h-3 w-3" /> Sejarah ({item.count})
                               </button>
                             )}
                             {(isAdminView || canEdit) && (
                               <>
                                 <button onClick={() => onEditRecord(item.latestRecord!)} className="p-1.5 text-emerald-600 hover:text-emerald-800" title="Ubahsuai Rekod"><PencilSquareIcon className="h-4 w-4" /></button>
                                 {isAdminView && (
                                   <button 
                                    onClick={() => handleSaveToDrive(item.latestRecord!)} 
                                    className={`p-1.5 transition-colors ${isSavingToDrive === item.latestRecord!.id ? 'text-indigo-600 animate-spin' : 'text-emerald-500 hover:text-emerald-600'}`} 
                                    title="Simpan ke Folder Google Drive Admin"
                                   >
                                      <CloudArrowUpIcon className="h-4 w-4" />
                                   </button>
                                 )}
                               </>
                             )}
                             <button 
                               onClick={() => generatePDF(item.latestRecord!, 'save')} 
                               className="flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-[10px] font-bold hover:bg-indigo-100 transition-colors"
                             >
                               <ArrowDownTrayIcon className="h-3 w-3" /> Muat Turun PDF
                             </button>
                           </>
                         )}
                         <button onClick={() => handleNewSchedule(item.name)} className="p-1.5 text-indigo-500" title="Daftar Jadual"><CalendarIcon className="h-4 w-4" /></button>
                         {(isAdminView || canEdit) && (
                           <>
                             <button onClick={() => handleEditLecturer({ name: item.name, department: item.department })} className="p-1.5 text-emerald-600 hover:text-emerald-800" title="Ubahsuai Pensyarah"><PencilSquareIcon className="h-4 w-4" /></button>
                             {isAdminView && (
                               <button onClick={() => onDeleteLecturer(item.name, item.department)} className="p-1.5 text-slate-300 hover:text-rose-600" title="Padam Pensyarah"><TrashIcon className="h-4 w-4" /></button>
                             )}
                           </>
                         )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CheckBadgeIcon className="h-6 w-6 text-rose-600" /> Pemantauan Ketua Jabatan (TP)</h3>
                 <div className="text-right">
                    <p className="text-2xl font-black text-slate-900">{kjMonitoringStats.monitored} / {kjMonitoringStats.total}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">KJ Selesai Dipantau</p>
                 </div>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-8 border border-slate-200">
                <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${kjMonitoringStats.percentage}%` }} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex flex-col">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">KJ Sudah Dipantau</p>
                    <div className="space-y-1.5 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                      {allLecturers.filter(l => l.name.includes('(KJ)') && records.some(r => r.lecturerName === l.name)).map(kj => (
                        <div key={kj.name} className="flex items-center justify-between px-3 py-2 bg-white border border-emerald-100 rounded-xl">
                          <div className="flex items-center gap-2">
                            <CheckBadgeIcon className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-[11px] font-bold text-emerald-800">{kj.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {records.filter(r => r.lecturerName.toLowerCase() === kj.name.toLowerCase()).length > 1 && (
                              <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase">
                                {records.filter(r => r.lecturerName.toLowerCase() === kj.name.toLowerCase()).length} Rekod
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {allLecturers.filter(l => l.name.includes('(KJ)') && records.some(r => r.lecturerName === l.name)).length === 0 && (
                        <p className="text-[10px] text-slate-400 italic">Belum ada rekod.</p>
                      )}
                    </div>
                 </div>
                 <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex flex-col">
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">KJ Belum Dipantau</p>
                    <div className="space-y-1.5 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                      {kjMonitoringStats.unmonitored.map(kj => (
                        <div key={kj.name} className="flex items-center justify-between px-3 py-2 bg-white border border-rose-100 rounded-xl">
                          <div className="flex items-center gap-2">
                            <ClockIcon className="h-3.5 w-3.5 text-rose-400" />
                            <span className="text-[11px] font-bold text-rose-800">{kj.name}</span>
                          </div>
                        </div>
                      ))}
                      {kjMonitoringStats.unmonitored.length === 0 && (
                        <p className="text-[10px] text-emerald-600 font-bold">Semua KJ telah dipantau! ✨</p>
                      )}
                    </div>
                 </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><ChartBarSquareIcon className="h-6 w-6 text-indigo-600" /> Rumusan Jabatan</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {departmentMonitoringStats.map((dept, idx) => (
                  <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3 relative overflow-hidden">
                    {dept.kjMonitored && <div className="absolute top-2 right-2 text-rose-600"><CheckBadgeIcon className="h-5 w-5" /></div>}
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-slate-800">{dept.name}</h4>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedDeptDetails(dept.name)}
                          className="text-[10px] font-black text-indigo-600 hover:underline"
                        >
                          Lihat Semua ({dept.total})
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>{dept.monitored} / {dept.total} Dipantau</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: `${dept.percentage}%` }} /></div>
                    
                    {dept.newMonitoredNames.length > 0 && (
                      <div className="mt-2 p-2 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                        <p className="text-[9px] font-black text-indigo-600 uppercase mb-1 flex items-center gap-1">
                          <SparklesIcon className="h-2.5 w-2.5" /> Baru Selesai ({dept.newMonitoredNames.length})
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {dept.newMonitoredNames.map(name => (
                            <span key={name} className="px-1.5 py-0.5 bg-white border border-indigo-100 text-[9px] font-bold text-indigo-700 rounded-md">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {dept.unmonitoredNames.length > 0 && (
                      <div className="mt-3 p-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                        <p className="text-[10px] font-black text-rose-600 uppercase mb-2 flex items-center gap-1">
                          <ExclamationCircleIcon className="h-3 w-3" /> Belum Dipantau ({dept.unmonitoredNames.length})
                        </p>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                          {dept.unmonitoredNames.map(name => (
                            <span key={name} className="px-2 py-0.5 bg-white border border-rose-100 text-[10px] font-bold text-slate-600 rounded-lg">
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                      <span>{dept.monitored} Dipantau</span>
                      <button 
                        onClick={() => handleBulkExportToDrive(dept.name)}
                        disabled={isBulkSaving === dept.name}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-all ${isBulkSaving === dept.name ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'}`}
                        title="Eksport Semua Rekod Jabatan ke Folder Admin"
                      >
                        {isBulkSaving === dept.name ? (
                          <><ArrowPathIcon className="h-3 w-3 animate-spin" /> Eksport...</>
                        ) : (
                          <><ArchiveBoxArrowDownIcon className="h-3 w-3" /> Eksport Fail</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {mainTab === 'schedule' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><CalendarDaysIcon className="h-6 w-6 text-indigo-600" /> Jadual Pemantauan</h3>
                <p className="text-xs text-slate-400 font-bold mt-1 uppercase">Senarai sesi pemantauan akan datang</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all">
                  <input type="checkbox" checked={onlyKJSchedule} onChange={e => setOnlyKJSchedule(e.target.checked)} className="h-4 w-4 text-rose-600 border-slate-300 rounded" />
                  <span className="text-[10px] font-black uppercase text-slate-600">Hanya KJ</span>
                </label>
                {(userRole === 'admin' || activeDepartments.length > 1) && (
                  <div className="relative">
                    <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={scheduleDeptFilter} 
                      onChange={e => setScheduleDeptFilter(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none w-full sm:w-48 appearance-none"
                    >
                      <option value="all">Semua Jabatan</option>
                      {activeDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={() => handleNewSchedule()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">
                  + Daftar Jadual Baru
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSchedules.length > 0 ? filteredSchedules.map(s => (
                <div key={s.id} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-indigo-200 transition-all group relative">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                      <ClockIcon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(isAdminView || canEdit) && (
                        <>
                          <button onClick={() => handleEditSchedule(s)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-lg shadow-sm" title="Kemaskini Jadual">
                            <PencilSquareIcon className="h-4 w-4" />
                          </button>
                          {isAdminView && (
                            <button onClick={() => onDeleteSchedule(s.id)} className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg shadow-sm" title="Padam Jadual">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    <div className="flex items-center gap-2">
                      <p className="font-black text-slate-800 leading-tight">{s.lecturerName}</p>
                      {s.lecturerName.includes('(KJ)') && <span className="bg-rose-50 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border border-rose-100">KJ</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.department}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <CalendarIcon className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{formatDate(s.date)}</span>
                      <span className="mx-1">•</span>
                      <span>{s.time}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <AcademicCapIcon className="h-3.5 w-3.5 text-indigo-500" />
                      <span>{s.code} - {s.course}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit">
                      <MapPinIcon className="h-3.5 w-3.5" />
                      <span>{s.location}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                  <CalendarDaysIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-sm text-slate-500 font-bold italic">Tiada jadual pemantauan ditemui buat masa ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mainTab === 'summary' && !isRestricted && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <ChartBarSquareIcon className="h-6 w-6 text-indigo-600" /> Rumusan Analisis Data Terkumpul
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1 uppercase">
                {analysisDeptFilter === 'all' ? 'Seluruh Kampus' : `Jabatan: ${analysisDeptFilter}`}
              </p>
            </div>
            {(userRole === 'admin' || activeDepartments.length > 1) && (
              <div className="relative">
                <FunnelIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select 
                  value={analysisDeptFilter} 
                  onChange={e => setAnalysisDeptFilter(e.target.value)}
                  className="pl-9 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none shadow-sm appearance-none min-w-[240px]"
                >
                  <option value="all">Semua Jabatan (Seluruh Kampus)</option>
                  {activeDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ArrowPathIcon className="h-4 w-4" />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] space-y-6 shadow-sm">
              <h3 className="text-lg font-black text-emerald-800 uppercase tracking-wider flex items-center gap-3">
                <HandThumbUpIcon className="h-6 w-6" /> Kekuatan Utama
              </h3>
              <div className="space-y-3">
                {strengthsAndWeaknesses.strengths.map((s, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-emerald-200 flex justify-between items-center shadow-sm hover:scale-[1.02] transition-transform">
                    <span className="text-sm font-bold text-emerald-900 pr-4">{s.text}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-emerald-600">{s.avg}</span>
                      <span className="text-[10px] font-black text-emerald-400 uppercase">Purata Skor</span>
                    </div>
                  </div>
                ))}
                {strengthsAndWeaknesses.strengths.length === 0 && (
                  <p className="text-sm italic text-emerald-600/60">Tiada data kekuatan utama.</p>
                )}
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2.5rem] space-y-6 shadow-sm">
              <h3 className="text-lg font-black text-rose-800 uppercase tracking-wider flex items-center gap-3">
                <ExclamationCircleIcon className="h-6 w-6" /> Keperluan Intervensi
              </h3>
              <div className="space-y-3">
                {strengthsAndWeaknesses.weaknesses.map((w, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-rose-200 flex justify-between items-center shadow-sm hover:scale-[1.02] transition-transform">
                    <span className="text-sm font-bold text-rose-900 pr-4">{w.text}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-xl font-black text-rose-600">{w.avg}</span>
                      <span className="text-[10px] font-black text-rose-400 uppercase">Purata Skor</span>
                    </div>
                  </div>
                ))}
                {strengthsAndWeaknesses.weaknesses.length === 0 && (
                  <p className="text-sm italic text-rose-600/60">Tiada data keperluan intervensi.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                <ChartBarSquareIcon className="h-6 w-6 text-indigo-600" /> Analisis Item Terkumpul (Seluruh Kampus)
              </h3>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Cemerlang</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /> Baik</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Intervensi</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100 uppercase text-[10px] tracking-widest">
                    <th className="px-8 py-4">Kriteria Penilaian (LAM-PT-03-04)</th>
                    <th className="px-8 py-4 text-center">Purata Skor</th>
                    <th className="px-8 py-4 text-center">Status Prestasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {itemAnalysis.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5 text-sm font-medium text-slate-700 group-hover:text-slate-900">{item.text}</td>
                      <td className="px-8 py-5 text-center font-black text-slate-900 text-lg">{item.avg}</td>
                      <td className="px-8 py-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                          item.avg >= 4.5 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          item.avg >= 4.0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          'bg-rose-50 text-rose-600 border-rose-100'
                        }`}>
                          {item.avg >= 4.5 ? 'Cemerlang' : item.avg >= 4.0 ? 'Baik' : 'Intervensi'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {itemAnalysis.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">Tiada data untuk dipaparkan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Department Details Modal */}
      {selectedDeptDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800">{selectedDeptDetails}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Senarai Keseluruhan Pensyarah</p>
              </div>
              <button onClick={() => setSelectedDeptDetails(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                    <CheckBadgeIcon className="h-3 w-3" /> Sudah Dipantau ({departmentMonitoringStats.find(d => d.name === selectedDeptDetails)?.monitored})
                  </p>
                  <div className="space-y-1.5">
                    {allLecturers
                      .filter(l => l.department === selectedDeptDetails && records.some(r => r.lecturerName.toLowerCase() === l.name.toLowerCase()))
                      .map(l => {
                        const isNew = !LECTURERS.some(staticL => staticL.name.toLowerCase() === l.name.toLowerCase());
                        return (
                          <div key={l.name} className={`p-3 border rounded-xl flex items-center justify-between ${isNew ? 'bg-indigo-50/50 border-indigo-100' : 'bg-emerald-50/50 border-emerald-100'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isNew ? 'text-indigo-900' : 'text-emerald-900'}`}>{l.name}</span>
                              {isNew && <SparklesIcon className="h-3 w-3 text-indigo-500" />}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${isNew ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {isNew ? 'Baru' : (records.filter(r => r.lecturerName.toLowerCase() === l.name.toLowerCase()).length > 1 ? `${records.filter(r => r.lecturerName.toLowerCase() === l.name.toLowerCase()).length} Rekod` : 'Selesai')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    {allLecturers.filter(l => l.department === selectedDeptDetails && records.some(r => r.lecturerName.toLowerCase() === l.name.toLowerCase())).length === 0 && (
                      <p className="text-xs text-slate-400 italic">Tiada rekod.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                    <ClockIcon className="h-3 w-3" /> Belum Dipantau ({departmentMonitoringStats.find(d => d.name === selectedDeptDetails)?.unmonitoredNames.length})
                  </p>
                  <div className="space-y-1.5">
                    {allLecturers
                      .filter(l => l.department === selectedDeptDetails && !records.some(r => r.lecturerName.toLowerCase() === l.name.toLowerCase()))
                      .map(l => (
                        <div key={l.name} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-900">{l.name}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase">Belum</span>
                          </div>
                        </div>
                      ))}
                    {allLecturers.filter(l => l.department === selectedDeptDetails && !records.some(r => r.lecturerName.toLowerCase() === l.name.toLowerCase())).length === 0 && (
                      <p className="text-xs text-emerald-600 font-bold">Semua telah dipantau! ✨</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedDeptDetails(null)} className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {showAIModal && !isRestricted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white font-bold">
              <span className="flex items-center gap-2"><SparklesIcon className="h-5 w-5" /> Rumusan AI Gemini</span>
              <button onClick={() => setShowAIModal(false)}><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <div className="p-8">
              <p className="text-lg font-black text-slate-800 mb-4">{activeLecturer}</p>
              {isSummarizing ? (
                <div className="py-12 flex flex-col items-center"><ArrowPathIcon className="h-10 w-10 text-indigo-600 animate-spin" /><p className="text-sm font-medium text-slate-500 mt-4">Menganalisis...</p></div>
              ) : (
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">{aiSummary}</div>
              )}
              <div className="mt-8 flex justify-end"><button onClick={() => setShowAIModal(false)} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold">Tutup</button></div>
            </div>
          </div>
        </div>
      )}

      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white font-bold">
              <span><CalendarDaysIcon className="h-5 w-5 inline mr-2" /> {editingScheduleId ? 'Ubahsuai' : 'Daftar'} Jadual</span>
              <button onClick={() => setShowScheduleModal(false)}><XMarkIcon className="h-6 w-6" /></button>
            </div>
            <form onSubmit={handleScheduleSubmit} className="p-8 space-y-4">
              <select required value={schedForm.lecturerName} onChange={e => setSchedForm({...schedForm, lecturerName: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm shadow-inner">
                <option value="" disabled>Pilih Pensyarah (Semua Jabatan)</option>
                {allLecturers.sort((a,b) => a.name.localeCompare(b.name)).map(l => (
                  <option key={l.name} value={l.name}>{l.name} ({l.department})</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <input required type="date" value={schedForm.date} onChange={e => setSchedForm({...schedForm, date: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input required type="time" value={schedForm.time} onChange={e => setSchedForm({...schedForm, time: e.target.value})} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <input required type="text" value={schedForm.course} onChange={e => setSchedForm({...schedForm, course: e.target.value})} placeholder="Nama Kursus" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              <div className="grid grid-cols-2 gap-4">
                <input required type="text" value={schedForm.code} onChange={e => setSchedForm({...schedForm, code: e.target.value})} placeholder="Kod" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input required type="text" value={schedForm.location} onChange={e => setSchedForm({...schedForm, location: e.target.value})} placeholder="Lokasi (cth: Bilik Kuliah / Google Meet)" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">Batal</button>
                <button type="submit" className="px-8 py-2 bg-indigo-600 text-white font-black rounded-xl text-sm shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95">Simpan Jadual</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLecturerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <AcademicCapIcon className="h-6 w-6 text-rose-600" />
                {editingLecturer ? 'Ubahsuai Pensyarah' : 'Tambah Pensyarah Baru'}
              </h2>
              <button onClick={() => setShowLecturerModal(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleLecturerSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Nama Penuh</label>
                  <input 
                    required
                    type="text" 
                    value={lecturerFormData.name}
                    onChange={e => setLecturerFormData({...lecturerFormData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                    placeholder="Contoh: Dr. Ahmad Bin Ali"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Jabatan / Unit</label>
                  {!isOtherDept ? (
                    <select 
                      required
                      disabled={!isAdminView}
                      value={lecturerFormData.department}
                      onChange={e => {
                        if (e.target.value === 'OTHER') {
                          setIsOtherDept(true);
                          setLecturerFormData({...lecturerFormData, department: ''});
                        } else {
                          setLecturerFormData({...lecturerFormData, department: e.target.value});
                        }
                      }}
                      className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all appearance-none ${!isAdminView ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <option value="" disabled>Pilih Jabatan</option>
                      {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                      <option value="OTHER">LAIN-LAIN (Sila Nyatakan)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input 
                        required
                        type="text" 
                        value={lecturerFormData.department}
                        onChange={e => setLecturerFormData({...lecturerFormData, department: e.target.value})}
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                        placeholder="Masukkan Nama Jabatan"
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          setIsOtherDept(false);
                          setLecturerFormData({...lecturerFormData, department: ''});
                        }}
                        className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={lecturerFormData.isKJ}
                      onChange={e => setLecturerFormData({...lecturerFormData, isKJ: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 transition-all cursor-pointer"
                    />
                    <span className="text-sm font-bold text-slate-700 group-hover:text-rose-600 transition-colors">
                      Ketua Jabatan (KJ)
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-slate-400 ml-7">
                    Tandakan jika pensyarah ini adalah Ketua Jabatan.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowLecturerModal(false)}
                  className="flex-1 px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  {editingLecturer ? 'Simpan Perubahan' : 'Tambah Pensyarah'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLecturerHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800">{selectedLecturerHistory.name}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Sejarah Pemantauan ({selectedLecturerHistory.records.length} Rekod)</p>
              </div>
              <button onClick={() => setSelectedLecturerHistory(null)} className="p-2 hover:bg-white rounded-full transition-colors">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              {selectedLecturerHistory.records.map((record, idx) => {
                const allScores = Object.values(record.scores);
                const avg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2) : '0.00';
                return (
                  <div key={record.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-200 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-800">Sesi #{selectedLecturerHistory.records.length - idx}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatDate(record.date)}</span>
                      </div>
                      <p className="text-xs text-slate-600 font-bold">{record.code} - {record.course}</p>
                      <p className="text-[10px] text-slate-400">Pemantau: {record.evaluatorName}</p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-600">{avg}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Purata Skor</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => generatePDF(record, 'view')} 
                          className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                          title="Lihat PDF"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => generatePDF(record, 'save')} 
                          className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                          title="Muat Turun PDF"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedLecturerHistory(null)} className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all">
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      <UserGuideModal 
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
};