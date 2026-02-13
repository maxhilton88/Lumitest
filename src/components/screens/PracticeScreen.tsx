import React, { useState, useCallback, useRef } from 'react';
import { ArrowLeft, Swords, RotateCcw, Infinity } from 'lucide-react';
import { QuestionScreen, Question } from './QuestionScreen';
import { QuestSelector } from './QuestSelector';
import { useLanguage } from '../LanguageContext';
import { FantasyBackground } from '../FantasyBackground';
import { fetchQuestionBank } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';

/* ── colour tokens ── */
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const DARK_BASE = 'rgba(12,8,20,';

/* ── transform backend questions → frontend Question[] ── */
function transformBankQuestions(bankQuestions: any[]): Question[] {
  return bankQuestions.map((bq: any) => {
    const optionsEn = Array.isArray(bq.options_en) ? bq.options_en : [];
    const optionsMs = Array.isArray(bq.options_ms) ? bq.options_ms : [];
    const optionsZh = Array.isArray(bq.options_zh) ? bq.options_zh : [];

    const mergedOptions = optionsEn.map((optEn: any, idx: number) => {
      const optMs = optionsMs[idx] || {};
      const optZh = optionsZh[idx] || {};
      return {
        id: optEn.id || String.fromCharCode(97 + idx),
        text: {
          en: typeof optEn === 'string' ? optEn : (optEn.text || ''),
          ms: typeof optMs === 'string' ? optMs : (optMs.text || ''),
          zh: typeof optZh === 'string' ? optZh : (optZh.text || ''),
        },
      };
    });

    return {
      id: bq.q_id,
      type: (bq.input_type || 'mcq') as Question['type'],
      question: {
        en: bq.question_text_en || '',
        ms: bq.question_text_ms || '',
        zh: bq.question_text_zh || '',
      },
      options: mergedOptions,
      correctAnswer: bq.correct_answer || 'a',
      foxyMessage: bq.visual_prompt
        ? { en: bq.visual_prompt, ms: bq.visual_prompt, zh: bq.visual_prompt }
        : undefined,
      questionImage: bq.image_url || undefined,
    } as Question;
  });
}

/* ── Fallback sample questions ── */
const SAMPLE_QUESTIONS: Question[] = [
  {
    id: 'p1', type: 'mcq',
    question: { en: 'Which letter comes after A?', ms: 'Huruf apa selepas A?', zh: '哪个字母在A后面？' },
    options: [
      { id: 'a', text: { en: 'B', ms: 'B', zh: 'B' } },
      { id: 'b', text: { en: 'C', ms: 'C', zh: 'C' } },
      { id: 'c', text: { en: 'D', ms: 'D', zh: 'D' } },
      { id: 'd', text: { en: 'Z', ms: 'Z', zh: 'Z' } },
    ],
    correctAnswer: 'a',
    foxyMessage: { en: "Let's find the letter!", ms: 'Mari cari huruf!', zh: '找字母！' },
  },
  {
    id: 'p2', type: 'mcq',
    question: { en: 'What is 1 + 1?', ms: 'Berapa 1 + 1?', zh: '1 + 1 等于几？' },
    options: [
      { id: 'a', text: { en: '1', ms: '1', zh: '1' } },
      { id: 'b', text: { en: '2', ms: '2', zh: '2' } },
      { id: 'c', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'd', text: { en: '4', ms: '4', zh: '4' } },
    ],
    correctAnswer: 'b',
    foxyMessage: { en: "Let's add together!", ms: 'Mari tambah!', zh: '一起加！' },
  },
];

/* ── shuffle utility ── */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ═══════════════════════════════════════════════════════
   PRACTICE SCREEN
   ═══════════════════════════════════════════════════════ */

interface PracticeScreenProps {
  liveQuests?: Array<{
    id: string;
    subject: string;
    name: { en: string; ms: string; zh: string };
    icon: string;
    is_mandarin: boolean;
    status: string;
    question_count: number;
    image_path: string | null;
    created_at: string;
    signed_image_url?: string | null;
  }>;
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
  };
  questCardImageUrls?: Record<string, string>;
  onExit: () => void;
}

