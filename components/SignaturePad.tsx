import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  TrashIcon, 
  CheckCircleIcon,
  PencilSquareIcon,
  PhotoIcon,
  DocumentArrowUpIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Props {
  label: string;
  personName?: string;
  initialSignature?: string;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
}

type SignatureSource = 'initial' | 'uploaded' | 'drawn' | null;

/**
 * Exports canvas content as a crisp PNG with a guaranteed pure white background.
 * Prevents transparent alpha channels from turning into black boxes in jsPDF or previews.
 */
const getOptimizedCanvasDataUrl = (canvas: HTMLCanvasElement): string => {
  const offCanvas = document.createElement('canvas');
  offCanvas.width = canvas.width;
  offCanvas.height = canvas.height;
  const offCtx = offCanvas.getContext('2d');
  if (offCtx) {
    offCtx.fillStyle = '#ffffff';
    offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    offCtx.drawImage(canvas, 0, 0);
    return offCanvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/png');
};

export const SignaturePad: React.FC<Props> = ({ 
  label, 
  personName,
  initialSignature, 
  onSave, 
  onClear
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Mode selection: 'pen' (Tandatangan Guna Pen) or 'upload' (Muat Naik Tandatangan)
  const [activeMode, setActiveMode] = useState<'pen' | 'upload'>('pen');
  
  // Official ink choices: Pekat, kontras tinggi & boleh dibaca dengan jelas dalam dokumen rasmi
  const [penColor, setPenColor] = useState<'#0f172a' | '#1e3a8a'>('#0f172a');
  const penWidth = 3.5; // Bold, crisp stroke for maximum legibility
  const lastCoordRef = useRef<{ x: number; y: number } | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [sigSource, setSigSource] = useState<SignatureSource>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Track if user explicitly cleared to prevent auto-reloading
  const userClearedRef = useRef(false);
  const prevPersonRef = useRef<string | undefined>(personName);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Helper to fill canvas with pure white background
  const clearCanvasWithWhite = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const drawImageToCanvas = useCallback((dataUrl: string, source: 'initial' | 'uploaded', silent = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!dataUrl || !dataUrl.trim()) {
      clearCanvasWithWhite(canvas);
      setHasSignature(false);
      setSigSource(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const hRatio = canvas.width / img.width;
      const vRatio = canvas.height / img.height;
      const ratio = Math.min(hRatio, vRatio) * 0.88;
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
          showFeedback('Tandatangan imej baharu berjaya dimuat naik!', 'success');
        } else {
          showFeedback('Tandatangan rekod sedia ada dimuatkan.', 'info');
        }
      }
    };

    img.onerror = () => {
      if (!silent) {
        showFeedback('Ralat membaca fail imej tandatangan. Sila cuba fail lain.', 'error');
      }
    };

    img.src = dataUrl;
  }, [onSave, clearCanvasWithWhite]);

  // Initialize canvas with clean white on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      clearCanvasWithWhite(canvas);
    }
  }, [clearCanvasWithWhite]);

  // When person changes, reset to empty
  useEffect(() => {
    if (personName !== prevPersonRef.current) {
      prevPersonRef.current = personName;
      userClearedRef.current = false;
    }
  }, [personName]);

  // Load initialSignature ONLY if editing an existing record and user hasn't cleared
  useEffect(() => {
    if (userClearedRef.current) return;

    if (initialSignature && !hasSignature) {
      drawImageToCanvas(initialSignature, 'initial', true);
    }
  }, [initialSignature, hasSignature, drawImageToCanvas]);

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

    // Draw initial dot for instant responsiveness
    ctx.fillStyle = penColor;
    ctx.beginPath();
    ctx.arc(x, y, penWidth / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, y);
    lastCoordRef.current = { x, y };
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

    const current = getCoordinates(e);
    if (lastCoordRef.current) {
      const midX = (lastCoordRef.current.x + current.x) / 2;
      const midY = (lastCoordRef.current.y + current.y) / 2;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.quadraticCurveTo(lastCoordRef.current.x, lastCoordRef.current.y, midX, midY);
      ctx.stroke();
      lastCoordRef.current = current;
    } else {
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      lastCoordRef.current = current;
    }
    setHasSignature(true);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastCoordRef.current = null;
    
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

  // Explicitly clear signature to blank
  const clearOldSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      clearCanvasWithWhite(canvas);
    }
    userClearedRef.current = true;
    setHasSignature(false);
    setSigSource(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear();
    onSave('');
    showFeedback('Ruangan tandatangan dikosongkan. Sila turunkan tandatangan baharu.', 'info');
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showFeedback('Sila pilih fail berformat imej.', 'error');
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

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
      {/* Header Bar: Label, Recipient Name & Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-black text-slate-800 flex items-center gap-1.5">
              <PencilSquareIcon className="h-4 w-4 text-indigo-600" />
              {label}
            </label>
            {hasSignature ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm ${
                sigSource === 'uploaded'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : sigSource === 'drawn'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
                {sigSource === 'initial' ? 'Tandatangan Sedia Ada' : 'Tandatangan Baharu Disimpan'}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Ruangan Kosong (Belum Ditandatangani)
              </span>
            )}
          </div>
          {personName && (
            <p className="text-xs text-slate-500 font-medium mt-1 truncate max-w-sm">
              Nama: <span className="font-bold text-slate-700">{personName}</span>
            </p>
          )}
        </div>

        {/* Top Right Action: Padam Tandatangan / Kosongkan Ruangan */}
        <div className="flex items-center gap-1.5">
          {hasSignature ? (
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Padam tandatangan ini dan kosongkan ruangan untuk tandatangan baharu"
            >
              <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
              {sigSource === 'initial' ? 'Padam Tandatangan Terdahulu' : 'Kosongkan Ruangan'}
            </button>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-200">
              Sedia untuk tandatangan baharu
            </span>
          )}
        </div>
      </div>

      {/* Main Mode Switcher: Tandatangan Guna Pen vs Muat Naik Tandatangan */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
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
        /* --- PEN CONTROLS: Pilihan Warna Dakwat Rasmi Yang Boleh Dibaca --- */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-600">Warna Dakwat (Boleh Dibaca):</span>
            <div className="inline-flex rounded-lg p-0.5 bg-white border border-slate-200 shadow-sm">
              <button
                type="button"
                onClick={() => setPenColor('#0f172a')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  penColor === '#0f172a'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Dakwat Hitam Rasmi (Jelas & Boleh Dibaca)"
              >
                <span className="w-2 h-2 rounded-full bg-slate-900 border border-white" />
                Hitam Rasmi
              </button>
              <button
                type="button"
                onClick={() => setPenColor('#1e3a8a')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  penColor === '#1e3a8a'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-900'
                }`}
                title="Dakwat Biru Gelap Rasmi (Jelas & Boleh Dibaca)"
              >
                <span className="w-2 h-2 rounded-full bg-blue-900 border border-white" />
                Biru Gelap Rasmi
              </button>
            </div>
          </div>

          {hasSignature && (
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-all flex items-center gap-1 shadow-sm active:scale-95 self-end sm:self-auto"
            >
              <TrashIcon className="w-3.5 h-3.5" />
              Padam Tulisan
            </button>
          )}
        </div>
      ) : (
        /* --- UPLOAD CONTROLS --- */
        <div className="flex items-center justify-between gap-3 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <DocumentArrowUpIcon className="w-4 h-4" />
            </div>
            <p className="font-bold text-blue-950 text-xs">
              Muat Naik Fail Imej Tandatangan Baharu
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <ArrowUpTrayIcon className="w-3.5 h-3.5" />
            Pilih Fail Imej
          </button>
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
        className={`relative rounded-xl overflow-hidden transition-all shadow-inner border-2 ${
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
          width={560}
          height={180}
          style={{ touchAction: 'none' }}
          className={`w-full h-40 bg-white block select-none ${
            activeMode === 'pen' ? 'cursor-crosshair' : 'cursor-default'
          }`}
          onPointerDown={activeMode === 'pen' ? handlePointerDown : undefined}
          onPointerMove={activeMode === 'pen' ? handlePointerMove : undefined}
          onPointerUp={activeMode === 'pen' ? handlePointerUp : undefined}
          onPointerCancel={activeMode === 'pen' ? handlePointerUp : undefined}
        />

        {/* Elegant Official Signature Baseline Guide (Physical form style) */}
        {!hasSignature && activeMode === 'pen' && (
          <div className="pointer-events-none absolute inset-x-8 bottom-7 border-b border-dashed border-slate-300 flex items-center justify-between text-[11px] text-slate-400 font-medium select-none pb-0.5">
            <span className="font-bold text-slate-400">✕ Tandatangan di atas garisan</span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">LAM-PT-03-04</span>
          </div>
        )}

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
              <div className="space-y-1">
                <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-1 border border-indigo-100 shadow-sm">
                  <PencilSquareIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-600">
                  ✍️ Sila tandatangan di sini
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-1 border border-blue-100 shadow-sm">
                  <ArrowUpTrayIcon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-blue-800">
                  Klik untuk pilih fail imej tandatangan
                </p>
              </div>
            )}
          </div>
        )}

        {/* Canvas Corner Overlays when signature exists */}
        {hasSignature && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-200">
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Padam tandatangan ini"
            >
              <TrashIcon className="h-3.5 w-3.5 text-rose-600" />
              Padam
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeMode === 'upload') {
                  fileInputRef.current?.click();
                } else {
                  clearOldSignature();
                }
              }}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title={activeMode === 'upload' ? 'Pilih fail imej lain' : 'Lukis semula tandatangan'}
            >
              <ArrowPathIcon className="h-3.5 w-3.5 text-indigo-600" />
              {activeMode === 'upload' ? 'Tukar Fail' : 'Lukis Semula'}
            </button>
          </div>
        )}

        {/* Drag-over indicator */}
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-0 bg-blue-500/10 backdrop-blur-[1px] flex items-center justify-center border-2 border-dashed border-blue-600 rounded-xl">
            <div className="bg-white px-4 py-2.5 rounded-xl shadow-lg border border-blue-200 flex items-center gap-2 text-xs font-bold text-blue-700 animate-bounce">
              <PhotoIcon className="w-5 h-5 text-blue-600" />
              Lepaskan fail imej di sini untuk muat naik
            </div>
          </div>
        )}
      </div>

      {/* Toast Feedback */}
      {feedback && (
        <div className="flex justify-end text-[11px] min-h-[18px]">
          <span className={`font-bold animate-in fade-in duration-200 flex items-center gap-1 ${
            feedback.type === 'error' 
              ? 'text-rose-600' 
              : feedback.type === 'info' 
                ? 'text-amber-600' 
                : 'text-emerald-600'
          }`}>
            <CheckCircleIcon className="h-3.5 w-3.5" /> {feedback.message}
          </span>
        </div>
      )}
    </div>
  );
};
