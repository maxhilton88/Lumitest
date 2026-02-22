import React, { useState, useEffect, useCallback } from 'react';
import {
  Music, Video, Plus, RefreshCw, Trash2, Pencil, X, Save,
  Star, Crown, Check, Search, ChevronDown, Upload, Loader2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchMediaCategories,
  saveMediaCategory,
  deleteMediaCategory,
  fetchAdminAudioTracks,
  saveAdminAudioTrack,
  deleteAdminAudioTrack,
  uploadAudioFile,
  uploadAlbumArt,
} from '../../utils/api';

// ===== TYPES =====
interface MediaCategory {
  id: string;
  name: string;
  type: 'video' | 'audio';
  icon: string;
  color: string;
  order: number;
  created_at: string;
}

interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  album_art: string;
  audio_url: string;
  duration: string;
  duration_sec: number;
  category: string;
  is_premium: boolean;
  is_featured: boolean;
  order: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ===== COMPONENT =====
export const MediaManager: React.FC = () => {
  const [subTab, setSubTab] = useState<'audio' | 'categories'>('audio');

  // Categories state
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'audio' as 'video' | 'audio', icon: '🎵', color: '#d4a44a', order: 0 });
  const [savingCat, setSavingCat] = useState(false);

  // Audio tracks state
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [showTrackForm, setShowTrackForm] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackForm, setTrackForm] = useState({
    title: '',
    artist: 'Foxy & Friends',
    album_art: '',
    audio_url: '',
    duration: '0:00',
    duration_sec: 0,
    category: '',
    is_premium: false,
    is_featured: false,
    order: 0,
    status: 'active',
  });
  const [savingTrack, setSavingTrack] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [trackCategoryFilter, setTrackCategoryFilter] = useState<string>('all');

  // Upload state
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingArt, setUploadingArt] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [durationAutoDetected, setDurationAutoDetected] = useState(false);

  // Inline quick-add category state
  const [showQuickCat, setShowQuickCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickCatIcon, setQuickCatIcon] = useState('🎵');
  const [quickCatColor, setQuickCatColor] = useState('#d4a44a');
  const [savingQuickCat, setSavingQuickCat] = useState(false);

  // ── Load data ──
  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const cats = await fetchMediaCategories();
      setCategories(cats);
    } catch (err: any) {
      console.error('[MEDIA] Load categories error:', err);
      toast.error(`Failed to load categories: ${err.message}`);
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  const loadTracks = useCallback(async () => {
    setTracksLoading(true);
    try {
      const t = await fetchAdminAudioTracks();
      setTracks(t);
    } catch (err: any) {
      console.error('[MEDIA] Load tracks error:', err);
      toast.error(`Failed to load tracks: ${err.message}`);
    } finally {
      setTracksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadTracks();
  }, []);

  // ── Category CRUD ──
  const resetCatForm = () => {
    setShowCatForm(false);
    setEditingCatId(null);
    setCatForm({ name: '', type: 'audio', icon: '🎵', color: '#d4a44a', order: 0 });
  };

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) { toast.error('Name is required'); return; }
    setSavingCat(true);
    try {
      await saveMediaCategory({
        ...(editingCatId ? { id: editingCatId } : {}),
        name: catForm.name,
        type: catForm.type,
        icon: catForm.icon,
        color: catForm.color,
        order: catForm.order,
      });
      toast.success(editingCatId ? 'Category updated' : 'Category created');
      resetCatForm();
      loadCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Tracks in it will become uncategorized.')) return;
    try {
      await deleteMediaCategory(id);
      toast.success('Category deleted');
      loadCategories();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const editCategory = (cat: MediaCategory) => {
    setEditingCatId(cat.id);
    setCatForm({ name: cat.name, type: cat.type, icon: cat.icon, color: cat.color, order: cat.order });
    setShowCatForm(true);
  };

  // ── Audio Track CRUD ──
  const resetTrackForm = () => {
    setShowTrackForm(false);
    setEditingTrackId(null);
    setTrackForm({
      title: '', artist: 'Foxy & Friends', album_art: '', audio_url: '',
      duration: '0:00', duration_sec: 0, category: '', is_premium: false,
      is_featured: false, order: 0, status: 'active',
    });
    setDurationAutoDetected(false);
    setAudioFileName(null);
  };

  const handleSaveTrack = async () => {
    if (!trackForm.title.trim()) { toast.error('Title is required'); return; }
    setSavingTrack(true);
    try {
      await saveAdminAudioTrack({
        ...(editingTrackId ? { id: editingTrackId } : {}),
        ...trackForm,
      });
      toast.success(editingTrackId ? 'Track updated' : 'Track created');
      resetTrackForm();
      loadTracks();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingTrack(false);
    }
  };

  const handleDeleteTrack = async (id: string) => {
    if (!confirm('Delete this audio track?')) return;
    try {
      await deleteAdminAudioTrack(id);
      toast.success('Track deleted');
      loadTracks();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const editTrack = (track: AudioTrack) => {
    setEditingTrackId(track.id);
    setTrackForm({
      title: track.title,
      artist: track.artist,
      album_art: track.album_art,
      audio_url: track.audio_url,
      duration: track.duration,
      duration_sec: track.duration_sec,
      category: track.category,
      is_premium: track.is_premium,
      is_featured: track.is_featured,
      order: track.order,
      status: track.status,
    });
    setShowTrackForm(true);
  };

  // ── Filtered tracks ──
  const audioCategories = categories.filter(c => c.type === 'audio');
  const filteredTracks = tracks.filter(t => {
    if (trackCategoryFilter !== 'all' && t.category !== trackCategoryFilter) return false;
    if (trackSearch && !t.title.toLowerCase().includes(trackSearch.toLowerCase()) && !t.artist.toLowerCase().includes(trackSearch.toLowerCase())) return false;
    return true;
  });

  // ── Inline quick-add category ──
  const handleSaveQuickCat = async () => {
    if (!quickCatName.trim()) { toast.error('Name is required'); return; }
    setSavingQuickCat(true);
    try {
      const result = await saveMediaCategory({
        name: quickCatName,
        type: 'audio',
        icon: quickCatIcon,
        color: quickCatColor,
        order: audioCategories.length,
      });
      toast.success(`Category "${quickCatName}" created`);
      // Auto-select the newly created category in the track form
      if (result?.category?.id) {
        setTrackForm(prev => ({ ...prev, category: result.category.id }));
      }
      setQuickCatName('');
      setQuickCatIcon('🎵');
      setQuickCatColor('#d4a44a');
      setShowQuickCat(false);
      await loadCategories();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingQuickCat(false);
    }
  };

  // ===== RENDER =====
  return (
    <div className="space-y-4">
      {/* Sub-tab nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setSubTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === 'audio' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Audio Tracks
          </button>
          <button
            onClick={() => setSubTab('categories')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              subTab === 'categories' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Categories
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadCategories(); loadTracks(); }}
            disabled={tracksLoading || categoriesLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${tracksLoading || categoriesLoading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          {subTab === 'audio' && (
            <button
              onClick={() => { resetTrackForm(); setShowTrackForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Track
            </button>
          )}
          {subTab === 'categories' && (
            <button
              onClick={() => { resetCatForm(); setShowCatForm(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Category
            </button>
          )}
        </div>
      </div>

      {/* ===== AUDIO TRACKS TAB ===== */}
      {subTab === 'audio' && (
        <div className="space-y-4">
          {/* Search + filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tracks..."
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setTrackCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${trackCategoryFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                All ({tracks.length})
              </button>
              {audioCategories.map(cat => {
                const count = tracks.filter(t => t.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setTrackCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${trackCategoryFilter === cat.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {cat.icon} {cat.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Track form */}
          {showTrackForm && (
            <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingTrackId ? 'Edit Audio Track' : 'Add New Audio Track'}
                </h3>
                <button onClick={resetTrackForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
                  <input
                    type="text"
                    value={trackForm.title}
                    onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Twinkle Twinkle Little Star"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Artist</label>
                  <input
                    type="text"
                    value={trackForm.artist}
                    onChange={(e) => setTrackForm({ ...trackForm, artist: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Foxy & Friends"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Album Art</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={trackForm.album_art}
                      onChange={(e) => setTrackForm({ ...trackForm, album_art: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                      placeholder="URL or upload an image"
                    />
                    <button
                      type="button"
                      disabled={uploadingArt}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
                          setUploadingArt(true);
                          try {
                            const result = await uploadAlbumArt(file);
                            // Use the displayable public URL (server will unresolve back to r2: key on save)
                            setTrackForm(prev => ({ ...prev, album_art: result.signed_url }));
                            toast.success('Album art uploaded!');
                          } catch (err: any) {
                            toast.error(err.message || 'Upload failed');
                          } finally {
                            setUploadingArt(false);
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {uploadingArt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingArt ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Audio File</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={trackForm.audio_url}
                      onChange={(e) => setTrackForm({ ...trackForm, audio_url: e.target.value })}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                      placeholder="URL or upload audio (MP3, WAV, OGG)"
                    />
                    <button
                      type="button"
                      disabled={uploadingAudio}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'audio/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          if (file.size > 50 * 1024 * 1024) { toast.error('Audio must be under 50MB'); return; }
                          setUploadingAudio(true);
                          setAudioFileName(file.name);
                          try {
                            // Auto-detect duration from the file (with 10s timeout)
                            const audioEl = document.createElement('audio');
                            audioEl.preload = 'metadata';
                            const durPromise = new Promise<number>((resolve) => {
                              const timeout = setTimeout(() => {
                                URL.revokeObjectURL(audioEl.src);
                                resolve(0);
                              }, 10_000);
                              audioEl.onloadedmetadata = () => {
                                clearTimeout(timeout);
                                const d = isFinite(audioEl.duration) ? audioEl.duration : 0;
                                URL.revokeObjectURL(audioEl.src);
                                resolve(d);
                              };
                              audioEl.onerror = () => {
                                clearTimeout(timeout);
                                resolve(0);
                              };
                            });
                            audioEl.src = URL.createObjectURL(file);

                            // Run upload and duration detection in parallel
                            const [dur, result] = await Promise.all([
                              durPromise,
                              uploadAudioFile(file),
                            ]);
                            setTrackForm(prev => {
                              // Use the displayable public URL (server will unresolve back to r2: key on save)
                              const updated = { ...prev, audio_url: result.signed_url };
                              if (dur > 0) {
                                const mins = Math.floor(dur / 60);
                                const secs = Math.floor(dur % 60);
                                updated.duration = `${mins}:${secs.toString().padStart(2, '0')}`;
                                updated.duration_sec = Math.round(dur);
                              }
                              return updated;
                            });
                            setDurationAutoDetected(dur > 0);
                            toast.success(dur > 0
                              ? `Audio uploaded — duration ${Math.floor(dur / 60)}:${Math.floor(dur % 60).toString().padStart(2, '0')} detected`
                              : 'Audio uploaded (enter duration manually)');
                          } catch (err: any) {
                            toast.error(err.message || 'Upload failed');
                          } finally {
                            setUploadingAudio(false);
                          }
                        };
                        input.click();
                      }}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      {uploadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {uploadingAudio ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                  {audioFileName && trackForm.audio_url && (
                    <p className="text-[10px] text-green-600 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {audioFileName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select
                    value={trackForm.category}
                    onChange={(e) => setTrackForm({ ...trackForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="">— Select —</option>
                    {audioCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                  {/* Inline quick-add when no categories exist */}
                  {audioCategories.length === 0 && !showQuickCat && (
                    <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[11px] text-amber-800 mb-1.5">No audio categories yet. Create one to organize your tracks.</p>
                      <button
                        type="button"
                        onClick={() => setShowQuickCat(true)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Quick Add Category
                      </button>
                    </div>
                  )}
                  {showQuickCat && (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                      <p className="text-[11px] font-semibold text-gray-700">New Audio Category</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={quickCatIcon}
                          onChange={(e) => setQuickCatIcon(e.target.value)}
                          className="w-10 px-1.5 py-1.5 text-sm border border-gray-200 rounded-md text-center"
                          placeholder="🎵"
                        />
                        <input
                          type="text"
                          value={quickCatName}
                          onChange={(e) => setQuickCatName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200"
                          placeholder="e.g. Lullabies, Nursery Rhymes..."
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveQuickCat(); }}
                        />
                        <input
                          type="color"
                          value={quickCatColor}
                          onChange={(e) => setQuickCatColor(e.target.value)}
                          className="w-8 h-8 rounded-md border border-gray-200 cursor-pointer"
                          title="Category color"
                        />
                        <button
                          type="button"
                          onClick={handleSaveQuickCat}
                          disabled={savingQuickCat || !quickCatName.trim()}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                          {savingQuickCat ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          {savingQuickCat ? '...' : 'Add'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowQuickCat(false); setQuickCatName(''); setQuickCatIcon('🎵'); setQuickCatColor('#d4a44a'); }}
                          className="p-1.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  {audioCategories.length > 0 && !showQuickCat && (
                    <button
                      type="button"
                      onClick={() => setShowQuickCat(true)}
                      className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add new category
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Duration
                      {durationAutoDetected && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-green-100 text-green-700">
                          <Check className="w-2.5 h-2.5" /> auto
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={trackForm.duration}
                        onChange={(e) => {
                          const dur = e.target.value;
                          setDurationAutoDetected(false);
                          setTrackForm({ ...trackForm, duration: dur });
                          // Auto-calculate seconds from m:ss format
                          const parts = dur.split(':');
                          if (parts.length === 2) {
                            const sec = parseInt(parts[0]) * 60 + parseInt(parts[1]);
                            if (!isNaN(sec)) setTrackForm(prev => ({ ...prev, duration: dur, duration_sec: sec }));
                          }
                        }}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 ${
                          durationAutoDetected
                            ? 'border-green-300 bg-green-50/50'
                            : 'border-gray-200'
                        }`}
                        placeholder="3:24"
                      />
                      {trackForm.duration_sec > 0 && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                          {trackForm.duration_sec}s
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                    <input
                      type="number"
                      value={trackForm.order}
                      onChange={(e) => setTrackForm({ ...trackForm, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackForm.is_premium}
                    onChange={(e) => setTrackForm({ ...trackForm, is_premium: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
                  />
                  <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-500" /> Premium
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trackForm.is_featured}
                    onChange={(e) => setTrackForm({ ...trackForm, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
                  />
                  <span className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-500" /> Featured
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <select
                    value={trackForm.status}
                    onChange={(e) => setTrackForm({ ...trackForm, status: e.target.value })}
                    className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </label>
              </div>

              {/* Album art preview */}
              {trackForm.album_art && (
                <div className="flex items-center gap-3">
                  <img
                    src={trackForm.album_art}
                    alt="Preview"
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-gray-400">Album art preview</span>
                </div>
              )}

              {/* Save button */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveTrack}
                  disabled={savingTrack || !trackForm.title.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingTrack ? 'Saving...' : editingTrackId ? 'Update Track' : 'Create Track'}
                </button>
                <button
                  onClick={resetTrackForm}
                  className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Track list */}
          {tracksLoading ? (
            <div className="text-center py-12 text-sm text-gray-400">Loading audio tracks...</div>
          ) : filteredTracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No audio tracks yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Add Track" to create your first one</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Track</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 hidden md:table-cell">Duration</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Flags</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTracks.map((track, idx) => {
                    const cat = audioCategories.find(c => c.id === track.category);
                    return (
                      <tr key={track.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            {track.album_art ? (
                              <img
                                src={track.album_art}
                                alt=""
                                className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <Music className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-gray-900 truncate">{track.title}</p>
                              <p className="text-[11px] text-gray-500 truncate">{track.artist}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell">
                          {cat ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                              {cat.icon} {cat.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 hidden md:table-cell text-xs text-gray-600">{track.duration}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            {track.is_premium && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                                <Crown className="w-2.5 h-2.5 mr-0.5" /> PRO
                              </span>
                            )}
                            {track.is_featured && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700">
                                <Star className="w-2.5 h-2.5 mr-0.5" />
                              </span>
                            )}
                            {track.status === 'draft' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-100 text-gray-500">
                                DRAFT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => editTrack(track)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTrack(track.id)}
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
            <span>{tracks.length} total tracks</span>
            <span>{tracks.filter(t => t.is_premium).length} premium</span>
            <span>{tracks.filter(t => t.status === 'draft').length} drafts</span>
            <span>{audioCategories.length} categories</span>
          </div>

          {/* R2 Info Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <Music className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-900">Cloudflare R2 Integration</p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Audio files are hosted on Cloudflare R2 for zero-egress-cost streaming. Paste R2 public URLs in the
                "Audio URL" field. Album art images can also be hosted on R2 or any CDN.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== CATEGORIES TAB ===== */}
      {subTab === 'categories' && (
        <div className="space-y-4">
          {/* Category form */}
          {showCatForm && (
            <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  {editingCatId ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button onClick={resetCatForm} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Lullabies"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    value={catForm.type}
                    onChange={(e) => setCatForm({ ...catForm, type: e.target.value as 'video' | 'audio' })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="audio">Audio</option>
                    <option value="video">Video</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                    <input
                      type="text"
                      value={catForm.icon}
                      onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-center"
                      placeholder="🎵"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                    <input
                      type="color"
                      value={catForm.color}
                      onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                      className="w-full h-[38px] border border-gray-200 rounded-lg cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Order</label>
                    <input
                      type="number"
                      value={catForm.order}
                      onChange={(e) => setCatForm({ ...catForm, order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveCategory}
                  disabled={savingCat || !catForm.name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingCat ? 'Saving...' : editingCatId ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={resetCatForm}
                  className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Inline quick-add category */}
          {showQuickCat && (
            <div className="bg-white border border-gray-200/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Add New Category
                </h3>
                <button onClick={() => setShowQuickCat(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                  <input
                    type="text"
                    value={quickCatName}
                    onChange={(e) => setQuickCatName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder="Lullabies"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select
                    value="audio"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                    <option value="audio">Audio</option>
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Icon</label>
                    <input
                      type="text"
                      value={quickCatIcon}
                      onChange={(e) => setQuickCatIcon(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-center"
                      placeholder="🎵"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
                    <input
                      type="color"
                      value={quickCatColor}
                      onChange={(e) => setQuickCatColor(e.target.value)}
                      className="w-full h-[38px] border border-gray-200 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveQuickCat}
                  disabled={savingQuickCat || !quickCatName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingQuickCat ? 'Saving...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowQuickCat(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Categories list — split by type */}
          {['audio', 'video'].map(type => {
            const typeCats = categories.filter(c => c.type === type);
            return (
              <div key={type}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  {type === 'audio' ? <Music className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                  {type === 'audio' ? 'Audio Categories' : 'Video Categories'}
                  <span className="text-gray-400 font-normal">({typeCats.length})</span>
                </h3>
                {typeCats.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 pl-2">No {type} categories yet</p>
                ) : (
                  <div className="bg-white border border-gray-200/80 rounded-xl overflow-hidden mb-4">
                    {typeCats.map((cat, i) => (
                      <div
                        key={cat.id}
                        className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''} hover:bg-gray-50/50 transition-colors`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-gray-900">{cat.name}</p>
                          <p className="text-[10px] text-gray-400">Order: {cat.order} &middot; {cat.id.slice(0, 8)}...</p>
                        </div>
                        <div
                          className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                          style={{ background: cat.color }}
                        />
                        <button
                          onClick={() => editCategory(cat)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {type === 'audio' && (
                  <button
                    onClick={() => setShowQuickCat(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Category
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};