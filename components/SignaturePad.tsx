import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  TrashIcon, 
  BookmarkSquareIcon, 
  CheckCircleIcon,
  SparklesIcon,
  PencilSquareIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface Props {
  label: string;
  personName?: string;
  initialSignature?: string;
  savedSignature?: string;
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  onSaveToLibrary?: (signatureDataUrl: string) => void;
}

export const SignaturePad: React.FC<Props> = ({ 
  label, 
  personName,
  initialSignature, 
  savedSignature,
  onSave, 
  onClear,
  onSaveToLibrary
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSavedSource, setIsSavedSource] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Track if user explicitly cleared to prevent useEffect auto-reloading
  const userClearedRef = useRef(false);
  // Track previous personName to reset userClearedRef when person changes
  const prevPersonRef = useRef<string | undefined>(personName);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const drawImageToCanvas = useCallback((dataUrl: string, markAsSaved = false, silent = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
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
      setIsSavedSource(markAsSaved);
      userClearedRef.current = false;
      const finalDataUrl = canvas.toDataURL('image/png');
      onSave(finalDataUrl);
      if (!silent) {
        showFeedback(markAsSaved ? 'Tandatangan tersimpan dimuatkan!' : 'Tandatangan sedia digunakan!', 'success');
      }
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

    if (initialSignature) {
      drawImageToCanvas(initialSignature, false, true);
    } else if (savedSignature && !hasSignature) {
      drawImageToCanvas(savedSignature, true, true);
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
    // Only accept left mouse click (0) or touch/pen (which may be 0 or -1)
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
    setIsSavedSource(false);
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
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
      setHasSignature(true);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    userClearedRef.current = true;
    setHasSignature(false);
    setIsSavedSource(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClear();
    onSave('');
    showFeedback('Tandatangan dipadam. Sila tandatangan semula atau muat naik.', 'info');
  };

  const handleFileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showFeedback('Sila pilih fail format imej (PNG, JPG, WEBP).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        userClearedRef.current = false;
        drawImageToCanvas(result, false);
        showFeedback('Fail imej tandatangan berjaya dimuat naik!', 'success');
      }
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
      drawImageToCanvas(savedSignature, true);
    }
  };

  const handleSaveToLibraryClick = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSaveToLibrary) {
      onSaveToLibrary(dataUrl);
      setIsSavedSource(true);
      showFeedback('Tandatangan berjaya disimpan ke profil!', 'success');
    }
  };

  return (
    <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
      {/* Header bar: Label & Status & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <PencilSquareIcon className="h-4 w-4 text-indigo-600" />
              {label}
            </label>
            {hasSignature ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                isSavedSource 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                <CheckCircleIcon className="h-3 w-3" />
                {isSavedSource ? 'Tersimpan Dimuat' : 'Tandatangan Sedia'}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
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

        {/* Action buttons: Padam, Muat Naik, Guna Tersimpan, Simpan Tetap */}
        <div className="flex items-center flex-wrap gap-1.5">
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

          {hasSignature && onSaveToLibrary && (
            <button
              type="button"
              onClick={handleSaveToLibraryClick}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-lg border border-emerald-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Simpan tandatangan ini ke profil untuk kegunaan pemantauan seterusnya"
            >
              <BookmarkSquareIcon className="w-3.5 h-3.5 text-emerald-600" />
              Simpan Tetap
            </button>
          )}

          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileInputChange} 
            accept="image/*" 
            className="hidden" 
          />

          {/* Muat Naik Fail Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition-all flex items-center gap-1 shadow-sm active:scale-95"
            title="Muat naik fail imej tandatangan anda (PNG, JPG, WEBP)"
          >
            <ArrowUpTrayIcon className="w-3.5 h-3.5 text-indigo-600" />
            Muat Naik
          </button>

          {/* Padam / Reset Button */}
          <button
            type="button"
            onClick={clearCanvas}
            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg border border-rose-300 transition-all flex items-center gap-1 shadow-sm active:scale-95"
            title="Padam tandatangan ini jika berlaku kesilapan dan tandatangan semula"
          >
            <TrashIcon className="w-3.5 h-3.5 text-rose-600" />
            Padam
          </button>
        </div>
      </div>

      {/* Canvas Drawing Area */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative bg-slate-50/50 border-2 rounded-xl overflow-hidden transition-all shadow-inner ${
          isDraggingOver 
            ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-200' 
            : hasSignature 
              ? 'border-emerald-300 bg-white' 
              : 'border-dashed border-slate-300 hover:border-slate-400'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          style={{ touchAction: 'none' }}
          className="w-full h-32 cursor-crosshair select-none bg-white block"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Placeholder Watermark when empty */}
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <p className="text-xs font-semibold text-slate-500">
              ✍️ Tandatangan di sini
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              (Skrin Sentuh / Tetikus / Stylus) atau tarik fail imej ke sini
            </p>
          </div>
        )}

        {/* Clear overlay button on hover if signature exists */}
        {hasSignature && (
          <button
            type="button"
            onClick={clearCanvas}
            className="absolute top-2 right-2 px-2 py-1 bg-white/90 hover:bg-rose-50 text-rose-600 hover:text-rose-700 border border-rose-200 text-[10px] font-bold rounded-md shadow-sm transition-all flex items-center gap-1 opacity-80 hover:opacity-100"
            title="Padam untuk tandatangan semula jika berlaku kesilapan"
          >
            <ArrowPathIcon className="h-3 w-3" />
            Tukar / Padam
          </button>
        )}
      </div>

      {/* Helper text & Toast Notification */}
      <div className="flex justify-between items-center text-[10px] min-h-[18px]">
        <span className="text-slate-400 italic">
          Boleh ditandatangan secara langsung, dimuat naik dari fail, atau dipadam jika berlaku kesilapan.
        </span>
        {feedback && (
          <span className={`font-bold animate-in fade-in duration-200 flex items-center gap-1 ${
            feedback.type === 'error' 
              ? 'text-rose-600' 
              : feedback.type === 'info' 
                ? 'text-amber-600' 
                : 'text-emerald-600'
          }`}>
            <CheckCircleIcon className="h-3 w-3" /> {feedback.message}
          </span>
        )}
      </div>
    </div>
  );
};
