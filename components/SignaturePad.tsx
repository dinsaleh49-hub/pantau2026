import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  TrashIcon, 
  BookmarkSquareIcon, 
  CheckCircleIcon,
  SparklesIcon,
  PencilSquareIcon,
  PhotoIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline';

interface Props {
  label: string;
  personName?: string;
  initialSignature?: string;
  savedSignature?: string;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  onSaveToLibrary?: (signatureDataUrl: string) => void;
  onDeleteFromLibrary?: () => void;
}

type SignatureSource = 'initial' | 'saved' | 'uploaded' | 'drawn' | null;

const getOptimizedCanvasDataUrl = (canvas: HTMLCanvasElement): string => {
  try {
    const webpUrl = canvas.toDataURL('image/webp', 0.85);
    if (webpUrl && webpUrl.startsWith('data:image/webp')) {
      return webpUrl;
    }
  } catch {
    // fallback to png
  }
  return canvas.toDataURL('image/png');
};

export const SignaturePad: React.FC<Props> = ({ 
  label, 
  personName,
  initialSignature, 
  savedSignature,
  onSave, 
  onClear,
  onSaveToLibrary,
  onDeleteFromLibrary
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mode selection: 'pen' (Tandatangan Guna Pen) or 'upload' (Muat Naik Tandatangan)
  const [activeMode, setActiveMode] = useState<'pen' | 'upload'>('pen');
  
  // Pen configuration
  const [penColor, setPenColor] = useState<string>('#0f172a'); // default black/slate
  const [penWidth, setPenWidth] = useState<number>(2.5); // default medium

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [sigSource, setSigSource] = useState<SignatureSource>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Track if user explicitly cleared to prevent useEffect auto-reloading
  const userClearedRef = useRef(false);
  // Track previous personName to reset userClearedRef when person changes
  const prevPersonRef = useRef<string | undefined>(personName);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const drawImageToCanvas = useCallback((dataUrl: string, source: 'initial' | 'saved' | 'uploaded', silent = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Clear previous canvas drawing
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.min(hRatio, vRatio) * 0.9;
      const centerShift_x = (canvas.width - img.width * ratio) / 2;
      const centerShift_y = (canvas.height - img.height * ratio) / 2;
      
      ctx.drawImage(
        img, 
        0, 
        0, 
        img.width, 
        img.height, 
        centerShift_x, 
        centerShift_y, 
        img.width * ratio, 
        img.height * ratio
      );
      setHasSignature(true);
      setSigSource(source);
      userClearedRef.current = false;
      const finalDataUrl = getOptimizedCanvasDataUrl(canvas);
      onSave(finalDataUrl);

      if (!silent) {
        if (source === 'uploaded') {
          showFeedback('Tandatangan imej berjaya dimuat naik & sedia digunakan!', 'success');
        } else if (source === 'saved') {
          showFeedback('Tandatangan profil berjaya dimuatkan!', 'success');
        } else {
          showFeedback('Tandatangan sedia ada dimuatkan!', 'info');
        }
      }
    };

    img.onerror = () => {
      showFeedback('Ralat membaca fail imej tandatangan. Sila cuba fail imej lain.', 'error');
    };

    img.src = dataUrl;
  }, [onSave]);

  // Reset cleared state when target person changes
  useEffect(() => {
    if (personName !== prevPersonRef.current) {
      prevPersonRef.current = personName;
      userClearedRef.current = false;
    }
  }, [personName]);

  // Load initial or saved signature when available, UNLESS explicitly cleared by user
  useEffect(() => {
    if (userClearedRef.current) return;

    if (initialSignature && !hasSignature) {
      drawImageToCanvas(initialSignature, 'initial', true);
    } else if (savedSignature && !hasSignature) {
      drawImageToCanvas(savedSignature, 'saved', true);
    }
  }, [initialSignature, savedSignature, hasSignature, drawImageToCanvas]);

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setSigSource('drawn');
    userClearedRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = getOptimizedCanvasDataUrl(canvas);
      onSave(dataUrl);
      setHasSignature(true);
      setSigSource('drawn');
    }
  };

  // Explicitly clear signature
  const clearOldSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    userClearedRef.current = true;
    setHasSignature(false);
    setSigSource(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear();
    onSave('');
    showFeedback('Tandatangan telah dikosongkan. Sila guna pen atau muat naik fail imej baru.', 'info');
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showFeedback('Sila pilih fail berformat imej (PNG, JPG, JPEG, WEBP).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        userClearedRef.current = false;
        drawImageToCanvas(result, 'uploaded');
      }
    };
    reader.onerror = () => {
      showFeedback('Ralat membaca fail yang dimuat naik.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    e.target.value = ''; // Reset input to allow selecting same file again
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleUseSaved = () => {
    if (savedSignature) {
      userClearedRef.current = false;
      drawImageToCanvas(savedSignature, 'saved');
    }
  };

  const handleSaveToLibraryClick = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = getOptimizedCanvasDataUrl(canvas);
    if (onSaveToLibrary) {
      onSaveToLibrary(dataUrl);
      setSigSource('saved');
      showFeedback('Tandatangan ini berjaya disimpan ke profil!', 'success');
    }
  };

  const handleDeleteSavedClick = () => {
    if (onDeleteFromLibrary) {
      onDeleteFromLibrary();
      showFeedback('Tandatangan profil telah dipadam.', 'info');
    }
  };

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
      {/* Header Bar: Label, Recipient Name & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <PencilSquareIcon className="h-4 w-4 text-indigo-600" />
              {label}
            </label>
            {hasSignature ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full border shadow-sm ${
                sigSource === 'uploaded'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : sigSource === 'drawn'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : sigSource === 'saved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                <CheckCircleIcon className="h-3 w-3" />
                {sigSource === 'uploaded' && 'Imej Dimuat Naik'}
                {sigSource === 'drawn' && 'Tandatangan Guna Pen'}
                {sigSource === 'saved' && 'Tersimpan (Profil)'}
                {sigSource === 'initial' && 'Tandatangan Sedia Ada'}
                {!sigSource && 'Tandatangan Sedia'}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Belum Ditandatangani
              </span>
            )}
          </div>
          {personName && (
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-xs">
              Nama: <span className="font-semibold text-slate-700">{personName}</span>
            </p>
          )}
        </div>

        {/* Global Signature Actions: Guna Profil, Simpan Profil, Padam */}
        <div className="flex items-center flex-wrap gap-1.5">
          {savedSignature && (
            <button
              type="button"
              onClick={handleUseSaved}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Gunakan tandatangan yang telah tersimpan dalam profil sistem"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-600" />
              Guna Profil
            </button>
          )}

          {hasSignature && onSaveToLibrary && (
            <button
              type="button"
              onClick={handleSaveToLibraryClick}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg border border-emerald-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Simpan tandatangan ini ke profil untuk kegunaan borang seterusnya"
            >
              <BookmarkSquareIcon className="w-3.5 h-3.5 text-emerald-600" />
              Simpan Profil
            </button>
          )}

          {savedSignature && onDeleteFromLibrary && (
            <button
              type="button"
              onClick={handleDeleteSavedClick}
              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-medium rounded-lg border border-slate-200 hover:border-rose-200 transition-all"
              title="Padam tandatangan tersimpan dalam profil"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {hasSignature && (
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Kosongkan tandatangan dan buat semula"
            >
              <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
              Padam / Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Mode Switcher: Kekalkan Muat Naik Tandatangan & Tandatangan Mengguna Pen */}
      <div className="flex items-center gap-2 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setActiveMode('pen')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
            activeMode === 'pen'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span className="text-sm">✍️</span>
          <span>Tandatangan Guna Pen</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('upload')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-2 transition-all ${
            activeMode === 'upload'
              ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span className="text-sm">📁</span>
          <span>Muat Naik Tandatangan</span>
        </button>
      </div>

      {/* Mode-Specific Controls */}
      {activeMode === 'pen' ? (
        /* --- PEN CONTROLS --- */
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              🎨 Warna:
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPenColor('#0f172a')}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  penColor === '#0f172a' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                style={{ backgroundColor: '#0f172a' }}
                title="Warna Hitam Pekat"
              />
              <button
                type="button"
                onClick={() => setPenColor('#1e40af')}
                className={`w-6 h-6 rounded-full border-2 transition-all ${
                  penColor === '#1e40af' ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-slate-300'
                }`}
                style={{ backgroundColor: '#1e40af' }}
                title="Warna Biru Dokumen / Rasmi"
              />
            </div>

            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              ✏️ Saiz Pen:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setPenWidth(1.8)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  penWidth === 1.8 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Halus
              </button>
              <button
                type="button"
                onClick={() => setPenWidth(2.8)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  penWidth === 2.8 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Biasa
              </button>
              <button
                type="button"
                onClick={() => setPenWidth(4.2)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  penWidth === 4.2 ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tebal
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Stylus / Skrin Sentuh / Tetikus
            </span>
            {hasSignature && (
              <button
                type="button"
                onClick={clearOldSignature}
                className="px-2 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all flex items-center gap-1"
              >
                <TrashIcon className="w-3 h-3" />
                Padam Tulisan
              </button>
            )}
          </div>
        </div>
      ) : (
        /* --- UPLOAD CONTROLS --- */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <DocumentArrowUpIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-blue-950 text-xs">
                Muat Naik Fail Imej Tandatangan
              </p>
              <p className="text-[11px] text-blue-700/80">
                Pilih fail dari komputer / telefon atau seret terus ke kotak di bawah (PNG, JPG, WEBP).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
            >
              <ArrowUpTrayIcon className="w-3.5 h-3.5" />
              Pilih Fail Tandatangan
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        accept="image/png, image/jpeg, image/jpg, image/webp" 
        className="hidden" 
      />

      {/* Drawing & Preview Canvas with Drag & Drop Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-slate-50/50 border-2 rounded-xl overflow-hidden transition-all shadow-inner ${
          isDraggingOver 
            ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-200' 
            : hasSignature 
              ? 'border-emerald-300 bg-white ring-1 ring-emerald-100' 
              : activeMode === 'pen'
                ? 'border-indigo-200 hover:border-indigo-300 bg-white'
                : 'border-dashed border-blue-300 hover:border-blue-400 bg-blue-50/20'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          style={{ touchAction: 'none' }}
          className={`w-full h-36 bg-white block select-none ${
            activeMode === 'pen' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onPointerDown={activeMode === 'pen' ? handlePointerDown : undefined}
          onPointerMove={activeMode === 'pen' ? handlePointerMove : undefined}
          onPointerUp={activeMode === 'pen' ? handlePointerUp : undefined}
          onPointerCancel={activeMode === 'pen' ? handlePointerUp : undefined}
        />

        {/* Empty State Overlay */}
        {!hasSignature && (
          <div 
            onClick={() => {
              if (activeMode === 'upload') {
                fileInputRef.current?.click();
              }
            }}
            className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center select-none ${
              activeMode === 'upload' ? 'pointer-events-auto cursor-pointer hover:bg-blue-50/40 transition-colors' : ''
            }`}
          >
            {activeMode === 'pen' ? (
              <>
                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1 border border-indigo-100">
                  <PencilSquareIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">
                  ✍️ Tandatangan di sini menggunakan pen / stylus / jari
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lukis terus atas garisan atau klik tab "Muat Naik Tandatangan" untuk fail imej
                </p>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1 border border-blue-100">
                  <ArrowUpTrayIcon className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-blue-900">
                  Klik di sini untuk memuat naik imej tandatangan
                </p>
                <p className="text-[11px] text-blue-600 mt-0.5">
                  atau seret dan lepas fail imej anda terus ke dalam kotak ini
                </p>
              </>
            )}
          </div>
        )}

        {/* Canvas Corner Overlays when signature exists */}
        {hasSignature && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-200">
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Padam tandatangan ini"
            >
              <TrashIcon className="h-3 w-3 text-rose-600" />
              Padam
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('upload');
                fileInputRef.current?.click();
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Muat naik imej baru untuk menggantikan"
            >
              <ArrowUpTrayIcon className="h-3 w-3 text-blue-600" />
              Tukar Fail
            </button>
          </div>
        )}

        {/* Drag-over indicator */}
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-0 bg-blue-500/10 backdrop-blur-[1px] flex items-center justify-center border-2 border-dashed border-blue-600 rounded-xl">
            <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-blue-200 flex items-center gap-2 text-xs font-bold text-blue-700 animate-bounce">
              <PhotoIcon className="w-4 h-4 text-blue-600" />
              Lepaskan fail imej di sini untuk muat naik
            </div>
          </div>
        )}
      </div>

      {/* Guide Text & Toast Feedback */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[11px] min-h-[20px]">
        <span className="text-slate-500 font-medium">
          💡 Anda boleh bertukar antara <strong className="text-indigo-700">Tandatangan Guna Pen</strong> dan <strong className="text-blue-700">Muat Naik Tandatangan</strong> pada bila-bila masa.
        </span>
        {feedback && (
          <span className={`font-bold animate-in fade-in duration-200 flex items-center gap-1 shrink-0 ${
            feedback.type === 'error' 
              ? 'text-rose-600' 
              : feedback.type === 'info' 
                ? 'text-amber-600' 
                : 'text-emerald-600'
          }`}>
            <CheckCircleIcon className="h-3.5 w-3.5" /> {feedback.message}
          </span>
        )}
      </div>
    </div>
  );
};
