/**
 * RPGAssetUploader.tsx — Reusable file upload slot for RPG entities.
 * Handles drag-drop, preview, upload to Supabase Storage, signed URL display.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Check, Image as ImageIcon, Music, FileJson } from 'lucide-react';
import { rpgGameUpload, rpgGameDeleteFile, rpgGameSignedUrl } from '../../utils/api';
import { toast } from 'sonner@2.0.3';

interface AssetSlotProps {
  /** Storage path for this asset (e.g. "spirits/flamewing/battle.png") */
  storagePath: string;
  /** Current stored path (if already uploaded) */
  currentPath?: string;
  /** Current signed URL (for preview) */
  currentUrl?: string;
  /** Label to display */
  label: string;
  /** Hint text */
  hint?: string;
  /** Accept attribute for file input */
  accept?: string;
  /** Called when upload completes with new storage path */
  onUploaded: (storagePath: string, signedUrl: string) => void;
  /** Called when file is removed */
  onRemoved?: () => void;
  /** Whether compact mode (smaller) */
  compact?: boolean;
}

export function RPGAssetSlot({
  storagePath,
  currentPath,
  currentUrl,
  label,
  hint,
  accept = 'image/*',
  onUploaded,
  onRemoved,
  compact = false,
}: AssetSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isImage = accept?.includes('image');
  const isAudio = accept?.includes('audio');
  const isJson = accept?.includes('json');
  const hasFile = !!currentPath;

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      // Ensure the storage path has the right extension
      const finalPath = storagePath.replace(/\.[^.]+$/, '') + '.' + ext;

      const result = await rpgGameUpload(file, finalPath);
      
      if (isImage) {
        // Use local blob for immediate preview
        setPreviewUrl(URL.createObjectURL(file));
      }
      
      onUploaded(finalPath, result.signedUrl || '');
      toast.success(`Uploaded ${label}`);
    } catch (err: any) {
      console.error('[RPG-UPLOAD]', err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }, [storagePath, label, onUploaded, isImage]);

  const handleRemove = useCallback(async () => {
    if (!currentPath) return;
    try {
      await rpgGameDeleteFile(currentPath);
      setPreviewUrl(null);
      onRemoved?.();
      toast.success(`Removed ${label}`);
    } catch (err: any) {
      toast.error(`Remove failed: ${err.message}`);
    }
  }, [currentPath, label, onRemoved]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // Refresh signed URL if we have a path but no URL
  React.useEffect(() => {
    if (currentPath && !previewUrl && isImage) {
      rpgGameSignedUrl(currentPath).then(url => {
        if (url) setPreviewUrl(url);
      });
    }
  }, [currentPath, previewUrl, isImage]);

  // Update preview when currentUrl changes externally
  React.useEffect(() => {
    if (currentUrl) setPreviewUrl(currentUrl);
  }, [currentUrl]);

  const size = compact ? 'w-24 h-24' : 'w-32 h-32';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`${size} relative rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden group ${
          dragOver
            ? 'border-amber-400 bg-amber-400/10'
            : hasFile
            ? 'border-emerald-500/40 bg-emerald-900/10'
            : 'border-gray-600 bg-gray-800/40 hover:border-gray-500'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
            e.target.value = '';
          }}
        />

        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          </div>
        ) : previewUrl && isImage ? (
          <>
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-contain p-1 bg-gray-900"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : hasFile ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            {isAudio ? (
              <Music className="w-6 h-6 text-emerald-400" />
            ) : isJson ? (
              <FileJson className="w-6 h-6 text-blue-400" />
            ) : (
              <Check className="w-6 h-6 text-emerald-400" />
            )}
            <span className="text-[9px] text-emerald-400 font-medium">Uploaded</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Upload className="w-5 h-5 text-gray-500" />
            {hint && (
              <span className="text-[9px] text-gray-500 text-center px-1">{hint}</span>
            )}
          </div>
        )}

        {/* Remove button */}
        {hasFile && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); handleRemove(); }}
            className="absolute top-1 right-1 p-0.5 bg-red-500/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      <div className="text-center">
        <p className={`font-bold ${compact ? 'text-[10px]' : 'text-xs'} ${hasFile ? 'text-emerald-400' : 'text-gray-400'}`}>
          {label}
        </p>
        {hasFile && (
          <p className="text-[9px] text-emerald-600">
            <Check className="w-2.5 h-2.5 inline mr-0.5" />
            Ready
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Multi-slot asset uploader — renders a grid of RPGAssetSlots for an entity.
 */
interface MultiSlotProps {
  entityType: string;
  entityId: string;
  slots: readonly { key: string; label: string; accept?: string; hint?: string }[];
  assets: Record<string, string>;
  signedUrls: Record<string, string>;
  onAssetChange: (key: string, path: string | null) => void;
  compact?: boolean;
}

export function RPGMultiSlotUploader({
  entityType,
  entityId,
  slots,
  assets,
  signedUrls,
  onAssetChange,
  compact = false,
}: MultiSlotProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {slots.map(slot => (
        <RPGAssetSlot
          key={slot.key}
          storagePath={`${entityType}s/${entityId}/${slot.key}`}
          currentPath={assets[slot.key] || undefined}
          currentUrl={signedUrls[assets[slot.key] || ''] || undefined}
          label={slot.label}
          hint={slot.hint}
          accept={slot.accept || 'image/*'}
          compact={compact}
          onUploaded={(path, url) => onAssetChange(slot.key, path)}
          onRemoved={() => onAssetChange(slot.key, null)}
        />
      ))}
    </div>
  );
}
