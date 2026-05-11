import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Search, Trash2, Download, AlertCircle, CheckCircle, RefreshCw, Database, ChevronDown, ChevronRight, X, FileText, Plus } from 'lucide-react';
import { Pencil, Save, ImagePlus, Image, Volume2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { uploadQuestionBank, uploadMCQImageQuestions, fetchQuestionBankPaginated, fetchQuestionBankStats, deleteGlobalQuestion, clearQuestionBank, updateGlobalQuestion, uploadQuestionImage, uploadAnswerOptionImage, uploadQuestionTTS, fetchQuests } from '../../utils/api';
import type { PaginatedQuestionResult } from '../../utils/api';
import { ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { QuestionCreator } from '../admin/QuestionCreator';
import { KSSRSkillPicker, type KSSRSelection } from '../admin/KSSRSkillPicker';

// Parse age_target from number OR KSSR display label (e.g. "Prasekolah Thn 1" → 4)
function parseAgeTarget(val: any): number {
  if (val === null || val === undefined || val === '') return NaN;
  const n = Number(val);
  if (!isNaN(n) && n >= 4 && n <= 12) return n;
  const labelMap: Record<string, number> = {
    'prasekolah thn 1': 4, 'prasekolah thn 2': 5, 'prasekolah thn 3': 6,
    'tahun 1': 7, 'tahun 2': 8, 'tahun 3': 9,
    'tahun 4': 10, 'tahun 5': 11, 'tahun 6': 12,
    'ps1': 4, 'ps2': 5, 'ps3': 6,
    't1': 7, 't2': 8, 't3': 9, 't4': 10, 't5': 11, 't6': 12,
    'thn 1': 7, 'thn 2': 8, 'thn 3': 9, 'thn 4': 10, 'thn 5': 11, 'thn 6': 12,
    'year 1': 7, 'year 2': 8, 'year 3': 9, 'year 4': 10, 'year 5': 11, 'year 6': 12,
    'prasekolah': 4,
  };
  const key = String(val).trim().toLowerCase();
  return labelMap[key] ?? NaN;
}

interface BankQuestion {
  q_id: string;
  age_target: number;
  subject: string;
  dskp_code: string;
  kssr_level: string;
  topic: string;
  skill_name: string;
  question_text_en: string;
  question_text_ms: string;
  question_text_zh: string;
  input_type: string;
  answer_type?: 'mcq-image'; // undefined = text (backward compat)
  options_en: any;
  options_ms: any;
  options_zh: any;
  correct_answer: string;
  visual_prompt: string;
  image_url: string;
  tts_en?: string;
  tts_ms?: string;
  tts_zh?: string;
  created_at?: string;
}

interface SubjectStats {
  name: string;
  count: number;
  ages: Record<number, number>;
}

// Parse CSV text with proper quote handling
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]).map(h => h.trim());
  // Deduplicate headers: if a header appears more than once, append _2, _3, etc.
  const headerCounts: Record<string, number> = {};
  const headers = rawHeaders.map(h => {
    headerCounts[h] = (headerCounts[h] || 0) + 1;
    return headerCounts[h] > 1 ? `${h}_${headerCounts[h]}` : h;
  });
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// Generate sample CSV templates
function generateTextTemplate(): string {
  const headers = 'age_target,subject,dskp_code,kssr_level,topic,skill_name,question_text_en,question_text_ms,question_text_zh,input_type,options_en,options_ms,options_zh,correct_answer,visual_prompt,image_url,TTS_en,TTS_ms,TTS_zh';
  const samples = [
    '4,English,ENG-4-P01,,Phonics,Mengenal huruf besar A-Z,Which letter comes after A?,Huruf mana yang datang selepas A?,哪个字母在A之后?,mcq,B|C|D|Z,B|C|D|Z,B|C|D|Z,a,Cheerful alphabet scene,,,,',
    '7,Math,MATH-7-N01,,Nombor,Membilang hingga 100,What is 2 + 3?,Berapakah 2 + 3?,2加3等于多少?,mcq,4|5|6|7,4|5|6|7,4|5|6|7,b,Colorful number blocks,,https://example.com/audio_en.mp3,https://example.com/audio_ms.mp3,https://example.com/audio_zh.mp3',
    '4,Bahasa Melayu,BM-4-D01,,Dengar & Tutur,Mendengar dan mengecam bunyi,What colour is the sky?,Apakah warna langit?,天空是什么颜色?,mcq,Red|Blue|Green|Yellow,Merah|Biru|Hijau|Kuning,红色|蓝色|绿色|黄色,b,Bright sky scene,,,,',
  ];
  return headers + '\n' + samples.join('\n');
}

