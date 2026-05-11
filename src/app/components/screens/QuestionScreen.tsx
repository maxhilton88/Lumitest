import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Settings, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { VoiceButton } from '../VoiceButton';
import { ProgressBar } from '../ProgressBar';
import { useLanguage } from '../LanguageContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { VictoryBurst } from '../VictoryBurst';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { FantasyBackground, FantasyFooter } from '../FantasyBackground';
import { useRealmContext } from '../../contexts/RealmContext';
import { RealmHUD } from '../realm/RealmHUD';
import { SettingsPopup } from '../realm/SettingsPopup';
import { useNavigate } from 'react-router';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

const F = "'Cherry Bomb One', cursive";

// ── Inject keyframe CSS ONCE globally ──
let questionStylesInjected = false;
function injectQuestionStyles() {
  if (questionStylesInjected) return;
  questionStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'question-screen-css';
  style.textContent = `
@keyframes qs-shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-10px)}20%,40%,60%,80%{transform:translateX(10px)}}
@keyframes qs-explode{0%{transform:scale(1) rotate(0);opacity:1}50%{transform:scale(.9) rotate(-2deg);opacity:.8}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes qs-correct-glow{0%{box-shadow:0 0 0 0 rgba(124,198,67,.6)}40%{box-shadow:0 0 30px 8px rgba(124,198,67,.4)}100%{box-shadow:0 0 15px 4px rgba(124,198,67,.2)}}
@keyframes qs-wrong-crack{0%{box-shadow:0 0 0 0 rgba(255,107,107,.6)}25%{box-shadow:0 0 30px 8px rgba(255,50,50,.5);transform:translateX(-4px) rotate(-.5deg)}50%{box-shadow:0 0 15px 4px rgba(255,107,107,.3);transform:translateX(4px) rotate(.5deg)}75%{box-shadow:0 0 25px 6px rgba(255,50,50,.4);transform:translateX(-3px) rotate(-.3deg)}100%{box-shadow:0 0 8px 2px rgba(255,107,107,.15);transform:translateX(0) rotate(0)}}
@keyframes qs-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes qs-progress-fill{0%{stroke-dashoffset:87.96}100%{stroke-dashoffset:0}}
@keyframes hudRingSpin{to{transform:rotate(360deg)}}
@keyframes hudShineSweep{0%,100%{transform:translateX(-120%)}50%{transform:translateX(120%)}}
@keyframes levelPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
.qs-shake{animation:qs-shake .6s ease-in-out}
.qs-explode{animation:qs-explode .6s ease-in-out}
.qs-correct-glow{animation:qs-correct-glow 1s ease-out forwards}
.qs-wrong-crack{animation:qs-wrong-crack .6s ease-out forwards}
.qs-progress-ring{animation:qs-progress-fill 3s linear forwards}
`;
  document.head.appendChild(style);
}

