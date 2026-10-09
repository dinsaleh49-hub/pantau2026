import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  TrashIcon, 
  BookmarkSquareIcon, 
  CheckCircleIcon,
  SparklesIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  PhotoIcon
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
    // fallback
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
          showFeedback('Tandatangan baru berjaya dimuat naik & sedia digunakan!', 'success');
        } else if (source === 'saved') {
          showFeedback('Tandatangan tersimpan daripada profil dimuatkan!', 'success');
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
    // Only accept left mouse click (0) or touch/pen
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if pointer capture unsupported
    }

    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
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

  // Explicitly clear old/existing signature
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
    showFeedback('Tandatangan lama telah dipadam. Sila muat naik tandatangan baru atau tandatangan di kanvas.', 'info');
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
    e.target.value = ''; // Reset input to allow selecting the same file again
  };

  // Drag and drop handlers on canvas
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
      showFeedback('Tandatangan baru ini berjaya disimpan ke profil!', 'success');
    }
  };

  const handleDeleteSavedClick = () => {
    if (onDeleteFromLibrary) {
      onDeleteFromLibrary();
      showFeedback('Tandatangan lama dalam profil telah dipadam.', 'info');
    }
  };

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
      {/* Header bar: Label & Status & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
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
                {sigSource === 'uploaded' && 'Tandatangan Baru Dimuat Naik'}
                {sigSource === 'drawn' && 'Tandatangan Baru Dilukis'}
                {sigSource === 'saved' && 'Tersimpan (Profil)'}
                {sigSource === 'initial' && 'Tandatangan Sedia (Lama)'}
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

        {/* Action buttons: Padam Yang Lama, Muat Naik Baru, Guna Tersimpan, Simpan Profil */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Button: Muat Naik Tandatangan Baru */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            title="Muat naik fail imej tandatangan baru (PNG, JPG, JPEG, WEBP)"
          >
            <ArrowUpTrayIcon className="w-3.5 h-3.5" />
            Muat Naik Baru
          </button>

          {/* Button: Padam Tandatangan Lama / Semasa */}
          {hasSignature && (
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold rounded-lg border border-rose-300 transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
              title="Padam tandatangan lama atau yang sedang dipaparkan"
            >
              <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
              Padam Yang Lama
            </button>
          )}

          {/* Button: Guna Tersimpan jika ada dalam profil */}
          {savedSignature && (
            <button
              type="button"
              onClick={handleUseSaved}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg border border-amber-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Gunakan tandatangan yang telah tersimpan dalam profil sistem"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-600" />
              Guna Tersimpan
            </button>
          )}

          {/* Button: Simpan ke Profil */}
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

          {/* Button: Padam dari Profil (jika ada disimpan di sistem) */}
          {savedSignature && onDeleteFromLibrary && (
            <button
              type="button"
              onClick={handleDeleteSavedClick}
              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-[10px] font-medium rounded-lg border border-slate-200 hover:border-rose-200 transition-all"
              title="Padam tandatangan tersimpan dalam profil sistem"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            accept="image/png, image/jpeg, image/jpg, image/webp" 
            className="hidden" 
          />
        </div>
      </div>

      {/* Canvas Drawing & Drop Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-slate-50/50 border-2 rounded-xl overflow-hidden transition-all shadow-inner ${
          isDraggingOver 
            ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-200' 
            : hasSignature 
              ? 'border-emerald-300 bg-white ring-1 ring-emerald-100' 
              : 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/30'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          style={{ touchAction: 'none' }}
          className="w-full h-36 cursor-crosshair select-none bg-white block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Placeholder Watermark when empty */}
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center select-none">
            <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              ✍️ Tandatangan di sini (Skrin Sentuh / Tetikus / Stylus)
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              atau klik butang <span className="font-bold text-indigo-600">"Muat Naik Baru"</span> untuk memuat naik fail imej
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              (Format PNG, JPG, WEBP disokong)
            </p>
          </div>
        )}

        {/* Action Overlay Buttons inside the Canvas when signature exists */}
        {hasSignature && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-200">
            <button
              type="button"
              onClick={clearOldSignature}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-[10px] font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Padam tandatangan lama ini dan kosongkan ruang"
            >
              <TrashIcon className="h-3 w-3 text-rose-600" />
              Padam
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 text-[10px] font-bold rounded-lg border border-indigo-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Muat naik fail imej tandatangan baru untuk menggantikan yang sedia ada"
            >
              <ArrowUpTrayIcon className="h-3 w-3 text-indigo-600" />
              Muat Naik Baru
            </button>
          </div>
        )}

        {/* Drag-over indicator */}
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-0 bg-indigo-500/10 backdrop-blur-[1px] flex items-center justify-center border-2 border-dashed border-indigo-600 rounded-xl">
            <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-indigo-200 flex items-center gap-2 text-xs font-bold text-indigo-700 animate-bounce">
              <PhotoIcon className="w-4 h-4 text-indigo-600" />
              Lepaskan fail imej di sini untuk muat naik
            </div>
          </div>
        )}
      </div>

      {/* Guide text & Toast Feedback notification */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[11px] min-h-[20px]">
        <span className="text-slate-500 font-medium">
          💡 Anda boleh <span className="font-bold text-rose-600">padam yang lama</span> dan <span className="font-bold text-indigo-600">muat naik tandatangan yang baru</span> atau lukis terus di ruang kanvas.
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
