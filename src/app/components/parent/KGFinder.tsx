/**
 * KGFinder — Parent-facing component to search for their child's kindergarten.
 *
 * Features:
 *  - Search by name or postcode against the Postgres `kindergartens` table
 *  - Select a result (shows name/address)
 *  - If KG not found → opens a "Request Form" to submit details
 *
 * Styled in the dark-fantasy RPG theme to match the rest of the parent UI.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Search, MapPin, Building2, Send, ChevronRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { searchKindergartens, submitKGRequest } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import { useLanguage } from '../LanguageContext';

const F = "'Cherry Bomb One', cursive";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

interface KGResult {
  id: string;
  name: string;
  address: string;
  postcode: string;
  state: string;
  city: string;
  status: string;
}

interface KGFinderProps {
  parentId?: string;
  onKGSelected?: (kg: KGResult) => void;
}

const TEXTS = {
  en: {
    title: 'Find Your Kindergarten',
    subtitle: 'Search by name or postcode',
    searchPlaceholder: 'Type kindergarten name or postcode...',
    searching: 'Searching...',
    noResults: 'No kindergartens found',
    notFound: "Can't find your kindergarten?",
    requestBtn: 'Request to Add',
    requestTitle: 'Request Kindergarten',
    requestSubtitle: "Tell us about your child's kindergarten and we'll reach out to them.",
    kgName: 'Kindergarten Name',
    kgLocation: 'Location / Area',
    kgPostcode: 'Postcode',
    principalName: "Principal's Name",
    principalPhone: "Principal's Phone",
    principalEmail: "Principal's Email",
    message: 'Additional Message (optional)',
    submitRequest: 'Submit Request',
    submitting: 'Submitting...',
    submitted: 'Request Submitted!',
    submittedMsg: "Thank you! We'll contact the kindergarten and let you know.",
    select: 'Select',
    back: 'Back to Search',
  },
  ms: {
    title: 'Cari Tadika Anda',
    subtitle: 'Cari dengan nama atau poskod',
    searchPlaceholder: 'Taip nama tadika atau poskod...',
    searching: 'Mencari...',
    noResults: 'Tiada tadika ditemui',
    notFound: 'Tidak jumpa tadika anda?',
    requestBtn: 'Minta untuk Ditambah',
    requestTitle: 'Permintaan Tadika',
    requestSubtitle: 'Beritahu kami tentang tadika anak anda dan kami akan menghubungi mereka.',
    kgName: 'Nama Tadika',
    kgLocation: 'Lokasi / Kawasan',
    kgPostcode: 'Poskod',
    principalName: 'Nama Pengetua',
    principalPhone: 'Telefon Pengetua',
    principalEmail: 'Emel Pengetua',
    message: 'Mesej Tambahan (pilihan)',
    submitRequest: 'Hantar Permintaan',
    submitting: 'Menghantar...',
    submitted: 'Permintaan Dihantar!',
    submittedMsg: 'Terima kasih! Kami akan hubungi tadika dan maklumkan kepada anda.',
    select: 'Pilih',
    back: 'Kembali ke Carian',
  },
  zh: {
    title: '查找您的幼儿园',
    subtitle: '按名称或邮政编码搜索',
    searchPlaceholder: '输入幼儿园名称或邮政编码...',
    searching: '搜索中...',
    noResults: '未找到幼儿园',
    notFound: '找不到您的幼儿园？',
    requestBtn: '申请添加',
    requestTitle: '申请幼儿园',
    requestSubtitle: '告诉我们关于您孩子的幼儿园，我们会联系他们。',
    kgName: '幼儿园名称',
    kgLocation: '位置 / 地区',
    kgPostcode: '邮政编码',
    principalName: '园长姓名',
    principalPhone: '园长电话',
    principalEmail: '园长邮箱',
    message: '附加信息（可选）',
    submitRequest: '提交申请',
    submitting: '提交中...',
    submitted: '申请已提交！',
    submittedMsg: '谢谢！我们会联系幼儿园并通知您。',
    select: '选择',
    back: '返回搜索',
  },
};

type Phase = 'search' | 'request' | 'submitted';

export function KGFinder({ parentId, onKGSelected }: KGFinderProps) {
  const { language } = useLanguage();
  const t = TEXTS[language] || TEXTS.en;

  const [phase, setPhase] = useState<Phase>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KGResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<any>(null);

  // Request form state
  const [reqForm, setReqForm] = useState({
    kg_name: '',
    kg_location: '',
    kg_postcode: '',
    principal_name: '',
    principal_phone: '',
    principal_email: '',
    parent_message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      // Determine if numeric (postcode) or name search
      const isPostcode = /^\d{4,6}$/.test(q.trim());
      const data = await searchKindergartens(
        isPostcode ? { postcode: q.trim() } : { q: q.trim() }
      );
      setResults(data.results || []);
    } catch (err: any) {
      console.error('[KGFinder] Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleSelect = (kg: KGResult) => {
    onKGSelected?.(kg);
    toast.success(`Selected: ${kg.name}`);
  };

  const handleSubmitRequest = async () => {
    if (!reqForm.kg_name.trim()) {
      toast.error(t.kgName + ' is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await submitKGRequest({
        ...reqForm,
        parent_id: parentId,
      });
      setPhase('submitted');
      toast.success(t.submitted);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Submitted success screen ──
  if (phase === 'submitted') {
    return (
      <div className="rounded-2xl p-6 text-center" style={{
        background: 'rgba(212,164,74,0.06)',
        border: '1px solid rgba(212,164,74,0.15)',
      }}>
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3" style={{ color: '#22c55e' }} />
        <h3 style={{ fontFamily: F, fontSize: 18, color: GOLD_LIGHT, marginBottom: 4 }}>
          {t.submitted}
        </h3>
        <p style={{ fontSize: 13, color: `${PARCHMENT}80`, maxWidth: 280, margin: '0 auto' }}>
          {t.submittedMsg}
        </p>
        <button
          onClick={() => { setPhase('search'); setReqForm({ kg_name: '', kg_location: '', kg_postcode: '', principal_name: '', principal_phone: '', principal_email: '', parent_message: '' }); }}
          className="mt-4 px-4 py-2 rounded-full text-xs font-medium"
          style={{ background: `${GOLD}20`, color: GOLD_LIGHT, border: `1px solid ${GOLD}30` }}
        >
          {t.back}
        </button>
      </div>
    );
  }

  // ── Request form ──
  if (phase === 'request') {
    const fieldStyle = {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(212,164,74,0.15)',
      color: GOLD_LIGHT,
    };
    return (
      <div className="rounded-2xl p-4 space-y-3" style={{
        background: 'rgba(212,164,74,0.04)',
        border: '1px solid rgba(212,164,74,0.12)',
      }}>
        <div>
          <h3 style={{ fontFamily: F, fontSize: 16, color: GOLD_LIGHT }}>{t.requestTitle}</h3>
          <p style={{ fontSize: 11, color: `${PARCHMENT}70`, marginTop: 2 }}>{t.requestSubtitle}</p>
        </div>

        {[
          { key: 'kg_name', label: t.kgName, required: true },
          { key: 'kg_location', label: t.kgLocation },
          { key: 'kg_postcode', label: t.kgPostcode },
          { key: 'principal_name', label: t.principalName },
          { key: 'principal_phone', label: t.principalPhone },
          { key: 'principal_email', label: t.principalEmail },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-[10px] mb-1" style={{ color: `${PARCHMENT}60` }}>
              {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
            <input
              type="text"
              value={(reqForm as any)[f.key]}
              onChange={e => setReqForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
              style={fieldStyle}
              placeholder={f.label}
            />
          </div>
        ))}

        <div>
          <label className="block text-[10px] mb-1" style={{ color: `${PARCHMENT}60` }}>{t.message}</label>
          <textarea
            value={reqForm.parent_message}
            onChange={e => setReqForm(prev => ({ ...prev, parent_message: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none resize-none"
            style={{ ...fieldStyle, minHeight: 60 }}
            placeholder={t.message}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setPhase('search')}
            className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', color: `${PARCHMENT}80`, border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {t.back}
          </button>
          <button
            onClick={handleSubmitRequest}
            disabled={isSubmitting}
            className="flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"
            style={{
              background: `linear-gradient(135deg, ${GOLD}40, ${GOLD}25)`,
              color: GOLD_LIGHT,
              border: `1px solid ${GOLD}40`,
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            {isSubmitting ? t.submitting : t.submitRequest}
          </button>
        </div>
      </div>
    );
  }

  // ── Search phase ──
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{
      background: 'rgba(212,164,74,0.04)',
      border: '1px solid rgba(212,164,74,0.12)',
    }}>
      {/* Title */}
      <div>
        <h3 style={{ fontFamily: F, fontSize: 16, color: GOLD_LIGHT }}>{t.title}</h3>
        <p style={{ fontSize: 11, color: `${PARCHMENT}60`, marginTop: 2 }}>{t.subtitle}</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: `${GOLD}60` }} />
        <input
          type="text"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs focus:outline-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(212,164,74,0.18)',
            color: GOLD_LIGHT,
            caretColor: GOLD,
          }}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin" style={{ color: `${GOLD}60` }} />
        )}
      </div>

      {/* Results */}
      {hasSearched && !isSearching && results.length === 0 && (
        <div className="text-center py-4">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: `${PARCHMENT}40` }} />
          <p style={{ fontSize: 12, color: `${PARCHMENT}60` }}>{t.noResults}</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {results.map(kg => (
            <button
              key={kg.id}
              onClick={() => handleSelect(kg)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212,164,74,0.1)',
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}20` }}>
                <Building2 className="w-4 h-4" style={{ color: `${GOLD}80` }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: GOLD_LIGHT }}>
                  {kg.name}
                </p>
                <p className="text-[10px] truncate" style={{ color: `${PARCHMENT}50` }}>
                  {[kg.address, kg.city, kg.state, kg.postcode].filter(Boolean).join(', ') || 'No address'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: `${GOLD}40` }} />
            </button>
          ))}
        </div>
      )}

      {/* "Not found" prompt */}
      {hasSearched && !isSearching && (
        <div className="pt-2 border-t" style={{ borderColor: `${GOLD}0f` }}>
          <button
            onClick={() => {
              setPhase('request');
              if (query) setReqForm(prev => ({ ...prev, kg_name: query }));
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
              color: '#fca5a5',
            }}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {t.notFound} <span style={{ color: '#ef4444', fontWeight: 600 }}>{t.requestBtn}</span>
          </button>
        </div>
      )}
    </div>
  );
}