export interface Question {
  id: string;
  type: 'mcq' | 'dragdrop' | 'hotspot' | 'matching' | 'sequence';
  question: { en: string; ms: string; zh: string };
  questionImage?: string;
  options?: Array<{
    id: string;
    text?: { en: string; ms: string; zh: string };
    image?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  correctAnswer: string;
  foxyMessage?: { en: string; ms: string; zh: string };
  hotspotImage?: string;
  /** Uploaded TTS audio URLs (preferred over browser speech synthesis) */
  tts?: { en?: string; ms?: string; zh?: string };
}

interface QuestionScreenProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answerId: string) => void;
  onNext: () => void;
  onBack?: () => void;
  hideProgress?: boolean;
  brandingSettings: {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
  };
  /** Training reward preview (max XP & Gold for this session) */
  trainingRewards?: { xp: number; gold: number };
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  question, questionNumber, totalQuestions, onAnswer, onNext,
  onBack, hideProgress = false, brandingSettings, trainingRewards,
}) => {
  const { language, t } = useLanguage();
  // Pull live stats + assets from realm context
  let realmStats: any = null;
  let realmAssets: any = null;
  let realmMusicOn = true;
  let realmToggleMusic: (() => void) | undefined;
  try {
    const realm = useRealmContext();
    realmStats = realm.stats;
    realmAssets = realm.assets;
    realmMusicOn = realm.musicOn;
    realmToggleMusic = realm.toggleMusicFn;
  } catch { /* Not inside RealmProvider — use fallback */ }

  const stats = realmStats || { name: 'Foxy', level: 1, xp: 0, xpToNext: 100, hp: 100, maxHp: 100, gold: 100, diamond: 5, rank: 0, age: 5 };
  const foxyImgUrl = realmAssets?.foxyHatchedImg || realmAssets?.foxyImg || null;
  const coinIconUrl = realmAssets?.iconCoin || null;
  const diamondIconUrl = realmAssets?.iconDiamond || null;

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const { playCorrectSound, playWrongSound } = useSoundEffects();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([]);
  const [sequenceSubmitted, setSequenceSubmitted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // Ref to always call the latest handleNext (avoids stale closures in auto-advance timer)
  const handleNextRef = useRef<() => void>(() => {});

  useEffect(() => { injectQuestionStyles(); }, []);

  useEffect(() => {
    if (question.type === 'sequence' && question.options) {
      const shuffled = [...question.options].sort(() => Math.random() - 0.5);
      setSequenceOrder(shuffled.map(opt => opt.id));
      setSequenceSubmitted(false);
    }
  }, [question.id]);

  useEffect(() => {
    if (selectedAnswer) {
      setProgressKey(k => k + 1);
      autoAdvanceTimerRef.current = setTimeout(() => { handleNextRef.current(); }, 3000);
      return () => { if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current); };
    }
  }, [selectedAnswer]);

  useEffect(() => {
    // Prefer uploaded TTS audio over browser speech synthesis
    const ttsUrl = question.tts?.[language as 'en' | 'ms' | 'zh'];
    if (ttsUrl) {
      // Stop any previous playback
      if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
      window.speechSynthesis?.cancel();

      const audio = new Audio(ttsUrl);
      ttsAudioRef.current = audio;
      audio.onerror = () => {
        console.warn('[QuestionScreen] TTS audio failed, falling back to speech synthesis:', ttsUrl);
        // Fallback to browser TTS
        if ('speechSynthesis' in window) {
          const text = question.question[language];
          const u = new SpeechSynthesisUtterance(text);
          u.lang = { en: 'en-US', ms: 'ms-MY', zh: 'zh-CN' }[language] || 'en-US';
          u.rate = 0.9; u.pitch = 1.1;
          window.speechSynthesis.speak(u);
        }
      };
      setTimeout(() => { audio.play().catch(() => {}); }, 300);
    } else if ('speechSynthesis' in window) {
      const text = question.question[language];
      const u = new SpeechSynthesisUtterance(text);
      u.lang = { en: 'en-US', ms: 'ms-MY', zh: 'zh-CN' }[language] || 'en-US';
      u.rate = 0.9; u.pitch = 1.1;
      window.speechSynthesis.cancel();
      setTimeout(() => { window.speechSynthesis.speak(u); }, 300);
    }
    return () => {
      if (ttsAudioRef.current) { ttsAudioRef.current.pause(); ttsAudioRef.current = null; }
      window.speechSynthesis?.cancel();
    };
  }, [question.id, language]);

  const handleSelectAnswer = (answerId: string) => {
    setSelectedAnswer(answerId);
    const correct = answerId === question.correctAnswer;
    setIsCorrect(correct);
    onAnswer(answerId);
    if (correct) { playCorrectSound(); setShowVictory(true); setTimeout(() => setShowVictory(false), 3000); }
    else { playWrongSound(); setWrongShake(true); setTimeout(() => setWrongShake(false), 600); }
  };

  const handleNext = () => {
    setSelectedAnswer(null); setIsCorrect(null); setShowVictory(false);
    setWrongShake(false); setSequenceOrder([]); setSequenceSubmitted(false); onNext();
  };

  // Update the ref to the latest handleNext function
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  const handleSequenceSubmit = () => {
    if (question.type === 'sequence' && question.options) {
      const correctOrder = question.correctAnswer.split(',');
      const ok = sequenceOrder.every((id, idx) => id === correctOrder[idx]);
      setSelectedAnswer(ok ? 'correct' : 'wrong'); setIsCorrect(ok);
      setSequenceSubmitted(true); onAnswer(sequenceOrder.join(','));
      if (ok) { playCorrectSound(); setShowVictory(true); setTimeout(() => setShowVictory(false), 3000); }
      else { playWrongSound(); setWrongShake(true); setTimeout(() => setWrongShake(false), 600); }
    }
  };

  const moveSequenceItem = (from: number, to: number) => {
    if (sequenceSubmitted) return;
    const a = [...sequenceOrder]; const [m] = a.splice(from, 1); a.splice(to, 0, m); setSequenceOrder(a);
  };

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const gold = '#d4a44a';
  const goldLight = '#ffeaa7';
  const darkBg = 'rgba(30,22,12,0.92)';
  const darkBgLight = 'rgba(42,31,14,0.85)';
  const parchment = '#c8b88a';

  const navigate = useNavigate();

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      <FantasyBackground bgImage={brandingSettings.testBackgroundImage || forestBackground} overlayOpacity={0.55} />
      <VictoryBurst isActive={showVictory} />

      <div className="relative z-10 flex flex-col h-full w-full max-w-lg mx-auto">

        {/* ═══════ ACTUAL REALM HUD — 100% identical to realm page ═══════ */}
        <RealmHUD
          stats={stats}
          coinIconUrl={coinIconUrl}
          diamondIconUrl={diamondIconUrl}
          onSettings={() => setSettingsOpen(true)}
          onMusicToggle={realmToggleMusic}
          onAvatarTap={() => navigate('/realm/mastery')}
          musicOn={realmMusicOn}
          variant="training"
          trainingRewards={trainingRewards || { xp: 25, gold: 10 }}
        />

        {/* Back button — below compact HUD (only 2 rows: top row + rewards strip) */}
        {onBack && (
          <motion.button
            onClick={onBack}
            className="absolute z-40 flex items-center gap-1.5"
            style={{
              top: 88,
              left: 12,
              background: 'linear-gradient(135deg, rgba(15,12,8,0.9), rgba(25,20,12,0.95))',
              border: '2px solid rgba(212,164,74,0.3)',
              borderRadius: 20,
              padding: '4px 14px 4px 8px',
              boxShadow: '0 3px 12px rgba(0,0,0,0.5), 0 0 8px rgba(212,164,74,0.1)',
            }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={16} color="#d4a44a" />
            <span style={{ fontFamily: F, fontSize: 13, color: '#d4a44a', textShadow: '0 1px 3px rgba(0,0,0,0.8)', lineHeight: 1 }}>
              {language === 'en' ? 'Exit' : language === 'ms' ? 'Keluar' : '退出'}
            </span>
          </motion.button>
        )}

        {/* Spacer to clear the compact training HUD */}
        <div className="flex-shrink-0" style={{ height: 116 }} />

        {/* Progress bar — hidden in practice mode */}
        {!hideProgress && <ProgressBar current={questionNumber} total={totalQuestions} />}

        {/* ═══════ CHALLENGE QUESTION — large bold heading ═══════ */}
        <div className="flex-shrink-0 flex items-center justify-center gap-3 px-6 pb-3 pt-2">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${gold})` }} />
          <h2
            className="text-lg md:text-xl font-black tracking-wider text-center"
            style={{
              fontFamily: F,
              color: goldLight,
              textShadow: `0 0 24px ${gold}66, 0 2px 4px rgba(0,0,0,0.8)`,
            }}
          >
            {question.question[language]}
          </h2>
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${gold}, transparent)` }} />
        </div>

        {/* ═══════ SCROLLABLE CONTENT ═══════ */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">

        {/* ═══ QUESTION CARD — thick gold double-frame with connected Voice button ═══ */}
        <div
          className="relative rounded-xl mb-5"
          style={{
            padding: '4px',
            background: `linear-gradient(135deg, #8b6914, ${gold}, #f0d078, ${gold}, #8b6914)`,
            boxShadow: `0 0 20px ${gold}44, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Voice button — small, anchored inside top-right corner of the card */}
          <div
            className="absolute z-20"
            style={{ top: 8, right: 8 }}
          >
            <VoiceButton text={question.question[language]} language={language} size="small" audioUrl={question.tts?.[language as 'en' | 'ms' | 'zh']} />
          </div>

          {/* Inner dark panel */}
          <div
            className="relative rounded-lg overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(18,22,18,0.98) 0%, rgba(12,16,12,0.99) 100%)',
            }}
          >
            {/* Inner border highlight */}
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ border: `1.5px solid ${gold}33` }}
            />

            <div className={`${question.questionImage ? 'p-0' : 'p-5 md:p-6 pr-16'} flex flex-col items-start gap-3`}>
              {/* Optional question image — full bleed, fills entire card */}
              {question.questionImage && (
                <div className="w-full overflow-hidden rounded-lg">
                  <ImageWithFallback
                    src={question.questionImage}
                    alt="Question illustration"
                    className="w-full h-auto object-contain"
                  />
                </div>
              )}

              {/* Question text — only shown if no image (since heading already shows it) */}
              {!question.questionImage && (
                <p
                  className="text-xl md:text-2xl font-black leading-relaxed text-left w-full"
                  style={{
                    fontFamily: F,
                    color: '#fff',
                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  }}
                >
                  {question.question[language]}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ═══ MCQ OPTIONS ═══ */}
        {question.type === 'mcq' && question.options && (() => {
          const hasImages = question.options!.some(opt => opt.image);

          /* ════ IMAGE MCQ: 2×2 grid — image top, text label below ════ */
          if (hasImages) {
            return (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {question.options!.map((option, i) => {
                  const isSel = selectedAnswer === option.id;
                  const isRight = isSel && isCorrect;
                  const isWrong = isSel && !isCorrect;
                  const isTheCorrectAnswer = option.id === question.correctAnswer;
                  // When user picked wrong, highlight the actual correct answer green
                  const revealCorrect = selectedAnswer !== null && !isCorrect && isTheCorrectAnswer;
                  const hasText = option.text && (option.text.en || option.text.ms || option.text.zh);
                  const ltr = LETTERS[i];

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectAnswer(option.id)}
                      disabled={selectedAnswer !== null}
                      className={`
                        relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300
                        ${isSel ? (isCorrect ? 'scale-[1.03]' : 'scale-95')
                          : revealCorrect ? 'scale-[1.03]'
                          : selectedAnswer ? 'opacity-40 scale-95' : 'hover:scale-[1.02] active:scale-95'}
                        ${isRight || revealCorrect ? 'qs-correct-glow' : ''}
                        ${isWrong ? 'qs-wrong-crack' : ''}
                      `}
                      style={{
                        background: 'rgba(20,18,28,0.95)',
                        border: isSel
                          ? isCorrect ? '3px solid #7cc643' : '3px solid #ff6b6b'
                          : revealCorrect ? '3px solid #7cc643'
                          : `2.5px solid ${gold}66`,
                        boxShadow: isSel
                          ? isCorrect ? '0 0 20px rgba(124,198,67,0.4)' : '0 0 20px rgba(255,80,80,0.4)'
                          : revealCorrect ? '0 0 20px rgba(124,198,67,0.4)'
                          : '0 4px 16px rgba(0,0,0,0.4)',
                      }}
                    >
                      {/* Image */}
                      <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
                        {option.image ? (
                          <ImageWithFallback
                            src={option.image}
                            alt={option.text?.[language] || ''}
                            className={`w-full h-full object-cover ${isWrong && wrongShake ? 'qs-explode' : ''}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-black/30">
                            <span className="text-3xl opacity-30">🖼</span>
                          </div>
                        )}

                        {/* Letter badge — gold coin, top-left, connected to card edge */}
                        <div
                          className="absolute w-10 h-10 rounded-full flex items-center justify-center font-black text-base z-10"
                          style={{
                            top: -5,
                            left: -5,
                            fontFamily: F,
                            background: isSel
                              ? isCorrect ? 'linear-gradient(135deg, #7cc643, #5a9e2e)' : 'linear-gradient(135deg, #ff6b6b, #dd4444)'
                              : revealCorrect ? 'linear-gradient(135deg, #7cc643, #5a9e2e)'
                              : `linear-gradient(135deg, ${gold}, #f0d078, ${gold})`,
                            color: (isSel || revealCorrect) ? '#fff' : '#2a1f0e',
                            border: `3px solid ${isSel ? (isCorrect ? '#9ed963' : '#ff8888') : revealCorrect ? '#9ed963' : goldLight}`,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                          }}
                        >
                          {ltr}
                        </div>

                        {/* Correct/Wrong overlay */}
                        {(isSel || revealCorrect) && (
                          <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30">
                            <div
                              className="w-14 h-14 rounded-full flex items-center justify-center"
                              style={{
                                background: (isRight || revealCorrect) ? '#7cc643' : '#ff5050',
                                boxShadow: (isRight || revealCorrect) ? '0 0 30px rgba(124,198,67,0.7)' : '0 0 30px rgba(255,80,80,0.7)',
                              }}
                            >
                              <span className="text-white text-3xl font-black">{(isRight || revealCorrect) ? '✓' : '✗'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Text label below */}
                      {hasText && (
                        <div className="px-2 py-2.5 text-center">
                          <p
                            className="text-sm font-bold leading-tight"
                            style={{ fontFamily: F, color: isSel ? (isCorrect ? '#9ed963' : '#ff8888') : revealCorrect ? '#9ed963' : '#e8dcc8' }}
                          >
                            {option.text![language]}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          }

          /* ════ TEXT MCQ: capsule pills — coin badge vertically centered, touching pill border ════ */
          return (
            <div className="flex flex-col gap-3.5 mb-4">
              {question.options!.map((option, i) => {
                const isSel = selectedAnswer === option.id;
                const isRight = isSel && isCorrect;
                const isWrong = isSel && !isCorrect;
                const isTheCorrectAnswer = option.id === question.correctAnswer;
                // When user picked wrong, highlight the actual correct answer green
                const revealCorrect = selectedAnswer !== null && !isCorrect && isTheCorrectAnswer;
                const ltr = LETTERS[i];

                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectAnswer(option.id)}
                    disabled={selectedAnswer !== null}
                    className={`
                      relative w-full transition-all duration-300
                      ${isSel ? (isCorrect ? 'scale-[1.02]' : 'scale-[0.97]')
                        : revealCorrect ? 'scale-[1.02]'
                        : selectedAnswer ? 'opacity-35 scale-[0.97]' : 'hover:scale-[1.02] active:scale-[0.97]'}
                      ${isRight || revealCorrect ? 'qs-correct-glow' : ''}
                      ${isWrong ? 'qs-wrong-crack' : ''}
                    `}
                  >
                    <div className="flex items-center">
                      {/* ── Gold Coin Badge — overlapping pill left edge, vertically centered ── */}
                      <div
                        className="relative z-10 flex-shrink-0"
                        style={{ width: 46, height: 46, marginRight: -20 }}
                      >
                        <div
                          className="w-full h-full rounded-full flex items-center justify-center font-black text-xl"
                          style={{
                            fontFamily: F,
                            background: isSel
                              ? isCorrect
                                ? 'linear-gradient(145deg, #8dd44f, #6ab537, #7cc643)'
                                : 'linear-gradient(145deg, #ff7777, #dd4444, #ff6b6b)'
                              : revealCorrect
                                ? 'linear-gradient(145deg, #8dd44f, #6ab537, #7cc643)'
                                : `linear-gradient(145deg, #f0d078, ${gold}, #b8862e)`,
                            color: (isSel || revealCorrect) ? '#fff' : '#2a1f0e',
                            border: `3px solid ${isSel ? (isCorrect ? '#b8f080' : '#ff9999') : revealCorrect ? '#b8f080' : '#ffeaa7'}`,
                            boxShadow: isSel
                              ? isCorrect
                                ? '0 0 14px rgba(124,198,67,0.6), 0 3px 6px rgba(0,0,0,0.4)'
                                : '0 0 14px rgba(255,80,80,0.6), 0 3px 6px rgba(0,0,0,0.4)'
                              : revealCorrect
                                ? '0 0 14px rgba(124,198,67,0.6), 0 3px 6px rgba(0,0,0,0.4)'
                                : `0 0 8px ${gold}55, 0 4px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.3)`,
                          }}
                        >
                          {ltr}
                        </div>
                      </div>

                      {/* ── Pill Body — thick gold-brown gradient border ── */}
                      <div
                        className="flex-1 relative rounded-xl overflow-hidden"
                        style={{
                          padding: '3px',
                          background: isSel
                            ? isCorrect
                              ? 'linear-gradient(135deg, #7cc643, #5a9e2e)'
                              : 'linear-gradient(135deg, #ff6b6b, #cc3333)'
                            : revealCorrect
                              ? 'linear-gradient(135deg, #7cc643, #5a9e2e)'
                              : `linear-gradient(135deg, #8b6914, ${gold}, #c4943a, ${gold}, #8b6914)`,
                        }}
                      >
                        <div
                          className="rounded-[10px] py-3 md:py-3.5 pl-8 pr-4 flex items-center justify-between"
                          style={{
                            background: isSel
                              ? isCorrect
                                ? 'linear-gradient(135deg, rgba(50,80,30,0.95), rgba(30,50,20,0.98))'
                                : 'linear-gradient(135deg, rgba(80,20,20,0.95), rgba(50,15,15,0.98))'
                              : revealCorrect
                                ? 'linear-gradient(135deg, rgba(50,80,30,0.95), rgba(30,50,20,0.98))'
                                : 'linear-gradient(135deg, rgba(30,24,42,0.97), rgba(22,18,32,0.99))',
                          }}
                        >
                          <p
                            className="text-base md:text-lg font-bold text-left flex-1"
                            style={{
                              fontFamily: F,
                              color: isSel ? (isCorrect ? '#c8ff90' : '#ffaaaa') : revealCorrect ? '#c8ff90' : '#f0e6d0',
                            }}
                          >
                            {option.text?.[language]}
                          </p>

                          {(isSel || revealCorrect) && (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ml-2"
                              style={{
                                background: (isRight || revealCorrect) ? '#7cc643' : '#ff5050',
                                boxShadow: (isRight || revealCorrect) ? '0 0 8px rgba(124,198,67,0.6)' : '0 0 8px rgba(255,80,80,0.6)',
                              }}
                            >
                              <span className="text-white text-xs font-black">{(isRight || revealCorrect) ? '✓' : '✗'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ═══ Drag & Drop ═══ */}
        {question.type === 'dragdrop' && question.options && (
          <div>
            <div
              className="rounded-2xl p-6 mb-4"
              style={{ background: `linear-gradient(135deg, ${darkBg}, rgba(20,16,10,0.95))`, border: `2px solid ${gold}44`, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            >
              <p className="text-center font-bold mb-4 text-lg" style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}>
                {language === 'en' ? 'Drag the correct answer here' : language === 'ms' ? 'Seret jawapan yang betul ke sini' : '将正确答案拖到这里'}
              </p>
              <div
                onDragOver={(e) => { e.preventDefault(); if (!selectedAnswer) setIsDraggingOver(true); }}
                onDragLeave={() => setIsDraggingOver(false)}
                onDrop={(e) => { e.preventDefault(); setIsDraggingOver(false); if (draggedItem && !selectedAnswer) handleSelectAnswer(draggedItem); }}
                className="min-h-40 rounded-xl flex items-center justify-center transition-all"
                style={{
                  border: selectedAnswer ? '4px solid #7cc64388' : isDraggingOver ? `4px solid ${gold}` : `4px dashed ${gold}44`,
                  background: selectedAnswer ? 'rgba(124,198,67,0.08)' : isDraggingOver ? `${gold}15` : 'rgba(10,10,18,0.3)',
                  transform: isDraggingOver ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {selectedAnswer ? (
                  <div className="text-center p-4">
                    {question.options.find(o => o.id === selectedAnswer)?.image && (
                      <ImageWithFallback src={question.options.find(o => o.id === selectedAnswer)!.image!} alt="" className="w-32 h-32 object-contain mx-auto mb-2" />
                    )}
                    <p className="text-4xl font-black" style={{ color: goldLight }}>{question.options.find(o => o.id === selectedAnswer)?.text?.[language]}</p>
                    {isCorrect !== null && <div className="text-6xl mt-4">{isCorrect ? '✅' : '❌'}</div>}
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-6xl mb-2">{isDraggingOver ? '✋' : '👇'}</div>
                    <p className="text-lg font-bold" style={{ color: `${parchment}88` }}>
                      {isDraggingOver
                        ? (language === 'en' ? 'Drop here!' : language === 'ms' ? 'Lepaskan di sini!' : '放在这里！')
                        : (language === 'en' ? 'Drag an answer here' : language === 'ms' ? 'Seret jawapan ke sini' : '将答案拖到这里')}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  draggable={!selectedAnswer}
                  onDragStart={(e) => { setDraggedItem(option.id); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDraggedItem(null); setIsDraggingOver(false); }}
                  onClick={() => !selectedAnswer && handleSelectAnswer(option.id)}
                  className={`p-6 rounded-xl transition-all ${selectedAnswer === option.id ? 'opacity-30 scale-90' : selectedAnswer ? 'opacity-50' : draggedItem === option.id ? 'scale-95 opacity-50 cursor-grabbing' : 'cursor-grab hover:scale-105 active:scale-95'}`}
                  style={{
                    background: `linear-gradient(135deg, ${darkBg}, rgba(20,16,10,0.95))`,
                    border: draggedItem === option.id ? `3px solid ${gold}` : `3px solid ${gold}33`,
                    boxShadow: draggedItem === option.id ? `0 0 20px ${gold}33` : '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  {option.image && <ImageWithFallback src={option.image} alt="" className="w-full h-24 object-contain mb-2 pointer-events-none" />}
                  <p className="text-2xl font-black text-center pointer-events-none select-none" style={{ color: goldLight }}>{option.text?.[language]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Hotspot ═══ */}
        {question.type === 'hotspot' && question.hotspotImage && question.options && (
          <div>
            <div className="rounded-2xl p-6" style={{ background: `linear-gradient(135deg, ${darkBg}, rgba(20,16,10,0.95))`, border: `2px solid ${gold}44` }}>
              <p className="text-center font-bold mb-6 text-lg" style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}>
                {language === 'en' ? '👆 Tap on the correct part' : language === 'ms' ? '👆 Ketik bahagian yang betul' : '👆 点击正确的部分'}
              </p>
              <div className="relative max-w-2xl mx-auto">
                <ImageWithFallback src={question.hotspotImage} alt="Hotspot" className="w-full h-auto rounded-xl" style={{ border: `2px solid ${gold}33` }} />
                {question.options.map((option) => {
                  const isSel = selectedAnswer === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => !selectedAnswer && handleSelectAnswer(option.id)}
                      disabled={selectedAnswer !== null}
                      className="rounded-full transition-all absolute"
                      style={{
                        left: `${option.position?.x || 0}%`, top: `${option.position?.y || 0}%`,
                        width: `${option.position?.width || 15}%`, height: `${option.position?.height || 15}%`,
                        background: isSel ? (isCorrect ? 'rgba(124,198,67,0.4)' : 'rgba(255,107,107,0.4)') : `${gold}20`,
                        border: isSel ? (isCorrect ? '4px solid #7cc643' : '4px solid #ff6b6b') : `3px solid ${gold}55`,
                        boxShadow: isSel ? (isCorrect ? '0 0 20px rgba(124,198,67,0.5)' : '0 0 20px rgba(255,107,107,0.5)') : 'none',
                      }}
                    >
                      {isSel && <div className="absolute -top-16 left-1/2 -translate-x-1/2 text-7xl animate-bounce">{isCorrect ? '✅' : '❌'}</div>}
                    </button>
                  );
                })}
                {!selectedAnswer && (
                  <div className="absolute bottom-3 right-3 text-sm px-3 py-2 rounded-full" style={{ background: 'rgba(10,10,18,0.9)', color: parchment, border: `1px solid ${gold}33` }}>
                    👆 {language === 'en' ? 'Tap the correct area' : language === 'ms' ? 'Ketik kawasan yang betul' : '点击正确区域'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Sequence ═══ */}
        {question.type === 'sequence' && question.options && sequenceOrder.length > 0 && (
          <div>
            <div className={`rounded-2xl p-6 ${wrongShake && sequenceSubmitted && !isCorrect ? 'qs-shake' : ''}`}
              style={{ background: `linear-gradient(135deg, ${darkBg}, rgba(20,16,10,0.95))`, border: `2px solid ${gold}44` }}>
              <p className="text-center font-bold mb-4 text-sm" style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}>
                {language === 'en' ? '🔀 Tap arrows or drag to reorder' : language === 'ms' ? '🔀 Ketik anak panah atau seret' : '🔀 点击箭头或拖动排序'}
              </p>
              <div className="space-y-3">
                {sequenceOrder.map((optionId, index) => {
                  const option = question.options!.find(o => o.id === optionId);
                  if (!option) return null;
                  const correctOrder = question.correctAnswer.split(',');
                  const isItemOk = optionId === correctOrder[index];
                  return (
                    <div key={optionId}
                      draggable={!sequenceSubmitted}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedItem(index.toString()); }}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); const di = parseInt(draggedItem || '-1'); if (di !== -1 && di !== index) moveSequenceItem(di, index); setDraggedItem(null); }}
                      onDragEnd={() => setDraggedItem(null)}
                      className={`relative rounded-xl p-4 flex items-center gap-4 transition-all ${sequenceSubmitted ? '' : draggedItem === index.toString() ? 'opacity-50 scale-95 cursor-grabbing' : 'cursor-grab hover:scale-[1.02]'}`}
                      style={{
                        background: darkBgLight,
                        border: sequenceSubmitted ? (isItemOk ? '3px solid #7cc643' : '3px solid #ff6b6b') : `3px solid ${gold}33`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {!sequenceSubmitted && <div className="text-2xl" style={{ color: `${gold}66` }}>⋮⋮</div>}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                          style={{
                            background: sequenceSubmitted ? (isItemOk ? 'linear-gradient(135deg,#7cc643,#6ab537)' : 'linear-gradient(135deg,#ff6b6b,#ee5a5a)') : `linear-gradient(135deg,${gold},#a67c2e)`,
                            color: sequenceSubmitted ? '#fff' : '#2a1f0e',
                            border: sequenceSubmitted ? (isItemOk ? '2px solid #9ed963' : '2px solid #ff8888') : `2px solid ${goldLight}`,
                          }}>
                          {index + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        {option.image && <ImageWithFallback src={option.image} alt="" className="w-20 h-20 object-contain mb-2" />}
                        <p className="text-xl font-bold text-left" style={{ color: goldLight }}>{option.text?.[language]}</p>
                      </div>
                      {sequenceSubmitted && <div className="text-3xl">{isItemOk ? '✅' : '❌'}</div>}
                      {!sequenceSubmitted && (
                        <div className="flex flex-col gap-1 ml-auto shrink-0">
                          <button type="button" disabled={index === 0} onClick={(e) => { e.stopPropagation(); moveSequenceItem(index, index - 1); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-20"
                            style={{ background: index === 0 ? 'transparent' : `${gold}22`, border: `2px solid ${gold}${index === 0 ? '15' : '55'}` }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3L13 9H3L8 3Z" fill={index === 0 ? `${gold}33` : gold} /></svg>
                          </button>
                          <button type="button" disabled={index === sequenceOrder.length - 1} onClick={(e) => { e.stopPropagation(); moveSequenceItem(index, index + 1); }}
                            className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-20"
                            style={{ background: index === sequenceOrder.length - 1 ? 'transparent' : `${gold}22`, border: `2px solid ${gold}${index === sequenceOrder.length - 1 ? '15' : '55'}` }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13L3 7H13L8 13Z" fill={index === sequenceOrder.length - 1 ? `${gold}33` : gold} /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!sequenceSubmitted && (
                <div className="mt-6 text-center">
                  <button onClick={handleSequenceSubmit}
                    className="px-8 py-4 rounded-xl text-lg font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all"
                    style={{
                      fontFamily: "'Cinzel Decorative', serif",
                      background: `linear-gradient(135deg, ${gold}, #f0d078, ${gold})`,
                      color: '#2a1f0e', border: `3px solid ${goldLight}`,
                      boxShadow: `0 4px 20px ${gold}44`,
                    }}>
                    {language === 'en' ? '✓ Check Answer' : language === 'ms' ? '✓ Semak Jawapan' : '✓ 检查答案'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        </div>

        {/* ═══ NEXT BUTTON — golden fantasy ═══ */}
        {selectedAnswer && (
          <div className="flex-shrink-0 px-4 pb-4">
            <button
              onClick={handleNext}
              className="relative w-full px-8 py-4 rounded-xl text-lg font-black uppercase tracking-wider active:translate-y-1 transition-all duration-150 overflow-hidden"
              style={{
                fontFamily: "'Cinzel Decorative', serif",
                background: `linear-gradient(135deg, ${gold}, #f0d078, ${goldLight}, #f0d078, ${gold})`,
                color: '#2a1f0e',
                border: `4px solid ${goldLight}`,
                boxShadow: `0 6px 0 #a67c2e, 0 0 30px ${gold}55`,
                textShadow: '0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'qs-shimmer 2s infinite' }} />
              <svg className="absolute top-1/2 left-4 -translate-y-1/2 w-8 h-8 -rotate-90">
                <circle cx="16" cy="16" r="14" stroke="rgba(42,31,14,0.3)" strokeWidth="3" fill="none" />
                <circle key={progressKey} cx="16" cy="16" r="14" stroke="#2a1f0e" strokeWidth="3" fill="none"
                  strokeDasharray="87.96" strokeDashoffset="87.96" className="qs-progress-ring"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(42,31,14,0.5))' }} />
              </svg>
              <span className="relative z-10 ml-8">
                {language === 'en' ? 'Next' : language === 'ms' ? 'Seterusnya' : '下一个'} →
              </span>
            </button>
            <p className="text-center text-xs mt-2" style={{ fontFamily: F, color: `${parchment}88` }}>
              {language === 'en' ? 'Auto-advancing in 3 seconds...' : language === 'ms' ? 'Meneruskan secara automatik dalam 3 saat...' : '3秒后自动前进...'}
            </p>
          </div>
        )}
      </div>

      <FantasyFooter hideLinks />

      {/* ═══ Settings Popup Modal ═══ */}
      <SettingsPopup isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};