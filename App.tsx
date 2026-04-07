import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EvaluationForm } from './components/EvaluationForm';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';
import { UserGuideModal } from './components/UserGuideModal';
import { EvaluationRecord, MonitoringSchedule } from './types';
import { INITIAL_RECORDS, LECTURERS } from './constants';
import { 
  ClipboardDocumentCheckIcon, 
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

interface Lecturer {
  name: string;
  department: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
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
            Ya, Padam
          </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<{ username: string; department: string; role: 'admin' | 'user' } | null>(() => {
    const saved = localStorage.getItem('ipgkpt_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState<'dashboard' | 'form'>('dashboard');
  const [editingRecord, setEditingRecord] = useState<EvaluationRecord | null>(null);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const isInitialLoad = useRef(true);
  
  const [records, setRecords] = useState<EvaluationRecord[]>(() => {
    const saved = localStorage.getItem('ipgkpt_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [schedules, setSchedules] = useState<MonitoringSchedule[]>(() => {
    const saved = localStorage.getItem('ipgkpt_schedules');
    return saved ? JSON.parse(saved) : [];
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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = useCallback(async (isSilent = false) => {
    const isAnyLocalUpdate = isLocalUpdate.records || isLocalUpdate.schedules || isLocalUpdate.lecturers;
    if (isAnyLocalUpdate && isSilent) return; // Don't poll if we have unsynced local changes
    if (!isSilent) setIsSyncing(true);
    try {
      const [recordsRes, schedulesRes, lecturersRes, healthRes] = await Promise.all([
        fetch('/api/records'),
        fetch('/api/schedules'),
        fetch('/api/lecturers'),
        fetch('/api/health')
      ]);
      
      if (healthRes.ok) {
        const health = await healthRes.json();
        setPersistenceType(health.persistence);
        setSupabaseStatus(health.supabase_status);
        if (health.supabase_error) {
          setSyncError(`Supabase: ${health.supabase_error}`);
        }
      }
      
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        if (Array.isArray(recordsData)) {
          // Only update if server has data OR if it's the very first load and server is empty
          if (recordsData.length > 0) {
            setRecords(recordsData);
          } else if (isInitialLoad.current) {
            // Migration logic only on first load if server is empty
            const saved = localStorage.getItem('ipgkpt_records');
            if (saved && JSON.parse(saved).length > 0) {
              const localRecords = JSON.parse(saved);
              setRecords(localRecords);
              // Push to server immediately
              fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localRecords)
              }).catch(console.error);
            } else {
              setRecords(INITIAL_RECORDS);
              fetch('/api/records', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(INITIAL_RECORDS)
              }).catch(console.error);
            }
          }
        }
      }

      if (schedulesRes.ok) {
        const schedulesData = await schedulesRes.json();
        if (Array.isArray(schedulesData)) {
          if (schedulesData.length > 0) {
            setSchedules(schedulesData);
          } else if (isInitialLoad.current) {
            const saved = localStorage.getItem('ipgkpt_schedules');
            if (saved && JSON.parse(saved).length > 0) {
              const localSchedules = JSON.parse(saved);
              setSchedules(localSchedules);
              fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localSchedules)
              }).catch(console.error);
            }
          }
        }
      }

      if (lecturersRes.ok) {
        const lecturersData = await lecturersRes.json();
        if (Array.isArray(lecturersData)) {
          if (lecturersData.length > 0) {
            setLecturersList(lecturersData);
          } else if (isInitialLoad.current) {
            const saved = localStorage.getItem('ipgkpt_lecturers');
            if (saved && JSON.parse(saved).length > 0) {
              const localLecturers = JSON.parse(saved);
              setLecturersList(localLecturers);
              fetch('/api/lecturers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localLecturers)
              }).catch(console.error);
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setSyncError(error.message);
    } finally {
      if (isInitialLoad.current) {
        isInitialLoad.current = false;
      }
      setIsSyncing(false);
      setLastSync(new Date());
    }
  }, []);
  
  // Initial data fetch and polling
  useEffect(() => {
    fetchData();

    // Polling every 15 seconds for faster sync across devices
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
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
        fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(records)
        }),
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
    } catch (e: any) {
      setSyncError(`Manual Sync Failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('ipgkpt_user');
  };
  
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'record' | 'lecturer' | 'schedule' | null;
    targetId: string | null;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    targetId: null,
    title: '',
    message: ''
  });

  const syncData = async (
    updatedRecords: EvaluationRecord[], 
    updatedSchedules: MonitoringSchedule[], 
    updatedLecturers: Lecturer[]
  ) => {
    // Update localStorage immediately
    localStorage.setItem('ipgkpt_records', JSON.stringify(updatedRecords));
    localStorage.setItem('ipgkpt_schedules', JSON.stringify(updatedSchedules));
    localStorage.setItem('ipgkpt_lecturers', JSON.stringify(updatedLecturers));

    try {
      setIsSyncing(true);
      const [recRes, lecRes, schRes] = await Promise.all([
        fetch('/api/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedRecords)
        }),
        fetch('/api/lecturers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedLecturers)
        }),
        fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSchedules)
        })
      ]);

      if (!recRes.ok || !lecRes.ok || !schRes.ok) {
        throw new Error('Gagal menyimpan ke pelayan pusat.');
      }

      setIsLocalUpdate({ records: false, schedules: false, lecturers: false });
      setSyncError(null);
      setLastSync(new Date());
    } catch (error: any) {
      console.error("Sync error:", error);
      setSyncError(`Data disimpan secara lokal tetapi gagal dihantar ke pelayan: ${error.message}`);
      showNotification('Data disimpan secara lokal. Ia akan dihantar ke pelayan apabila talian pulih.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddRecord = async (record: EvaluationRecord) => {
    // Set local update flag immediately
    setIsLocalUpdate(prev => ({ ...prev, records: true }));
    
    const trimmedName = record.lecturerName.trim();
    const normalizedRecord = { ...record, lecturerName: trimmedName };
    
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
    
    const updatedRecords = records.some(r => r.id === record.id)
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
    await syncData(updatedRecords, updatedSchedules, updatedLecturers);
    
    setEditingRecord(null);
    setView('dashboard');
    showNotification('Rekod penilaian telah berjaya disimpan.');
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
  const isRestrictedUser = user?.username.toLowerCase() === 'pensyarah' && user?.role === 'user';

  // Improved filtering to handle universal 'SEMUA' access
  const accessibleRecords = (user?.role === 'admin' || (user?.department === 'SEMUA' && !isRestrictedUser))
    ? records 
    : isRestrictedUser 
      ? [] // Restricted user gets ZERO evaluation records
      : records.filter(r => 
          r.department === user?.department || 
          (r.evaluatorName && user?.username && r.evaluatorName.toLowerCase().includes(user.username.toLowerCase()))
        );

  const accessibleLecturers = (user?.role === 'admin' || user?.department === 'SEMUA')
    ? lecturersList 
    : lecturersList.filter((l: Lecturer) => l.department === user?.department);

  const accessibleSchedules = (user?.role === 'admin' || user?.department === 'SEMUA')
    ? schedules
    : schedules.filter(s => s.department === user?.department);

  if (!user) return <Login onLogin={handleLogin} onShowGuide={() => setShowGuideModal(true)} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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
                <h1 className="text-xl font-bold text-slate-900 leading-tight">ePantau v2.0</h1>
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
                <button
                  onClick={() => { setView('dashboard'); setEditingRecord(null); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    view === 'dashboard' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Dashboard
                </button>
                
                <button
                  onClick={() => { setEditingRecord(null); setView('form'); }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    view === 'form' && !editingRecord ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  + Borang
                </button>

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
        {view === 'dashboard' ? (
          <Dashboard 
            records={accessibleRecords} 
            schedules={accessibleSchedules}
            lecturers={accessibleLecturers}
            allLecturers={lecturersList}
            userRole={user.role}
            username={user.username}
            userDept={user.department}
            onDeleteRecord={openDeleteRecordConfirm} 
            onDeleteLecturer={openDeleteLecturerConfirm}
            onDeleteSchedule={openDeleteScheduleConfirm}
            onEditRecord={handleEditRecord}
            onAddSchedule={handleAddSchedule}
            onUpdateSchedule={handleUpdateSchedule}
            onAddLecturer={handleAddLecturer}
            onUpdateLecturer={handleUpdateLecturer}
            onRefresh={() => fetchData()}
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
              lecturers={accessibleLecturers} 
              userDept={user.department}
              isAdmin={user.role === 'admin' || user.department === 'SEMUA'}
              username={user.username}
              initialData={editingRecord || undefined} 
              onNotification={showNotification}
            />
          </div>
        )}
      </main>
      
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
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