function generateImageTemplate(): string {
  const headers = 'age_target,subject,dskp_code,kssr_level,topic,skill_name,question_text_en,question_text_ms,question_text_zh,option_a_image_url,option_b_image_url,option_c_image_url,option_d_image_url,option_labels_en,option_labels_ms,option_labels_zh,correct_answer,visual_prompt,image_url,TTS_en,TTS_ms,TTS_zh';
  const samples = [
    '4,Math,MATH-4-B01,,Bentuk 2D,"Mengenal bentuk: bulatan, segi tiga, segi empat",Which shape is a circle?,Bentuk mana yang bulatan?,哪个形状是圆形?,https://example.com/circle.png,https://example.com/square.png,https://example.com/triangle.png,https://example.com/star.png,Circle|Square|Triangle|Star,Bulatan|Segi empat|Segi tiga|Bintang,圆形|正方形|三角形|星形,a,Colourful shapes,,https://example.com/audio_en.mp3,https://example.com/audio_ms.mp3,',
    '7,Science,SCI-7-H01,,Hidupan,Mengenal bahagian tubuh manusia,Which animal lives in water?,Haiwan mana yang tinggal di air?,哪种动物生活在水里?,https://example.com/fish.png,https://example.com/cat.png,https://example.com/bird.png,https://example.com/dog.png,Fish|Cat|Bird|Dog,Ikan|Kucing|Burung|Anjing,鱼|猫|鸟|狗,a,Animal habitats,,,,',
  ];
  return headers + '\n' + samples.join('\n');
}

const ITEMS_PER_PAGE = 50;

