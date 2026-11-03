import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EvaluationForm } from './components/EvaluationForm';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { UserGuideModal } from './components/UserGuideModal';
import { SavedRecordSuccessModal } from './components/SavedRecordSuccessModal';
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
  const [recentlySavedId, setRecentlySavedId] = useState<string | null>(null);
  const [recentlySavedAction, setRecentlySavedAction] = useState<'created' | 'updated' | null>(null);
  const [savedSuccessModal, setSavedSuccessModal] = useState<{ record: EvaluationRecord; isEdit: boolean } | null>(null);
  const isInitialLoad = useRef(true);
  
  const [records, setRecords] = useState<EvaluationRecord[]>(() => {
    try {
      const deletedIds = new Set<string>(JSON.parse(localStorage.getItem('ipgkpt_deleted_records') || '[]'));
      const saved = localStorage.getItem('ipgkpt_records');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => r && r.id && !deletedIds.has(r.id) && r.id !== '9x1p9rsg7');
        }
      }
      return INITIAL_RECORDS.filter(r => !deletedIds.has(r.id));
    } catch {}
    return INITIAL_RECORDS;
  });
  const [schedules, setSchedules] = useState<MonitoringSchedule[]>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_schedules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
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
  const [lastSync, setLastSync] = useState<Date | null>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_last_sync');
      if (saved) return new Date(saved);
    } catch {}
    return null;
  });
  const [persistenceType, setPersistenceType] = useState<'supabase' | 'local_file' | 'unknown'>('unknown');
  const [supabaseStatus, setSupabaseStatus] = useState<string>('unknown');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lecturersList, setLecturersList] = useState<Lecturer[]>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_lecturers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return LECTURERS;
  });
  // Ruangan tandatangan tersimpan untuk kegunaan merentasi semua peranti
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('ipgkpt_signatures');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return {};
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

  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  const notifyDataChanged = useCallback(() => {
    try {
      syncChannelRef.current?.postMessage({ type: 'DATA_CHANGED', time: Date.now() });
    } catch {}
  }, []);


  // Safely sync records in atomic requests up to 3.5MB (Vercel limit 4.5MB, local Express 50MB)
  const syncRecordsToServerSafely = useCallback(async (recordsToSync: EvaluationRecord[]) => {
    if (!Array.isArray(recordsToSync)) {
      return { success: false, count: 0 };
    }

    if (recordsToSync.length === 0) {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server error on /api/records: ${res.status} ${errText}`);
      }
      return res.json();
    }

    const payloadStr = JSON.stringify(recordsToSync);
    // Send in single atomic request for payloads under 3.5MB (fast, reliable, and consistent)
    if (payloadStr.length < 3.5 * 1024 * 1024) {
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

    // Fallback chunking only for massive payloads > 3.5MB
    const CHUNK_SIZE = 25;
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
    if (!isSilent) setIsSyncing(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/records'),
        fetch('/api/schedules'),
        fetch('/api/lecturers'),
        fetch('/api/health'),
        fetch('/api/signatures'),
        fetch('/api/deleted-schedules'),
        fetch('/api/deleted-records')
      ]);

      const [recordsSettled, schedulesSettled, lecturersSettled, healthSettled, signaturesSettled, deletedSchedsSettled, deletedRecsSettled] = results;

      let anySuccess = false;

      // Parse server-side deleted schedule IDs for cross-device synchronization
      const deletedSchedIds = new Set<string>();
      try {
        const savedDel = localStorage.getItem('ipgkpt_deleted_schedules');
        if (savedDel) {
          const parsedDel = JSON.parse(savedDel);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach((id: string) => deletedSchedIds.add(id));
          }
        }
      } catch {}

      if (deletedSchedsSettled && deletedSchedsSettled.status === 'fulfilled' && deletedSchedsSettled.value.ok) {
        try {
          const serverDeletedScheds = await deletedSchedsSettled.value.json();
          if (Array.isArray(serverDeletedScheds)) {
            serverDeletedScheds.forEach((id: string) => deletedSchedIds.add(id));
          }
        } catch (e) {
          console.warn("Failed to parse deleted schedules data:", e);
        }
      }

      // Persist the combined set of deleted schedule IDs back to localStorage
      try {
        localStorage.setItem('ipgkpt_deleted_schedules', JSON.stringify(Array.from(deletedSchedIds)));
      } catch {}

      // Parse server-side deleted evaluation record IDs for cross-device synchronization
      const deletedRecordIds = new Set<string>();
      try {
        const savedDelR = localStorage.getItem('ipgkpt_deleted_records');
        if (savedDelR) {
          const parsedDelR = JSON.parse(savedDelR);
          if (Array.isArray(parsedDelR)) {
            parsedDelR.forEach((id: string) => deletedRecordIds.add(id));
          }
        }
      } catch {}

      if (deletedRecsSettled && deletedRecsSettled.status === 'fulfilled' && deletedRecsSettled.value.ok) {
        try {
          const serverDeletedRecs = await deletedRecsSettled.value.json();
          if (Array.isArray(serverDeletedRecs)) {
            serverDeletedRecs.forEach((id: string) => deletedRecordIds.add(id));
          }
        } catch (e) {
          console.warn("Failed to parse deleted records data:", e);
        }
      }

      // Persist the combined set of deleted record IDs back to localStorage
      try {
        localStorage.setItem('ipgkpt_deleted_records', JSON.stringify(Array.from(deletedRecordIds)));
      } catch {}

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
            // Server records filtered by deletedRecordIds
            const cleanedServer = recordsData.filter((r: any) => 
              r && r.id && !deletedRecordIds.has(r.id) && r.id !== '9x1p9rsg7'
            );
            
            // Read and purge local records of any deleted IDs so deleted records NEVER resurrect across devices
            let localRecords: EvaluationRecord[] = [];
            try {
              const saved = localStorage.getItem('ipgkpt_records');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                  localRecords = parsed.filter(r => r && r.id && !deletedRecordIds.has(r.id) && r.id !== '9x1p9rsg7');
                }
              }
            } catch {}

            const recMap = new Map<string, EvaluationRecord>();
            cleanedServer.forEach(r => { if (r && r.id && !deletedRecordIds.has(r.id)) recMap.set(r.id, r); });

            let hasNewerLocal = false;
            localRecords.forEach(loc => {
              if (!loc || !loc.id || deletedRecordIds.has(loc.id)) return;
              const existing = recMap.get(loc.id);
              if (!existing) {
                // Only if newly added record locally that was NEVER deleted
                recMap.set(loc.id, loc);
                hasNewerLocal = true;
              } else if ((loc.timestamp || 0) > (existing.timestamp || 0)) {
                recMap.set(loc.id, loc);
                hasNewerLocal = true;
              }
            });

            const mergedRecords = Array.from(recMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setRecords(mergedRecords);
            try {
              localStorage.setItem('ipgkpt_records', JSON.stringify(mergedRecords));
            } catch {}

            if (hasNewerLocal) {
              syncRecordsToServerSafely(mergedRecords).catch(console.error);
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
            // Read and purge local schedules of any deleted IDs so deleted schedules NEVER resurrect across devices
            let localSchedules: MonitoringSchedule[] = [];
            try {
              const saved = localStorage.getItem('ipgkpt_schedules');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                  localSchedules = parsed.filter(s => s && s.id && !deletedSchedIds.has(s.id));
                }
              }
            } catch {}

            const schedMap = new Map<string, MonitoringSchedule>();
            schedulesData.forEach(s => { 
              if (s && s.id && !deletedSchedIds.has(s.id)) schedMap.set(s.id, s); 
            });

            let hasNewerLocal = false;
            localSchedules.forEach(loc => {
              if (!loc || !loc.id || deletedSchedIds.has(loc.id)) return;
              const existing = schedMap.get(loc.id);
              if (!existing) {
                // Only if newly added schedule locally that was never deleted
                schedMap.set(loc.id, loc);
                hasNewerLocal = true;
              } else if (loc.status === 'Completed' && existing.status !== 'Completed') {
                schedMap.set(loc.id, loc);
                hasNewerLocal = true;
              } else if ((loc.timestamp || 0) > (existing.timestamp || 0)) {
                schedMap.set(loc.id, loc);
                hasNewerLocal = true;
              }
            });

            const mergedSchedules = Array.from(schedMap.values());
            setSchedules(mergedSchedules);
            try {
              localStorage.setItem('ipgkpt_schedules', JSON.stringify(mergedSchedules));
            } catch {}

            if (hasNewerLocal) {
              fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mergedSchedules)
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
          if (Array.isArray(lecturersData) && lecturersData.length > 0) {
            setLecturersList(lecturersData);
            try {
              localStorage.setItem('ipgkpt_lecturers', JSON.stringify(lecturersData));
            } catch {}
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
  }, [syncRecordsToServerSafely]);
  
  // Initial data fetch and polling
  useEffect(() => {
    fetchData();

    // Fast polling every 4 seconds when tab is active for near instant sync across devices
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchData(true);
      }
    }, 4000);

    const handleFocus = () => {
      fetchData(true);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchData(true);
      }
    };

    const handleOnline = () => {
      console.log("[App] Network back online, syncing...");
      setSyncError(null);
      fetchData(false);
    };

    const handleOffline = () => {
      console.log("[App] Network offline.");
      setSyncError("Di luar talian (data selamat disimpan secara setempat)");
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData]);

  // Real-time synchronization across browser tabs
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('ipgkpt_epantau_sync');
      channel.onmessage = (event) => {
        if (event.data?.type === 'DATA_CHANGED') {
          fetchData(true);
        }
      };
      syncChannelRef.current = channel;
      return () => {
        channel.close();
      };
    }
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
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      // 1. Kumpulkan rekod & jadual yang dipadam untuk dihantar ke pelayan
      let deletedSchedIds: string[] = [];
      try {
        const savedDel = localStorage.getItem('ipgkpt_deleted_schedules');
        if (savedDel) {
          const parsed = JSON.parse(savedDel);
          if (Array.isArray(parsed)) deletedSchedIds = parsed;
        }
      } catch {}

      let deletedRecIds: string[] = [];
      try {
        const savedDelR = localStorage.getItem('ipgkpt_deleted_records');
        if (savedDelR) {
          const parsed = JSON.parse(savedDelR);
          if (Array.isArray(parsed)) deletedRecIds = parsed;
        }
      } catch {}

      // 2. Hantar perubahan setempat ke pelayan (records, schedules, lecturers, signatures, deleted_schedules, deleted_records)
      const pushPromises: Promise<any>[] = [
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
        }),
        fetch('/api/signatures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(savedSignatures)
        })
      ];

      if (deletedSchedIds.length > 0) {
        pushPromises.push(
          fetch('/api/deleted-schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deletedSchedIds)
          })
        );
      }

      if (deletedRecIds.length > 0) {
        pushPromises.push(
          fetch('/api/deleted-records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deletedRecIds)
          })
        );
      }

      await Promise.allSettled(pushPromises);

      // 3. Muat turun data terkini dari pelayan agar peranti ini mendapat data terbaharu dari peranti lain
      await fetchData(false);

      // 4. Maklumkan semua tab pelayar lain pada peranti ini
      notifyDataChanged();

      const now = new Date();
      setLastSync(now);
      try {
        localStorage.setItem('ipgkpt_last_sync', now.toISOString());
      } catch {}

      showNotification('Penyelarasan berjaya! Data terkini kini selaras merentasi Laptop, Telefon Pintar (Android & iOS) dan Komputer (Windows & Mac).', 'success');
    } catch (e: any) {
      console.error("Manual sync failed:", e);
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        showNotification('Di luar talian: Data pemantauan disimpan selamat dalam peranti ini dan akan diselaraskan automatik apabila sambungan kembali.', 'success');
      } else {
        setSyncError(`Ralat Penyelarasan: ${e.message || 'Sila cuba lagi'}`);
        showNotification(`Gagal menyegerakkan data: ${e.message || 'Sila semak sambungan rangkaian'}`, 'error');
      }
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
    type: 'record' | 'multiple_records' | 'lecturer' | 'multiple_lecturers' | 'schedule' | 'multiple_schedules' | 'restore' | null;
    targetId: string | null;
    targetRecordIds?: string[];
    targetLecturers?: { name: string; department: string }[];
    targetScheduleIds?: string[];
    title: string;
    message: string;
    confirmText?: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    targetRecordIds: undefined,
    targetLecturers: undefined,
    targetScheduleIds: undefined,
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
    updatedLecturers: Lecturer[],
    options?: { syncRecords?: boolean; syncSchedules?: boolean; syncLecturers?: boolean }
  ) => {
    const doRecords = options?.syncRecords !== false;
    const doSchedules = options?.syncSchedules !== false;
    const doLecturers = options?.syncLecturers !== false;

    console.log(`[Sync] Starting sync. Records: ${doRecords ? updatedRecords.length : 'skip'}, Schedules: ${doSchedules ? updatedSchedules.length : 'skip'}, Lecturers: ${doLecturers ? updatedLecturers.length : 'skip'}`);
    
    // Update localStorage immediately with quota protection
    try {
      if (doRecords) localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
      if (doSchedules) localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      if (doLecturers) localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
    } catch (storageError) {
      console.warn("[Sync] LocalStorage write error (quota reached), relying on server sync:", storageError);
    }

    try {
      setIsSyncing(true);
      
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

      const tasks: Promise<any>[] = [];
      if (doRecords) tasks.push(syncRecordsToServerSafely(updatedRecords));
      if (doLecturers) tasks.push(syncRequest('/api/lecturers', updatedLecturers));
      if (doSchedules) tasks.push(syncRequest('/api/schedules', updatedSchedules));

      await Promise.all(tasks);

      console.log("[Sync] Sync successful.");
      setIsLocalUpdate({
        records: false,
        schedules: false,
        lecturers: false
      });
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
    setIsLocalUpdate(prev => ({ ...prev, records: true }));
    
    const trimmedName = record.lecturerName.trim();
    // Ensure this record ID is removed from any previous deletedIds list so it is always preserved
    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_records') || '[]');
      if (existingDeleted.includes(record.id)) {
        const filtered = existingDeleted.filter(id => id !== record.id);
        localStorage.setItem('ipgkpt_deleted_records', JSON.stringify(filtered));
      }
    } catch {}

    const isEdit = records.some(r => r.id === record.id);
    const normalizedRecord: EvaluationRecord = { 
      ...record, 
      lecturerName: trimmedName,
      timestamp: Date.now() // Always assign latest timestamp to guarantee persistence
    };
    
    // Save both signatures to persistent library
    if (record.lecturerSignature && trimmedName) {
      handleSaveSignature(trimmedName, record.lecturerSignature);
    }
    if (record.evaluatorSignature && record.evaluatorName?.trim()) {
      handleSaveSignature(record.evaluatorName.trim(), record.evaluatorSignature);
    }
    
    // Update local lecturers list if new or department changed
    const updatedLecturers = [...lecturersList];
    const existingLecturerIndex = updatedLecturers.findIndex(l => l.name.toLowerCase() === trimmedName.toLowerCase());
    
    if (existingLecturerIndex !== -1) {
      if (updatedLecturers[existingLecturerIndex].department !== record.department) {
        updatedLecturers[existingLecturerIndex] = { ...updatedLecturers[existingLecturerIndex], department: record.department };
      }
    } else if (trimmedName) {
      updatedLecturers.push({ name: trimmedName, department: record.department });
    }
    
    // Put newly added or updated record at index 0 so it's always at the top
    const updatedRecords = isEdit
      ? [normalizedRecord, ...records.filter(r => r.id !== record.id)]
      : [normalizedRecord, ...records];

    // Smart schedule matching: match by lecturer name case-insensitively, and mark completed if date matches or pending
    let matchedSchedule = false;
    const updatedSchedules = schedules.map(s => {
      const isLecturerMatch = s.lecturerName.trim().toLowerCase() === trimmedName.toLowerCase();
      if (!isLecturerMatch) return s;
      matchedSchedule = true;
      return { ...s, status: 'Completed' as const, date: normalizedRecord.date || s.date, timestamp: Date.now() };
    });

    if (!matchedSchedule && trimmedName) {
      const newScheduleEntry: MonitoringSchedule = {
        id: `sch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        lecturerName: trimmedName,
        department: normalizedRecord.department,
        course: normalizedRecord.course || 'Pemantauan PdP',
        code: normalizedRecord.code || '',
        date: normalizedRecord.date || new Date().toISOString().split('T')[0],
        time: '08:00',
        location: 'Bilik Kuliah / Makmal',
        timestamp: normalizedRecord.timestamp || Date.now(),
        status: 'Completed'
      };
      updatedSchedules.unshift(newScheduleEntry);
    }

    // Update state immediately for instant responsive feedback
    setLecturersList(updatedLecturers);
    setRecords(updatedRecords);
    setSchedules(updatedSchedules);
    setRecentlySavedId(normalizedRecord.id);
    setRecentlySavedAction(isEdit ? 'updated' : 'created');

    // Immediate local persistence
    try {
      localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
      localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
    } catch (lsErr) {
      console.warn("LocalStorage immediate write error:", lsErr);
    }

    // Fast direct upsert to server endpoint for instant persistence
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_record', record: normalizedRecord })
      });
      console.log("[App] Direct upsert to server succeeded for record:", normalizedRecord.id);
    } catch (upsertErr) {
      console.warn("[App] Direct upsert to server warning (will be resolved by syncData):", upsertErr);
    }

    const scheduleToUpsert = updatedSchedules.find(s => s.lecturerName.trim().toLowerCase() === trimmedName.toLowerCase());
    if (scheduleToUpsert) {
      try {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert_schedule', schedule: scheduleToUpsert })
        });
      } catch (schedErr) {
        console.warn("[App] Direct schedule upsert warning:", schedErr);
      }
    }

    // Clear temporary in-progress form draft from storage
    try {
      localStorage.removeItem('epantau_draft_active_form');
      sessionStorage.removeItem('epantau_draft_active_form');
    } catch {}

    // Full sync in background
    syncData(updatedRecords, updatedSchedules, updatedLecturers).catch(console.error);
    notifyDataChanged();
    
    const scoreVals = Object.values(normalizedRecord.scores || {}) as number[];
    const avgScore = scoreVals.length > 0 ? (scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length).toFixed(2) : '-';

    if (isEdit) {
      showNotification(`Rekod penilaian ${trimmedName} berjaya dikemaskini dan disimpan (Skor: ${avgScore})!`, 'success');
    } else if (normalizedRecord.lecturerSignature && normalizedRecord.evaluatorSignature) {
      showNotification(`Rekod penilaian baharu ${trimmedName} dan kedua-dua tandatangan berjaya disimpan (Skor: ${avgScore})!`, 'success');
    } else {
      showNotification(`Rekod penilaian baharu ${trimmedName} berjaya disimpan (Skor: ${avgScore})!`, 'success');
    }
    
    // Show success dialog with quick actions (View/Print PDF, Download PDF, Next evaluation)
    setSavedSuccessModal({ record: normalizedRecord, isEdit });
    setEditingRecord(null);
    setView('dashboard');
  };

  const handleStartEvaluation = (preset?: {
    lecturerName?: string;
    department?: string;
    course?: string;
    code?: string;
    date?: string;
    evaluatorName?: string;
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
      evaluatorName: preset?.evaluatorName || (user?.username || ''),
      remarks: '',
      scores: {},
      itemRemarks: {},
      lecturerSignature: '',
      evaluatorSignature: ''
    };
    setEditingRecord(template);
    setView('form');
  };

  const handleAddSchedule = async (schedule: MonitoringSchedule) => {
    // Ensure this schedule ID is not marked as deleted
    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_schedules') || '[]');
      if (existingDeleted.includes(schedule.id)) {
        const filtered = existingDeleted.filter(id => id !== schedule.id);
        localStorage.setItem('ipgkpt_deleted_schedules', JSON.stringify(filtered));
      }
    } catch {}

    const updatedSchedules = [schedule, ...schedules];
    setSchedules(updatedSchedules);
    setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
    
    try {
      localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
    } catch (e) {}

    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_schedule', schedule })
      });
    } catch (e) {
      console.warn("Direct schedule upsert error:", e);
    }

    syncData(records, updatedSchedules, lecturersList, { syncRecords: false, syncSchedules: true, syncLecturers: false }).catch(console.error);
    notifyDataChanged();
    showNotification(`Jadual pemantauan baharu (${schedule.lecturerName}) telah berjaya didaftarkan dan disimpan.`, 'success');
  };

  const handleUpdateSchedule = async (updatedSchedule: MonitoringSchedule) => {
    // Ensure updated schedule ID is not marked as deleted
    try {
      const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_schedules') || '[]');
      if (existingDeleted.includes(updatedSchedule.id)) {
        const filtered = existingDeleted.filter(id => id !== updatedSchedule.id);
        localStorage.setItem('ipgkpt_deleted_schedules', JSON.stringify(filtered));
      }
    } catch {}

    const updatedSchedules = schedules.map((s: MonitoringSchedule) => s.id === updatedSchedule.id ? updatedSchedule : s);
    setSchedules(updatedSchedules);
    setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
    
    try {
      localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
    } catch (e) {}

    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_schedule', schedule: updatedSchedule })
      });
    } catch (e) {
      console.warn("Direct schedule update error:", e);
    }

    syncData(records, updatedSchedules, lecturersList, { syncRecords: false, syncSchedules: true, syncLecturers: false }).catch(console.error);
    notifyDataChanged();
    showNotification(`Jadual pemantauan (${updatedSchedule.lecturerName}) telah berjaya dikemaskini dan disimpan.`, 'success');
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
    
    try {
      localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
      localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
      localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
    } catch (e) {}

    try {
      await fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_lecturer', lecturer: updatedLecturer, oldName, oldDept })
      });
    } catch (e) {
      console.warn("Direct lecturer update error:", e);
    }

    setIsLocalUpdate({ records: true, schedules: true, lecturers: true });
    syncData(updatedRecords, updatedSchedules, updatedLecturers).catch(console.error);
    notifyDataChanged();
    showNotification(`Maklumat pensyarah (${updatedLecturer.name}) telah berjaya dikemaskini dan disimpan.`, 'success');
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
    
    try {
      localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
    } catch (e) {}

    try {
      await fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert_lecturer', lecturer })
      });
    } catch (e) {
      console.warn("Direct lecturer upsert error:", e);
    }

    syncData(records, schedules, updatedLecturers, { syncRecords: false, syncSchedules: false, syncLecturers: true }).catch(console.error);
    notifyDataChanged();
    showNotification(`Pensyarah baharu (${lecturer.name}) telah berjaya didaftarkan dan disimpan.`, 'success');
  };

  const openDeleteRecordConfirm = (id: string) => {
    const record = records.find(r => r.id === id);
    setConfirmModal({
      isOpen: true,
      type: 'record',
      targetId: id,
      title: 'Padam Rekod Penilaian Pensyarah?',
      message: `Adakah anda pasti mahu memadam rekod penilaian bagi ${record?.lecturerName || 'pensyarah ini'} secara kekal? Tindakan ini boleh dilakukan jika berlaku sebarang kesilapan pengisian.`,
      confirmText: 'Ya, Padam Rekod'
    });
  };

  const openDeleteMultipleRecordsConfirm = (recordIds: string[]) => {
    if (!recordIds || recordIds.length === 0) return;
    const matchingRecords = records.filter(r => recordIds.includes(r.id));
    const names = Array.from(new Set(matchingRecords.map(r => r.lecturerName)));
    const namesPreview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` dan ${names.length - 3} lagi` : '');
    setConfirmModal({
      isOpen: true,
      type: 'multiple_records',
      targetId: null,
      targetRecordIds: recordIds,
      title: `Padam ${recordIds.length} Rekod Penilaian Pensyarah?`,
      message: `Adakah anda pasti mahu memadam ${recordIds.length} rekod penilaian yang dipilih (${namesPreview}) secara kekal? Tindakan ini boleh dilakukan jika berlaku sebarang kesilapan pengisian.`,
      confirmText: `Ya, Padam (${recordIds.length}) Rekod`
    });
  };

  const openDeleteLecturerConfirm = (name: string, department: string) => {
    setConfirmModal({
      isOpen: true,
      type: 'lecturer',
      targetId: `${name}|${department}`,
      title: 'Padam Maklumat Pensyarah?',
      message: `Adakah anda pasti mahu memadam pensyarah "${name}" (${department}) dari senarai data secara kekal jika berlaku sebarang kesilapan?`,
      confirmText: 'Ya, Padam Pensyarah'
    });
  };

  const openDeleteMultipleLecturersConfirm = (targets: { name: string; department: string }[]) => {
    if (!targets || targets.length === 0) return;
    const namesPreview = targets.slice(0, 3).map(t => t.name).join(', ') + (targets.length > 3 ? ` dan ${targets.length - 3} lagi` : '');
    setConfirmModal({
      isOpen: true,
      type: 'multiple_lecturers',
      targetId: null,
      targetLecturers: targets,
      title: `Padam ${targets.length} Orang Pensyarah?`,
      message: `Adakah anda pasti mahu memadam ${targets.length} orang pensyarah yang dipilih (${namesPreview}) secara kekal daripada data? Tindakan ini akan mengeluarkan mereka daripada senarai pensyarah kampus/jabatan.`,
      confirmText: `Ya, Padam (${targets.length}) Pensyarah`
    });
  };

  const openDeleteScheduleConfirm = (id: string) => {
    const sched = schedules.find(s => s.id === id);
    setConfirmModal({
      isOpen: true,
      type: 'schedule',
      targetId: id,
      title: 'Padam Jadual Pemantauan?',
      message: `Adakah anda pasti mahu memadam jadual pemantauan bagi ${sched?.lecturerName || 'pensyarah ini'} (${sched?.course || 'sesi pemantauan'})? Tindakan ini boleh dilakukan oleh semua pensyarah dan Ketua Jabatan jika berlaku sebarang kesilapan.`,
      confirmText: 'Ya, Padam Jadual'
    });
  };

  const openDeleteMultipleSchedulesConfirm = (scheduleIds: string[]) => {
    if (!scheduleIds || scheduleIds.length === 0) return;
    const isAll = scheduleIds.length >= schedules.length;
    const matchingScheds = schedules.filter(s => scheduleIds.includes(s.id));
    const names = Array.from(new Set(matchingScheds.map(s => s.lecturerName)));
    const namesPreview = names.slice(0, 3).join(', ') + (names.length > 3 ? ` dan ${names.length - 3} lagi` : '');
    setConfirmModal({
      isOpen: true,
      type: 'multiple_schedules',
      targetId: null,
      targetScheduleIds: scheduleIds,
      title: isAll ? `Padam Jadual Untuk Semua Pensyarah (${scheduleIds.length})?` : `Padam ${scheduleIds.length} Jadual Pemantauan?`,
      message: isAll
        ? `Adakah anda pasti mahu memadam jadual pemantauan untuk SEMUA pensyarah (${scheduleIds.length} jadual) secara kekal? Tindakan ini boleh dilakukan oleh semua pensyarah dan Ketua Jabatan, dan akan diselaraskan serta-merta ke semua peranti.`
        : `Adakah anda pasti mahu memadam ${scheduleIds.length} jadual pemantauan yang dipilih (${namesPreview}) secara kekal? Tindakan ini boleh dilakukan oleh semua pensyarah dan Ketua Jabatan jika berlaku sebarang kesilapan, dan akan diselaraskan ke semua peranti.`,
      confirmText: isAll ? `Ya, Padam Semua (${scheduleIds.length}) Jadual` : `Ya, Padam (${scheduleIds.length}) Jadual`
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
          localStorage.removeItem('ipgkpt_deleted_schedules');
          localStorage.removeItem('ipgkpt_deleted_records');
          showNotification('Berjaya memulihkan 73 rekod pemantauan pensyarah (7.10.2026)!', 'success');
        } else {
          showNotification(`Gagal memulihkan: ${data.error || 'Ralat server'}`, 'error');
        }
      } catch (err: any) {
        setRecords(INITIAL_RECORDS);
        setSchedules(INITIAL_SCHEDULES);
        localStorage.setItem('ipgkpt_records', JSON.stringify(INITIAL_RECORDS));
        localStorage.setItem('ipgkpt_schedules', JSON.stringify(INITIAL_SCHEDULES));
        localStorage.removeItem('ipgkpt_deleted_schedules');
        localStorage.removeItem('ipgkpt_deleted_records');
        showNotification('Data 73 orang pensyarah berjaya dipulihkan.', 'success');
      } finally {
        setIsSyncing(false);
        setLastSync(new Date());
      }
      return;
    }

    // All lecturers, ketua jabatan, and admins are authorized to delete evaluation records
    let updatedRecords = [...records];
    let updatedLecturers = [...lecturersList];
    let updatedSchedules = [...schedules];

    if (confirmModal.type === 'record' && confirmModal.targetId) {
      const recordIdToDelete = confirmModal.targetId;
      const deletedRecord = records.find(r => r.id === recordIdToDelete);
      
      // Save to deletedIds list in localStorage so it is never re-seeded
      try {
        const existingDeleted = JSON.parse(localStorage.getItem('ipgkpt_deleted_records') || '[]');
        if (!existingDeleted.includes(recordIdToDelete)) {
          existingDeleted.push(recordIdToDelete);
          localStorage.setItem('ipgkpt_deleted_records', JSON.stringify(existingDeleted));
        }
      } catch {}

      // Inform server of deleted ID immediately (both to /api/records and to /api/deleted-records for cross-device tombstone)
      fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_record', id: recordIdToDelete })
      }).catch(console.warn);

      fetch('/api/deleted-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([recordIdToDelete])
      }).catch(console.warn);

      updatedRecords = records.filter((r: EvaluationRecord) => r.id !== recordIdToDelete);
      
      // Update schedule status if this lecturer has no other records left
      if (deletedRecord) {
        const remaining = updatedRecords.filter(r => 
          r.lecturerName.trim().toLowerCase() === deletedRecord.lecturerName.trim().toLowerCase()
        );
        if (remaining.length === 0) {
          updatedSchedules = schedules.map(s => {
            if (s.lecturerName.trim().toLowerCase() === deletedRecord.lecturerName.trim().toLowerCase()) {
              return { ...s, status: 'Pending' as const };
            }
            return s;
          });
          setSchedules(updatedSchedules);
          try {
            localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
          } catch {}

          const matchedSchedule = updatedSchedules.find(s => s.lecturerName.trim().toLowerCase() === deletedRecord.lecturerName.trim().toLowerCase());
          if (matchedSchedule) {
            fetch('/api/schedules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'upsert_schedule', schedule: matchedSchedule })
            }).catch(console.warn);
          }
        }
      }

      setRecords(updatedRecords);
      setIsLocalUpdate(prev => ({ ...prev, records: true, schedules: true }));
      try {
        localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
      } catch {}
      showNotification(`Rekod pemantauan bagi ${deletedRecord?.lecturerName || 'pensyarah'} berjaya dipadam dan diselaraskan ke semua peranti.`, 'success');
    } else if (confirmModal.type === 'multiple_records' && confirmModal.targetRecordIds) {
      const idsToDelete = new Set(confirmModal.targetRecordIds);
      const deletedRecordsList = records.filter(r => idsToDelete.has(r.id));

      // Save to deletedIds list in localStorage so they are never re-seeded
      try {
        const existingDeleted = JSON.parse(localStorage.getItem('ipgkpt_deleted_records') || '[]');
        confirmModal.targetRecordIds.forEach(id => {
          if (!existingDeleted.includes(id)) existingDeleted.push(id);
        });
        localStorage.setItem('ipgkpt_deleted_records', JSON.stringify(existingDeleted));
      } catch {}

      // Inform server of deleted IDs (both to /api/records and to /api/deleted-records for cross-device tombstone)
      fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_records', ids: confirmModal.targetRecordIds })
      }).catch(console.warn);

      fetch('/api/deleted-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmModal.targetRecordIds)
      }).catch(console.warn);

      updatedRecords = records.filter((r: EvaluationRecord) => !idsToDelete.has(r.id));

      // Revert schedule status to Pending if lecturers have no remaining records
      const affectedLecturerNames = new Set(deletedRecordsList.map(r => r.lecturerName.trim().toLowerCase()));
      affectedLecturerNames.forEach(lecName => {
        const remaining = updatedRecords.filter(r => r.lecturerName.trim().toLowerCase() === lecName);
        if (remaining.length === 0) {
          updatedSchedules = updatedSchedules.map(s => {
            if (s.lecturerName.trim().toLowerCase() === lecName) {
              return { ...s, status: 'Pending' as const };
            }
            return s;
          });
        }
      });

      setRecords(updatedRecords);
      setSchedules(updatedSchedules);
      setIsLocalUpdate(prev => ({ ...prev, records: true, schedules: true }));
      try {
        localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
        localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      } catch {}

      showNotification(`${confirmModal.targetRecordIds.length} rekod pemantauan pensyarah berjaya dipadam secara kekal.`, 'success');
    } else if (confirmModal.type === 'lecturer' && confirmModal.targetId) {
      const [name, dept] = confirmModal.targetId.split('|');
      
      // Save to ipgkpt_deleted_lecturers so it is never re-seeded
      try {
        const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_lecturers') || '[]');
        const key = `${name.trim().toLowerCase()}|${dept.trim().toLowerCase()}`;
        if (!existingDeleted.includes(key)) existingDeleted.push(key);
        if (!existingDeleted.includes(name.trim().toLowerCase())) existingDeleted.push(name.trim().toLowerCase());
        localStorage.setItem('ipgkpt_deleted_lecturers', JSON.stringify(existingDeleted));
      } catch {}

      // Inform server of deleted lecturer
      fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_lecturers', lecturers: [{ name, department: dept }] })
      }).catch(console.warn);

      updatedLecturers = lecturersList.filter((l: Lecturer) => !(l.name === name && l.department === dept));
      setLecturersList(updatedLecturers);
      setIsLocalUpdate(prev => ({ ...prev, lecturers: true }));
      try {
        localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
      } catch {}
      showNotification(`Maklumat pensyarah "${name}" berjaya dipadam daripada data.`, 'success');
    } else if (confirmModal.type === 'multiple_lecturers' && confirmModal.targetLecturers) {
      const targets = confirmModal.targetLecturers;
      const targetKeys = new Set(targets.map(t => `${t.name.trim().toLowerCase()}|${t.department.trim().toLowerCase()}`));
      const targetNames = new Set(targets.map(t => t.name.trim().toLowerCase()));

      // Save to ipgkpt_deleted_lecturers in localStorage
      try {
        const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_lecturers') || '[]');
        targets.forEach(t => {
          const k = `${t.name.trim().toLowerCase()}|${t.department.trim().toLowerCase()}`;
          if (!existingDeleted.includes(k)) existingDeleted.push(k);
          const kNameOnly = t.name.trim().toLowerCase();
          if (!existingDeleted.includes(kNameOnly)) existingDeleted.push(kNameOnly);
        });
        localStorage.setItem('ipgkpt_deleted_lecturers', JSON.stringify(existingDeleted));
      } catch {}

      // Inform server
      fetch('/api/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_lecturers', lecturers: targets })
      }).catch(console.warn);

      updatedLecturers = lecturersList.filter((l: Lecturer) => 
        !targetKeys.has(`${l.name.trim().toLowerCase()}|${l.department.trim().toLowerCase()}`) &&
        !targetNames.has(l.name.trim().toLowerCase())
      );
      setLecturersList(updatedLecturers);
      setIsLocalUpdate(prev => ({ ...prev, lecturers: true }));
      try {
        localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));
      } catch {}
      showNotification(`${targets.length} orang pensyarah berjaya dipadam daripada data.`, 'success');
    } else if (confirmModal.type === 'schedule' && confirmModal.targetId) {
      const scheduleIdToDelete = confirmModal.targetId;
      const targetSchedule = schedules.find(s => s.id === scheduleIdToDelete);

      // Track deleted schedule ID in localStorage so it is never re-seeded
      try {
        const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_schedules') || '[]');
        if (!existingDeleted.includes(scheduleIdToDelete)) {
          existingDeleted.push(scheduleIdToDelete);
          localStorage.setItem('ipgkpt_deleted_schedules', JSON.stringify(existingDeleted));
        }
      } catch {}

      try {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_schedule', id: scheduleIdToDelete })
        });
      } catch (e) {
        console.warn("Direct schedule delete error:", e);
      }

      updatedSchedules = schedules.filter((s: MonitoringSchedule) => s.id !== scheduleIdToDelete);
      setSchedules(updatedSchedules);
      setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
      try {
        localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      } catch {}
      showNotification(`Jadual pemantauan bagi ${targetSchedule?.lecturerName || 'pensyarah'} berjaya dipadam dan diselaraskan ke semua peranti.`, 'success');
    } else if (confirmModal.type === 'multiple_schedules' && confirmModal.targetScheduleIds) {
      const idsToDelete = new Set(confirmModal.targetScheduleIds);

      // Track deleted schedule IDs in localStorage so they are never re-seeded
      try {
        const existingDeleted: string[] = JSON.parse(localStorage.getItem('ipgkpt_deleted_schedules') || '[]');
        confirmModal.targetScheduleIds.forEach(id => {
          if (!existingDeleted.includes(id)) existingDeleted.push(id);
        });
        localStorage.setItem('ipgkpt_deleted_schedules', JSON.stringify(existingDeleted));
      } catch {}

      try {
        await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_schedules', ids: confirmModal.targetScheduleIds })
        });
      } catch (e) {
        console.warn("Direct multiple schedules delete error:", e);
      }

      updatedSchedules = schedules.filter((s: MonitoringSchedule) => !idsToDelete.has(s.id));
      setSchedules(updatedSchedules);
      setIsLocalUpdate(prev => ({ ...prev, schedules: true }));
      try {
        localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
      } catch {}

      const isAll = confirmModal.targetScheduleIds.length >= schedules.length;
      showNotification(isAll 
        ? `Jadual pemantauan bagi SEMUA pensyarah (${confirmModal.targetScheduleIds.length} jadual) berjaya dipadam secara kekal di semua peranti.`
        : `${confirmModal.targetScheduleIds.length} jadual pemantauan berjaya dipadam secara kekal di semua peranti.`,
        'success'
      );
    }

    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    // Sync to server: if schedules were deleted, skip syncSchedules since delete_schedule(s) was already sent with tombstones
    const isScheduleDelete = confirmModal.type === 'schedule' || confirmModal.type === 'multiple_schedules';
    await syncData(updatedRecords, updatedSchedules, updatedLecturers, {
      syncSchedules: !isScheduleDelete
    });
    notifyDataChanged();
  };

  // Full dashboard access for all lecturers and ketua jabatan
  const isRestrictedUser = false;

  // Full records access for all lecturers and ketua jabatan so all filled evaluation forms remain in the system
  const accessibleRecords = records;

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
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200/90 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95 disabled:opacity-50 min-h-[38px] shadow-xs cursor-pointer"
                  title="Klik untuk menyegerakkan data secara dua hala merentasi Laptop, Telefon Pintar (Android & iOS) dan Komputer (Mac/Windows)"
                >
                  <ArrowPathIcon className={`h-4 w-4 shrink-0 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-xs">{isSyncing ? 'Menyelaraskan...' : 'Segerak'}</span>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${syncError ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                </button>
                <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>{syncError ? 'Ralat Penyelarasan' : 'Semua Peranti Selaras'}</span>
                  {lastSync && (
                    <span className="text-slate-400 font-normal">
                      • {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
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
            onDeleteMultipleRecords={openDeleteMultipleRecordsConfirm}
            onDeleteLecturer={openDeleteLecturerConfirm}
            onDeleteMultipleLecturers={openDeleteMultipleLecturersConfirm}
            onDeleteSchedule={openDeleteScheduleConfirm}
            onDeleteMultipleSchedules={openDeleteMultipleSchedulesConfirm}
            onEditRecord={handleEditRecord}
            onStartEvaluation={handleStartEvaluation}
            onAddSchedule={handleAddSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onAddLecturer={handleAddLecturer}
            onUpdateLecturer={handleUpdateLecturer}
            onRefresh={() => fetchData()}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            syncError={syncError}
            lastSync={lastSync}
            recentlySavedId={recentlySavedId}
            recentlySavedAction={recentlySavedAction}
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
              onDeleteRecord={(id) => { openDeleteRecordConfirm(id); setView('dashboard'); setEditingRecord(null); }}
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

      <SavedRecordSuccessModal 
        record={savedSuccessModal?.record || null}
        isEdit={savedSuccessModal?.isEdit}
        isOpen={!!savedSuccessModal}
        onClose={() => setSavedSuccessModal(null)}
        onNewEvaluation={() => {
          setSavedSuccessModal(null);
          handleStartEvaluation();
        }}
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