type PracticePhase = 'selectQuest' | 'loading' | 'practicing';

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  liveQuests = [],
  brandingSettings,
  questCardImageUrls = {},
  onExit,
}) => {
  const { language } = useLanguage();
  const [phase, setPhase] = useState<PracticePhase>('selectQuest');
  const [selectedQuestName, setSelectedQuestName] = useState('');

  /* question state */
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const answeredThisRoundRef = useRef(0);

  /* ── Select a quest and load questions ── */
  const handleQuestSelect = useCallback(async (moduleId: string) => {
    setPhase('loading');

    // Find quest info
    const quest = liveQuests.find(q => q.id === moduleId);
    const subject = quest?.subject;
    setSelectedQuestName(quest?.name?.[language] || subject || moduleId);

    try {
      if (subject) {
        console.log(`[PRACTICE] Loading questions for subject: ${subject}`);
        const bankQuestions = await fetchQuestionBank({ subject });

        if (bankQuestions.length > 0) {
          const transformed = transformBankQuestions(bankQuestions);
          const shuffled = shuffle(transformed);
          setAllQuestions(transformed);
          setCurrentQuestions(shuffled);
          console.log(`[PRACTICE] Loaded ${shuffled.length} questions for ${subject}`);
          setCurrentIndex(0);
          setRoundNumber(1);
          setTotalAnswered(0);
          answeredThisRoundRef.current = 0;
          setPhase('practicing');
          return;
        }
      }
    } catch (err) {
      console.error('[PRACTICE] Failed to fetch questions:', err);
    }

    // Fallback
    console.warn('[PRACTICE] No questions found, using samples');
    toast.error('Could not load questions. Using sample set.');
    setAllQuestions(SAMPLE_QUESTIONS);
    setCurrentQuestions(shuffle(SAMPLE_QUESTIONS));
    setCurrentIndex(0);
    setRoundNumber(1);
    setTotalAnswered(0);
    answeredThisRoundRef.current = 0;
    setPhase('practicing');
  }, [liveQuests, language]);

  /* ── Answer handler (no-op scoring — just track count) ── */
  const handleAnswer = (_answerId: string) => {
    setTotalAnswered(prev => prev + 1);
    answeredThisRoundRef.current += 1;
  };

  /* ── Next handler — loop infinitely ── */
  const handleNext = useCallback(() => {
    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Round complete — reshuffle and restart
      const reshuffled = shuffle(allQuestions);
      setCurrentQuestions(reshuffled);
      setCurrentIndex(0);
      setRoundNumber(prev => prev + 1);
      answeredThisRoundRef.current = 0;
      toast.success('Round complete! Reshuffling questions...', { duration: 2000 });
    }
  }, [currentIndex, currentQuestions.length, allQuestions]);

  /* ═══ QUEST SELECT PHASE — use the real QuestSelector with practiceMode ═══ */
  if (phase === 'selectQuest') {
    return (
      <QuestSelector
        includeMandarinTest={true}
        onModuleSelect={handleQuestSelect}
        completedModules={[]}
        moduleResults={{}}
        brandingSettings={{
          ...brandingSettings,
          questCardImages: questCardImageUrls,
        }}
        onBack={onExit}
        liveQuests={liveQuests}
        practiceMode={true}
      />
    );
  }

  /* ═══ LOADING PHASE ═══ */
  if (phase === 'loading') {
    return (
      <div className="h-[100dvh] relative overflow-hidden flex items-center justify-center">
        <FantasyBackground bgImage={questMapBg} overlayOpacity={0.7} />
        <div className="relative z-10 text-center">
          <div className="text-5xl mb-4 animate-bounce">⚔</div>
          <p
            className="text-lg font-bold"
            style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
          >
            Preparing Training...
          </p>
          <p className="text-sm mt-2" style={{ color: `${PARCHMENT}70` }}>
            Loading questions for {selectedQuestName}
          </p>
        </div>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </div>
    );
  }

  /* ═══ PRACTICING PHASE ═══ */
  if (currentQuestions.length === 0) {
    return (
      <div className="h-[100dvh] relative overflow-hidden flex items-center justify-center">
        <FantasyBackground bgImage={questMapBg} overlayOpacity={0.7} />
        <div className="relative z-10 text-center px-6">
          <p className="text-4xl mb-4">😕</p>
          <p className="text-lg font-bold" style={{ color: GOLD_LIGHT }}>
            No questions available
          </p>
          <button
            onClick={onExit}
            className="mt-6 px-6 py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #d4a44a, #f0d078, #d4a44a)',
              color: '#2a1f0e',
              border: '2px solid #ffeaa7',
              fontFamily: "'Cinzel Decorative', serif",
            }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = currentQuestions[currentIndex];

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Practice Mode floating banner — top center */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full"
          style={{
            background: `${DARK_BASE}0.85)`,
            border: '1.5px solid rgba(124,198,67,0.35)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <Swords className="w-3.5 h-3.5" style={{ color: '#7cc643' }} />
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: '#7cc643', fontFamily: "'Cinzel Decorative', serif" }}
          >
            Training
          </span>
          <span className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>|</span>
          <span className="text-[10px] font-bold" style={{ color: GOLD_LIGHT }}>
            {selectedQuestName}
          </span>
          <span className="text-[10px]" style={{ color: `${PARCHMENT}70` }}>|</span>
          <span className="text-[10px]" style={{ color: `${PARCHMENT}90` }}>
            R{roundNumber}
          </span>
          <Infinity className="w-3 h-3" style={{ color: 'rgba(124,198,67,0.5)' }} />
        </div>
      </div>

      {/* Exit button — top left, above QuestionScreen */}
      <div className="absolute top-3 left-3 z-30">
        <button
          onClick={() => {
            setPhase('selectQuest');
            setCurrentQuestions([]);
            setAllQuestions([]);
            setCurrentIndex(0);
            setTotalAnswered(0);
            setRoundNumber(1);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95"
          style={{
            background: `${DARK_BASE}0.8)`,
            border: '1.5px solid rgba(212,164,74,0.25)',
            color: GOLD_LIGHT,
            backdropFilter: 'blur(8px)',
            fontFamily: "'Cinzel Decorative', serif",
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Exit
        </button>
      </div>

      {/* Stats badge — top right area below music */}
      <div className="absolute top-14 right-4 z-30">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
          style={{
            background: `${DARK_BASE}0.75)`,
            border: '1px solid rgba(212,164,74,0.2)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <RotateCcw className="w-3 h-3" style={{ color: '#d4a44a' }} />
          <span className="text-[10px] font-bold" style={{ color: GOLD_LIGHT }}>
            {totalAnswered}
          </span>
          <span className="text-[10px]" style={{ color: `${PARCHMENT}60` }}>
            answered
          </span>
        </div>
      </div>

      {/* Reuse the full QuestionScreen — with progress hidden */}
      <QuestionScreen
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={currentQuestions.length}
        onAnswer={handleAnswer}
        onNext={handleNext}
        hideProgress={true}
        brandingSettings={brandingSettings}
      />

      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};
