import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Search, Trash2, Download, AlertCircle, CheckCircle, RefreshCw, Database, ChevronDown, ChevronRight, X, FileText } from 'lucide-react';
import { Pencil, Save, ImagePlus, Image } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { uploadQuestionBank, uploadMCQImageQuestions, fetchQuestionBank, fetchQuestionBankStats, deleteGlobalQuestion, clearQuestionBank, updateGlobalQuestion, uploadQuestionImage } from '../../utils/api';

interface BankQuestion {
  q_id: string;
  age_target: number;
  subject: string;
  dskp_code: string;
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

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// Generate sample CSV templates
function generateTextTemplate(): string {
  const headers = 'age_target,subject,dskp_code,question_text_en,question_text_ms,question_text_zh,input_type,options_en,options_ms,options_zh,correct_answer,visual_prompt,image_url';
  const samples = [
    '4,English,BI 1.1.1,Which letter comes after A?,Huruf mana yang datang selepas A?,哪个字母在A之后?,mcq,B|C|D|Z,B|C|D|Z,B|C|D|Z,a,Cheerful alphabet scene,',
    '5,Math,MA 2.1.1,What is 2 + 3?,Berapakah 2 + 3?,2加3等于多少?,mcq,4|5|6|7,4|5|6|7,4|5|6|7,b,Colorful number blocks,',
    '4,Bahasa Melayu,BM 1.1.1,What colour is the sky?,Apakah warna langit?,天空是什么颜色?,mcq,Red|Blue|Green|Yellow,Merah|Biru|Hijau|Kuning,红色|蓝色|绿色|黄色,b,Bright sky scene,',
    '"6",English,BI 3.2.1,"Put in order: wake up, eat, school, sleep","Susun mengikut urutan: bangun, makan, sekolah, tidur","按顺序排列：起床、吃饭、上学、睡觉",sequence,Wake up|Eat breakfast|Go to school|Sleep,Bangun|Makan pagi|Pergi sekolah|Tidur,起床|吃早餐|去上学|睡觉,"a,b,c,d",Daily routine images,',
  ];
  return headers + '\n' + samples.join('\n');
}

function generateImageTemplate(): string {
  const headers = 'age_target,subject,dskp_code,question_text_en,question_text_ms,question_text_zh,option_a_image_url,option_b_image_url,option_c_image_url,option_d_image_url,option_labels_en,option_labels_ms,option_labels_zh,correct_answer,visual_prompt,image_url';
  const samples = [
    '4,Math,MA 1.1.1,Which shape is a circle?,Bentuk mana yang bulatan?,哪个形状是圆形?,https://example.com/circle.png,https://example.com/square.png,https://example.com/triangle.png,https://example.com/star.png,Circle|Square|Triangle|Star,Bulatan|Segi empat|Segi tiga|Bintang,圆形|正方形|三角形|星形,a,Colourful shapes,',
    '5,Science,SN 2.1.1,Which animal lives in water?,Haiwan mana yang tinggal di air?,哪种动物生活在水里?,https://example.com/fish.png,https://example.com/cat.png,https://example.com/bird.png,https://example.com/dog.png,Fish|Cat|Bird|Dog,Ikan|Kucing|Burung|Anjing,鱼|猫|鸟|狗,a,Animal habitats,',
  ];
  return headers + '\n' + samples.join('\n');
}

export const MasterQuestionBank: React.FC = () => {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [stats, setStats] = useState<{ subjects: SubjectStats[]; totalQuestions: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterAge, setFilterAge] = useState<string>('all');
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

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
    setEditForm({
      question_text_en: q.question_text_en || '',
      question_text_ms: q.question_text_ms || '',
      question_text_zh: q.question_text_zh || '',
      age_target: q.age_target,
      subject: q.subject,
      dskp_code: q.dskp_code || '',
      input_type: q.input_type || 'mcq',
      options_en: optionsToPipe(q.options_en),
      options_ms: optionsToPipe(q.options_ms),
      options_zh: optionsToPipe(q.options_zh),
      correct_answer: q.correct_answer || '',
      visual_prompt: q.visual_prompt || '',
      image_url: q.image_url || '',
    });
  };

  // Save edited question
  const handleSaveEdit = async () => {
    if (!editingQuestion) return;
    setIsSaving(true);
    try {
      const updated = await updateGlobalQuestion(editingQuestion.q_id, editForm);
      toast.success(`Question ${editingQuestion.q_id} updated`);
      // Update local state
      setQuestions(prev => prev.map(q =>
        q.q_id === editingQuestion.q_id ? { ...q, ...updated } : q
      ));
      setEditingQuestion(null);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [questionsData, statsData] = await Promise.all([
        fetchQuestionBank(),
        fetchQuestionBankStats()
      ]);
      setQuestions(questionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load question bank:', error);
      toast.error('Failed to load question bank');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

      let resultErrors: string[] = [];

      if (uploadType === 'mcq-image') {
        // MCQ-Image: map CSV rows with image URLs
        const mapped = rows.map(row => ({
          age_target: Number(row['age_target'] || row['Age'] || row['age']),
          subject: row['subject'] || row['Subject'],
          dskp_code: row['dskp_code'] || row['DSKP'] || '',
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
        }));

        toast.info(`Processing ${mapped.length} questions (downloading ${mapped.length * 4} images)... This may take up to 60 seconds.`);
        const result = await uploadMCQImageQuestions(mapped);
        setUploadResult({ stored: result.stored, errors: result.errors || [], imagesProcessed: result.imagesProcessed });
        resultErrors = result.errors || [];
        toast.success(`${result.stored} image-MCQ questions uploaded! (${result.imagesProcessed} images downloaded)`);
      } else {
        // Text MCQ: existing flow
        const mapped = rows.map(row => ({
          age_target: Number(row['age_target'] || row['Age'] || row['age']),
          subject: row['subject'] || row['Subject'],
          dskp_code: row['dskp_code'] || row['DSKP'] || '',
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
        }));

        const result = await uploadQuestionBank(mapped);
        setUploadResult({ stored: result.stored, errors: result.errors || [] });
        resultErrors = result.errors || [];
        toast.success(`${result.stored} questions uploaded successfully!`);
      }
      
      // Refresh data
      await loadData();
      
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
      setQuestions(prev => prev.filter(q => q.q_id !== qId));
      // Refresh stats
      const statsData = await fetchQuestionBankStats();
      setStats(statsData);
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

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    if (filterSubject !== 'all' && q.subject !== filterSubject) return false;
    if (filterAge !== 'all' && q.age_target !== Number(filterAge)) return false;
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return q.q_id.toLowerCase().includes(search) ||
             q.question_text_en.toLowerCase().includes(search) ||
             q.subject.toLowerCase().includes(search);
    }
    return true;
  });

