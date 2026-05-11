/**
 * FlashcardManager — Super Admin panel for managing flashcard categories + cards.
 * Supports CSV bulk upload and manual CRUD for individual cards.
 * Styled to match the admin panel design system (clean white/gray).
 */
import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, Trash2, Edit3, Save, X, ChevronDown, ChevronUp, FileText, Image, Film, Volume2, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  fetchFlashcardCategories,
  saveFlashcardCategory,
  deleteFlashcardCategory,
  fetchFlashcards,
  saveFlashcard,
  deleteFlashcard,
  uploadFlashcardCSV,
  uploadFlashcardAsset,
} from '../../utils/api';

interface Category {
  id: string;
  name_en: string;
  name_bm: string;
  name_zh: string;
  emoji: string;
  color: string;
  order: number;
  image_url?: string | null;
  image_key?: string | null;
}

interface FlashCard {
  id: string;
  category_id: string;
  word_en: string;
  word_bm: string;
  word_zh: string;
  image_key?: string | null;
  video_key?: string | null;
  audio_en_key?: string | null;
  audio_bm_key?: string | null;
  audio_zh_key?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  audio_en_url?: string | null;
  audio_bm_url?: string | null;
  audio_zh_url?: string | null;
  order: number;
}

// ── CSV Upload Panel ─────────────────────────────────────
function CSVUploadPanel({ onSuccess }: { onSuccess: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || '');
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!csvText.trim()) return;
    setUploading(true);
    setResult(null);
    try {
      const res = await uploadFlashcardCSV(csvText);
      setResult(res);
      toast.success('CSV uploaded successfully!');
      onSuccess();
    } catch (err: any) {
      setResult({ error: err.message });
      toast.error('CSV upload failed');
    } finally {
      setUploading(false);
    }
  };

  const sampleCSV = `category,word_en,word_bm,word_zh,image_key,video_key,audio_en_key,audio_bm_key,audio_zh_key
Animals,Tiger,Harimau,老虎,flashcards/images/tiger.png,flashcards/videos/tiger.mp4,flashcards/audio/tiger_en.mp3,flashcards/audio/tiger_bm.mp3,flashcards/audio/tiger_zh.mp3
Vegetables,Carrot,Lobak Merah,胡萝卜,flashcards/images/carrot.png,flashcards/videos/carrot.mp4,flashcards/audio/carrot_en.mp3,flashcards/audio/carrot_bm.mp3,flashcards/audio/carrot_zh.mp3`;

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-3">
        <Upload className="w-5 h-5 text-gray-700" />
        <h3 className="font-semibold text-gray-900">CSV Bulk Upload</h3>
      </div>

      <p className="text-sm text-gray-500 mb-3">
        Upload a CSV file with your flashcard data. Categories will be auto-created.
        R2 keys should point to assets already uploaded by your n8n workflow.
      </p>

      {/* Sample CSV */}
      <details className="mb-4">
        <summary className="text-xs cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
          View sample CSV format
        </summary>
        <pre className="mt-2 p-3 rounded-lg text-xs overflow-x-auto bg-gray-100 text-gray-600 border border-gray-200">
          {sampleCSV}
        </pre>
      </details>

      {/* File input */}
      <div className="flex gap-2 mb-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          onChange={handleFile}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-gray-200 hover:bg-gray-100 transition-colors text-gray-700"
        >
          <FileText className="w-4 h-4" /> Choose CSV File
        </button>
      </div>

      {/* Textarea */}
      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder="Paste CSV here, or use the file picker above..."
        rows={5}
        className="w-full rounded-lg p-3 text-sm font-mono resize-y bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
      />

      <button
        onClick={handleUpload}
        disabled={uploading || !csvText.trim()}
        className="mt-3 px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 transition-all bg-black text-white hover:bg-gray-800"
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading...' : 'Upload CSV'}
      </button>

      {/* Result */}
      {result && (
        <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${result.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {result.error ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />}
          <div>
            {result.error ? (
              <span>{result.error}</span>
            ) : (
              <>
                <p className="font-medium">Upload complete!</p>
                <p>{result.cards_created} cards created, {result.categories_created} new categories</p>
                {result.errors?.length > 0 && (
                  <p className="text-amber-600 mt-1">{result.errors.length} rows had errors</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card Form (create/edit) ──────────────────────────────
function CardForm({
  card,
  categories,
  onSave,
  onCancel,
}: {
  card?: FlashCard | null;
  categories: Category[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    category_id: card?.category_id || categories[0]?.id || '',
    word_en: card?.word_en || '',
    word_bm: card?.word_bm || '',
    word_zh: card?.word_zh || '',
    image_key: card?.image_key || '',
    video_key: card?.video_key || '',
    audio_en_key: card?.audio_en_key || '',
    audio_bm_key: card?.audio_bm_key || '',
    audio_zh_key: card?.audio_zh_key || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleFileUpload = async (field: string, subfolder: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingField(field);
    try {
      const result = await uploadFlashcardAsset(file, subfolder);
      setForm(prev => ({ ...prev, [field]: result.key }));
      toast.success('File uploaded');
    } catch (err: any) {
      console.error('Upload failed:', err);
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.word_en || !form.category_id) {
      toast.error('English word and category are required');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...(card?.id ? { id: card.id } : {}),
        category_id: form.category_id,
        word_en: form.word_en,
        word_bm: form.word_bm || form.word_en,
        word_zh: form.word_zh || form.word_en,
        image_key: form.image_key || null,
        video_key: form.video_key || null,
        audio_en_key: form.audio_en_key || null,
        audio_bm_key: form.audio_bm_key || null,
        audio_zh_key: form.audio_zh_key || null,
      });
    } finally {
      setSaving(false);
    }
  };

  const FileUploadField = ({ label, field, subfolder, accept, icon: Icon }: { label: string; field: string; subfolder: string; accept: string; icon: any }) => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          value={(form as any)[field] || ''}
          onChange={(e) => setForm(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={`R2 key (e.g. flashcards/${subfolder}/file.ext)`}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-mono bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
        <label className="px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1 text-xs transition-colors shrink-0 border border-gray-200 hover:bg-gray-100 text-gray-600">
          {uploadingField === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
          <input type="file" accept={accept} className="hidden" onChange={(e) => handleFileUpload(field, subfolder, e)} />
          Upload
        </label>
      </div>
    </div>
  );

  return (
    <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{card ? 'Edit Card' : 'New Card'}</h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
      </div>

      {/* Category select */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
        <select
          value={form.category_id}
          onChange={(e) => setForm(prev => ({ ...prev, category_id: e.target.value }))}
          className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-black/10"
        >
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name_en}</option>
          ))}
        </select>
      </div>

      {/* Words */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">English *</label>
          <input value={form.word_en} onChange={(e) => setForm(prev => ({ ...prev, word_en: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="Volcano" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bahasa Melayu</label>
          <input value={form.word_bm} onChange={(e) => setForm(prev => ({ ...prev, word_bm: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="Gunung Berapi" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">中文</label>
          <input value={form.word_zh} onChange={(e) => setForm(prev => ({ ...prev, word_zh: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="火山" />
        </div>
      </div>

      {/* Asset fields */}
      <FileUploadField label="Image" field="image_key" subfolder="images" accept="image/*" icon={Image} />
      <FileUploadField label="Video (10s clip)" field="video_key" subfolder="videos" accept="video/*" icon={Film} />
      <FileUploadField label="Audio EN" field="audio_en_key" subfolder="audio" accept="audio/*" icon={Volume2} />
      <FileUploadField label="Audio BM" field="audio_bm_key" subfolder="audio" accept="audio/*" icon={Volume2} />
      <FileUploadField label="Audio ZH" field="audio_zh_key" subfolder="audio" accept="audio/*" icon={Volume2} />

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={saving || !form.word_en || !form.category_id}
          className="px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-2 disabled:opacity-50 bg-black text-white hover:bg-gray-800 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : card ? 'Update Card' : 'Create Card'}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Category Form (inline) ───────────────────────────────
function CategoryForm({
  category,
  onSave,
  onCancel,
}: {
  category?: Category | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name_en: category?.name_en || '',
    name_bm: category?.name_bm || '',
    name_zh: category?.name_zh || '',
    image_key: category?.image_key || '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await uploadFlashcardAsset(file, 'categories');
      setForm(prev => ({ ...prev, image_key: result.key }));
      toast.success('Category image uploaded');
    } catch (err: any) {
      console.error('Category image upload failed:', err);
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name_en) {
      toast.error('English name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...(category?.id ? { id: category.id } : {}),
        name_en: form.name_en,
        name_bm: form.name_bm || form.name_en,
        name_zh: form.name_zh || form.name_en,
        emoji: category?.emoji || '📚',
        color: category?.color || '#7cc643',
        image_key: form.image_key || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl p-5 border border-gray-200 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{category ? 'Edit Category' : 'New Category'}</h3>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-400" /></button>
      </div>

      {/* Language names */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">English *</label>
          <input value={form.name_en} onChange={(e) => setForm(p => ({ ...p, name_en: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="Animals" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Bahasa Melayu</label>
          <input value={form.name_bm} onChange={(e) => setForm(p => ({ ...p, name_bm: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="Haiwan" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">中文</label>
          <input value={form.name_zh} onChange={(e) => setForm(p => ({ ...p, name_zh: e.target.value }))}
            className="w-full rounded-lg px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10" placeholder="动物" />
        </div>
      </div>

      {/* Category image */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Category Image</label>
        <div className="flex gap-3 items-center">
          {/* Preview */}
          {(form.image_key || category?.image_url) && (
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <img
                src={category?.image_url && !form.image_key ? category.image_url : ''}
                alt="Preview"
                className="w-full h-full object-cover"
                style={{ display: (category?.image_url || form.image_key) ? 'block' : 'none' }}
              />
              {form.image_key && !category?.image_url && (
                <div className="w-full h-full flex items-center justify-center bg-green-50">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
              )}
            </div>
          )}
          <div className="flex-1">
            <div className="flex gap-2">
              <input
                value={form.image_key || ''}
                onChange={(e) => setForm(prev => ({ ...prev, image_key: e.target.value }))}
                placeholder="R2 key (e.g. flashcards/categories/animals.png)"
                className="flex-1 rounded-lg px-3 py-2 text-sm font-mono bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
              />
              <label className="px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1 text-xs transition-colors shrink-0 border border-gray-200 hover:bg-gray-100 text-gray-600">
                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                Upload
              </label>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Used as the card background in the flashcard category selection screen</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={handleSubmit} disabled={saving || !form.name_en}
          className="px-5 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 disabled:opacity-50 bg-black text-white hover:bg-gray-800 transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {category ? 'Update Category' : 'Create Category'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main FlashcardManager Component ──────────────────────
export function FlashcardManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCard, setEditingCard] = useState<FlashCard | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [visibleCardLimit, setVisibleCardLimit] = useState<Record<string, number>>({});

  const CARDS_PER_PAGE = 30;

  const loadData = async () => {
    try {
      const [cats, allCards] = await Promise.all([
        fetchFlashcardCategories(),
        fetchFlashcards(),
      ]);
      setCategories(cats);
      setCards(allCards);
    } catch (err) {
      console.error('Failed to load flashcard data:', err);
      toast.error('Failed to load flashcard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveCard = async (data: any) => {
    await saveFlashcard(data);
    setShowCardForm(false);
    setEditingCard(null);
    toast.success(data.id ? 'Card updated!' : 'Card created!');
    await loadData();
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Delete this flashcard?')) return;
    setDeleting(cardId);
    try {
      await deleteFlashcard(cardId);
      toast.success('Card deleted');
      await loadData();
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveCategory = async (data: any) => {
    await saveFlashcardCategory(data);
    setShowCatForm(false);
    setEditingCat(null);
    toast.success(data.id ? 'Category updated!' : 'Category created!');
    await loadData();
  };

  const handleDeleteCategory = async (catId: string) => {
    const catCards = cards.filter(c => c.category_id === catId);
    if (!confirm(`Delete this category and its ${catCards.length} cards?`)) return;
    setDeleting(catId);
    try {
      await deleteFlashcardCategory(catId);
      toast.success('Category deleted');
      await loadData();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-900">Flashcard Management</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {categories.length} categories, {cards.length} cards
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setShowCatForm(true); setEditingCat(null); }}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs md:text-sm font-medium hover:bg-gray-50 transition-colors text-gray-700"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Category</span>
              <span className="sm:hidden">Cat</span>
            </button>
            <button
              onClick={() => { setShowCardForm(true); setEditingCard(null); }}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-black text-white rounded-lg text-xs md:text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Card</span>
              <span className="sm:hidden">Card</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 md:gap-6">
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Categories</div>
            <div className="text-xl md:text-2xl font-semibold text-gray-900">{categories.length}</div>
          </div>
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Total Cards</div>
            <div className="text-xl md:text-2xl font-semibold text-gray-900">{cards.length}</div>
          </div>
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Avg per Category</div>
            <div className="text-xl md:text-2xl font-semibold text-gray-900">
              {categories.length > 0 ? Math.round(cards.length / categories.length) : 0}
            </div>
          </div>
        </div>

        {/* CSV Upload */}
        <CSVUploadPanel onSuccess={loadData} />

        {/* Category Form */}
        {showCatForm && (
          <CategoryForm
            category={editingCat}
            onSave={handleSaveCategory}
            onCancel={() => { setShowCatForm(false); setEditingCat(null); }}
          />
        )}

        {/* Card Form */}
        {(showCardForm || editingCard) && (
          <CardForm
            card={editingCard}
            categories={categories}
            onSave={handleSaveCard}
            onCancel={() => { setShowCardForm(false); setEditingCard(null); }}
          />
        )}

        {/* Categories + Cards */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading flashcards...
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-600 font-medium">No categories yet</p>
            <p className="text-sm text-gray-500 mt-1">Upload a CSV or create one manually.</p>
            <button
              onClick={() => { setShowCatForm(true); setEditingCat(null); }}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
            >
              Create First Category
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map(cat => {
              const catCards = cards.filter(c => c.category_id === cat.id);
              const isExpanded = expandedCat === cat.id;

              return (
                <div key={cat.id} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                  {/* Category header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                  >
                    {/* Category image thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-100 border border-gray-200">
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name_en} className="w-full h-full object-cover" />
                      ) : (
                        <Image className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{cat.name_en}</p>
                      <p className="text-xs text-gray-500">{cat.name_bm} · {cat.name_zh} · {catCards.length} cards</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCat(cat); setShowCatForm(true); }}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      ><Edit3 className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        disabled={deleting === cat.id}
                      >
                        {deleting === cat.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded cards list */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-1">
                      {catCards.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No cards in this category</p>
                      ) : (
                        <>
                        {catCards.length > CARDS_PER_PAGE && (
                          <p className="text-xs text-gray-400 px-3 pb-1">
                            Showing {Math.min(visibleCardLimit[cat.id] || CARDS_PER_PAGE, catCards.length)} of {catCards.length} cards
                          </p>
                        )}
                        {catCards.slice(0, visibleCardLimit[cat.id] || CARDS_PER_PAGE).map(card => (
                          <div key={card.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
                            {/* Thumbnail */}
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-gray-100 border border-gray-200">
                              {card.image_url ? (
                                <img src={card.image_url} alt={card.word_en} className="w-full h-full object-cover" />
                              ) : (
                                <Image className="w-4 h-4 text-gray-300" />
                              )}
                            </div>

                            {/* Card info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{card.word_en}</p>
                              <p className="text-xs text-gray-500 truncate">{card.word_bm} · {card.word_zh}</p>
                            </div>

                            {/* Asset indicators */}
                            <div className="flex items-center gap-1.5">
                              {card.image_key && <Image className="w-3 h-3 text-green-500" />}
                              {card.video_key && <Film className="w-3 h-3 text-blue-500" />}
                              {(card.audio_en_key || card.audio_bm_key || card.audio_zh_key) && <Volume2 className="w-3 h-3 text-purple-500" />}
                            </div>

                            {/* Actions */}
                            <button
                              onClick={() => { setEditingCard(card); setShowCardForm(false); }}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            ><Edit3 className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              disabled={deleting === card.id}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              {deleting === card.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                        {catCards.length > (visibleCardLimit[cat.id] || CARDS_PER_PAGE) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisibleCardLimit(prev => ({
                                ...prev,
                                [cat.id]: (prev[cat.id] || CARDS_PER_PAGE) + CARDS_PER_PAGE,
                              }));
                            }}
                            className="w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors mt-1"
                          >
                            Show {Math.min(CARDS_PER_PAGE, catCards.length - (visibleCardLimit[cat.id] || CARDS_PER_PAGE))} more cards...
                          </button>
                        )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}