/**
 * RPGLegacyAssetManager.tsx — Flat slug-based asset uploader for general site images.
 *
 * This is the original R2 asset pipeline where you upload images with a slug + category.
 * Used by: HomePage (hero-01, hero-bg, hero-char, for_kindergarten),
 *          KGMapPage (hero-01, kinder2), ParentsPage (kid_study, parents-2),
 *          RealmContext (realm-bg, game_egg, foxy-practice, game-coin, game-diamond, etc.),
 *          BagPage (bag_header, shop_header), and more.
 *
 * Uploads go to R2 via the /rpg-assets/upload server endpoint.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Trash2, Search, Loader2, Image, FolderOpen,
  RefreshCw, X, AlertCircle, Eye,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchRPGAssets, uploadRPGAsset, invalidateRPGAssetsCache,
  type RPGAsset,
} from '../../utils/api';

const GOLD = '#d4a44a';

// Common categories for organizing assets
const CATEGORIES = [
  'all', 'background', 'foxy', 'icon', 'item', 'ui', 'character',
  'hero', 'marketing', 'quest', 'zone', 'misc',
];

export function RPGLegacyAssetManager() {
  const [assets, setAssets] = useState<RPGAsset[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Upload form state
  const [uploadSlug, setUploadSlug] = useState('');
  const [uploadCategory, setUploadCategory] = useState('misc');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchRPGAssets(selectedCategory === 'all' ? undefined : selectedCategory);
      setAssets(result.assets || []);
      // Always fetch all categories for the filter
      if (selectedCategory === 'all') {
        setCategories(result.categories || []);
      }
    } catch (err: any) {
      toast.error(`Failed to load assets: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  // Filter by search
  const filteredAssets = assets.filter(a =>
    !searchQuery || a.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    // Auto-generate slug from filename if empty
    if (!uploadSlug) {
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      setUploadSlug(baseName);
    }
    // Preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadSlug.trim()) {
      toast.error('Please select a file and enter a slug');
      return;
    }
    setUploading(true);
    try {
      await uploadRPGAsset(uploadFile, uploadSlug.trim(), uploadCategory);
      invalidateRPGAssetsCache();
      toast.success(`Uploaded "${uploadSlug}" to ${uploadCategory}`);
      // Reset form
      setUploadFile(null);
      setUploadSlug('');
      setUploadPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadAssets();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const clearUploadForm = () => {
    setUploadFile(null);
    setUploadSlug('');
    setUploadPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Upload form */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
        <h4 className="text-xs font-bold text-amber-300 flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          Upload New Asset
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Slug (unique ID) *</label>
            <input
              type="text"
              value={uploadSlug}
              onChange={e => setUploadSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase())}
              placeholder="e.g. hero-01, realm-bg, game-coin"
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Category</label>
            <select
              value={uploadCategory}
              onChange={e => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-900 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            >
              {CATEGORIES.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* File picker + preview */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg cursor-pointer transition-colors">
            <Image className="w-3.5 h-3.5" />
            {uploadFile ? uploadFile.name : 'Choose File'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,audio/*,video/*,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>

          {uploadPreview && (
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-600 shrink-0">
              <img src={uploadPreview} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          {uploadFile && (
            <button onClick={clearUploadForm} className="p-1.5 hover:bg-gray-700 rounded-lg">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={handleUpload}
            disabled={uploading || !uploadFile || !uploadSlug.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Category pills */}
        <div className="flex gap-1 flex-wrap flex-1">
          {['all', ...categories.filter(c => c !== 'all')].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-all ${
                selectedCategory === cat
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search slugs..."
            className="pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none w-40"
          />
        </div>

        <button onClick={() => { invalidateRPGAssetsCache(); loadAssets(); }} className="p-1.5 hover:bg-gray-700 rounded-lg">
          <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Asset count */}
      <p className="text-xs text-gray-500">
        {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''}
        {selectedCategory !== 'all' ? ` in "${selectedCategory}"` : ''}
        {searchQuery ? ` matching "${searchQuery}"` : ''}
      </p>

      {/* Asset grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No assets found</p>
          <p className="text-gray-600 text-xs mt-1">Upload images above to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filteredAssets.map(asset => (
            <div
              key={asset.slug}
              className="bg-gray-800/60 border border-gray-700 rounded-xl p-2 group hover:border-gray-600 transition-colors"
            >
              {/* Preview */}
              <div className="aspect-square rounded-lg bg-gray-900 overflow-hidden mb-2 flex items-center justify-center border border-gray-800">
                {asset.publicUrl ? (
                  <img
                    src={asset.publicUrl}
                    alt={asset.slug}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <Image className="w-8 h-8 text-gray-700" />
                )}
              </div>

              {/* Info */}
              <p className="text-[11px] font-bold text-white truncate" title={asset.slug}>
                {asset.slug}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                  {asset.category || 'misc'}
                </span>
                {asset.sizeKB && (
                  <span className="text-[9px] text-gray-600">
                    {asset.sizeKB > 1024 ? `${(asset.sizeKB / 1024).toFixed(1)}MB` : `${asset.sizeKB}KB`}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {asset.publicUrl && (
                  <a
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-700 rounded"
                    title="View full size"
                  >
                    <Eye className="w-3 h-3 text-gray-400" />
                  </a>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(asset.slug);
                    toast.success(`Slug "${asset.slug}" copied!`);
                  }}
                  className="p-1 hover:bg-gray-700 rounded text-[9px] text-gray-400"
                  title="Copy slug"
                >
                  Copy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slug reference */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-3">
        <h4 className="text-[10px] font-bold text-gray-400 mb-1.5">Common Slugs Reference</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] text-gray-500">
          <span><code className="text-amber-400/70">realm-bg</code> — Realm background (portrait)</span>
          <span><code className="text-amber-400/70">realm-bg-landscape</code> — Realm BG landscape</span>
          <span><code className="text-amber-400/70">game_egg</code> — Foxy egg sprite</span>
          <span><code className="text-amber-400/70">foxy-practice</code> — Foxy hatched sprite</span>
          <span><code className="text-amber-400/70">game-coin</code> — Gold coin icon</span>
          <span><code className="text-amber-400/70">game-diamond</code> — Diamond icon</span>
          <span><code className="text-amber-400/70">realm_bag</code> — Bag icon</span>
          <span><code className="text-amber-400/70">realm_shield</code> — Battle/shield icon</span>
          <span><code className="text-amber-400/70">realm_map</code> — Quest map icon</span>
          <span><code className="text-amber-400/70">stroll</code> — Magic button image</span>
          <span><code className="text-amber-400/70">hero-01</code> — Homepage hero image</span>
          <span><code className="text-amber-400/70">hero-bg</code> — Homepage hero BG</span>
          <span><code className="text-amber-400/70">hero-char</code> — Homepage character</span>
          <span><code className="text-amber-400/70">for_kindergarten</code> — KG promo image</span>
          <span><code className="text-amber-400/70">kid_study</code> — Parents page image</span>
          <span><code className="text-amber-400/70">parents-2</code> — Parents page image 2</span>
        </div>
      </div>
    </div>
  );
}
