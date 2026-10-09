import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EvaluationForm } from './components/EvaluationForm';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { UserGuideModal } from './components/UserGuideModal';
import { EvaluationRecord, MonitoringSchedule } from './types';
import { INITIAL_RECORDS, INITIAL_SCHEDULES, INITIAL_SIGNATURES, LECTURERS, CAMPUSES } from './constants';
import { 
  ClipboardDocumentCheckIcon, 
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
}

interface Lecturer {
  name: string;
  department: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      <div className="relative bg-white rounded-3xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in duration-300 shadow-2xl">
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="h-8 w-8 text-rose-600" />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed px-4">{message}</p>
        </div>
        <div className="flex border-t border-slate-100">
          <button 
            onClick={onClose}
            className="flex-1 px-6 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
          >
            Batal
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-6 py-4 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
          >
            {confirmText || 'Ya, Padam'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<{ username: string; department: string; role: 'admin' | 'user'; isRestricted?: boolean } | null>(() => {
    const saved = localStorage.getItem('ipgkpt_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [editingRecord, setEditingRecord] = useState<EvaluationRecord | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const isInitialLoad = useRef(true);
  
  const [records, setRecords] = useState<EvaluationRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(r => r.id !== '9x1p9rsg7' && r.date !== '2026-10-09');
          if (cleaned.length === 73 && cleaned.every(r => r.date === '2026-10-07')) return cleaned;
          if (cleaned.length >= 73) return cleaned;
        }
      }
    } catch {}
    return INITIAL_RECORDS;
  });
  const [schedules, setSchedules] = useState<MonitoringSchedule[]>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_schedules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 73 && parsed.some(s => s.date === '2026-10-07')) return parsed;
      }
    } catch {}
    return INITIAL_SCHEDULES;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLocalUpdate, setIsLocalUpdate] = useState({
    records: false,
    schedules: false,
    lecturers: false
  });
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [persistenceType, setPersistenceType] = useState<'supabase' | 'local_file' | 'unknown'>('unknown');
  const [supabaseStatus, setSupabaseStatus] = useState<string>('unknown');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lecturersList, setLecturersList] = useState<Lecturer[]>(() => {
    const saved = localStorage.getItem('ipgkpt_lecturers');
    return saved ? JSON.parse(saved) : LECTURERS;
  });
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_signatures');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
      }
    } catch {}
    return INITIAL_SIGNATURES;
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveSignature = async (name: string, signatureData: string) => {
    if (!name || !signatureData) return;
    const trimmed = name.trim();
    setSavedSignatures(prev => {
      const updated = { ...prev, [trimmed]: signatureData };
      try {
        localStorage.setItem('ipgkpt_signatures', JSON.stringify(updated));
      } catch (e) {
        console.warn("LocalStorage quota reached when saving signature:", e);
      }
      return updated;
    });

    try {
      await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [trimmed]: signatureData })
      });
    } catch (err) {
      console.warn("Could not sync signature to backend:", err);
    }
  };

  const handleDeleteSavedSignature = async (name: string) => {
    if (!name) return;
    const trimmed = name.trim();
    setSavedSignatures(prev => {
      const updated = { ...prev };
      delete updated[trimmed];
      try {
        localStorage.setItem('ipgkpt_signatures', JSON.stringify(updated));
      } catch (e) {
        console.warn("LocalStorage error on deleting signature:", e);
      }
      return updated;
    });

    try {
      await fetch('/api/signatures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [trimmed]: null })
      });
      showNotification(`Tandatangan profil untuk ${trimmed} berjaya dipadam.`, 'success');
    } catch (err) {
      console.warn("Could not sync signature deletion to backend:", err);
    }
  };

  // Safely sync records in batches to never exceed serverless 4.5MB payload limit (Vercel 413 prevention)
  const syncRecordsToServerSafely = useCallback(async (recordsToSync: EvaluationRecord[]) => {
    if (!Array.isArray(recordsToSync) || recordsToSync.length === 0) {
      return { success: true, count: 0 };
    }

    const payloadStr = JSON.stringify(recordsToSync);
    // If under 300KB and small record count, send directly
    if (payloadStr.length < 300000 && recordsToSync.length <= 15) {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error on /api/records: ${res.status} ${errText}`);
      }
      return res.json();
    }

    // Otherwise chunk into batches of 15 records (< 250KB per request)
    const CHUNK_SIZE = 15;
    const chunks: EvaluationRecord[][] = [];
    for (let i = 0; i < recordsToSync.length; i += CHUNK_SIZE) {
      chunks.push(recordsToSync.slice(i, i + CHUNK_SIZE));
    }

    const batchId = `b_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`[Sync] Chunking ${recordsToSync.length} records into ${chunks.length} batches (batch: ${batchId})...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkPayload = {
        action: 'chunk',
        batchId,
        chunkIndex: i,
        totalChunks: chunks.length,
        records: chunk
      };

      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkPayload)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error on /api/records (bahagian ${i + 1}/${chunks.length}): ${res.status} ${errText}`);
      }
    }

    console.log(`[Sync] Kesemua ${chunks.length} bahagian rekod berjaya dihantar.`);
    return { success: true, count: recordsToSync.length };
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    const isAnyLocalUpdate = isLocalUpdate.records || isLocalUpdate.schedules || isLocalUpdate.lecturers;
    if (isAnyLocalUpdate && isSilent) return; // Don't poll if we have unsynced local changes
    if (!isSilent) setIsSyncing(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/records'),
        fetch('/api/schedules'),
        fetch('/api/lecturers'),
        fetch('/api/health'),
        fetch('/api/signatures')
      ]);

      const [recordsSettled, schedulesSettled, lecturersSettled, healthSettled, signaturesSettled] = results;

      let anySuccess = false;

      if (healthSettled.status === 'fulfilled' && healthSettled.value.ok) {
        anySuccess = true;
        try {
          const health = await healthSettled.value.json();
          setPersistenceType(health.persistence);
          setSupabaseStatus(health.supabase_status);
          if (health.supabase_error) {
            setSyncError(`Supabase: ${health.supabase_error}`);
          }
        } catch (e) {
          console.warn("Failed to parse health data:", e);
        }
      }
      
      if (recordsSettled.status === 'fulfilled' && recordsSettled.value.ok) {
        anySuccess = true;
        try {
          const recordsData = await recordsSettled.value.json();
          if (Array.isArray(recordsData)) {
            const cleaned = recordsData.filter((r: any) => r.id !== '9x1p9rsg7' && r.date !== '2026-10-09');
            if (cleaned.length >= 73) {
              setRecords(cleaned);
              localStorage.setItem('ipgkpt_records', JSON.stringify(cleaned));
            } else if (cleaned.length > 0 && cleaned.length < 73) {
              const existingNames = new Set(cleaned.map((r: any) => r.lecturerName?.toLowerCase()));
              const missingFromInitial = INITIAL_RECORDS.filter(r => !existingNames.has(r.lecturerName.toLowerCase()));
              const merged = [...cleaned, ...missingFromInitial];
              setRecords(merged);
              localStorage.setItem('ipgkpt_records', JSON.stringify(merged));
              syncRecordsToServerSafely(merged).catch(console.error);
            } else {
              setRecords(INITIAL_RECORDS);
              localStorage.setItem('ipgkpt_records', JSON.stringify(INITIAL_RECORDS));
              syncRecordsToServerSafely(INITIAL_RECORDS).catch(console.error);
            }
          }
        } catch (e) {
          console.warn("Failed to parse records data:", e);
        }
      }

      if (schedulesSettled.status === 'fulfilled' && schedulesSettled.value.ok) {
        anySuccess = true;
        try {
          const schedulesData = await schedulesSettled.value.json();
          if (Array.isArray(schedulesData)) {
            if (schedulesData.length >= 73) {
              setSchedules(schedulesData);
              localStorage.setItem('ipgkpt_schedules', JSON.stringify(schedulesData));
            } else if (schedulesData.length > 0 && schedulesData.length < 73) {
              const existingNames = new Set(schedulesData.map((s: any) => s.lecturerName?.toLowerCase()));
              const missingFromInitial = INITIAL_SCHEDULES.filter(s => !existingNames.has(s.lecturerName.toLowerCase()));
              const merged = [...schedulesData, ...missingFromInitial];
              setSchedules(merged);
              localStorage.setItem('ipgkpt_schedules', JSON.stringify(merged));
              fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(merged)
              }).catch(console.error);
            } else {
              setSchedules(INITIAL_SCHEDULES);
              localStorage.setItem('ipgkpt_schedules', JSON.stringify(INITIAL_SCHEDULES));
              fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(INITIAL_SCHEDULES)
              }).catch(console.error);
            }
          }
        } catch (e) {
          console.warn("Failed to parse schedules data:", e);
        }
      }

      if (lecturersSettled.status === 'fulfilled' && lecturersSettled.value.ok) {
        anySuccess = true;
        try {
          const lecturersData = await lecturersSettled.value.json();
          if (Array.isArray(lecturersData)) {
            if (lecturersData.length > 0) {
              setLecturersList(lecturersData);
              localStorage.setItem('ipgkpt_lecturers', JSON.stringify(lecturersData));
            } else {
              const saved = localStorage.getItem('ipgkpt_lecturers');
              const localLecturers = saved ? JSON.parse(saved) : [];
              if (localLecturers.length > 0) {
                setLecturersList(localLecturers);
                fetch('/api/lecturers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(localLecturers)
                }).catch(console.error);
              } else {
                setLecturersList(LECTURERS);
                localStorage.setItem('ipgkpt_lecturers', JSON.stringify(LECTURERS));
              }
            }
          }
        } catch (e) {
          console.warn("Failed to parse lecturers data:", e);
        }
      }

      if (signaturesSettled.status === 'fulfilled' && signaturesSettled.value.ok) {
        anySuccess = true;
        try {
          const sigsData = await signaturesSettled.value.json();
          if (sigsData && typeof sigsData === 'object' && !Array.isArray(sigsData)) {
            setSavedSignatures(prev => {
              const merged = { ...prev, ...sigsData };
              try {
                localStorage.setItem('ipgkpt_signatures', JSON.stringify(merged));
              } catch (e) {
                console.warn("Storage quota warning on signatures:", e);
              }
              return merged;
            });
          }
        } catch (e) {
          console.warn("Failed to parse signatures data:", e);
        }
      }

      if (anySuccess) {
        // Successfully connected to backend and synced
        setSyncError(null);
      } else {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        setSyncError(isOffline 
          ? "Di luar talian (data selamat disimpan secara setempat)" 
          : "Sambungan pelayan tergendala seketika (menggunakan data setempat)"
        );
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      setSyncError(isOffline 
        ? "Di luar talian (data selamat disimpan secara setempat)" 
        : `Sambungan pelayan tergendala: ${error.message || 'Sila cuba lagi'}`
      );
    } finally {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
      setIsSyncing(false);
      setLastSync(new Date());
    }
  }, [isLocalUpdate]);
  
  // Initial data fetch and polling
  useEffect(() => {
    fetchData();

    // Polling every 20 seconds for faster sync across devices
    const interval = setInterval(() => fetchData(true), 20000);

    const handleOnline = () => {
      console.log("[App] Network back online, syncing...");
      setSyncError(null);
      fetchData(false);
    };

    const handleOffline = () => {
      console.log("[App] Network offline.");
      setSyncError("Di luar talian (data selamat disimpan secara setempat)");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  const handleLogin = (userData: { username: string; department: string; role: 'admin' | 'user' }, remember: boolean) => {
    setUser(userData);
    if (remember) {
      localStorage.setItem('ipgkpt_user', JSON.stringify(userData));
      localStorage.setItem('ipgkpt_saved_username', userData.username);
    }
    // Always default to dashboard on login
    setView('dashboard');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      await Promise.all([
        syncRecordsToServerSafely(records),
        fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(schedules)
        }),
        fetch('/api/lecturers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lecturersList)
        })
      ]);
      setLastSync(new Date());
      showNotification('Semua data pemantauan berjaya disegerakkan ke pelayan!', 'success');
    } catch (e: any) {
      setSyncError(`Manual Sync Failed: ${e.message}`);
      showNotification(`Gagal menyegerakkan data: ${e.message}`, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetrySync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    showNotification('Sedang menyelaraskan semula data ke pelayan...');
    const success = await syncData(records, schedules, lecturersList);
    if (success) {
      showNotification('Data pemantauan berjaya diselaraskan ke pelayan!', 'success');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ipgkpt_user');
  };
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'record' | 'lecturer' | 'schedule' | 'restore' | null;
    targetId: string | null;
    title: string;
    message: string;
    confirmText?: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    title: '',
    message: '',
    confirmText: ''
  });

  const handleOpenRestoreConfirm = () => {
    setConfirmModal({
      isOpen: true,
      type: 'restore',
      targetId: 'all',
      title: 'Pulihkan Data Pemantauan (73 Pensyarah)',
      message: 'Adakah anda pasti untuk memulihkan rekod pemantauan bagi 73 orang pensyarah bertarikh 7.10.2026? Tindakan ini akan menyelaraskan semula data setempat dan pangkalan data Supabase secara lengkap.',
      confirmText: 'Ya, Pulihkan Sekarang'
    });
  };

  const syncData = async (
    updatedRecords: EvaluationRecord[], 
    updatedSchedules: MonitoringSchedule[], 
    updatedLecturers: Lecturer[]
  ) => {
    console.log(`[Sync] Starting sync. Records: ${updatedRecords.length}, Schedules: ${updatedSchedules.length}, Lecturers: ${updatedLecturers.length}`);
    
    // Update localStorage immediately with quota protection
    try {
      localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
      localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
    } catch (storageError) {
      console.warn("[Sync] LocalStorage write error (quota reached), relying on server sync:", storageError);
    }

    try {
      setIsSyncing(true);
      
      // Perform requests sequentially or with better error tracking
      const syncRequest = async (path: string, data: any) => {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server error on ${path}: ${res.status} ${errText}`);
        }
        return res.json();
      };

      await Promise.all([
        syncRecordsToServerSafely(updatedRecords),
        syncRequest('/api/lecturers', updatedLecturers),
        syncRequest('/api/schedules', updatedSchedules)
      ]);

      console.log("[Sync] Sync successful.");
      setIsLocalUpdate({ records: false, schedules: false, lecturers: false });
      setSyncError(null);
      setLastSync(new Date());
      return true;
    } catch (error: any) {
      console.error("[Sync] Sync failed:", error);
      setSyncError(`Data disimpan secara lokal tetapi gagal dihantar ke pelayan: ${error.message}`);
      showNotification('Data disimpan secara lokal. Ia akan dihantar ke pelayan apabila talian pulih.', 'error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddRecord = async (record: EvaluationRecord) => {
    console.log("[App] handleAddRecord called", record.id);
    // Set local update flag immediately
    setIsLocalUpdate(prev => ({ ...prev, records: true }));
    
    const trimmedName = record.lecturerName.trim();
    const normalizedRecord = { ...record, lecturerName: trimmedName };
    
    // Save both signatures to persistent library so they are never lost
    if (record.lecturerSignature && trimmedName) {
      handleSaveSignature(trimmedName, record.lecturerSignature);
    }
    if (record.evaluatorSignature && record.evaluatorName?.trim()) {
      handleSaveSignature(record.evaluatorName.trim(), record.evaluatorSignature);
    }
    
    // Update local states first for immediate UI feedback
    const updatedLecturers = [...lecturersList];
    const existingLecturerIndex = updatedLecturers.findIndex(l => l.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (existingLecturerIndex !== -1) {
      if (updatedLecturers[existingLecturerIndex].department !== record.department) {
        updatedLecturers[existingLecturerIndex] = { ...updatedLecturers[existingLecturerIndex], department: record.department };
      }
    } else if (trimmedName) {
      updatedLecturers.push({ name: trimmedName, department: record.department });
    }
    
    const isEdit = records.some(r => r.id === record.id);
    const updatedRecords = isEdit
      ? records.map(r => r.id === record.id ? normalizedRecord : r)
      : [normalizedRecord, ...records];

    const updatedSchedules = schedules.map(s => (
      s.lecturerName.toLowerCase() === normalizedRecord.lecturerName.toLowerCase() && 
      s.department === normalizedRecord.department &&
      s.date === normalizedRecord.date
    ) ? { ...s, status: 'Completed' as const } : s);

    // Update state
    setLecturersList(updatedLecturers);
    setRecords(updatedRecords);
    setSchedules(updatedSchedules);

    // Sync
    const success = await syncData(updatedRecords, updatedSchedules, updatedLecturers);
    
    if (isEdit) {
      showNotification(`Rekod pemantauan untuk ${trimmedName} telah berjaya dikemaskini!`, 'success');
    } else if (normalizedRecord.lecturerSignature && normalizedRecord.evaluatorSignature) {
      showNotification(`Rekod penilaian untuk ${trimmedName} dan kedua-dua tandatangan berjaya disimpan!`, 'success');
    } else if (normalizedRecord.evaluatorSignature) {
      showNotification(`Rekod penilaian untuk ${trimmedName} berjaya disimpan! (Status: Menunggu tandatangan pensyarah)`, 'success');
    } else {
      showNotification(`Draf rekod penilaian untuk ${trimmedName} telah selamat disimpan!`, 'success');
    }
    
    setEditingRecord(null);
    setView('dashboard');
  };

  const handleStartEvaluation = (preset?: {
    lecturerName?: string;
    department?: string;
    course?: string;
    code?: string;
    date?: string;
  }) => {
    const targetDept = preset?.department || (user?.role === 'admin' ? '' : user?.department || '');
    const targetLecturer = preset?.lecturerName || '';
    const template: EvaluationRecord = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      campus: CAMPUSES[0],
      department: targetDept,
      lecturerName: targetLecturer,
      course: preset?.course || '',
      code: preset?.code || '',
      credit: '',
      date: preset?.date || new Date().toISOString().split('T')[0],
      evaluatorName: user?.username || '',
      remarks: '',
      scores: {},
      itemRemarks: {},
      lecturerSignature: targetLecturer ? (savedSignatures[targetLecturer.trim()] || '') : '',
      evaluatorSignature: user?.username ? (savedSignatures[user.username.trim()] || '') : ''
    };
    setEditingRecord(template);
    setView('form');
  };

  const handleAddSchedule = async (schedule: MonitoringSchedule) => {
    const updatedSchedules = [schedule, ...schedules];
    setSchedules(updatedSchedules);
    setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
    await syncData(records, updatedSchedules, lecturersList);
    showNotification('Jadual pemantauan telah berjaya didaftarkan.');
  };

  const handleUpdateSchedule = async (updatedSchedule: MonitoringSchedule) => {
    const updatedSchedules = schedules.map((s: MonitoringSchedule) => s.id === updatedSchedule.id ? updatedSchedule : s);
    setSchedules(updatedSchedules);
    setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
    await syncData(records, updatedSchedules, lecturersList);
    showNotification('Jadual pemantauan telah berjaya dikemaskini.');
  };

  const handleEditRecord = (record: EvaluationRecord) => {
    setEditingRecord(record);
    setView('form');
  };

  const handleUpdateLecturer = async (oldName: string, oldDept: string, updatedLecturer: Lecturer) => {
    const isMonitor = user?.role === 'admin' || (user?.role === 'user' && user?.username.toLowerCase() !== 'pensyarah');
    if (!isMonitor) {
      alert('Hanya Admin atau Pemantau dibenarkan mengemaskini maklumat pensyarah.');
      return;
    }
    
    const updatedLecturers = lecturersList.map(l => (l.name === oldName && l.department === oldDept) ? updatedLecturer : l);
    let updatedRecords = [...records];
    let updatedSchedules = [...schedules];

    if (oldName !== updatedLecturer.name || oldDept !== updatedLecturer.department) {
      updatedRecords = records.map(r => (r.lecturerName === oldName && r.department === oldDept) ? { ...r, lecturerName: updatedLecturer.name, department: updatedLecturer.department } : r);
      updatedSchedules = schedules.map(s => (s.lecturerName === oldName && s.department === oldDept) ? { ...s, lecturerName: updatedLecturer.name, department: updatedLecturer.department } : s);
    }

    setLecturersList(updatedLecturers);
    setRecords(updatedRecords);
    setSchedules(updatedSchedules);
    
    setIsLocalUpdate({ records: true, schedules: true, lecturers: true });
    await syncData(updatedRecords, updatedSchedules, updatedLecturers);
    showNotification('Maklumat pensyarah telah berjaya dikemaskini.');
  };

  const handleAddLecturer = async (lecturer: Lecturer) => {
    const isMonitor = user?.role === 'admin' || (user?.role === 'user' && user?.username.toLowerCase() !== 'pensyarah');
    if (!isMonitor) {
      alert('Hanya Admin atau Pemantau dibenarkan menambah pensyarah.');
      return;
    }

    if (lecturersList.some(l => l.name.toLowerCase() === lecturer.name.toLowerCase() && l.department === lecturer.department)) {
      alert('Nama pensyarah dan jabatan ini sudah wujud dalam senarai.');
      return;
    }

    const updatedLecturers = [...lecturersList, lecturer];
    setLecturersList(updatedLecturers);
    setIsLocalUpdate(prev => ({ ...prev, lecturers: true }));
    await syncData(records, schedules, updatedLecturers);
    showNotification('Pensyarah baru telah berjaya ditambah.');
  };

  const openDeleteRecordConfirm = (id: string) => {
    const record = records.find(r => r.id === id);
    setConfirmModal({
      isOpen: true,
      type: 'record',
      targetId: id,
      title: 'Padam Rekod Penilaian?',
      message: `Tindakan ini akan memadam rekod penilaian bagi ${record?.lecturerName} secara kekal.`
    });
  };

  const openDeleteLecturerConfirm = (name: string, department: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'lecturer',
      targetId: `${name}|${department}`,
      title: 'Padam Pensyarah?',
      message: `Adakah anda pasti mahu memadam "${name}" dari jabatan "${department}"? Rekod sedia ada akan KEKAL dalam arkib.`
    });
  };

  const openDeleteScheduleConfirm = (id: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'schedule',
      targetId: id,
      title: 'Padam Jadual?',
      message: `Tindakan ini akan memadam pendaftaran jadual pemantauan ini.`
    });
  };

  const handleConfirmedDelete = async () => {
    if (confirmModal.type === 'restore') {
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setIsSyncing(true);
      try {
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          setRecords(INITIAL_RECORDS);
          setSchedules(INITIAL_SCHEDULES);
          localStorage.setItem('ipgkpt_records', JSON.stringify(INITIAL_RECORDS));
          localStorage.setItem('ipgkpt_schedules', JSON.stringify(INITIAL_SCHEDULES));
          showNotification('Berjaya memulihkan 73 rekod pemantauan pensyarah (7.10.2026)!', 'success');
        } else {
          showNotification(`Gagal memulihkan: ${data.error || 'Ralat server'}`, 'error');
        }
      } catch (err: any) {
        setRecords(INITIAL_RECORDS);
        setSchedules(INITIAL_SCHEDULES);
        localStorage.setItem('ipgkpt_records', JSON.stringify(INITIAL_RECORDS));
        localStorage.setItem('ipgkpt_schedules', JSON.stringify(INITIAL_SCHEDULES));
        showNotification('Data 73 orang pensyarah berjaya dipulihkan.', 'success');
      } finally {
        setIsSyncing(false);
        setLastSync(new Date());
      }
      return;
    }

    const isMonitor = user?.role === 'admin' || (user?.role === 'user' && user?.username.toLowerCase() !== 'pensyarah');
    if (!isMonitor && (confirmModal.type === 'record' || confirmModal.type === 'lecturer')) {
      alert('Hanya Admin atau Pemantau dibenarkan memadam rekod atau pensyarah.');
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      return;
    }

    let updatedRecords = [...records];
    let updatedLecturers = [...lecturersList];
    let updatedSchedules = [...schedules];

    if (confirmModal.type === 'record' && confirmModal.targetId) {
      updatedRecords = records.filter((r: EvaluationRecord) => r.id !== confirmModal.targetId);
      setRecords(updatedRecords);
      setIsLocalUpdate(prev => ({ ...prev, records: true }));
    } else if (confirmModal.type === 'lecturer' && confirmModal.targetId) {
      const [name, dept] = confirmModal.targetId.split('|');
      updatedLecturers = lecturersList.filter((l: Lecturer) => !(l.name === name && l.department === dept));
      setLecturersList(updatedLecturers);
      setIsLocalUpdate(prev => ({ ...prev, lecturers: true }));
    } else if (confirmModal.type === 'schedule' && confirmModal.targetId) {
      updatedSchedules = schedules.filter((s: MonitoringSchedule) => s.id !== confirmModal.targetId);
      setSchedules(updatedSchedules);
      setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
    }

    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Sync to server
    await syncData(updatedRecords, updatedSchedules, updatedLecturers);
  };

  // Restricted user identification
  const isRestrictedUser = !!user?.isRestricted || (user?.username.toLowerCase() === 'pensyarah' && user?.role === 'user');

  // Improved filtering to handle universal 'SEMUA' access
  const accessibleRecords = (user?.role === 'admin' || (user?.department === 'SEMUA' && !isRestrictedUser))
    ? records 
    : isRestrictedUser 
      ? [] // Restricted user gets ZERO evaluation records
      : records.filter(r => r.department === user?.department);

  const accessibleLecturers = (user?.role === 'admin' || user?.department === 'SEMUA')
    ? lecturersList 
    : lecturersList.filter((l: Lecturer) => l.department === user?.department);

  const accessibleSchedules = (user?.role === 'admin' || user?.department === 'SEMUA')
    ? schedules
    : schedules.filter(s => s.department === user?.department);

  if (!user) return <Login onLogin={handleLogin} onShowGuide={() => setShowGuideModal(true)} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {isSyncing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full mx-4 border border-slate-100">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CloudArrowUpIcon className="h-6 w-6 text-indigo-600 animate-bounce" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-800">Menyimpan Data...</h3>
              <p className="text-sm text-slate-500 mt-1">Sila tunggu sebentar sementara sistem menyelaraskan data anda ke pelayan.</p>
            </div>
          </div>
        </div>
      )}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => {
              setView('dashboard');
              setEditingRecord(null);
            }}>
              <div className="bg-indigo-600 p-2 rounded-lg group-hover:bg-indigo-700 transition-colors relative">
                <ClipboardDocumentCheckIcon className="h-6 w-6 text-white" />
                {isSyncing && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" title="Syncing..." />
                )}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">PINTAR-Dash</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                  {isRestrictedUser ? 'Akses Terhad' : user.role === 'admin' ? 'Superuser' : user.department}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                <UserCircleIcon className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">{user.username}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${syncError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {syncError ? 'Ralat Penyelarasan' : 'Sistem Dalam Talian'}
                </span>
                {lastSync && (
                  <span className="text-[9px] text-slate-400">
                    • Terakhir: {lastSync.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setView('dashboard'); setEditingRecord(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    view === 'dashboard' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Dashboard
                </button>
                
                {editingRecord ? (
                  <div className="flex items-center gap-1.5">
                    <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <PencilSquareIcon className="h-4 w-4 text-amber-600" />
                      Kemaskini: {editingRecord.lecturerName.split(' ')[0]}
                    </span>
                    <button
                      onClick={() => { setEditingRecord(null); setView('dashboard'); }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                      title="Batal pengemaskinian dan kembali ke Dashboard"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  !isRestrictedUser && (
                    <button
                      onClick={() => { setEditingRecord(null); setView('form'); }}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        view === 'form' && !editingRecord ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      + Borang
                    </button>
                  )
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors ml-2"
                  title="Log Keluar"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Admin Debug Info */}
        {user.role === 'admin' && syncError && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2 text-rose-700 mb-2">
              <ExclamationCircleIcon className="h-5 w-5" />
              <h4 className="font-bold text-sm uppercase">Maklumat Ralat Penyelarasan (Admin Sahaja)</h4>
            </div>
            <p className="text-xs text-rose-600 font-mono break-all">{syncError}</p>
            <button 
              onClick={() => handleRetrySync()} 
              className="mt-3 text-[10px] font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg hover:bg-rose-700 transition-all flex items-center gap-1 shadow-sm"
            >
              <ArrowPathIcon className="h-3 w-3" /> Cuba Lagi Sekarang
            </button>
          </div>
        )}

        {view === 'dashboard' ? (
          <Dashboard 
            records={accessibleRecords} 
            schedules={accessibleSchedules}
            lecturers={accessibleLecturers}
            allLecturers={(user.role === 'admin' || user.department === 'SEMUA') ? lecturersList : accessibleLecturers}
            userRole={user.role}
            username={user.username}
            userDept={user.department}
            isRestrictedUser={isRestrictedUser}
            onDeleteRecord={openDeleteRecordConfirm} 
            onDeleteLecturer={openDeleteLecturerConfirm}
            onDeleteSchedule={openDeleteScheduleConfirm}
            onEditRecord={handleEditRecord}
            onStartEvaluation={handleStartEvaluation}
            onAddSchedule={handleAddSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onAddLecturer={handleAddLecturer}
            onUpdateLecturer={handleUpdateLecturer}
            onRefresh={() => fetchData()}
            onRestoreData={handleOpenRestoreConfirm}
            lastSync={lastSync}
          />
        ) : (
          <div className="max-w-4xl mx-auto">
            <button 
              onClick={() => { setView('dashboard'); setEditingRecord(null); }}
              className="flex items-center text-indigo-600 hover:text-indigo-800 mb-6 font-bold transition-all group"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1 group-hover:-translate-x-1 transition-transform" />
              Kembali ke Dashboard
            </button>
            <EvaluationForm 
              onSubmit={handleAddRecord} 
              onCancel={() => { setEditingRecord(null); setView('dashboard'); }}
              lecturers={accessibleLecturers} 
              userDept={user.department}
              isAdmin={user.role === 'admin' || user.department === 'SEMUA'}
              username={user.username}
              initialData={editingRecord || undefined} 
              onNotification={showNotification}
              savedSignatures={savedSignatures}
              onSaveSignature={handleSaveSignature}
              onDeleteSavedSignature={handleDeleteSavedSignature}
            />
          </div>
        )}
      </main>
      
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmedDelete}
      />

      <UserGuideModal 
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
            notification.type === 'success' 
              ? 'bg-emerald-600 border-emerald-500 text-white' 
              : 'bg-rose-600 border-rose-500 text-white'
          }`}>
            {notification.type === 'success' ? (
              <CheckBadgeIcon className="h-5 w-5" />
            ) : (
              <ExclamationCircleIcon className="h-5 w-5" />
            )}
            <p className="text-sm font-bold">{notification.message}</p>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-6 mt-12 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-400 font-medium italic">
              {isRestrictedUser ? 'Akses Terhad: Daftar Jadual Sahaja' : `Data diproses untuk (${user.department}). Log keluar untuk bertukar akses.`}
            </p>
            {user.role === 'admin' && persistenceType === 'local_file' && (
              <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                <ExclamationTriangleIcon className="h-3 w-3" /> 
                Amaran: Menggunakan storan sementara. Sila konfigurasi Supabase untuk simpanan kekal.
              </p>
            )}
            {syncError && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <ExclamationCircleIcon className="h-3 w-3" /> 
                Ralat: {syncError}
              </p>
            )}
            {persistenceType === 'supabase' && (
              <div className="flex items-center gap-3">
                <p className={`text-[9px] font-bold flex items-center gap-1 ${supabaseStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {supabaseStatus === 'connected' ? <CheckBadgeIcon className="h-3 w-3" /> : <ExclamationTriangleIcon className="h-3 w-3" />}
                  Supabase: {supabaseStatus === 'connected' ? 'Berhubung & Aktif' : `Masalah Sambungan (${supabaseStatus})`}
                  {supabaseStatus !== 'connected' && syncError && (
                    <span className="text-red-500 ml-1">[{syncError}]</span>
                  )}
                </p>
                <button 
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 font-bold transition-colors disabled:opacity-50"
                >
                  {isSyncing ? 'Menyimpan...' : 'Simpan Sekarang'}
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;