  // Group by subject for display
  const groupedBySubject = filteredQuestions.reduce<Record<string, BankQuestion[]>>((acc, q) => {
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

  const uniqueSubjects = [...new Set(questions.map(q => q.subject))].sort();

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
            onClick={loadData}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
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
      ) : questions.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No questions in the bank yet</p>
          <p className="text-sm text-gray-500 mt-1">Upload a CSV to get started</p>
          <button
            onClick={() => setShowUpload(true)}
            className="mt-4 px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800"
          >
            Upload CSV
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">{filteredQuestions.length} questions shown</p>
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
                        <th className="text-left px-4 py-2 font-medium text-gray-600">Question</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-600 w-8">
                          <Image className="w-3.5 h-3.5 mx-auto text-gray-400" />
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
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                q.input_type === 'mcq' ? 'bg-green-50 text-green-700' :
                                q.input_type === 'sequence' ? 'bg-purple-50 text-purple-700' :
                                'bg-orange-50 text-orange-700'
                              }`}>{q.input_type}</span>
                              {q.answer_type === 'mcq-image' && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700" title="Image-based answer options">img</span>
                              )}
                            </div>
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
                    The server will download each answer image from the URL, validate it (must be HTTPS, image format, ≤200KB),
                    and permanently store it in Supabase Storage. This may take 30-60 seconds for large uploads.
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
                    <span><strong>age_target</strong> — 4, 5, 6, or 7</span>
                    <span><strong>subject</strong> — English, Math, etc.</span>
                    <span><strong>dskp_code</strong> — KSSR code</span>
                    <span><strong>question_text_en</strong> — English</span>
                    <span><strong>question_text_ms</strong> — BM</span>
                    <span><strong>question_text_zh</strong> — Chinese</span>
                    <span><strong>input_type</strong> — mcq, sequence</span>
                    <span><strong>options_en</strong> — Pipe-separated English</span>
                    <span><strong>options_ms</strong> — Pipe-separated BM</span>
                    <span><strong>options_zh</strong> — Pipe-separated Chinese</span>
                    <span><strong>correct_answer</strong> — a, b, c, or d</span>
                    <span><strong>visual_prompt</strong> — Prompt text</span>
                    <span><strong>image_url</strong> — Optional image</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-600">
                    <span><strong>age_target</strong> — 4, 5, 6, or 7</span>
                    <span><strong>subject</strong> — English, Math, etc.</span>
                    <span><strong>dskp_code</strong> — KSSR code</span>
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
                  </div>
                )}
                <p className="text-xs text-green-600 mt-3 font-medium">
                  No q_id needed — IDs are auto-generated as SUBJ-AGE-001, SUBJ-AGE-002, etc.
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

      {/* Edit Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit Question</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Modify the question details below
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
                <input
                  type="text"
                  value={editForm.subject}
                  onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">DSKP Code</label>
                <input
                  type="text"
                  value={editForm.dskp_code}
                  onChange={e => setEditForm({ ...editForm, dskp_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
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
                <select
                  value={editForm.input_type}
                  onChange={e => setEditForm({ ...editForm, input_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="sequence">Sequence</option>
                  <option value="hotspot">Hotspot</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options (English)</label>
                <input
                  type="text"
                  value={editForm.options_en}
                  onChange={e => setEditForm({ ...editForm, options_en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options (Bahasa Melayu)</label>
                <input
                  type="text"
                  value={editForm.options_ms}
                  onChange={e => setEditForm({ ...editForm, options_ms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Options (Chinese)</label>
                <input
                  type="text"
                  value={editForm.options_zh}
                  onChange={e => setEditForm({ ...editForm, options_zh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
                <input
                  type="text"
                  value={editForm.correct_answer}
                  onChange={e => setEditForm({ ...editForm, correct_answer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
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
                      src={editForm.image_url}
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
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error('Image must be under 5MB');
                          return;
                        }
                        try {
                          toast.loading('Uploading image...', { id: 'img-upload' });
                          const result = await uploadQuestionImage(file);
                          // Store the storage path (not the signed URL) — server resolves on GET
                          setEditForm({ ...editForm, image_url: result.image_path });
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
                <p className="text-xs text-gray-400 mt-1.5">Recommended: 600 × 300px · Landscape · PNG or JPG · Max 5MB</p>
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