/**
 * BattleMCQPopup.tsx — MCQ question overlay during battle attacks
 *
 * Appears when player selects a skill. Correct answer = skill hits.
 * Wrong answer or timeout = skill misses, opponent counter-attacks.
 *
 * Timer: age 4-6 = 8s, 7-9 = 6s, 10-12 = 4s
 * Only shows text MCQ questions (no image-option questions).
 * Question header images are allowed.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Zap, Volume2 } from 'lucide-react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";

export interface BattleMCQQuestion {
  id: string;
  question: { en: string; ms: string; zh: string };
  questionImage?: string;
  options: Array<{
    id: string;
    text: { en: string; ms: string; zh: string };
  }>;
  correctAnswer: string;
  /** Carried through for mastery pipeline */
  dskpCode?: string;
  bankSubject?: string;
  /** KSSR taxonomy metadata for mastery recording */
  kssrLevel?: string;
  topic?: string;
  skillName?: string;
  /** Age target from question bank, used for pool sorting in BattleScreen */
  _ageTarget?: number | null;
  /** Uploaded TTS audio URLs (preferred over browser speech synthesis) */
  tts?: { en?: string; ms?: string; zh?: string };
}

interface BattleMCQPopupProps {
  question: BattleMCQQuestion;
  timerSeconds: number;
  language: string;
  skillColor: string;
  skillName: string;
  /** Called on correct answer — passes elapsed seconds for speed bonus calculation */
  onCorrect: (elapsedSeconds: number) => void;
  onWrong: () => void;
}

function t3(en: string, ms: string, zh: string, lang: string) {
  return lang === 'en' ? en : lang === 'ms' ? ms : zh;
}

