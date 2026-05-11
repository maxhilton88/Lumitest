/**
 * QuestionCreator — Admin modal form for manually creating a single question.
 * Supports both Text MCQ and Image MCQ types.
 * Uploads images and TTS audio directly to R2 via existing endpoints.
 * Uses a temporary client-side ID for file uploads, then creates the question
 * via the standard upload endpoint which auto-generates the real q_id.
 */
import React, { useState, useCallback } from 'react';
import { X, Upload, Plus, ImagePlus, Volume2, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  uploadQuestionBank,
  uploadQuestionImage,
  uploadAnswerOptionImage,
  uploadQuestionTTS,
} from '../../utils/api';
import { KSSRSkillPicker, type KSSRSelection } from './KSSRSkillPicker';

interface QuestionCreatorProps {
  onClose: () => void;
  onCreated: () => void;
  subjects: string[];          // subjects that already have questions in the bank
  questSubjects?: string[];    // subjects from Quest Manager (source of truth)
}

const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const OPTION_IDS = ['a', 'b', 'c', 'd'] as const;

interface OptionData {
  id: string;
  text: string;
  image?: string;       // R2 public URL for preview
  image_path?: string;  // R2 key for storage (r2:mcq-img/...)
}

export const QuestionCreator: React.FC<QuestionCreatorProps> = ({ onClose, onCreated, subjects, questSubjects = [] }) => {
  // Form state
  const [answerType, setAnswerType] = useState<'text' | 'mcq-image'>('text');
  const [subject, setSubject] = useState('');
  const [ageTarget, setAgeTarget] = useState(4);
  const [dskpCode, setDskpCode] = useState('');
  const [kssrLevel, setKssrLevel] = useState('');
  const [kssrTopic, setKssrTopic] = useState('');
  const [kssrSkillName, setKssrSkillName] = useState('');
  const [questionTextEn, setQuestionTextEn] = useState('');
  const [questionTextMs, setQuestionTextMs] = useState('');
  const [questionTextZh, setQuestionTextZh] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('a');
  const [visualPrompt, setVisualPrompt] = useState('');

  // Header image
  const [headerImageKey, setHeaderImageKey] = useState('');      // r2: key
  const [headerImagePreview, setHeaderImagePreview] = useState(''); // public URL
  const [uploadingHeader, setUploadingHeader] = useState(false);

  // Text MCQ options (pipe-delimited strings)
  const [optionsEn, setOptionsEn] = useState('');
  const [optionsMs, setOptionsMs] = useState('');
  const [optionsZh, setOptionsZh] = useState('');

  // Image MCQ options
  const [imageOptions, setImageOptions] = useState<OptionData[]>(
    OPTION_IDS.map(id => ({ id, text: '' }))
  );
  const [imageLabelsMs, setImageLabelsMs] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [imageLabelsZh, setImageLabelsZh] = useState<Record<string, string>>({ a: '', b: '', c: '', d: '' });
  const [uploadingOption, setUploadingOption] = useState<string | null>(null);

  // TTS audio
  const [ttsEn, setTtsEn] = useState('');       // r2: key
  const [ttsMs, setTtsMs] = useState('');
  const [ttsZh, setTtsZh] = useState('');
  const [ttsPreviewEn, setTtsPreviewEn] = useState('');
  const [ttsPreviewMs, setTtsPreviewMs] = useState('');
  const [ttsPreviewZh, setTtsPreviewZh] = useState('');
  const [uploadingTts, setUploadingTts] = useState<string | null>(null);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Temp ID for file uploads (used as questionId in R2 paths)
  const [tempId] = useState(() => `tmp-${crypto.randomUUID().slice(0, 8)}`);

  // Quest Manager is the source of truth for available subjects.
  // Also include subjects that already have questions in the bank (in case a quest was deleted but questions remain).
  const allSubjects = Array.from(new Set([...questSubjects, ...subjects])).sort();
  const finalSubject = subject;

  // ── Upload header image ──
  const handleHeaderImageUpload = useCallback(async (file: File) => {
    if (file.size > 500 * 1024) {
      toast.error('Image must be under 500KB');
      return;
    }
    setUploadingHeader(true);
    try {
      const result = await uploadQuestionImage(file);
      setHeaderImageKey(result.image_path);
      setHeaderImagePreview(result.public_url);
      toast.success('Header image uploaded!');
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingHeader(false);
    }
  }, []);

  // ── Upload answer option image ──
  const handleOptionImageUpload = useCallback(async (optionId: string, file: File) => {
    if (file.size > 500 * 1024) {
      toast.error('Option image must be under 500KB');
      return;
    }
    setUploadingOption(optionId);
    try {
      const result = await uploadAnswerOptionImage(file, tempId, optionId);
      setImageOptions(prev => prev.map(o =>
        o.id === optionId
          ? { ...o, image: result.public_url, image_path: result.image_path }
          : o
      ));
      toast.success(`Option ${optionId.toUpperCase()} image uploaded!`);
    } catch (err) {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingOption(null);
    }
  }, [tempId]);

  // ── Upload TTS audio ──
  const handleTtsUpload = useCallback(async (lang: 'en' | 'ms' | 'zh', file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Audio file must be under 2MB');
      return;
    }
    setUploadingTts(lang);
    try {
      const result = await uploadQuestionTTS(file, tempId, lang);
      const setKey = lang === 'en' ? setTtsEn : lang === 'ms' ? setTtsMs : setTtsZh;
      const setPreview = lang === 'en' ? setTtsPreviewEn : lang === 'ms' ? setTtsPreviewMs : setTtsPreviewZh;
      setKey(result.image_path);
      setPreview(result.public_url);
      toast.success(`${lang.toUpperCase()} TTS uploaded!`);
    } catch (err) {
      toast.error(`TTS upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploadingTts(null);
    }
  }, [tempId]);

  // ── Validate form ──
  const validate = (): string | null => {
    if (!finalSubject) return 'Subject is required';
    if (!questionTextEn.trim()) return 'Question text (English) is required';
    if (!questionTextMs.trim()) return 'Question text (Bahasa Melayu) is required';

    if (answerType === 'text') {
      const enOpts = optionsEn.split('|').filter(s => s.trim());
      const msOpts = optionsMs.split('|').filter(s => s.trim());
      if (enOpts.length < 2) return 'At least 2 English options required (pipe-separated)';
      if (msOpts.length < 2) return 'At least 2 BM options required (pipe-separated)';
    } else {
      const withImages = imageOptions.filter(o => o.image_path);
      if (withImages.length < 4) return 'All 4 answer option images are required for Image MCQ';
    }

    return null;
  };

  // ── Submit: create the question ──
  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setIsSubmitting(true);
    try {
      let questionData: any = {
        age_target: ageTarget,
        subject: finalSubject,
        dskp_code: dskpCode,
        kssr_level: kssrLevel,
        topic: kssrTopic,
        skill_name: kssrSkillName,
        question_text_en: questionTextEn.trim(),
        question_text_ms: questionTextMs.trim(),
        question_text_zh: questionTextZh.trim(),
        input_type: 'mcq',
        correct_answer: correctAnswer,
        visual_prompt: visualPrompt,
        image_url: headerImageKey || '',
      };

      if (answerType === 'mcq-image') {
        questionData.answer_type = 'mcq-image';
        // Build structured options arrays with R2 keys
        questionData.options_en = imageOptions.map(o => ({
          id: o.id,
          text: o.text || '',
          image: o.image_path || '',
        }));
        questionData.options_ms = imageOptions.map(o => ({
          id: o.id,
          text: imageLabelsMs[o.id] || '',
          image: o.image_path || '',
        }));
        questionData.options_zh = imageOptions.map(o => ({
          id: o.id,
          text: imageLabelsZh[o.id] || '',
          image: o.image_path || '',
        }));
      } else {
        questionData.options_en = optionsEn;
        questionData.options_ms = optionsMs;
        questionData.options_zh = optionsZh;
      }

      // Include TTS R2 keys if uploaded
      if (ttsEn) questionData.tts_en = ttsEn;
      if (ttsMs) questionData.tts_ms = ttsMs;
      if (ttsZh) questionData.tts_zh = ttsZh;

      const result = await uploadQuestionBank([questionData]);
      
      if (result.created_ids?.[0]) {
        toast.success(`Question ${result.created_ids[0]} created!`);
      } else {
        toast.success('Question created!');
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error('Create question failed:', err);
      toast.error(`Create failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Question
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Fill in the details below. Images and audio upload directly to R2.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── Question Type Toggle ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAnswerType('text')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  answerType === 'text'
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">Text MCQ</span>
                <p className="text-xs text-gray-500 mt-0.5">Text-based A/B/C/D answers</p>
              </button>
              <button
                type="button"
                onClick={() => setAnswerType('mcq-image')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  answerType === 'mcq-image'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">Image MCQ</span>
                <p className="text-xs text-gray-500 mt-0.5">Image-based answer options</p>
              </button>
            </div>
          </div>

          {/* ── Subject & Age ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="">Select subject...</option>
                {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {allSubjects.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No subjects found. Create quests in Quest Manager first to define available subjects.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age Target *</label>
              <div className="flex gap-2">
                {AGES.map(age => (
                  <button
                    key={age}
                    type="button"
                    onClick={() => setAgeTarget(age)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border-2 ${
                      ageTarget === age
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* DSKP Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Skill Code</label>
            <input
              type="text"
              value={dskpCode}
              onChange={e => setDskpCode(e.target.value)}
              placeholder="e.g. MAT-T1-N01"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          {/* KSSR Skill Picker */}
          <div>
            <KSSRSkillPicker
              value={{ level: kssrLevel, subject: subject, topic: kssrTopic, skillName: kssrSkillName, dskpCode }}
              onChange={(sel) => {
                setKssrLevel(sel.level);
                setKssrTopic(sel.topic);
                setKssrSkillName(sel.skillName);
                setDskpCode(sel.dskpCode);
                // If picker resolved a subject, sync it
                if (sel.subject) setSubject(sel.subject);
              }}
            />
          </div>

          {/* ── Question Text (Trilingual) ── */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text (English) *
              </label>
              <textarea
                value={questionTextEn}
                onChange={e => setQuestionTextEn(e.target.value)}
                placeholder="What colour is the sky?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text (Bahasa Melayu) *
              </label>
              <textarea
                value={questionTextMs}
                onChange={e => setQuestionTextMs(e.target.value)}
                placeholder="Apakah warna langit?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question Text (Chinese)
              </label>
              <textarea
                value={questionTextZh}
                onChange={e => setQuestionTextZh(e.target.value)}
                placeholder="天空是什么颜色?"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                rows={2}
              />
            </div>
          </div>

          {/* ── Answer Options ── */}
          {answerType === 'text' ? (
            /* TEXT MCQ OPTIONS */
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Answer Options (pipe-separated)</label>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">English *</span>
                <input
                  type="text"
                  value={optionsEn}
                  onChange={e => setOptionsEn(e.target.value)}
                  placeholder="Red|Blue|Green|Yellow"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Bahasa Melayu *</span>
                <input
                  type="text"
                  value={optionsMs}
                  onChange={e => setOptionsMs(e.target.value)}
                  placeholder="Merah|Biru|Hijau|Kuning"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 mb-1 block">Chinese</span>
                <input
                  type="text"
                  value={optionsZh}
                  onChange={e => setOptionsZh(e.target.value)}
                  placeholder="红色|蓝色|绿色|黄色"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          ) : (
            /* IMAGE MCQ OPTIONS */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Answer Options (Image MCQ)
              </label>
              <div className="space-y-3">
                {OPTION_IDS.map((optId) => {
                  const opt = imageOptions.find(o => o.id === optId)!;
                  const isCorrect = correctAnswer === optId;
                  const isUploading = uploadingOption === optId;

                  return (
                    <div
                      key={optId}
                      className={`border rounded-xl p-3 transition-colors ${
                        isCorrect ? 'border-green-300 bg-green-50/50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Badge */}
                        <button
                          type="button"
                          onClick={() => setCorrectAnswer(optId)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                            isCorrect ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                          }`}
                          title={isCorrect ? 'Correct answer' : 'Click to mark as correct'}
                        >
                          {isCorrect ? <CheckCircle className="w-4 h-4" /> : optId.toUpperCase()}
                        </button>

                        {/* Image upload */}
                        <div className="shrink-0">
                          {opt.image ? (
                            <div className="relative group">
                              <img
                                src={opt.image}
                                alt={`Option ${optId}`}
                                className="w-20 h-20 rounded-lg object-cover border border-gray-200 bg-gray-50"
                              />
                              <label className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                                <ImagePlus className="w-5 h-5 text-white" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleOptionImageUpload(optId, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          ) : (
                            <label className={`w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                              isUploading
                                ? 'border-blue-400 bg-blue-50'
                                : 'border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                            }`}>
                              {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                              ) : (
                                <>
                                  <ImagePlus className="w-5 h-5" />
                                  <span className="text-[9px]">Upload</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleOptionImageUpload(optId, file);
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
                            value={opt.text}
                            onChange={e => {
                              const val = e.target.value;
                              setImageOptions(prev => prev.map(o =>
                                o.id === optId ? { ...o, text: val } : o
                              ));
                            }}
                            placeholder="English label"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                          />
                          <input
                            type="text"
                            value={imageLabelsMs[optId] || ''}
                            onChange={e => setImageLabelsMs(prev => ({ ...prev, [optId]: e.target.value }))}
                            placeholder="BM label"
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs"
                          />
                          <input
                            type="text"
                            value={imageLabelsZh[optId] || ''}
                            onChange={e => setImageLabelsZh(prev => ({ ...prev, [optId]: e.target.value }))}
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
                Click the letter badge to mark the correct answer. Max 500KB per image.
              </p>
            </div>
          )}

          {/* ── Correct Answer (text MCQ) ── */}
          {answerType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer *</label>
              <div className="flex gap-2">
                {OPTION_IDS.map((optId) => (
                  <button
                    key={optId}
                    type="button"
                    onClick={() => setCorrectAnswer(optId)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all border-2 ${
                      correctAnswer === optId
                        ? 'bg-green-600 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-green-300 hover:text-green-600'
                    }`}
                  >
                    {optId.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Visual Prompt ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visual Prompt</label>
            <input
              type="text"
              value={visualPrompt}
              onChange={e => setVisualPrompt(e.target.value)}
              placeholder="Cheerful sky scene with clouds"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Optional AI image generation prompt (for future use)</p>
          </div>

          {/* ── Header Image ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Header Image</label>
            {headerImagePreview && (
              <div className="mb-3 relative inline-block">
                <img
                  src={headerImagePreview}
                  alt="Header preview"
                  className="h-32 w-auto rounded-lg border border-gray-200 object-contain bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => { setHeaderImageKey(''); setHeaderImagePreview(''); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <label className={`flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
              uploadingHeader
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}>
              {uploadingHeader ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              ) : (
                <ImagePlus className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-sm text-gray-600">
                {uploadingHeader ? 'Uploading...' : headerImageKey ? 'Replace Image' : 'Upload Image'}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingHeader}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleHeaderImageUpload(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="text-xs text-gray-400 mt-1">Optional. 600x300px recommended, max 500KB. Stored in R2.</p>
          </div>

          {/* ── TTS Audio ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Volume2 className="w-4 h-4 inline mr-1 text-amber-500" />
              Question Voice (TTS)
            </label>
            <div className="space-y-2">
              {[
                { lang: 'en' as const, label: 'English', key: ttsEn, preview: ttsPreviewEn, setKey: setTtsEn, setPreview: setTtsPreviewEn },
                { lang: 'ms' as const, label: 'Bahasa Melayu', key: ttsMs, preview: ttsPreviewMs, setKey: setTtsMs, setPreview: setTtsPreviewMs },
                { lang: 'zh' as const, label: 'Chinese', key: ttsZh, preview: ttsPreviewZh, setKey: setTtsZh, setPreview: setTtsPreviewZh },
              ].map(({ lang, label, key, preview, setKey, setPreview }) => {
                const isUploading = uploadingTts === lang;
                return (
                  <div key={lang} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-xs font-medium text-gray-500 w-14 shrink-0">{label}</span>
                    {preview ? (
                      <>
                        <audio controls className="h-8 flex-1 min-w-0" preload="none">
                          <source src={preview} />
                        </audio>
                        <button
                          type="button"
                          onClick={() => { setKey(''); setPreview(''); }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                        isUploading
                          ? 'border-amber-400 bg-amber-50'
                          : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'
                      }`}>
                        {isUploading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-gray-400" />
                        )}
                        <span className="text-xs text-gray-500">
                          {isUploading ? 'Uploading...' : 'Upload MP3/WAV'}
                        </span>
                        <input
                          type="file"
                          accept="audio/mpeg,audio/wav,audio/mp3,audio/ogg,.mp3,.wav,.ogg"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleTtsUpload(lang, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1">Optional. Max 2MB each. Stored in R2.</p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex gap-3 p-6 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !finalSubject || !questionTextEn.trim() || !questionTextMs.trim()}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2 ${
              answerType === 'mcq-image' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-black hover:bg-gray-800'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Question
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};