export const MasterQuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [stats, setStats] = useState<{ subjects: SubjectStats[]; totalQuestions: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFiltered, setTotalFiltered] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ stored: number; errors: string[]; imagesProcessed?: number } | null>(null);
  const [uploadType, setUploadType] = useState<'mcq-text' | 'mcq-image'>('mcq-text');

  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<BankQuestion | null>(null);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Create mode
  const [showCreate, setShowCreate] = useState(false);

  // Quest-sourced subjects (authoritative source of truth for available subjects)
  const [questSubjects, setQuestSubjects] = useState<string[]>([]);

  // Track last uploaded image file size for display
  const [lastUploadedSize, setLastUploadedSize] = useState<number | null>(null);

  // Helper: convert options array to pipe-delimited string for editing
  const optionsToPipe = (options: any): string => {
    if (!options) return '';
    if (typeof options === 'string') return options;
    if (Array.isArray(options)) {
      return options.map((o: any) => typeof o === 'string' ? o : (o.text || '')).join('|');
    }
    return '';
  };

  // Open edit modal
  const handleEdit = (q: BankQuestion) => {
    setEditingQuestion(q);
    setLastUploadedSize(null);

    const isImageMcq = q.answer_type === 'mcq-image';

    setEditForm({
      question_text_en: q.question_text_en || '',
      question_text_ms: q.question_text_ms || '',
      question_text_zh: q.question_text_zh || '',
      age_target: q.age_target,
      subject: q.subject,
      dskp_code: q.dskp_code || '',
      kssr_level: q.kssr_level || '',
      topic: q.topic || '',
      skill_name: q.skill_name || '',
      input_type: q.input_type || 'mcq',
      answer_type: q.answer_type || undefined,
      // For mcq-image: store full structured options arrays (with image/image_path)
      // For text MCQ: store pipe-delimited strings as before
      options_en: isImageMcq ? (Array.isArray(q.options_en) ? q.options_en : []) : optionsToPipe(q.options_en),
      options_ms: isImageMcq ? (Array.isArray(q.options_ms) ? q.options_ms : []) : optionsToPipe(q.options_ms),
      options_zh: isImageMcq ? (Array.isArray(q.options_zh) ? q.options_zh : []) : optionsToPipe(q.options_zh),
      correct_answer: q.correct_answer || '',
      visual_prompt: q.visual_prompt || '',
      image_url: q.image_url || '',
      tts_en: q.tts_en || '',
      tts_ms: q.tts_ms || '',
      tts_zh: q.tts_zh || '',
    });
  };

  // Save edited question
  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    setIsSaving(true);
    try {
      // For mcq-image: remap options to use image_path (storage path) instead of signed URL
      const payload = { ...editForm };
      if (editForm.answer_type === 'mcq-image') {
        const remapOptions = (opts: any[]) => {
          if (!Array.isArray(opts)) return opts;
          return opts.map((opt: any) => ({
            id: opt.id,
            text: opt.text || '',
            // Use image_path (original storage path) for saving; fall back to image if no path
            image: opt.image_path || opt.image || '',
          }));
        };
        payload.options_en = remapOptions(editForm.options_en);
        payload.options_ms = remapOptions(editForm.options_ms);
        payload.options_zh = remapOptions(editForm.options_zh);
      }

      // Include TTS fields in payload
      if (editForm.tts_en !== undefined) payload.tts_en = editForm.tts_en;
      if (editForm.tts_ms !== undefined) payload.tts_ms = editForm.tts_ms;
      if (editForm.tts_zh !== undefined) payload.tts_zh = editForm.tts_zh;

      const updated = await updateGlobalQuestion(editingQuestion.q_id, payload);
      toast.success(`Question ${editingQuestion.q_id} updated`);
      // Update local state immediately, then reload to get resolved URLs
      setQuestions(prev => prev.map(q =>
        q.q_id === editingQuestion.q_id ? { ...q, ...updated } : q
      ));
      setEditingQuestion(null);
      // Refresh current page to get properly resolved URLs
      loadData(currentPage);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Load paginated data
  const loadData = useCallback(async (page = currentPage) => {
    setIsLoading(true);
    try {
      const filters: any = { page, limit: ITEMS_PER_PAGE };
      if (filterSubject !== 'all') filters.subject = filterSubject;
      if (filterAge !== 'all') filters.age_target = Number(filterAge);
      if (debouncedSearch) filters.search = debouncedSearch;

      const [paginatedResult, statsData] = await Promise.all([
        fetchQuestionBankPaginated(filters),
        fetchQuestionBankStats()
      ]);
      setQuestions(paginatedResult.questions);
      setTotalPages(paginatedResult.totalPages);
      setTotalFiltered(paginatedResult.total);
      setCurrentPage(paginatedResult.page);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load question bank:', error);
      toast.error('Failed to load question bank');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filterSubject, filterAge, debouncedSearch]);

  // Initial load + reload when filters change
  useEffect(() => { loadData(1); }, [filterSubject, filterAge, debouncedSearch]);

  // Load quest subjects (source of truth from Quest Manager)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchQuests();
        const quests: { subject: string }[] = res || [];
        const subjects = Array.from(new Set(quests.map(q => q.subject).filter(Boolean))).sort();
        setQuestSubjects(subjects);
        console.log('[MasterQB] Quest subjects loaded:', subjects);
      } catch (err) {
        console.error('[MasterQB] Failed to fetch quest subjects:', err);
      }
    })();
  }, []);

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Page change handler
  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(p);
    loadData(p);
  };

  // Handle CSV upload (text MCQ or image MCQ)
  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const text = await uploadFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        toast.error('No valid rows found in CSV');
        setUploading(false);
        return;
      }

      // Validate subjects against Quest Manager
      const csvSubjects = Array.from(new Set(rows.map(r => r['subject'] || r['Subject']).filter(Boolean)));
      const unknownSubjects = csvSubjects.filter(s => !questSubjects.includes(s));
      if (unknownSubjects.length > 0) {
        const proceed = window.confirm(
          `Warning: The following subjects in your CSV are not defined in Quest Manager:\n\n` +
          `  ${unknownSubjects.join(', ')}\n\n` +
          `Questions with unrecognized subjects won't appear in any quest.\n` +
          `Available subjects: ${questSubjects.length > 0 ? questSubjects.join(', ') : '(none — create quests first)'}\n\n` +
          `Upload anyway?`
        );
        if (!proceed) {
          setUploading(false);
          return;
        }
      }

      let resultErrors: string[] = [];

      if (uploadType === 'mcq-image') {
        // MCQ-Image: map CSV rows with image URLs
        const mapped = rows.map(row => ({
          age_target: parseAgeTarget(row['age_target'] || row['Age'] || row['age']),
          subject: row['subject'] || row['Subject'],
          dskp_code: row['dskp_code'] || row['DSKP'] || '',
          kssr_level: row['kssr_level'] || row['level'] || '',
          topic: row['topic'] || row['kssr_level_2'] || '',
          skill_name: row['skill_name'] || '',
          question_text_en: row['question_text_en'] || row['Question'] || row['question'],
          question_text_ms: row['question_text_ms'] || '',
          question_text_zh: row['question_text_zh'] || '',
          option_a_image_url: row['option_a_image_url'] || '',
          option_b_image_url: row['option_b_image_url'] || '',
          option_c_image_url: row['option_c_image_url'] || '',
          option_d_image_url: row['option_d_image_url'] || '',
          option_labels_en: row['option_labels_en'] || '',
          option_labels_ms: row['option_labels_ms'] || '',
          option_labels_zh: row['option_labels_zh'] || '',
          correct_answer: row['correct_answer'] || row['Answer'] || row['answer'],
          visual_prompt: row['visual_prompt'] || '',
          image_url: row['image_url'] || '',
          TTS_en: row['TTS_en'] || row['tts_en'] || '',
          TTS_ms: row['TTS_ms'] || row['tts_ms'] || '',
          TTS_zh: row['TTS_zh'] || row['tts_zh'] || '',
        }));

        toast.info(`Processing ${mapped.length} questions (downloading ${mapped.length * 4} images)... This may take up to 60 seconds.`);
        const result = await uploadMCQImageQuestions(mapped);
        setUploadResult({ stored: result.stored, errors: result.errors || [], imagesProcessed: result.imagesProcessed });
        resultErrors = result.errors || [];
        if (result.stored > 0) {
          toast.success(`${result.stored} image-MCQ questions uploaded! (${result.imagesProcessed} images downloaded)`);
        } else {
          toast.error(`Upload failed — no questions stored. Check errors below.`);
        }
      } else {
        // Text MCQ: existing flow
        const mapped = rows.map(row => ({
          age_target: parseAgeTarget(row['age_target'] || row['Age'] || row['age']),
          subject: row['subject'] || row['Subject'],
          dskp_code: row['dskp_code'] || row['DSKP'] || '',
          kssr_level: row['kssr_level'] || row['level'] || '',
          topic: row['topic'] || row['kssr_level_2'] || '',
          skill_name: row['skill_name'] || '',
          question_text_en: row['question_text_en'] || row['Question'] || row['question'],
          question_text_ms: row['question_text_ms'] || '',
          question_text_zh: row['question_text_zh'] || '',
          input_type: (row['input_type'] || row['type'] || 'mcq').toLowerCase(),
          options_en: row['options_en'] || row['Options'] || '',
          options_ms: row['options_ms'] || '',
          options_zh: row['options_zh'] || '',
          correct_answer: row['correct_answer'] || row['Answer'] || row['answer'],
          visual_prompt: row['visual_prompt'] || '',
          image_url: row['image_url'] || row['Image'] || '',
          tts_en: row['TTS_en'] || row['tts_en'] || '',
          tts_ms: row['TTS_ms'] || row['tts_ms'] || '',
          tts_zh: row['TTS_zh'] || row['tts_zh'] || '',
        }));

        const result = await uploadQuestionBank(mapped);
        setUploadResult({ stored: result.stored, errors: result.errors || [] });
        resultErrors = result.errors || [];
        if (result.stored > 0) {
          toast.success(`${result.stored} questions uploaded successfully!`);
        } else {
          toast.error(`Upload failed — no questions stored. Check errors below.`);
        }
      }
      
      // Refresh data - go to page 1 to see new uploads
      await loadData(1);
      
      if (resultErrors.length === 0) {
        setTimeout(() => { setShowUpload(false); setUploadFile(null); setUploadResult(null); }, 1500);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  // Handle delete single question
  const handleDelete = async (qId: string) => {
    if (!confirm(`Delete question ${qId}?`)) return;
    try {
      await deleteGlobalQuestion(qId);
      toast.success(`Deleted ${qId}`);
      // Reload current page (or prev page if last item on page)
      const newPage = questions.length <= 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await loadData(newPage);
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  // Handle clear all
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL questions from the bank? This cannot be undone.')) return;
    if (!confirm('REALLY sure? This will remove everything.')) return;
    try {
      const result = await clearQuestionBank();
      toast.success(`Cleared ${result.deleted} questions`);
      setQuestions([]);
      setStats({ subjects: [], totalQuestions: 0 });
      setCurrentPage(1);
      setTotalPages(1);
      setTotalFiltered(0);
    } catch (error) {
      toast.error('Failed to clear question bank');
    }
  };

  // Download CSV template
  const handleDownloadTemplate = (type: 'mcq-text' | 'mcq-image') => {
    const csv = type === 'mcq-image' ? generateImageTemplate() : generateTextTemplate();
    const filename = type === 'mcq-image' ? 'mcq_image_template.csv' : 'mcq_text_template.csv';
    // BOM for Excel to correctly read UTF-8 (important for BM & Chinese text)
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Append to DOM for Safari compatibility
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Questions are already filtered server-side; group by subject for display
  const groupedBySubject = questions.reduce<Record<string, BankQuestion[]>>((acc, q) => {
    if (!acc[q.subject]) acc[q.subject] = [];
    acc[q.subject].push(q);
    return acc;
  }, {});

  const toggleSubject = (subject: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  // Use stats for subject filter options (not limited to current page)
  const uniqueSubjects = stats?.subjects.map(s => s.name).sort() || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Global Question Bank
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {stats ? `${stats.totalQuestions} questions across ${stats.subjects.length} subjects` : 'Loading...'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => loadData(currentPage)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleDownloadTemplate('mcq-text')}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
            title="Download MCQ Text CSV template"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Text Template</span>
            <span className="sm:hidden">Text</span>
          </button>
          <button
            onClick={() => handleDownloadTemplate('mcq-image')}
            className="px-3 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
            title="Download MCQ Image CSV template"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Image Template</span>
            <span className="sm:hidden">Image</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Question
          </button>
          <button
            onClick={() => { setShowUpload(true); setUploadResult(null); setUploadFile(null); }}
            className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && stats.subjects.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stats.subjects.map(subj => (
            <div key={subj.name} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900">{subj.name}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{subj.count}</p>
              <div className="flex gap-1 mt-2">
                {[4, 5, 6, 7].map(age => (
                  <span key={age} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                    Age {age}: {subj.ages[age] || 0}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by ID, text, or subject..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">All Subjects</option>
          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterAge}
          onChange={e => setFilterAge(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">All Ages</option>
          <option value="4">Age 4</option>
          <option value="5">Age 5</option>
          <option value="6">Age 6</option>
          <option value="7">Age 7</option>
        </select>
        {questions.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All
          </button>
        )}
      </div>

      {/* Questions List - Grouped by Subject */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
          Loading question bank...
        </div>
      ) : questions.length === 0 && !debouncedSearch && filterSubject === 'all' && filterAge === 'all' ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No questions in the bank yet</p>
          <p className="text-sm text-gray-500 mt-1">Create a question or upload a CSV to get started</p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Question
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
            >
              Upload CSV
            </button>
          </div>
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Search className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No questions match your filters</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {questions.length} of {totalFiltered} questions
              {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
            </p>
          </div>

          {/* Pagination Controls (top) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 py-2">
              <button onClick={() => goToPage(1)} disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* Page number buttons */}
              {(() => {
                const pages: number[] = [];
                let start = Math.max(1, currentPage - 2);
                let end = Math.min(totalPages, currentPage + 2);
                if (end - start < 4) {
                  if (start === 1) end = Math.min(totalPages, start + 4);
                  else start = Math.max(1, end - 4);
                }
                for (let i = start; i <= end; i++) pages.push(i);
                return pages.map(p => (
                  <button key={p} onClick={() => goToPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-black text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {p}
                  </button>
                ));
              })()}
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {Object.entries(groupedBySubject).sort(([a], [b]) => a.localeCompare(b)).map(([subject, qs]) => (
            <div key={subject} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
              <button
                onClick={() => toggleSubject(subject)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedSubjects.has(subject) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="font-medium text-gray-900">{subject}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                    {qs.length} questions
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {[4, 5, 6, 7].map(age => {
                    const count = qs.filter(q => q.age_target === age).length;
                    return count > 0 ? (
                      <span key={age} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                        {age}y: {count}
                      </span>
                    ) : null;
                  })}
                </div>
              </button>
              {expandedSubjects.has(subject) && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">ID</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Age</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Type</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">KSSR</th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Question</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-600 w-8">
                          <Image className="w-3.5 h-3.5 mx-auto text-gray-400" />
                        </th>
                        <th className="text-center px-2 py-2 font-medium text-gray-600 w-8">
                          <Volume2 className="w-3.5 h-3.5 mx-auto text-gray-400" />
                        </th>
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Answer</th>
                        <th className="text-right px-4 py-2 font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qs.sort((a, b) => a.age_target - b.age_target || a.q_id.localeCompare(b.q_id)).map(q => (
                        <tr key={q.q_id} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 font-mono text-xs text-gray-600">{q.q_id}</td>
                          <td className="px-4 py-2">
                            <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{q.age_target}</span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700">{q.input_type}</span>
                              {q.answer_type === 'mcq-image' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700" title="Image-based answer options">img</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            {q.dskp_code ? (
                              <span className="text-xs font-mono px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded" title={`${q.kssr_level || '?'} · ${q.topic || '?'} · ${q.skill_name || '?'}`}>
                                {q.dskp_code}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2 max-w-xs truncate text-gray-900">{q.question_text_en}</td>
                          <td className="px-2 py-2 text-center">
                            {(q.image_url || q.visual_prompt) && (
                              <Image
                                className="w-3.5 h-3.5 mx-auto text-gray-400"
                                style={{ opacity: q.image_url ? 1 : 0.3 }}
                                title={q.image_url ? 'Image uploaded' : `Prompt: ${q.visual_prompt}`}
                              />
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {(q.tts_en || q.tts_ms || q.tts_zh) && (
                              <Volume2
                                className="w-3.5 h-3.5 mx-auto text-amber-500"
                                title={`TTS: ${[q.tts_en && 'EN', q.tts_ms && 'BM', q.tts_zh && 'ZH'].filter(Boolean).join(', ')}`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-600 font-mono text-xs">{q.correct_answer}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(q)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit question"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(q.q_id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete question"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Pagination Controls (bottom) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 py-3">
              <button onClick={() => goToPage(1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronsLeft className="w-4 h-4" /></button>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-3 py-1.5 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronsRight className="w-4 h-4" /></button>
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Upload Question Bank CSV</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Select question type, then upload the matching CSV template
                </p>
              </div>
              <button onClick={() => { setShowUpload(false); setUploadResult(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Question Type Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Select Question Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setUploadType('mcq-text'); setUploadFile(null); setUploadResult(null); }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      uploadType === 'mcq-text'
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm font-semibold text-gray-900">MCQ — Text</span>
                    </div>
                    <p className="text-xs text-gray-500">Text answers (A/B/C/D)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUploadType('mcq-image'); setUploadFile(null); setUploadResult(null); }}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      uploadType === 'mcq-image'
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ImagePlus className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-gray-900">MCQ — Image</span>
                    </div>
                    <p className="text-xs text-gray-500">Image answers (URLs)</p>
                  </button>
                </div>
              </div>

              {/* Step 2: Download template */}
              <button
                onClick={() => handleDownloadTemplate(uploadType)}
                className="w-full px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download {uploadType === 'mcq-image' ? 'Image MCQ' : 'Text MCQ'} Template
              </button>

              {/* Step 3: File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Step 3: Upload Filled CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => { setUploadFile(e.target.files?.[0] || null); setUploadResult(null); }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  disabled={uploading}
                />
                {uploadFile && (
                  <p className="text-sm text-gray-600 mt-1">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>

              {/* MCQ-Image warning */}
              {uploadType === 'mcq-image' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-medium mb-1">Image MCQ Processing</p>
                  <p className="text-xs text-blue-700">
                    The server downloads answer images + optional TTS audio from URLs, validates them,
                    and stores permanently in R2 (no URL expiry). Google Drive URLs are auto-converted. May take 30-60s for large uploads.
                  </p>
                </div>
              )}

              {/* Result */}
              {uploadResult && (
                <div className={`p-4 rounded-lg border ${uploadResult.errors.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-start gap-2">
                    {uploadResult.errors.length > 0 ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        {uploadResult.stored} questions stored successfully
                        {uploadResult.imagesProcessed ? ` (${uploadResult.imagesProcessed} images downloaded)` : ''}
                      </p>
                      {uploadResult.errors.length > 0 && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {uploadResult.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-600">{err}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions — dynamic based on type */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {uploadType === 'mcq-image' ? 'Image MCQ CSV Columns:' : 'Text MCQ CSV Columns:'}
                </p>
                {uploadType === 'mcq-text' ? (
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                    <span><strong>age_target</strong> — 4 to 12</span>
                    <span><strong>subject</strong> — Must match Quest Manager</span>
                    <span><strong>dskp_code</strong> — Skill Code</span>
                    <span><strong>question_text_en</strong> — English</span>
                    <span><strong>question_text_ms</strong> — BM</span>
                    <span><strong>question_text_zh</strong> — Chinese</span>
                    <span><strong>input_type</strong> — mcq</span>
                    <span><strong>options_en</strong> — Pipe-separated English</span>
                    <span><strong>options_ms</strong> — Pipe-separated BM</span>
                    <span><strong>options_zh</strong> — Pipe-separated Chinese</span>
                    <span><strong>correct_answer</strong> — a, b, c, or d</span>
                    <span><strong>visual_prompt</strong> — Prompt text</span>
                    <span><strong>image_url</strong> — Optional image</span>
                    <span><strong>TTS_en</strong> — Audio URL (opt.)</span>
                    <span><strong>TTS_ms</strong> — Audio URL (opt.)</span>
                    <span><strong>TTS_zh</strong> — Audio URL (opt.)</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                    <span><strong>age_target</strong> — 4 to 12</span>
                    <span><strong>subject</strong> — Must match Quest Manager</span>
                    <span><strong>dskp_code</strong> — Skill Code</span>
                    <span><strong>question_text_en</strong> — English</span>
                    <span><strong>question_text_ms</strong> — BM</span>
                    <span><strong>question_text_zh</strong> — Chinese</span>
                    <span><strong>option_a_image_url</strong> — HTTPS URL</span>
                    <span><strong>option_b_image_url</strong> — HTTPS URL</span>
                    <span><strong>option_c_image_url</strong> — HTTPS URL</span>
                    <span><strong>option_d_image_url</strong> — HTTPS URL</span>
                    <span><strong>option_labels_en</strong> — Pipe-separated (opt.)</span>
                    <span><strong>option_labels_ms</strong> — Pipe-separated (opt.)</span>
                    <span><strong>option_labels_zh</strong> — Pipe-separated (opt.)</span>
                    <span><strong>correct_answer</strong> — a, b, c, or d</span>
                    <span><strong>visual_prompt</strong> — AI image prompt (opt.)</span>
                    <span><strong>image_url</strong> — Header image URL (opt.)</span>
                    <span><strong>TTS_en</strong> — Audio URL (opt.)</span>
                    <span><strong>TTS_ms</strong> — Audio URL (opt.)</span>
                    <span><strong>TTS_zh</strong> — Audio URL (opt.)</span>
                  </div>
                )}
                <p className="text-xs text-green-600 mt-3 font-medium">
                  No q_id needed — IDs are auto-generated as SUBJ-AGE-001, SUBJ-AGE-002, etc.
                </p>
                {questSubjects.length > 0 ? (
                  <p className="text-xs text-blue-600 mt-1">
                    Available subjects: {questSubjects.join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">
                    No subjects found — create quests in Quest Manager first to define available subjects.
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Google Drive URLs (drive.google.com/uc?id=...) are automatically converted for download.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => { setShowUpload(false); setUploadResult(null); }}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className={`flex-1 px-4 py-2 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
                  uploadType === 'mcq-image' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-gray-800'
                }`}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {uploadType === 'mcq-image' ? 'Downloading images...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Upload {uploadType === 'mcq-image' ? 'Image MCQ' : 'Text MCQ'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Question Modal */}
      {showCreate && (
        <QuestionCreator
          onClose={() => setShowCreate(false)}
          onCreated={() => loadData(1)}
          subjects={uniqueSubjects}
          questSubjects={questSubjects}
        />
      )}

      {/* Edit Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  Edit Question
                  {editingQuestion.answer_type === 'mcq-image' && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-200">
                      Image MCQ
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {editingQuestion.answer_type === 'mcq-image'
                    ? 'Edit image options, labels, and question details'
                    : 'Modify the question details below'}
                </p>
              </div>
              <button onClick={() => setEditingQuestion(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Form fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question ID</label>
                <input
                  type="text"
                  value={editingQuestion.q_id}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Age Target</label>
                <input
                  type="number"
                  value={editForm.age_target}
                  onChange={e => setEditForm({ ...editForm, age_target: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <select
                  value={editForm.subject}
                  onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">Select subject...</option>
                  {Array.from(new Set([...questSubjects, ...uniqueSubjects, ...(editForm.subject ? [editForm.subject] : [])])).sort().map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {/* KSSR Skill Tag */}
              <KSSRSkillPicker
                value={{
                  level: editForm.kssr_level || '',
                  subject: editForm.subject || '',
                  topic: editForm.topic || '',
                  skillName: editForm.skill_name || '',
                  dskpCode: editForm.dskp_code || '',
                }}
                onChange={(sel: KSSRSelection) => {
                  setEditForm({
                    ...editForm,
                    dskp_code: sel.dskpCode,
                    kssr_level: sel.level,
                    topic: sel.topic,
                    skill_name: sel.skillName,
                    ...(sel.subject ? { subject: sel.subject } : {}),
                  });
                }}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Text (English)</label>
                <textarea
                  value={editForm.question_text_en}
                  onChange={e => setEditForm({ ...editForm, question_text_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Text (Bahasa Melayu)</label>
                <textarea
                  value={editForm.question_text_ms}
                  onChange={e => setEditForm({ ...editForm, question_text_ms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Text (Chinese)</label>
                <textarea
                  value={editForm.question_text_zh}
                  onChange={e => setEditForm({ ...editForm, question_text_zh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Input Type</label>
                <div className="flex items-center gap-3">
                  <select
                    value={editForm.input_type}
                    onChange={e => setEditForm({ ...editForm, input_type: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                  </select>
                  {editForm.answer_type === 'mcq-image' && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded border border-blue-200">
                      Image Options
                    </span>
                  )}
                </div>
              </div>

              {/* ── MCQ-IMAGE OPTIONS EDITOR ── */}
              {editForm.answer_type === 'mcq-image' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Answer Options (Image MCQ)
                  </label>
                  <div className="space-y-4">
                    {(['a', 'b', 'c', 'd'] as const).map((optId) => {
                      // Get the option from options_en (images are shared across languages)
                      const optEn = Array.isArray(editForm.options_en) ? editForm.options_en.find((o: any) => o.id === optId) : null;
                      const optMs = Array.isArray(editForm.options_ms) ? editForm.options_ms.find((o: any) => o.id === optId) : null;
                      const optZh = Array.isArray(editForm.options_zh) ? editForm.options_zh.find((o: any) => o.id === optId) : null;
                      const imageUrl = optEn?.image || '';
                      const isCorrect = editForm.correct_answer?.toLowerCase() === optId;

                      return (
                        <div
                          key={optId}
                          className={`border rounded-xl p-3 ${isCorrect ? 'border-green-300 bg-green-50/50' : 'border-gray-200'}`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Option letter badge */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                              isCorrect ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {optId.toUpperCase()}
                            </div>

                            {/* Image preview */}
                            <div className="shrink-0">
                              {imageUrl ? (
                                <div className="relative group">
                                  <img
                                    src={imageUrl}
                                    alt={`Option ${optId}`}
                                    className="w-20 h-20 rounded-lg object-cover border border-gray-200 bg-gray-50"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = '';
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                  <label className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                    <ImagePlus className="w-5 h-5 text-white" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 500 * 1024) {
                                          toast.error('Option image must be under 500KB');
                                          return;
                                        }
                                        try {
                                          toast.loading(`Uploading option ${optId.toUpperCase()}...`, { id: `opt-${optId}` });
                                          const result = await uploadAnswerOptionImage(file, editingQuestion!.q_id, optId);
                                          // Update all 3 language options with new image path + public URL
                                          const updateOpts = (opts: any[]) => {
                                            if (!Array.isArray(opts)) return opts;
                                            return opts.map((o: any) =>
                                              o.id === optId ? { ...o, image: result.public_url || result.signed_url, image_path: result.image_path } : o
                                            );
                                          };
                                          setEditForm((prev: any) => ({
                                            ...prev,
                                            options_en: updateOpts(prev.options_en),
                                            options_ms: updateOpts(prev.options_ms),
                                            options_zh: updateOpts(prev.options_zh),
                                          }));
                                          toast.success(`Option ${optId.toUpperCase()} image replaced!`, { id: `opt-${optId}` });
                                        } catch (err) {
                                          console.error('Option image upload failed:', err);
                                          toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: `opt-${optId}` });
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              ) : (
                                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors">
                                  <ImagePlus className="w-5 h-5" />
                                  <span className="text-[9px]">Upload</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      if (file.size > 500 * 1024) {
                                        toast.error('Option image must be under 500KB');
                                        return;
                                      }
                                      try {
                                        toast.loading(`Uploading option ${optId.toUpperCase()}...`, { id: `opt-${optId}` });
                                        const result = await uploadAnswerOptionImage(file, editingQuestion!.q_id, optId);
                                        const updateOpts = (opts: any[]) => {
                                          if (!Array.isArray(opts)) return opts;
                                          return opts.map((o: any) =>
                                            o.id === optId ? { ...o, image: result.public_url || result.signed_url, image_path: result.image_path } : o
                                          );
                                        };
                                        setEditForm((prev: any) => ({
                                          ...prev,
                                          options_en: updateOpts(prev.options_en),
                                          options_ms: updateOpts(prev.options_ms),
                                          options_zh: updateOpts(prev.options_zh),
                                        }));
                                        toast.success(`Option ${optId.toUpperCase()} image uploaded!`, { id: `opt-${optId}` });
                                      } catch (err) {
                                        console.error('Option image upload failed:', err);
                                        toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: `opt-${optId}` });
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              )}
                            </div>

                            {/* Text labels */}
                            <div className="flex-1 space-y-1.5 min-w-0">
                              <input
                                type="text"
                                value={optEn?.text || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditForm((prev: any) => ({
                                    ...prev,
                                    options_en: Array.isArray(prev.options_en) ? prev.options_en.map((o: any) =>
                                      o.id === optId ? { ...o, text: val } : o
                                    ) : prev.options_en,
                                  }));
                                }}
                                placeholder="English label"
                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                              />
                              <input
                                type="text"
                                value={optMs?.text || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditForm((prev: any) => ({
                                    ...prev,
                                    options_ms: Array.isArray(prev.options_ms) ? prev.options_ms.map((o: any) =>
                                      o.id === optId ? { ...o, text: val } : o
                                    ) : prev.options_ms,
                                  }));
                                }}
                                placeholder="BM label"
                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                              />
                              <input
                                type="text"
                                value={optZh?.text || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditForm((prev: any) => ({
                                    ...prev,
                                    options_zh: Array.isArray(prev.options_zh) ? prev.options_zh.map((o: any) =>
                                      o.id === optId ? { ...o, text: val } : o
                                    ) : prev.options_zh,
                                  }));
                                }}
                                placeholder="Chinese label"
                                className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Hover over an image to replace it. Max 500KB per image. Images are shared across all 3 languages.
                  </p>
                </div>
              ) : (
                /* ── TEXT MCQ OPTIONS EDITOR (original) ── */
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options (English)</label>
                    <input
                      type="text"
                      value={editForm.options_en}
                      onChange={e => setEditForm({ ...editForm, options_en: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Option A|Option B|Option C|Option D"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options (Bahasa Melayu)</label>
                    <input
                      type="text"
                      value={editForm.options_ms}
                      onChange={e => setEditForm({ ...editForm, options_ms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Pilihan A|Pilihan B|Pilihan C|Pilihan D"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Options (Chinese)</label>
                    <input
                      type="text"
                      value={editForm.options_zh}
                      onChange={e => setEditForm({ ...editForm, options_zh: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="选项A|选项B|选项C|选项D"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                {editForm.answer_type === 'mcq-image' ? (
                  <div className="flex gap-2">
                    {['a', 'b', 'c', 'd'].map((optId) => {
                      const isSelected = editForm.correct_answer?.toLowerCase() === optId;
                      return (
                        <button
                          key={optId}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, correct_answer: optId })}
                          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                            isSelected
                              ? 'bg-green-600 text-white border-green-600 shadow-md'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600'
                          }`}
                        >
                          {optId.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editForm.correct_answer}
                    onChange={e => setEditForm({ ...editForm, correct_answer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visual Prompt</label>
                <input
                  type="text"
                  value={editForm.visual_prompt}
                  onChange={e => setEditForm({ ...editForm, visual_prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Image</label>
                {/* Image preview */}
                {editForm.image_url && (
                  <div className="mb-3 relative inline-block">
                    <img
                      src={editForm._image_preview || (editForm.image_url?.startsWith('http') ? editForm.image_url : '')}
                      alt="Question"
                      className="h-32 w-auto rounded-lg border border-gray-200 object-contain bg-gray-50"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <button
                      onClick={() => setEditForm({ ...editForm, image_url: '' })}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {/* Upload button */}
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
                    <ImagePlus className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {editForm.image_url ? 'Replace Image' : 'Upload Image'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          toast.error('Image must be under 500KB');
                          return;
                        }
                        try {
                          toast.loading('Uploading image...', { id: 'img-upload' });
                          const result = await uploadQuestionImage(file);
                          // Store the R2 key for saving; use public_url for local preview
                          setEditForm({ ...editForm, image_url: result.image_path, _image_preview: result.public_url });
                          toast.success('Image uploaded!', { id: 'img-upload' });
                          setLastUploadedSize(file.size);
                        } catch (err) {
                          console.error('Image upload failed:', err);
                          toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: 'img-upload' });
                        }
                        // Reset input so same file can be re-selected
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">Recommended: 600 × 300px · Landscape · PNG or JPG · Max 500KB</p>
                {/* Uploaded file size */}
                {lastUploadedSize !== null && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Uploaded: {lastUploadedSize < 1024 * 1024 ? `${(lastUploadedSize / 1024).toFixed(1)} KB` : `${(lastUploadedSize / (1024 * 1024)).toFixed(2)} MB`}
                  </p>
                )}
                {/* Manual URL fallback */}
                <div className="mt-2">
                  <p className="text-xs text-gray-400 mb-1">Or paste an external URL:</p>
                  <input
                    type="text"
                    value={editForm.image_url}
                    onChange={e => setEditForm({ ...editForm, image_url: e.target.value })}
                    placeholder="https://example.com/image.png"
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600"
                  />
                </div>
              </div>

              {/* ── TTS AUDIO SECTION ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Volume2 className="w-4 h-4 inline mr-1 text-amber-500" />
                  Question Voice (TTS)
                </label>
                <div className="space-y-2">
                  {[
                    { lang: 'en' as const, label: 'English', field: 'tts_en' },
                    { lang: 'ms' as const, label: 'Bahasa Melayu', field: 'tts_ms' },
                    { lang: 'zh' as const, label: 'Chinese', field: 'tts_zh' },
                  ].map(({ lang, label, field }) => {
                    const url = editForm[field];
                    return (
                      <div key={lang} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-xs font-medium text-gray-500 w-14 shrink-0">{label}</span>
                        {url ? (
                          <>
                            <audio controls className="h-8 flex-1 min-w-0" preload="none">
                              <source src={url} />
                            </audio>
                            <button
                              type="button"
                              onClick={() => setEditForm({ ...editForm, [field]: '' })}
                              className="p-1 text-gray-400 hover:text-red-500 rounded shrink-0"
                              title={`Remove ${label} TTS`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <label className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-amber-400 hover:bg-amber-50 cursor-pointer transition-colors">
                            <Upload className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-500">Upload MP3/WAV</span>
                            <input
                              type="file"
                              accept="audio/mpeg,audio/wav,audio/mp3,audio/ogg,.mp3,.wav,.ogg"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.size > 2 * 1024 * 1024) {
                                  toast.error('Audio file must be under 2MB');
                                  return;
                                }
                                try {
                                  toast.loading(`Uploading ${label} TTS...`, { id: `tts-${lang}` });
                                  const result = await uploadQuestionTTS(file, editingQuestion!.q_id, lang);
                                  setEditForm((prev: any) => ({ ...prev, [field]: result.public_url }));
                                  toast.success(`${label} TTS uploaded!`, { id: `tts-${lang}` });
                                } catch (err) {
                                  console.error(`TTS upload failed (${lang}):`, err);
                                  toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`, { id: `tts-${lang}` });
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Upload MP3/WAV per language, or add via CSV bulk upload. Max 2MB each.</p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setEditingQuestion(null)}
                className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};