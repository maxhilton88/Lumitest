import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ArrowLeft, Swords, RotateCcw, Infinity as InfinityIcon, Clock, Star, Trophy, ArrowRight, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QuestionScreen, Question } from './QuestionScreen';
import { ModuleSelector } from './ModuleSelector';
import { useLanguage } from '../LanguageContext';
import { FantasyBackground } from '../FantasyBackground';
import { fetchQuestionBank, fetchPracticeGateConfig } from '../../utils/api';
import { toast } from 'sonner@2.0.3';
import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';
import { SUBJECT_BY_QUEST_ID } from '../../data/kssr-taxonomy';
import {
  getQuestionsByLevelAndSubject,
  getQuestionsByLevel,
  toQuestionScreenFormat,
} from '../../data/sample-questions';
import { deriveLevelFromAge } from '../../utils/level-utils';
import { recordMasteryAnswers, type MasteryAnswer } from '../../utils/mastery-api';
import type { PracticeGateRule, PracticeGateConfig } from '../../types/practice-gate-config';
import { ARENA_SUBJECT_ALIASES } from '../../utils/subject-aliases';

/* ── colour tokens ── */
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const DARK_BASE = 'rgba(12,8,20,';
const CHERRY = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";

/* ── transform backend questions → frontend Question[] ── */
function transformBankQuestions(bankQuestions: any[]): Question[] {
  return bankQuestions.map((bq: any) => {
    const optionsEn = Array.isArray(bq.options_en) ? bq.options_en : [];
    const optionsMs = Array.isArray(bq.options_ms) ? bq.options_ms : [];
    const optionsZh = Array.isArray(bq.options_zh) ? bq.options_zh : [];

    const mergedOptions = optionsEn.map((optEn: any, idx: number) => {
      const optMs = optionsMs[idx] || {};
      const optZh = optionsZh[idx] || {};
      const option: any = {
        id: optEn.id || String.fromCharCode(97 + idx),
        text: {
          en: typeof optEn === 'string' ? optEn : (optEn.text || ''),
          ms: typeof optMs === 'string' ? optMs : (optMs.text || ''),
          zh: typeof optZh === 'string' ? optZh : (optZh.text || ''),
        },
      };
      // Pass through option images (IMAGE MCQ)
      if (optEn.image) option.image = optEn.image;
      return option;
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
      dskpCode: bq.dskp_code || '',
      bankSubject: bq.subject || '',
      kssr_level: bq.kssr_level || '',
      topic: bq.topic || '',
      skill_name: bq.skill_name || '',
      tts: (bq.tts_en || bq.tts_ms || bq.tts_zh) ? {
        en: bq.tts_en || undefined,
        ms: bq.tts_ms || undefined,
        zh: bq.tts_zh || undefined,
      } : undefined,
    } as Question & { dskpCode?: string; bankSubject?: string; kssr_level?: string; topic?: string; skill_name?: string };
  });
}

/* ── shuffle utility ── */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function findQuestByAlias(
  arenaId: string,
  quests: Array<{ id: string; subject: string; is_mandarin?: boolean; [k: string]: any }>
): { id: string; subject: string } | null {
  const lower = arenaId.toLowerCase();
  const exact = quests.find(q => q.subject.toLowerCase() === lower || q.id === arenaId);
  if (exact) return exact;
  if (lower === 'mandarin') { const f = quests.find(q => q.is_mandarin); if (f) return f; }
  const aliases = ARENA_SUBJECT_ALIASES[lower] || [lower];
  for (const q of quests) {
    const s = q.subject.toLowerCase();
    for (const a of aliases) { if (s === a || s.includes(a) || a.includes(s)) return q; }
  }
  return quests.find(q => q.subject.toLowerCase().startsWith(lower)) || null;
}

/* ── Match gate rule: exact subject > 'all', narrowest age range wins ── */
function matchGateRule(
  rules: PracticeGateRule[],
  age: number,
  subject: string
): PracticeGateRule | null {
  const activeRules = rules.filter(r => r.isActive && age >= r.ageMin && age <= r.ageMax);
  if (activeRules.length === 0) return null;

  const subjectLower = subject.toLowerCase();

  // First try exact subject match
  const exactMatch = activeRules.find(r => {
    if (r.subject === 'all') return false;
    const rSubject = r.subject.toLowerCase();
    if (rSubject === subjectLower) return true;
    // Check via aliases
    const aliases = ARENA_SUBJECT_ALIASES[rSubject] || [rSubject];
    return aliases.some(a => a === subjectLower || subjectLower.includes(a) || a.includes(subjectLower));
  });
  if (exactMatch) return exactMatch;

  // Fallback to 'all' subject
  const allMatch = activeRules.find(r => r.subject === 'all');
  return allMatch || null;
}

/* ── Format seconds to mm:ss ── */
function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ── Trilingual helper ── */
function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

/* ── Star rating from score percentage ── */
function getStars(score: number, passingScore: number): number {
  if (score >= 90) return 3;
  if (score >= passingScore) return 2;
  if (score >= passingScore * 0.5) return 1;
  return 0;
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
  selectedAge?: number;
  onRoundComplete?: () => void;
  /** If provided, skip the ModuleSelector and auto-start this subject */
  autoStartModule?: string;
  /** Training reward preview (max XP & Gold for this session) */
  trainingRewards?: { xp: number; gold: number };
  /** Called when a gated session completes — returns earned rewards */
  onSessionComplete?: (result: {
    correct: number;
    total: number;
    score: number;
    subject: string;
  }) => Promise<{ gold: number; xp: number } | null>;
}

type PracticePhase = 'selectQuest' | 'loading' | 'practicing' | 'summary';

export const PracticeScreen: React.FC<PracticeScreenProps> = ({
  liveQuests = [],
  brandingSettings,
  questCardImageUrls = {},
  onExit,
  selectedAge,
  onRoundComplete,
  autoStartModule,
  trainingRewards,
  onSessionComplete,
}) => {
  const { language } = useLanguage();
  const [phase, setPhase] = useState<PracticePhase>(autoStartModule ? 'loading' : 'selectQuest');
  const [selectedQuestName, setSelectedQuestName] = useState('');

  /* question state */
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const answeredThisRoundRef = useRef(0);

  /* mastery pipeline — accumulate answers per round, flush on round complete */
  const masteryBatchRef = useRef<MasteryAnswer[]>([]);
  const practiceSubjectRef = useRef<string>('');

  /* ── Earned rewards (populated by onSessionComplete callback) ── */
  const [earnedRewards, setEarnedRewards] = useState<{ gold: number; xp: number } | null>(null);

  /* ── Flush mastery batch on unmount (covers exit-without-finishing) ── */
  useEffect(() => {
    return () => {
      if (masteryBatchRef.current.length > 0) {
        const batch = [...masteryBatchRef.current];
        masteryBatchRef.current = [];
        console.log(`[PRACTICE] Unmount flush: ${batch.length} mastery answers`);
        recordMasteryAnswers(batch).catch(err => {
          console.error('[PRACTICE] Unmount mastery flush failed:', err);
        });
      }
    };
  }, []);

  /* ── Gate rule state ── */
  const [gateRule, setGateRule] = useState<PracticeGateRule | null>(null);
  const [gateConfig, setGateConfig] = useState<PracticeGateConfig | null>(null);
  const [gateConfigLoaded, setGateConfigLoaded] = useState(false);
  const [sessionTimer, setSessionTimer] = useState(0); // countdown seconds
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0); // questions answered in this gated session
  const sessionActiveRef = useRef(false);
  const timerExpiredRef = useRef(false);
  const sessionTotalRef = useRef(0); // ref mirror of sessionTotal for synchronous checks

  /* ── Load gate config on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const config = await fetchPracticeGateConfig();
        if (config) {
          setGateConfig(config);
          console.log(`[PRACTICE] Loaded gate config: ${config.rules?.length || 0} rules`);
        }
      } catch (err) {
        console.error('[PRACTICE] Failed to load gate config:', err);
      } finally {
        setGateConfigLoaded(true);
      }
    })();
  }, []);

  /* ── Session timer countdown ── */
  const [timerTicking, setTimerTicking] = useState(false);

  useEffect(() => {
    if (!timerTicking || !gateRule || sessionTimer <= 0) return;

    const interval = setInterval(() => {
      setSessionTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Timer expired! End the session
          timerExpiredRef.current = true;
          sessionActiveRef.current = false;
          setTimerTicking(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerTicking, gateRule]);

  /* ── When timer expires, trigger summary ── */
  useEffect(() => {
    if (timerExpiredRef.current && phase === 'practicing') {
      timerExpiredRef.current = false;
      handleSessionEnd(true);
    }
  }, [sessionTimer]);

  /* ── End session (timer expired or min questions reached) ── */
  const handleSessionEnd = useCallback((timerExpired: boolean) => {
    sessionActiveRef.current = false;
    setTimerTicking(false);

    // Flush mastery batch
    if (masteryBatchRef.current.length > 0) {
      const batch = [...masteryBatchRef.current];
      masteryBatchRef.current = [];
      recordMasteryAnswers(batch).catch(err => {
        console.error('[PRACTICE] Mastery batch flush failed:', err);
      });
      console.log(`[PRACTICE] Flushed ${batch.length} mastery answers (session end)`);
    }

    // If timer expired, count remaining unanswered as wrong
    if (timerExpired && gateRule) {
      const unanswered = Math.max(0, gateRule.minQuestions - sessionTotalRef.current);
      if (unanswered > 0) {
        console.log(`[PRACTICE] Timer expired: ${unanswered} unanswered questions counted as wrong`);
        // Record unanswered as wrong in mastery
        const wrongBatch: MasteryAnswer[] = [];
        for (let i = 0; i < unanswered; i++) {
          wrongBatch.push({
            subjectId: (practiceSubjectRef.current || 'mixed').toLowerCase(),
            skillCode: `TIMEOUT-${i}`,
            topicName: selectedQuestName || 'Practice',
            isCorrect: false,
            mode: 'practice',
          });
        }
        recordMasteryAnswers(wrongBatch).catch(err => {
          console.error('[PRACTICE] Timeout mastery record failed:', err);
        });
        // Update session totals for summary
        setSessionTotal(prev => prev + unanswered);
      }
    }

    onRoundComplete?.();
    setPhase('summary');

    // Fire onSessionComplete callback to record rewards + daily activity (async)
    if (onSessionComplete && gateRule) {
      const finalTotal = Math.max(sessionTotalRef.current, gateRule.minQuestions);
      const finalScore = finalTotal > 0 ? Math.round((sessionCorrect / finalTotal) * 100) : 0;
      onSessionComplete({
        correct: sessionCorrect,
        total: finalTotal,
        score: finalScore,
        subject: practiceSubjectRef.current,
      }).then(rewards => {
        if (rewards) {
          setEarnedRewards(rewards);
          console.log(`[PRACTICE] Earned rewards: ${rewards.gold} gold, ${rewards.xp} XP`);
        }
      }).catch(err => {
        console.error('[PRACTICE] onSessionComplete failed:', err);
      });
    }
  }, [gateRule, sessionTotal, selectedQuestName, onRoundComplete, onSessionComplete, sessionCorrect]);

  /* ── Select a quest and load questions ── */
  const handleQuestSelect = useCallback(async (moduleId: string) => {
    setPhase('loading');

    // Find quest info — match by id first, then by subject
    const quest = liveQuests.find(q => q.id === moduleId) || liveQuests.find(q => q.subject === moduleId);
    const subject = quest?.subject || moduleId; // fallback: treat moduleId as subject string
    setSelectedQuestName(quest?.name?.[language] || subject || moduleId);
    practiceSubjectRef.current = subject;
    masteryBatchRef.current = [];

    // Match gate rule for this age + subject
    const age = selectedAge || 5;
    const matchedRule = gateConfig ? matchGateRule(gateConfig.rules, age, subject) : null;
    setGateRule(matchedRule);

    if (matchedRule) {
      console.log(`[PRACTICE] Gate rule matched: age ${matchedRule.ageMin}-${matchedRule.ageMax}, subject=${matchedRule.subject}, time=${matchedRule.timeLimitSeconds}s, minQ=${matchedRule.minQuestions}`);
      setSessionTimer(matchedRule.timeLimitSeconds);
      setSessionCorrect(0);
      setSessionTotal(0);
      sessionTotalRef.current = 0;
      timerExpiredRef.current = false;
    } else {
      console.log('[PRACTICE] No gate rule matched — running in infinite/legacy mode');
    }

    try {
      if (subject) {
        console.log(`[PRACTICE] Loading questions for subject: ${subject}, age: ${selectedAge || 'any'}`);
        const bankQuestions = await fetchQuestionBank({
          subject,
          ...(selectedAge ? { age_target: selectedAge } : {}),
        });

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
          sessionActiveRef.current = !!matchedRule;
          setTimerTicking(!!matchedRule);
          setPhase('practicing');
          return;
        }

        // Fallback: try without age filter
        if (selectedAge) {
          console.warn(`[PRACTICE] No questions for age ${selectedAge}, falling back to all ages`);
          const fallbackQuestions = await fetchQuestionBank({ subject });
          if (fallbackQuestions.length > 0) {
            const transformed = transformBankQuestions(fallbackQuestions);
            const shuffled = shuffle(transformed);
            setAllQuestions(transformed);
            setCurrentQuestions(shuffled);
            setCurrentIndex(0);
            setRoundNumber(1);
            setTotalAnswered(0);
            answeredThisRoundRef.current = 0;
            sessionActiveRef.current = !!matchedRule;
            setTimerTicking(!!matchedRule);
            setPhase('practicing');
            toast.info(language === 'en' ? 'Using mixed-age questions' : language === 'ms' ? 'Menggunakan soalan pelbagai umur' : '\u4f7f\u7528\u6df7\u5408\u5e74\u9f84\u95ee\u9898');
            return;
          }
        }
      }
    } catch (err) {
      console.error('[PRACTICE] Failed to fetch questions:', err);
    }

    // Fallback
    console.warn('[PRACTICE] No questions found, using samples');
    toast.error('Could not load questions. Using sample set.');
    const derived = deriveLevelFromAge(selectedAge || 6);
    const subjectDef = SUBJECT_BY_QUEST_ID[subject] || SUBJECT_BY_QUEST_ID[moduleId];
    const sampleQuestions = subjectDef
      ? getQuestionsByLevelAndSubject(derived.level, subjectDef.code)
      : getQuestionsByLevel(derived.level);
    const transformed = sampleQuestions.map(sq => toQuestionScreenFormat(sq) as Question);
    const shuffled = shuffle(transformed);
    setAllQuestions(transformed);
    setCurrentQuestions(shuffled);
    setCurrentIndex(0);
    setRoundNumber(1);
    setTotalAnswered(0);
    answeredThisRoundRef.current = 0;
    sessionActiveRef.current = !!matchedRule;
    setTimerTicking(!!matchedRule);
    setPhase('practicing');
  }, [liveQuests, language, selectedAge, gateConfig]);

  /* ── Auto-start when autoStartModule is provided ── */
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (!autoStartModule || autoStartedRef.current) return;
    // Wait for gate config to load before auto-starting
    if (!gateConfigLoaded) return;
    autoStartedRef.current = true;

    // autoStartModule is a subject string (e.g. 'english').
    // Find a matching liveQuest by subject, or use it as a direct moduleId.
    const quest = findQuestByAlias(autoStartModule, liveQuests);
    const moduleId = quest?.id || autoStartModule;
    handleQuestSelect(moduleId);
  }, [autoStartModule, liveQuests, handleQuestSelect, gateConfigLoaded]);

  /* ── Answer handler — evaluate correctness and collect mastery data ── */
  const handleAnswer = (answerId: string) => {
    const q = currentQuestions[currentIndex] as any;
    const isCorrect = answerId === q?.correctAnswer;

    // Collect mastery answer for this round's batch
    if (q) {
      const rawSubjectId = q.bankSubject || practiceSubjectRef.current;
      const subjectId = rawSubjectId?.toLowerCase() || 'unknown';
      const subjectDef = SUBJECT_BY_QUEST_ID[subjectId] || SUBJECT_BY_QUEST_ID[practiceSubjectRef.current?.toLowerCase()];
      masteryBatchRef.current.push({
        subjectId,
        skillCode: q._taxonomy?.skillCode || q.dskpCode || q.id || `${(subjectDef?.code || 'GEN')}-P-${q.id || currentIndex}`,
        topicName: q._taxonomy?.topic || selectedQuestName || practiceSubjectRef.current || 'Practice',
        isCorrect,
        mode: 'practice',
        level: q._taxonomy?.level || q.kssr_level || '',
        skillName: q._taxonomy?.subtopic || q.skill_name || '',
      });
    }

    setTotalAnswered(prev => prev + 1);
    answeredThisRoundRef.current += 1;

    // Gate mode: track session stats
    if (gateRule) {
      setSessionTotal(prev => prev + 1);
      sessionTotalRef.current += 1;
      if (isCorrect) setSessionCorrect(prev => prev + 1);
    }
  };

  /* ── Next handler — gated or infinite ── */
  const handleNext = useCallback(() => {
    // Gate mode: check if minimum questions reached
    if (gateRule) {
      // Use ref for synchronous check (state may not be updated yet)
      if (sessionTotalRef.current >= gateRule.minQuestions) {
        // Session complete!
        handleSessionEnd(false);
        return;
      }
    }

    if (currentIndex < currentQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Round complete (reached end of question pool)
      // In gated mode, flush mastery but keep going
      if (masteryBatchRef.current.length > 0) {
        const batch = [...masteryBatchRef.current];
        masteryBatchRef.current = [];
        recordMasteryAnswers(batch).catch(err => {
          console.error('[PRACTICE] Mastery batch flush failed:', err);
        });
        console.log(`[PRACTICE] Flushed ${batch.length} mastery answers for round ${roundNumber}`);
      }

      // Reshuffle and restart
      const reshuffled = shuffle(allQuestions);
      setCurrentQuestions(reshuffled);
      setCurrentIndex(0);
      setRoundNumber(prev => prev + 1);
      answeredThisRoundRef.current = 0;

      if (!gateRule) {
        // Legacy infinite mode — notify round complete
        toast.success(
          t3('Round complete! Reshuffling questions...', 'Pusingan selesai! Mengocok semula...', '轮次完成！重新洗牌...', language),
          { duration: 2000 }
        );
        onRoundComplete?.();
      }
    }
  }, [currentIndex, currentQuestions.length, allQuestions, onRoundComplete, roundNumber, gateRule, handleSessionEnd, language]);

  /* ── Retry handler (from summary) ── */
  const handleRetry = useCallback(() => {
    setSessionCorrect(0);
    setSessionTotal(0);
    sessionTotalRef.current = 0;
    setCurrentIndex(0);
    setRoundNumber(1);
    setTotalAnswered(0);
    answeredThisRoundRef.current = 0;
    masteryBatchRef.current = [];
    timerExpiredRef.current = false;

    if (gateRule) {
      setSessionTimer(gateRule.timeLimitSeconds);
      sessionActiveRef.current = true;
      setTimerTicking(true);
    }

    const reshuffled = shuffle(allQuestions);
    setCurrentQuestions(reshuffled);
    setPhase('practicing');
  }, [gateRule, allQuestions]);

  /* ═══ QUEST SELECT PHASE — use the real QuestSelector with practiceMode ═══ */
  if (phase === 'selectQuest') {
    return (
      <ModuleSelector
        excludedSubjects={[]}
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
            style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}
          >
            {language === 'en' ? 'Preparing Training...' : language === 'ms' ? 'Menyediakan Latihan...' : '准备训练中...'}
          </p>
          <p className="text-sm mt-2" style={{ color: `${PARCHMENT}70` }}>
            {language === 'en' ? 'Loading questions for' : language === 'ms' ? 'Memuatkan soalan untuk' : '加载题目：'} {selectedQuestName}
          </p>
        </div>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </div>
    );
  }

  /* ═══ SUMMARY PHASE (gate mode only) ═══ */
  if (phase === 'summary' && gateRule) {
    const finalTotal = Math.max(sessionTotal, gateRule.minQuestions);
    const score = finalTotal > 0 ? Math.round((sessionCorrect / finalTotal) * 100) : 0;
    const stars = getStars(score, gateRule.passingScore);
    const passed = score >= gateRule.passingScore;
    const unanswered = Math.max(0, gateRule.minQuestions - sessionTotal);

    return (
      <div className="h-[100dvh] relative overflow-hidden flex items-center justify-center">
        <FantasyBackground bgImage={questMapBg} overlayOpacity={0.75} />
        <motion.div
          className="relative z-10 w-full max-w-sm mx-4"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          {/* Result card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: `linear-gradient(180deg, ${DARK_BASE}0.92) 0%, ${DARK_BASE}0.96) 100%)`,
              border: `2px solid ${passed ? 'rgba(212,164,74,0.4)' : 'rgba(239,68,68,0.3)'}`,
              boxShadow: `0 20px 60px ${DARK_BASE}0.5)`,
            }}
          >
            {/* Header */}
            <div
              className="text-center py-5 px-4"
              style={{
                background: passed
                  ? 'linear-gradient(180deg, rgba(212,164,74,0.15) 0%, transparent 100%)'
                  : 'linear-gradient(180deg, rgba(239,68,68,0.1) 0%, transparent 100%)',
              }}
            >
              <motion.div
                className="text-5xl mb-2"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                {passed ? '🏆' : '💪'}
              </motion.div>
              <h2
                className="text-xl mb-1"
                style={{ fontFamily: CHERRY, color: passed ? GOLD_LIGHT : '#ff9999' }}
              >
                {passed
                  ? t3('Well Done!', 'Syabas!', '干得好！', language)
                  : t3('Keep Trying!', 'Teruskan!', '继续努力！', language)}
              </h2>
              <p className="text-xs" style={{ color: PARCHMENT }}>
                {selectedQuestName}
              </p>
            </div>

            {/* Stars */}
            <div className="flex items-center justify-center gap-2 py-3">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: i <= stars ? 1 : 0.6, rotate: 0 }}
                  transition={{ delay: 0.5 + i * 0.15, type: 'spring' }}
                >
                  <Star
                    className="w-10 h-10"
                    fill={i <= stars ? '#fbbf24' : 'transparent'}
                    style={{ color: i <= stars ? '#fbbf24' : 'rgba(255,255,255,0.15)' }}
                  />
                </motion.div>
              ))}
            </div>

            {/* Score */}
            <div className="text-center pb-4">
              <motion.div
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-3"
                style={{
                  background: `conic-gradient(${passed ? '#d4a44a' : '#ef4444'} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
                  boxShadow: `0 0 20px ${passed ? 'rgba(212,164,74,0.2)' : 'rgba(239,68,68,0.15)'}`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: DARK_BASE + '0.95)' }}
                >
                  <span className="text-2xl font-bold" style={{ fontFamily: CHERRY, color: passed ? GOLD_LIGHT : '#ff9999' }}>
                    {score}%
                  </span>
                </div>
              </motion.div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3 px-5 mt-2">
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ fontFamily: CHERRY, color: '#22c55e' }}>
                    {sessionCorrect}
                  </p>
                  <p className="text-[10px]" style={{ color: PARCHMENT, fontFamily: CINZEL }}>
                    {t3('Correct', 'Betul', '正确', language)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ fontFamily: CHERRY, color: '#ef4444' }}>
                    {finalTotal - sessionCorrect}
                  </p>
                  <p className="text-[10px]" style={{ color: PARCHMENT, fontFamily: CINZEL }}>
                    {t3('Wrong', 'Salah', '错误', language)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>
                    {sessionTotal}/{gateRule.minQuestions}
                  </p>
                  <p className="text-[10px]" style={{ color: PARCHMENT, fontFamily: CINZEL }}>
                    {t3('Answered', 'Dijawab', '已答', language)}
                  </p>
                </div>
              </div>

              {/* Unanswered warning */}
              {unanswered > 0 && (
                <motion.p
                  className="text-xs mt-3 px-4"
                  style={{ color: '#fca5a5' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  {t3(
                    `${unanswered} question${unanswered > 1 ? 's' : ''} unanswered (counted as wrong)`,
                    `${unanswered} soalan tidak dijawab (dikira salah)`,
                    `${unanswered}题未答（计为错误）`,
                    language,
                  )}
                </motion.p>
              )}

              {/* Pass line */}
              <p className="text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: CINZEL }}>
                {t3('Passing score:', 'Markah lulus:', '及格分数：', language)} {gateRule.passingScore}%
              </p>

              {/* Earned rewards */}
              {earnedRewards && (earnedRewards.gold > 0 || earnedRewards.xp > 0) && (
                <motion.div
                  className="flex items-center justify-center gap-4 mt-3 py-2 mx-5 rounded-lg"
                  style={{ background: 'rgba(212,164,74,0.1)', border: '1px solid rgba(212,164,74,0.2)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 }}
                >
                  {earnedRewards.gold > 0 && (
                    <span className="text-sm font-bold" style={{ fontFamily: CHERRY, color: GOLD_LIGHT }}>
                      +{earnedRewards.gold} Gold
                    </span>
                  )}
                  {earnedRewards.xp > 0 && (
                    <span className="text-sm font-bold" style={{ fontFamily: CHERRY, color: '#a78bfa' }}>
                      +{earnedRewards.xp} XP
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                }}
              >
                <RotateCcw className="w-4 h-4" style={{ color: PARCHMENT }} />
                <span className="text-sm font-bold" style={{ fontFamily: CHERRY, color: PARCHMENT }}>
                  {t3('Retry', 'Cuba Lagi', '重试', language)}
                </span>
              </button>
              <button
                onClick={onExit}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl"
                style={{
                  background: passed
                    ? 'linear-gradient(135deg, #d4a44a, #f0d078, #d4a44a)'
                    : 'rgba(255,255,255,0.06)',
                  border: passed ? '2px solid #ffeaa7' : '1.5px solid rgba(255,255,255,0.12)',
                  color: passed ? '#2a1f0e' : PARCHMENT,
                }}
              >
                <Home className="w-4 h-4" />
                <span className="text-sm font-bold" style={{ fontFamily: CHERRY }}>
                  {t3('Done', 'Selesai', '完成', language)}
                </span>
              </button>
            </div>
          </div>
        </motion.div>

        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=Cherry+Bomb+One&display=swap"
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
            {language === 'en' ? 'No questions available' : language === 'ms' ? 'Tiada soalan tersedia' : '暂无题目'}
          </p>
          <button
            onClick={onExit}
            className="mt-6 px-6 py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'linear-gradient(135deg, #d4a44a, #f0d078, #d4a44a)',
              color: '#2a1f0e',
              border: '2px solid #ffeaa7',
              fontFamily: CHERRY,
            }}
          >
            {language === 'en' ? 'Go Back' : language === 'ms' ? 'Kembali' : '返回'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = currentQuestions[currentIndex];

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* ── Gate mode: floating timer + progress bar ── */}
      {gateRule && (
        <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
          {/* Timer progress bar */}
          <div className="w-full h-1" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <motion.div
              className="h-full"
              style={{
                background: sessionTimer <= 30
                  ? sessionTimer <= 10 ? '#ef4444' : '#eab308'
                  : '#22c55e',
              }}
              initial={{ width: '100%' }}
              animate={{ width: `${(sessionTimer / gateRule.timeLimitSeconds) * 100}%` }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </div>

          {/* Timer + question counter pill */}
          <div className="flex items-center justify-between px-3 pt-1.5">
            {/* Timer */}
            <motion.div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-auto"
              style={{
                background: sessionTimer <= 10
                  ? 'rgba(239,68,68,0.2)'
                  : sessionTimer <= 30
                    ? 'rgba(234,179,8,0.15)'
                    : 'rgba(0,0,0,0.5)',
                border: `1px solid ${
                  sessionTimer <= 10 ? 'rgba(239,68,68,0.4)' : sessionTimer <= 30 ? 'rgba(234,179,8,0.3)' : 'rgba(255,255,255,0.1)'
                }`,
                backdropFilter: 'blur(8px)',
              }}
              animate={sessionTimer <= 10 ? { scale: [1, 1.05, 1] } : {}}
              transition={sessionTimer <= 10 ? { repeat: Infinity, duration: 1 } : {}}
            >
              <Clock className="w-3.5 h-3.5" style={{ color: sessionTimer <= 10 ? '#ef4444' : sessionTimer <= 30 ? '#eab308' : '#ffeaa7' }} />
              <span
                className="text-xs font-bold tabular-nums"
                style={{
                  fontFamily: CINZEL,
                  color: sessionTimer <= 10 ? '#ef4444' : sessionTimer <= 30 ? '#eab308' : '#ffeaa7',
                }}
              >
                {formatTimer(sessionTimer)}
              </span>
            </motion.div>

            {/* Question counter */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full pointer-events-auto"
              style={{
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span className="text-xs font-bold" style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}>
                {sessionTotal}/{gateRule.minQuestions}
              </span>
              <span className="text-[9px]" style={{ color: PARCHMENT }}>
                {t3('answered', 'dijawab', '已答', language)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Reuse the full QuestionScreen — with progress hidden in gate mode */}
      <QuestionScreen
        question={currentQuestion}
        questionNumber={gateRule ? sessionTotal + 1 : currentIndex + 1}
        totalQuestions={gateRule ? gateRule.minQuestions : currentQuestions.length}
        onAnswer={handleAnswer}
        onNext={handleNext}
        onBack={onExit}
        hideProgress={!gateRule}
        brandingSettings={brandingSettings}
        trainingRewards={trainingRewards}
      />

      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};