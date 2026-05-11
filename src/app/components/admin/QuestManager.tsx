import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit, Trash2, X, RefreshCw, ToggleLeft, ToggleRight, AlertTriangle, ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchQuests, createQuest, updateQuest, deleteQuest, fetchQuestionBankStats, uploadQuestImage } from '../../utils/api';

interface Quest {
  id: string;
  subject: string;
  name: { en: string; ms: string; zh: string };
  status: 'live' | 'draft';
  question_count: number;
  icon: string;
  image_path: string | null;
  image_url: string | null;
  is_mandarin: boolean;
  conditional_key: string | null;
  created_at?: string;
  signed_image_url?: string;
}

interface SubjectStats {
  name: string;
  count: number;
  ages: Record<number, number>;
}

interface QuestManagerProps {
  questConfigs?: any;
  setQuestConfigs?: any;
}

export const QuestManager: React.FC<QuestManagerProps> = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [saving, setSaving] = useState(false);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signed URL cache for quest card images
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Form state
  const [form, setForm] = useState({
    subject: '',
    nameEn: '',
    nameMs: '',
    nameZh: '',
    status: 'draft' as 'live' | 'draft',
    question_count: 10,
    is_mandarin: false,
    image_path: '' as string,
  });

  // Load quests and stats
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [questsData, statsData] = await Promise.all([
        fetchQuests(),
        fetchQuestionBankStats()
      ]);
      setQuests(questsData);
      setSubjectStats(statsData.subjects || []);

      // Use signed_image_url returned by server (no separate calls needed)
      const urlMap: Record<string, string> = {};
      for (const q of questsData) {
        if (q.signed_image_url) {
          urlMap[q.id] = q.signed_image_url;
        }
      }
      setSignedUrls(prev => ({ ...prev, ...urlMap }));
    } catch (error) {
      console.error('Failed to load quests:', error);
      toast.error('Failed to load quests. Check your login.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Get question count for a subject from the bank
  const getSubjectQuestionCount = (subject: string): number => {
    const stat = subjectStats.find(s => s.name === subject);
    return stat?.count || 0;
  };

  const getSubjectAges = (subject: string): Record<number, number> => {
    const stat = subjectStats.find(s => s.name === subject);
    return stat?.ages || { 4: 0, 5: 0, 6: 0, 7: 0 };
  };

  // Open editor for new quest
  const handleNewQuest = () => {
    setEditingQuest(null);
    setForm({
      subject: '',
      nameEn: '', nameMs: '', nameZh: '',
      status: 'draft',
      question_count: 10,
      is_mandarin: false,
      image_path: '',
    });
    setImageFile(null);
    setImagePreview(null);
    setShowEditor(true);
  };

  // Open editor for existing quest
  const handleEdit = (quest: Quest) => {
    setEditingQuest(quest);
    setForm({
      subject: quest.subject,
      nameEn: quest.name?.en || '',
      nameMs: quest.name?.ms || '',
      nameZh: quest.name?.zh || '',
      status: quest.status,
      question_count: quest.question_count,
      is_mandarin: quest.is_mandarin || quest.conditional_key === 'mandarin',
      image_path: quest.image_path || '',
    });
    setImageFile(null);
    // Use existing signed/public URL as preview
    setImagePreview(quest.signed_image_url || signedUrls[quest.id] || null);
    setShowEditor(true);
  };

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm(prev => ({ ...prev, image_path: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Save (create or update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.nameEn.trim()) {
      toast.error('Subject and English name are required');
      return;
    }
    if (!form.nameMs.trim() || !form.nameZh.trim()) {
      toast.error('All 3 language names are required (EN, BM, ZH)');
      return;
    }

    setSaving(true);
    try {
      let imagePath = form.image_path;

      // Upload new image if selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          const result = await uploadQuestImage(imageFile);
          imagePath = result.image_path;
          // Cache the signed URL
          if (result.signed_url) {
            setSignedUrls(prev => ({
              ...prev,
              [editingQuest?.id || 'new']: result.signed_url
            }));
          }
        } catch (imgErr) {
          toast.error(`Image upload failed: ${imgErr instanceof Error ? imgErr.message : 'Unknown error'}`);
          setSaving(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      const payload = {
        subject: form.subject.trim(),
        name: { en: form.nameEn.trim(), ms: form.nameMs.trim(), zh: form.nameZh.trim() },
        status: form.status,
        question_count: form.question_count,
        icon: '📚',
        is_mandarin: form.is_mandarin,
        image_path: imagePath || null,
      };

      if (editingQuest) {
        await updateQuest(editingQuest.id, payload);
        toast.success('Quest updated!');
      } else {
        await createQuest(payload);
        toast.success('Quest created!');
      }

      setShowEditor(false);
      await loadData();
    } catch (error) {
      console.error('Save quest failed:', error);
      toast.error(`Failed to save quest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  // Toggle live/draft
  const handleToggleStatus = async (quest: Quest) => {
    const newStatus = quest.status === 'live' ? 'draft' : 'live';
    
    if (newStatus === 'live' && getSubjectQuestionCount(quest.subject) === 0) {
      toast.error(`Cannot set to Live: no questions found for subject "${quest.subject}" in the bank`);
      return;
    }

    try {
      await updateQuest(quest.id, { status: newStatus });
      setQuests(prev => prev.map(q => q.id === quest.id ? { ...q, status: newStatus } : q));
      toast.success(`"${quest.name.en}" is now ${newStatus.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Delete quest
  const handleDelete = async (quest: Quest) => {
    if (!confirm(`Delete quest "${quest.name.en}"? This cannot be undone.`)) return;
    try {
      await deleteQuest(quest.id);
      setQuests(prev => prev.filter(q => q.id !== quest.id));
      toast.success('Quest deleted');
    } catch (error) {
      toast.error('Failed to delete quest');
    }
  };

  // Clear all quest images (so user can re-upload fresh to R2)
  const handleClearAllImages = async () => {
    const questsWithImages = quests.filter(q => q.image_path);
    if (questsWithImages.length === 0) {
      toast.info('No quests have images to clear');
      return;
    }
    if (!confirm(`Clear images from ${questsWithImages.length} quest(s)? You'll need to re-upload new images.`)) return;
    try {
      let cleared = 0;
      for (const quest of questsWithImages) {
        await updateQuest(quest.id, { image_path: null });
        cleared++;
      }
      toast.success(`Cleared images from ${cleared} quest(s). Please re-upload new images.`);
      await loadData();
    } catch (error) {
      console.error('Failed to clear images:', error);
      toast.error('Failed to clear some images');
    }
  };

  // Available subjects from the bank (for dropdown)
  const availableSubjects = subjectStats.map(s => s.name);

  const liveCount = quests.filter(q => q.status === 'live').length;
  const draftCount = quests.filter(q => q.status === 'draft').length;

  return (
    <div className="h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base md:text-lg font-semibold text-gray-900">Quest Management</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {quests.length} quests ({liveCount} live, {draftCount} draft)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadData}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleNewQuest}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-black text-white rounded-lg text-xs md:text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Quest</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
        </div>

        {/* Clear All Images Banner */}
        {quests.some(q => q.image_path) && (
          <div className="mt-4 p-3 bg-orange-50 border-2 border-orange-300 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-4 h-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-orange-800">Re-upload Quest Images</p>
                <p className="text-xs text-orange-600 truncate">
                  {quests.filter(q => q.image_path).length} quest(s) have images — clear to re-upload to R2
                </p>
              </div>
            </div>
            <button
              onClick={handleClearAllImages}
              className="flex-shrink-0 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              Clear All Images
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6">
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Total Quests</div>
            <div className="text-xl md:text-2xl font-semibold text-gray-900">{quests.length}</div>
          </div>
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Live</div>
            <div className="text-xl md:text-2xl font-semibold text-green-600">{liveCount}</div>
          </div>
          <div>
            <div className="text-xs md:text-sm text-gray-500 mb-1">Draft</div>
            <div className="text-xl md:text-2xl font-semibold text-gray-400">{draftCount}</div>
          </div>
        </div>

        {/* Quests Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
            Loading quests...
          </div>
        ) : quests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-600 font-medium">No quests created yet</p>
            <p className="text-sm text-gray-500 mt-1">Create a quest and link it to a subject from the question bank</p>
            <button
              onClick={handleNewQuest}
              className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
            >
              Create First Quest
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quests.map((quest) => {
              const bankCount = getSubjectQuestionCount(quest.subject);
              const ages = getSubjectAges(quest.subject);
              const isLive = quest.status === 'live';
              const hasQuestions = bankCount > 0;
              const questImageUrl = signedUrls[quest.id];

              return (
                <div
                  key={quest.id}
                  className={`border rounded-xl p-5 transition-all ${
                    isLive ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                  }`}
                >
                  {/* Top Row: Image/Icon + Status Toggle */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {questImageUrl ? (
                        <div className="w-11 h-11 rounded-lg overflow-hidden border-2 border-gray-200 flex-shrink-0">
                          <img
                            src={questImageUrl}
                            alt={quest.name.en}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0 bg-gray-100 border-2 border-gray-200">
                          {quest.icon || '📚'}
                        </div>
                      )}
                    </div>

                    {/* Live/Draft Toggle */}
                    <button
                      onClick={() => handleToggleStatus(quest)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isLive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {isLive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {isLive ? 'LIVE' : 'DRAFT'}
                    </button>
                  </div>

                  {/* Quest Name */}
                  <h3 className="font-semibold text-gray-900 text-sm">{quest.name.en}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {quest.name.ms} &middot; {quest.name.zh}
                  </p>

                  {/* Subject + Bank Info */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                      {quest.subject}
                    </span>
                    <span className={`text-xs ${hasQuestions ? 'text-gray-500' : 'text-red-500'}`}>
                      {bankCount} in bank
                    </span>
                  </div>

                  {/* Age breakdown from bank */}
                  {hasQuestions && (
                    <div className="flex gap-1 mt-2">
                      {[4, 5, 6, 7].map(age => (
                        <span key={age} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                          {age}y: {ages[age] || 0}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Warning if no questions */}
                  {!hasQuestions && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <AlertTriangle className="w-3 h-3" />
                      No questions in bank for this subject
                    </div>
                  )}

                  {/* Question count config */}
                  <div className="mt-3 text-xs text-gray-500">
                    Questions per session: <strong>{quest.question_count}</strong>
                  </div>

                  {/* Actions */}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingQuest ? 'Edit Quest' : 'Create New Quest'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Link a quest card to a subject from the question bank
                </p>
              </div>
              <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5">
              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={e => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., English, Math, Bahasa Melayu"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  required
                  list="subject-suggestions"
                />
                <datalist id="subject-suggestions">
                  {availableSubjects.map(s => <option key={s} value={s} />)}
                </datalist>
                {form.subject && (
                  <p className="text-xs text-gray-500 mt-1">
                    Bank has <strong>{getSubjectQuestionCount(form.subject)}</strong> questions for "{form.subject}"
                  </p>
                )}
              </div>

              {/* Quest Name (all 3 required) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quest Name <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-400 ml-1">(all 3 languages)</span>
                </label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={e => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="English name (e.g., English Forest)"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={form.nameMs}
                    onChange={e => setForm({ ...form, nameMs: e.target.value })}
                    placeholder="BM name"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="text"
                    value={form.nameZh}
                    onChange={e => setForm({ ...form, nameZh: e.target.value })}
                    placeholder="Chinese name"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              {/* Card Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Card Image
                </label>
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Quest card preview"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-xs">Upload</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs text-blue-600 hover:underline"
                  >
                    Change image
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-1">Recommended 600 x 800px (3:4 portrait). Max 2MB. PNG, JPG, or WebP.</p>
              </div>

              {/* Question Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Questions Per Session
                </label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={form.question_count}
                  onChange={e => setForm({ ...form, question_count: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Must be even (batches of 2)</p>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'draft' })}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      form.status === 'draft'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, status: 'live' })}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      form.status === 'live'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Live
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      {uploadingImage ? (
                        <><Upload className="w-3.5 h-3.5 animate-bounce" /> Uploading image...</>
                      ) : (
                        'Saving...'
                      )}
                    </>
                  ) : (
                    editingQuest ? 'Save Changes' : 'Create Quest'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};