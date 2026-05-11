/**
 * RPGImageManager.tsx — Legacy R2-based image asset uploader.
 *
 * Upload, list, filter, preview, and delete general-purpose images:
 * backgrounds, icons, UI elements, coin/diamond sprites, etc.
 *
 * Uses the /rpg-assets/* server endpoints (R2 storage + KV metadata).
 * Categories: background, foxy, enemy, item, ui, effect, map, avatar, misc
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, Trash2, Loader2, Search, AlertCircle, Image as ImageIcon,
  Upload, Copy, Filter, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchRPGAssets, uploadRPGAsset, deleteRPGAsset, invalidateRPGAssetsCache,
  type RPGAsset,
} from '../../utils/api';

const GOLD = '#d4a44a';

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '📁' },
  { id: 'background', label: 'Backgrounds', emoji: '🖼️' },
  { id: 'foxy', label: 'Foxy', emoji: '🦊' },
  { id: 'enemy', label: 'Enemy', emoji: '👹' },
  { id: 'item', label: 'Items', emoji: '🎒' },
  { id: 'ui', label: 'UI', emoji: '🧩' },
  { id: 'effect', label: 'Effects', emoji: '✨' },
  { id: 'map', label: 'Map', emoji: '🗺️' },
  { id: 'avatar', label: 'Avatar', emoji: '👤' },
  { id: 'icon', label: 'Icons', emoji: '⭐' },
  { id: 'misc', label: 'Misc', emoji: '📦' },
];

export function RPGImageManager() {
  const [assets, setAssets] = useState<RPGAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadSlug, setUploadSlug] = useState('');
  const [uploadCategory, setUploadCategory] = useState('misc');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchRPGAssets();
      setAssets(result.assets || []);
    } catch (err: any) {
      toast.error(`Failed to load assets: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // Filter + search
  const filtered = assets.filter(a => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.slug.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Handle file select
  const handleFileSelect = (file: File) => {
    setUploadFile(file);
    // Auto-generate slug from filename
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    if (!uploadSlug) setUploadSlug(baseName);
    // Preview
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Upload
  const handleUpload = async () => {
    if (!uploadFile) { toast.error('Select a file first'); return; }
    if (!uploadSlug || !/^[a-z0-9][a-z0-9_-]*$/.test(uploadSlug)) {
      toast.error('Invalid slug: use lowercase letters, numbers, hyphens, underscores');
      return;
    }
    setUploading(true);
    try {
      await uploadRPGAsset(uploadFile, uploadSlug, uploadCategory);
      invalidateRPGAssetsCache();
      toast.success(`Uploaded "${uploadSlug}" to ${uploadCategory}`);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadSlug('');
      setShowUploadForm(false);
      await loadAssets();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Delete
  const handleDelete = async (slug: string) => {
    if (confirmDelete !== slug) {
      setConfirmDelete(slug);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    try {
      await deleteRPGAsset(slug);
      invalidateRPGAssetsCache();
      toast.success(`Deleted "${slug}"`);
      setConfirmDelete(null);
      await loadAssets();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  // Copy URL
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{assets.length} image{assets.length !== 1 ? 's' : ''} in R2</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { invalidateRPGAssetsCache(); loadAssets(); }}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Image
          </button>
        </div>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 space-y-3">
          <h4 className="text-xs font-bold text-amber-300">Upload New Image Asset</h4>

          {/* File picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = '';
              }}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 border border-gray-600"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                {uploadFile ? uploadFile.name : 'Choose File'}
              </button>
              {uploadPreview && (
                <img src={uploadPreview} alt="preview" className="w-12 h-12 rounded-lg object-contain bg-gray-900 border border-gray-700" />
              )}
            </div>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Slug (unique ID)</label>
            <input
              type="text"
              value={uploadSlug}
              onChange={e => setUploadSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="e.g. realm-bg-01, coin-icon, foxy-idle"
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none font-mono"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setUploadCategory(cat.id)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-all ${
                    uploadCategory === cat.id
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload button */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { setShowUploadForm(false); setUploadFile(null); setUploadPreview(null); setUploadSlug(''); }}
              className="px-3 py-2 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !uploadFile || !uploadSlug}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Uploading...' : 'Upload to R2'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by slug..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => {
            const count = cat.id === 'all' ? assets.length : assets.filter(a => a.category === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-all ${
                  filterCategory === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
              >
                {cat.emoji} {cat.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Asset Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">{assets.length === 0 ? 'No images uploaded yet' : 'No images match filters'}</p>
          <p className="text-gray-600 text-xs mt-1">Upload backgrounds, icons, UI sprites, and more</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtered.map(asset => {
            const catInfo = CATEGORIES.find(c => c.id === asset.category) || CATEGORIES[CATEGORIES.length - 1];
            return (
              <div
                key={asset.slug}
                className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden group hover:border-gray-600 transition-all"
              >
                {/* Image preview */}
                <div className="aspect-square bg-gray-900 flex items-center justify-center overflow-hidden">
                  {asset.publicUrl ? (
                    <img
                      src={asset.publicUrl}
                      alt={asset.slug}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-700" />
                  )}
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className="text-[11px] font-bold text-white truncate" title={asset.slug}>
                    {asset.slug}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                      {catInfo.emoji} {asset.category}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      {asset.sizeKB ? `${asset.sizeKB}KB` : ''}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {asset.publicUrl && (
                      <button
                        onClick={() => copyUrl(asset.publicUrl)}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                        title="Copy URL"
                      >
                        <Copy className="w-3 h-3" />
                        Copy URL
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(asset.slug)}
                      className={`px-2 py-1 rounded text-[10px] ${
                        confirmDelete === asset.slug
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-700 text-gray-400 hover:bg-red-500/20 hover:text-red-400'
                      }`}
                      title={confirmDelete === asset.slug ? 'Click again to confirm' : 'Delete'}
                    >
                      {confirmDelete === asset.slug ? <AlertCircle className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