export function BattleMCQPopup({
  question, timerSeconds, language, skillColor, skillName,
  onCorrect, onWrong,
}: BattleMCQPopupProps) {
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const resolvedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-play TTS when question appears (prefer uploaded audio over browser TTS)
  useEffect(() => {
    const ttsUrl = question.tts?.[language as 'en' | 'ms' | 'zh'];
    if (ttsUrl) {
      window.speechSynthesis?.cancel();
      const audio = new Audio(ttsUrl);
      ttsAudioRef.current = audio;
      audio.onerror = () => {
        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
          const qText = question.question[language as 'en' | 'ms' | 'zh'] || question.question.en;
          const u = new SpeechSynthesisUtterance(qText);
          u.lang = { en: 'en-US', ms: 'ms-MY', zh: 'zh-CN' }[language] || 'en-US';
          u.rate = 0.9; u.pitch = 1.1;
          window.speechSynthesis.speak(u);
        }
      };
      setTimeout(() => { audio.play().catch(() => {}); }, 200);
    } else if ('speechSynthesis' in window) {
      const qText = question.question[language as 'en' | 'ms' | 'zh'] || question.question.en;
      const u = new SpeechSynthesisUtterance(qText);
      u.lang = { en: 'en-US', ms: 'ms-MY', zh: 'zh-CN' }[language] || 'en-US';
      u.rate = 0.9; u.pitch = 1.1;
      window.speechSynthesis.cancel();
      setTimeout(() => { window.speechSynthesis.speak(u); }, 200);
    }
    return () => {
      if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
      window.speechSynthesis?.cancel();
    };
  }, [question.id, language]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          // Time's up — miss
          if (!resolvedRef.current) {
            resolvedRef.current = true;
            setShowResult(true);
            setIsCorrect(false);
            setTimeout(() => onWrong(), 1200);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerSeconds, onWrong]);

  const handleSelect = useCallback((optionId: string) => {
    if (resolvedRef.current || selected !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setSelected(optionId);
    resolvedRef.current = true;

    const correct = optionId === question.correctAnswer;
    setIsCorrect(correct);
    setShowResult(true);

    setTimeout(() => {
      if (correct) onCorrect(timerSeconds - timeLeft);
      else onWrong();
    }, 1000);
  }, [question.correctAnswer, selected, onCorrect, onWrong, timerSeconds, timeLeft]);

  const qText = question.question[language as 'en' | 'ms' | 'zh'] || question.question.en;
  const timerRatio = timeLeft / timerSeconds;
  const timerColor = timerRatio > 0.5 ? '#22c55e' : timerRatio > 0.25 ? '#eab308' : '#ef4444';

  // Circular timer SVG values
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - timerRatio);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #1a1428 0%, #0f0b1a 100%)',
          border: `2px solid ${skillColor}40`,
          boxShadow: `0 0 40px ${skillColor}20, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 30, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {/* Header with skill name + timer */}
        <div className="flex items-center justify-between px-4 py-3" style={{
          background: `linear-gradient(135deg, ${skillColor}20, ${skillColor}08)`,
          borderBottom: `1px solid ${skillColor}30`,
        }}>
          <div className="flex items-center gap-2">
            <Zap size={16} style={{ color: skillColor }} />
            <span style={{ fontFamily: F, fontSize: 13, color: skillColor }}>
              {skillName}
            </span>
          </div>

          {/* Circular timer */}
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg width="52" height="52" className="absolute -rotate-90">
              {/* Background ring */}
              <circle cx="26" cy="26" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
              {/* Timer ring */}
              <motion.circle
                cx="26" cy="26" r={radius} fill="none"
                stroke={timerColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 0.3, ease: 'linear' }}
                style={{ filter: `drop-shadow(0 0 4px ${timerColor}80)` }}
              />
            </svg>
            <span style={{
              fontFamily: CINZEL, fontSize: 14, color: timerColor,
              fontWeight: 'bold', position: 'relative', zIndex: 1,
            }}>
              {timeLeft}
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="px-4 pt-3 pb-2">
          {/* Question header image (optional) */}
          {question.questionImage && (
            <div className="mb-3 rounded-xl overflow-hidden" style={{
              border: '1px solid rgba(212,164,74,0.15)',
              maxHeight: 120,
            }}>
              <ImageWithFallback
                src={question.questionImage}
                alt="Question"
                className="w-full h-full object-contain"
                style={{ maxHeight: 120 }}
              />
            </div>
          )}

          <p style={{
            fontFamily: F, fontSize: 14, color: '#f0e6d0',
            lineHeight: 1.5, textAlign: 'center',
          }}>
            {qText}
          </p>
        </div>

        {/* Options */}
        <div className="px-4 pb-4 pt-2 grid grid-cols-1 gap-2">
          {(question.options || []).map((opt, idx) => {
            const optText = opt.text[language as 'en' | 'ms' | 'zh'] || opt.text.en;
            const isSelected = selected === opt.id;
            const isAnswer = opt.id === question.correctAnswer;
            const showCorrect = showResult && isAnswer;
            const showWrong = showResult && isSelected && !isAnswer;

            let bg = 'rgba(255,255,255,0.04)';
            let borderCol = 'rgba(255,255,255,0.1)';
            let textCol = '#e8dcc8';

            if (showCorrect) {
              bg = 'rgba(34,197,94,0.2)';
              borderCol = 'rgba(34,197,94,0.6)';
              textCol = '#22c55e';
            } else if (showWrong) {
              bg = 'rgba(239,68,68,0.2)';
              borderCol = 'rgba(239,68,68,0.6)';
              textCol = '#ef4444';
            } else if (isSelected) {
              bg = `${skillColor}15`;
              borderCol = `${skillColor}50`;
            }

            const label = String.fromCharCode(65 + idx); // A, B, C, D

            return (
              <motion.button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                disabled={resolvedRef.current}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-left w-full"
                style={{ background: bg, border: `1.5px solid ${borderCol}` }}
                whileHover={!resolvedRef.current ? { scale: 1.01, borderColor: `${skillColor}60` } : {}}
                whileTap={!resolvedRef.current ? { scale: 0.97 } : {}}
                animate={showWrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                transition={showWrong ? { duration: 0.4 } : {}}
              >
                {/* Letter badge */}
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
                  background: showCorrect ? 'rgba(34,197,94,0.25)' : showWrong ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${showCorrect ? 'rgba(34,197,94,0.4)' : showWrong ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
                }}>
                  <span style={{ fontFamily: CINZEL, fontSize: 11, color: textCol, fontWeight: 'bold' }}>
                    {label}
                  </span>
                </div>

                <span style={{ fontFamily: F, fontSize: 12, color: textCol, lineHeight: 1.3 }}>
                  {optText}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Result overlay flash */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {timeLeft === 0 && !selected ? (
                // Timeout
                <motion.div
                  className="px-6 py-3 rounded-2xl"
                  style={{
                    background: 'rgba(239,68,68,0.9)',
                    boxShadow: '0 0 40px rgba(239,68,68,0.5)',
                  }}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [0.5, 1.2, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <Clock size={20} color="white" />
                    <span style={{ fontFamily: F, fontSize: 18, color: 'white' }}>
                      {t3("Time's up!", 'Masa tamat!', '时间到！', language)}
                    </span>
                  </div>
                </motion.div>
              ) : isCorrect ? (
                // Correct
                <motion.div
                  className="px-6 py-3 rounded-2xl"
                  style={{
                    background: 'rgba(34,197,94,0.9)',
                    boxShadow: '0 0 40px rgba(34,197,94,0.5)',
                  }}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [0.5, 1.2, 1] }}
                  transition={{ duration: 0.4 }}
                >
                  <span style={{ fontFamily: F, fontSize: 20, color: 'white' }}>
                    {t3('Correct!', 'Betul!', '正确！', language)} &#x2728;
                  </span>
                </motion.div>
              ) : (
                // Wrong
                <motion.div
                  className="px-6 py-3 rounded-2xl"
                  style={{
                    background: 'rgba(239,68,68,0.9)',
                    boxShadow: '0 0 40px rgba(239,68,68,0.5)',
                  }}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: [0.5, 1.2, 1] }}
                  transition={{ duration: 0.4 }}
                >
                  <span style={{ fontFamily: F, fontSize: 20, color: 'white' }}>
                    {t3('Wrong!', 'Salah!', '错了！', language)} &#x1F4A8;
                  </span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}