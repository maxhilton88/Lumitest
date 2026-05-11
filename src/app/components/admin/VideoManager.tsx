import React, { useState, useEffect, useCallback } from 'react';
import {
  Video, Plus, RefreshCw, Trash2, Pencil, X, Save,
  Star, Crown, Check, Search, Upload, Loader2, Globe,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchAdminVideos,
  createAdminVideo,
  updateAdminVideo,
  deleteAdminVideo,
  uploadVideoThumbnail,
  fetchMediaCategories,
} from '../../utils/api';

interface AdminVideo {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail_url: string;
  dyntube_key: string;
  duration: string;
  episode?: number | null;
  category: string;
  language: string;
  series_id?: string | null;
  is_premium: boolean;
  is_featured: boolean;
  order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MediaCategory {
  id: string;
  name: string;
  type: 'video' | 'audio';
  icon: string;
  color: string;
  order: number;
}

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  thumbnail_url: '',
  dyntube_key: '',
  duration: '0:00',
  episode: null as number | null,
  category: '',
  language: 'en',
  series_id: '',
  is_premium: false,
  is_featured: false,
  order: 0,
  status: 'active',
};

export const VideoManager: React.FC = () => {
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<MediaCategory[]>([]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const videoCategories = categories.filter(c => c.type === 'video');

  // Load data
  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminVideos();
      setVideos(data.videos || []);
    } catch (err: any) {
      console.error('[VideoMgr] Load error:', err);
      toast.error(`Failed to load videos: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await fetchMediaCategories();
      setCategories(cats);
    } catch (err: any) {
      console.error('[VideoMgr] Load categories error:', err);
    }
  }, []);

  useEffect(() => {
    loadVideos();
    loadCategories();
  }, []);

  // CRUD
  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await updateAdminVideo(editingId, {
          title: form.title,
          subtitle: form.subtitle,
          thumbnail_url: form.thumbnail_url,
          dyntube_key: form.dyntube_key,
          duration: form.duration,
          episode: form.episode,
          category: form.category,
          language: form.language,
          series_id: form.series_id || null,
          is_premium: form.is_premium,
          is_featured: form.is_featured,
          order: form.order,
          status: form.status,
        });
        toast.success('Video updated');
      } else {
        await createAdminVideo({
          title: form.title,
          dyntube_key: form.dyntube_key,
          thumbnail_url: form.thumbnail_url,
          category: form.category,
          language: form.language,
          duration: form.duration,
          episode: form.episode,
          series_id: form.series_id || null,
          is_premium: form.is_premium,
          is_featured: form.is_featured,
          order: form.order,
        });
        toast.success('Video created');
      }
      resetForm();
      loadVideos();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    try {
      await deleteAdminVideo(id);
      toast.success('Video deleted');
      loadVideos();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const editVideo = (v: AdminVideo) => {
    setEditingId(v.id);
    setForm({
      title: v.title,
      subtitle: v.subtitle || '',
      thumbnail_url: v.thumbnail_url || '',
      dyntube_key: v.dyntube_key || '',
      duration: v.duration || '0:00',
      episode: v.episode || null,
      category: v.category || '',
      language: v.language || 'en',
      series_id: v.series_id || '',
      is_premium: v.is_premium,
      is_featured: v.is_featured,
      order: v.order || 0,
      status: v.status || 'active',
    });
    setShowForm(true);
  };

  const handleThumbnailUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
      setUploadingThumb(true);
      try {
        const result = await uploadVideoThumbnail(file);
        setForm(prev => ({ ...prev, thumbnail_url: result.signed_url || result.public_url }));
        toast.success('Thumbnail uploaded!');
      } catch (err: any) {
        toast.error(err.message || 'Upload failed');
      } finally {
        setUploadingThumb(false);
      }
    };
    input.click();
  };

  // Filters
  const filtered = videos.filter(v => {
    if (catFilter !== 'all' && v.category !== catFilter) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadVideos(); loadCategories(); }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Video
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setCatFilter('all')}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${catFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All ({videos.length})
        </button>
        {videoCategories.map(cat => {
          const count = videos.filter(v => v.category === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setCatFilter(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${catFilter === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {cat.icon} {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* ===== Form ===== */}
      {showForm && (
        <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              {editingId ? 'Edit Video' : 'Add New Video'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="The Magic Alphabet"
              />
            </div>
            {/* Subtitle */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="A journey across enchanted lands"
              />
            </div>
            {/* DynTube Key */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">DynTube Key</label>
              <input
                type="text"
                value={form.dyntube_key}
                onChange={(e) => setForm({ ...form, dyntube_key: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 font-mono"
                placeholder="abc123xyz"
              />
            </div>
            {/* Thumbnail */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Thumbnail</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="URL or upload image"
                />
                <button
                  type="button"
                  disabled={uploadingThumb}
                  onClick={handleThumbnailUpload}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {uploadingThumb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingThumb ? '...' : 'Upload'}
                </button>
              </div>
            </div>
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="">-- Select --</option>
                {videoCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
                {/* Also allow freeform category slug for backwards compat */}
                <option value="english">English</option>
                <option value="numbers">Numbers</option>
                <option value="bahasa">Bahasa</option>
                <option value="science">Science</option>
                <option value="music">Music</option>
                <option value="movie">Movie</option>
                <option value="sleep">Sleep</option>
              </select>
            </div>
            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Language</label>
              <select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <option value="en">English</option>
                <option value="ms">Bahasa Melayu</option>
                <option value="zh">Chinese</option>
                <option value="multi">Multilingual</option>
              </select>
            </div>
            {/* Duration + Episode + Order row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                <input
                  type="text"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="4:32"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Episode</label>
                <input
                  type="number"
                  value={form.episode ?? ''}
                  onChange={(e) => setForm({ ...form, episode: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  placeholder="#"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                />
              </div>
            </div>
            {/* Series ID */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Series ID (optional)</label>
              <input
                type="text"
                value={form.series_id || ''}
                onChange={(e) => setForm({ ...form, series_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                placeholder="ser_en"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_premium}
                onChange={(e) => setForm({ ...form, is_premium: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
              />
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500" /> Premium
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
              />
              <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-500" /> Featured
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>

          {/* Thumbnail preview */}
          {form.thumbnail_url && (
            <div className="flex items-center gap-3">
              <img
                src={form.thumbnail_url}
                alt="Preview"
                className="w-24 h-14 rounded-lg object-cover border border-gray-200"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-xs text-gray-400">Thumbnail preview</span>
            </div>
          )}

          {/* Save */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : editingId ? 'Update Video' : 'Create Video'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ===== Video List ===== */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Loading videos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Video className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">No videos yet</p>
          <p className="text-xs text-gray-400 mt-1">Click "Add Video" to create your first one</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Video</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Duration</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden lg:table-cell">Lang</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Flags</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, idx) => {
                const cat = videoCategories.find(c => c.id === v.category);
                const langLabel: Record<string, string> = { en: 'EN', ms: 'BM', zh: 'ZH', multi: 'Multi' };
                return (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        {v.thumbnail_url ? (
                          <img
                            src={v.thumbnail_url}
                            alt=""
                            className="w-16 h-9 rounded-md object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <Video className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-gray-900 truncate">{v.title}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {v.dyntube_key ? `Key: ${v.dyntube_key.slice(0, 12)}...` : 'No DynTube key'}
                            {v.episode ? ` | Ep ${v.episode}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {cat ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                          {cat.icon} {cat.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{v.category || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-600">{v.duration}</td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500">
                        <Globe className="w-2.5 h-2.5" /> {langLabel[v.language] || v.language}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {v.is_premium && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                            <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
                          </span>
                        )}
                        {v.is_featured && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700">
                            <Star className="w-2.5 h-2.5 mr-0.5" />
                          </span>
                        )}
                        {v.status === 'draft' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500">
                            DRAFT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => editVideo(v)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400">
        <span>{videos.length} total videos</span>
        <span>{videos.filter(v => v.is_premium).length} premium</span>
        <span>{videos.filter(v => v.status === 'draft').length} drafts</span>
        <span>{videoCategories.length} video categories</span>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Video className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-purple-900">DynTube Video Hosting</p>
          <p className="text-[11px] text-purple-700 mt-0.5">
            Videos are streamed via DynTube (HLS). Enter the DynTube key for each video. Thumbnails can be
            uploaded to R2 or provided as external URLs. Toggle "Premium" to gate content for paid subscribers.
          </p>
        </div>
      </div>
    </div>
  );
};
