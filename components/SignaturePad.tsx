import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  ArrowUpTrayIcon, 
  TrashIcon, 
  BookmarkSquareIcon, 
  CheckCircleIcon,
  SparklesIcon
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
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const drawImageToCanvas = useCallback((dataUrl: string, markAsSaved = false) => {
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
      onSave(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  }, [onSave]);

  // Load initial or saved signature when available
  useEffect(() => {
    if (initialSignature) {
      drawImageToCanvas(initialSignature, false);
    } else if (savedSignature && !hasSignature) {
      // Auto-load saved signature if none exists currently
      drawImageToCanvas(savedSignature, true);
    } else if (!initialSignature && !savedSignature && !hasSignature) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [initialSignature, savedSignature, drawImageToCanvas]);

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
    // Only respond to primary mouse click or touch/pen
    if (e.button !== 0) return;
    
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
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setIsSavedSource(false);
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
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setIsSavedSource(false);
    onClear();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        drawImageToCanvas(result, false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input so same file can be re-uploaded
  };

  const handleUseSaved = () => {
    if (savedSignature) {
      drawImageToCanvas(savedSignature, true);
      setSaveFeedback('Tandatangan tersimpan dimuatkan!');
      setTimeout(() => setSaveFeedback(null), 2500);
    }
  };

  const handleSaveToLibraryClick = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSaveToLibrary) {
      onSaveToLibrary(dataUrl);
      setIsSavedSource(true);
      setSaveFeedback('Tandatangan berjaya disimpan!');
      setTimeout(() => setSaveFeedback(null), 2500);
    }
  };

  return (
    <div className="space-y-2.5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label className="block text-sm font-bold text-slate-800">{label}</label>
          {hasSignature ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
              isSavedSource 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}>
              <CheckCircleIcon className="h-3 w-3" />
              {isSavedSource ? 'Tersimpan' : 'Sedia'}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
              Belum Ditandatangani
            </span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          {savedSignature && (
            <button
              type="button"
              onClick={handleUseSaved}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-black rounded-lg border border-amber-200 transition-all flex items-center gap-1 shadow-sm"
              title="Gunakan tandatangan yang telah tersimpan dalam profil sistem"
            >
              <SparklesIcon className="w-3 h-3 text-amber-600" />
              Guna Tersimpan
            </button>
          )}

          {hasSignature && onSaveToLibrary && (
            <button
              type="button"
              onClick={handleSaveToLibraryClick}
              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-lg border border-emerald-200 transition-all flex items-center gap-1 shadow-sm"
              title="Simpan tandatangan ini ke profil untuk kegunaan borang seterusnya"
            >
              <BookmarkSquareIcon className="w-3 h-3 text-emerald-600" />
              Simpan Tetap
            </button>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*" 
            className="hidden" 
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-all flex items-center gap-1 shadow-sm"
          >
            <ArrowUpTrayIcon className="w-3 h-3 text-slate-500" />
            Muat Naik
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 text-[10px] font-bold rounded-lg border border-rose-200 transition-all flex items-center gap-1 shadow-sm"
          >
            <TrashIcon className="w-3 h-3 text-rose-500" />
            Padam
          </button>
        </div>
      </div>

      <div className="relative bg-white border-2 border-dashed border-slate-300 rounded-xl overflow-hidden group shadow-inner">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          style={{ touchAction: 'none' }}
          className="w-full h-32 cursor-crosshair select-none bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        {!hasSignature && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-slate-300 text-xs font-medium italic">
            Tandatangan di sini (Skrin Sentuh / Tetikus / Stylus)
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-[10px]">
        <p className="text-slate-500 italic">
          {personName ? `Nama: ${personName}` : 'Sila tandatangan atau muat naik fail imej'}
        </p>
        {saveFeedback && (
          <span className="font-bold text-emerald-600 animate-in fade-in duration-200 flex items-center gap-1">
            <CheckCircleIcon className="h-3 w-3" /> {saveFeedback}
          </span>
        )}
      </div>
    </div>
  );
};
