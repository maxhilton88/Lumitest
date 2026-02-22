import React, { useState, useEffect, useRef } from 'react';
import { GlossyButton } from '../GlossyButton';
import { VoiceButton } from '../VoiceButton';
import { FoxyCharacter } from '../FoxyCharacter';
import { ProgressBar } from '../ProgressBar';
import { useLanguage } from '../LanguageContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { VictoryBurst } from '../VictoryBurst';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { FantasyBackground, FantasyFooter } from '../FantasyBackground';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

// ── Inject keyframe CSS ONCE globally (not per render) ──
let questionStylesInjected = false;
function injectQuestionStyles() {
  if (questionStylesInjected) return;
  questionStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'question-screen-css';
  style.textContent = `
@keyframes qs-shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-10px)}20%,40%,60%,80%{transform:translateX(10px)}}
@keyframes qs-explode{0%{transform:scale(1) rotate(0);opacity:1}50%{transform:scale(.9) rotate(-2deg);opacity:.8}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes qs-correct-glow{0%{box-shadow:0 0 0 0 rgba(124,198,67,.6),0 0 20px rgba(212,164,74,.3)}40%{box-shadow:0 0 30px 8px rgba(124,198,67,.4),0 0 60px rgba(212,164,74,.5)}100%{box-shadow:0 0 15px 4px rgba(124,198,67,.2),0 0 30px rgba(212,164,74,.2)}}
@keyframes qs-wrong-crack{0%{box-shadow:0 0 0 0 rgba(255,107,107,.6)}25%{box-shadow:0 0 30px 8px rgba(255,50,50,.5);transform:translateX(-4px) rotate(-.5deg)}50%{box-shadow:0 0 15px 4px rgba(255,107,107,.3);transform:translateX(4px) rotate(.5deg)}75%{box-shadow:0 0 25px 6px rgba(255,50,50,.4);transform:translateX(-3px) rotate(-.3deg)}100%{box-shadow:0 0 8px 2px rgba(255,107,107,.15);transform:translateX(0) rotate(0)}}
@keyframes qs-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes qs-progress-fill{0%{stroke-dashoffset:87.96}100%{stroke-dashoffset:0}}
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
  question: {
    en: string;
    ms: string;
    zh: string;
  };
  questionImage?: string; // Optional image shown with the question
  options?: Array<{
    id: string;
    text?: { en: string; ms: string; zh: string };
    image?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
  correctAnswer: string;
  foxyMessage?: {
    en: string;
    ms: string;
    zh: string;
  };
  hotspotImage?: string;
}

interface QuestionScreenProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answerId: string) => void;
  onNext: () => void;
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
}

export const QuestionScreen: React.FC<QuestionScreenProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onNext,
  hideProgress = false,
  brandingSettings
}) => {
  const { language, t } = useLanguage();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const { playCorrectSound, playWrongSound } = useSoundEffects();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Use a ref for the auto-advance timer so we can cancel it
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Key to force CSS animation restart on the progress ring
  const [progressKey, setProgressKey] = useState(0);

  // For sequence questions
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([]);
  const [sequenceSubmitted, setSequenceSubmitted] = useState(false);

  // Inject global CSS once on mount
  useEffect(() => { injectQuestionStyles(); }, []);

  useEffect(() => {
    if (question.type === 'sequence' && question.options) {
      const shuffled = [...question.options].sort(() => Math.random() - 0.5);
      setSequenceOrder(shuffled.map(opt => opt.id));
      setSequenceSubmitted(false);
    }
  }, [question.id]);

  // Auto-advance timer — NO setInterval, NO state updates during animation
  useEffect(() => {
    if (selectedAnswer) {
      // Bump the key to restart the CSS progress ring animation
      setProgressKey(k => k + 1);

      autoAdvanceTimerRef.current = setTimeout(() => {
        handleNext();
      }, 3000);

      return () => {
        if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      };
    }
  }, [selectedAnswer]);

  // Auto-play question audio
  useEffect(() => {
    const playQuestionAudio = () => {
      if ('speechSynthesis' in window) {
        const questionText = question.question[language];
        const utterance = new SpeechSynthesisUtterance(questionText);
        const languageMap = { en: 'en-US', ms: 'ms-MY', zh: 'zh-CN' };
        utterance.lang = languageMap[language];
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        window.speechSynthesis.cancel();
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 300);
      }
    };

    playQuestionAudio();
    return () => { window.speechSynthesis.cancel(); };
  }, [question.id, language]);

  const handleSelectAnswer = (answerId: string) => {
    setSelectedAnswer(answerId);
    const correct = answerId === question.correctAnswer;
    setIsCorrect(correct);
    onAnswer(answerId);

    if (correct) {
      playCorrectSound();
      setShowVictory(true);
      setTimeout(() => setShowVictory(false), 3000);
    } else {
      playWrongSound();
      setWrongShake(true);
      setTimeout(() => setWrongShake(false), 600);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowVictory(false);
    setWrongShake(false);
    setSequenceOrder([]);
    setSequenceSubmitted(false);
    onNext();
  };

  const handleSequenceSubmit = () => {
    if (question.type === 'sequence' && question.options) {
      const correctOrder = question.correctAnswer.split(',');
      const isSequenceCorrect = sequenceOrder.every((id, idx) => id === correctOrder[idx]);

      setSelectedAnswer(isSequenceCorrect ? 'correct' : 'wrong');
      setIsCorrect(isSequenceCorrect);
      setSequenceSubmitted(true);
      onAnswer(sequenceOrder.join(','));

      if (isSequenceCorrect) {
        playCorrectSound();
        setShowVictory(true);
        setTimeout(() => setShowVictory(false), 3000);
      } else {
        playWrongSound();
        setWrongShake(true);
        setTimeout(() => setWrongShake(false), 600);
      }
    }
  };

  const moveSequenceItem = (fromIndex: number, toIndex: number) => {
    if (sequenceSubmitted) return;
    const newOrder = [...sequenceOrder];
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setSequenceOrder(newOrder);
  };

  // Fantasy color tokens
  const gold = '#d4a44a';
  const goldLight = '#ffeaa7';
  const darkBg = 'rgba(30,22,12,0.92)';
  const darkBgLight = 'rgba(42,31,14,0.85)';
  const parchment = '#c8b88a';

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Fantasy background */}
      <FantasyBackground bgImage={brandingSettings.testBackgroundImage || forestBackground} overlayOpacity={0.55} />

      {/* Victory Burst */}
      <VictoryBurst isActive={showVictory} />

      <div className="relative z-10 flex flex-col h-full max-w-4xl mx-auto w-full overflow-y-auto">
        {/* Progress Bar — hidden in practice mode */}
        {!hideProgress && <ProgressBar current={questionNumber} total={totalQuestions} />}

        {/* Foxy Character */}
        <div className="px-4 md:px-6 pt-4">
          <FoxyCharacter
            size="md"
            message={question.foxyMessage?.[language] || question.question[language]}
          />
        </div>

        {/* Question Section */}
        <div className="flex-1 flex flex-col justify-center px-4 md:px-6 py-4 md:py-6">
          {/* Question text panel — dark fantasy glass */}
          <div
            className="relative rounded-2xl p-4 md:p-6 mb-4 md:mb-6"
            style={{
              background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
              border: `2px solid ${gold}44`,
              boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
            }}
          >
            {/* Corner accents */}
            {['top-1 left-1', 'top-1 right-1', 'bottom-1 left-1', 'bottom-1 right-1'].map((pos, idx) => (
              <div
                key={idx}
                className={`absolute ${pos} w-3 h-3 z-[1] pointer-events-none`}
                style={{
                  borderTop: pos.includes('top') ? `1.5px solid ${gold}55` : 'none',
                  borderBottom: pos.includes('bottom') ? `1.5px solid ${gold}55` : 'none',
                  borderLeft: pos.includes('left') ? `1.5px solid ${gold}55` : 'none',
                  borderRight: pos.includes('right') ? `1.5px solid ${gold}55` : 'none',
                  borderRadius: '3px',
                }}
              />
            ))}

            <div className="flex items-start gap-3 md:gap-4">
              <VoiceButton text={question.question[language]} language={language} />
              <div className="flex-1">
                <p
                  className="text-lg md:text-xl lg:text-2xl font-bold leading-relaxed"
                  style={{ color: goldLight, textShadow: `0 0 8px ${gold}33, 0 2px 4px rgba(0,0,0,0.6)` }}
                >
                  {question.question[language]}
                </p>
              </div>
            </div>

            {/* Question Image — shown only if questionImage exists */}
            {question.questionImage && (
              <div className="mt-4">
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ border: `2px solid ${gold}33` }}
                >
                  <ImageWithFallback
                    src={question.questionImage}
                    alt="Question illustration"
                    className="w-full h-auto object-cover"
                    style={{ maxHeight: '280px' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* === MCQ Answer Options === */}
          {question.type === 'mcq' && question.options && (() => {
            const hasImages = question.options!.some(opt => opt.image);

            // ---- IMAGE ANSWERS: 2×2 grid, full-bleed image bg, 4:3 landscape ----
            if (hasImages) {
              return (
                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                  {question.options!.map((option) => {
                    const isWrongAnswer = selectedAnswer === option.id && !isCorrect;
                    const isSelected = selectedAnswer === option.id;
                    const isCorrectAnswer = isSelected && isCorrect;
                    const hasText = option.text && (option.text.en || option.text.ms || option.text.zh);

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelectAnswer(option.id)}
                        disabled={selectedAnswer !== null}
                        className={`
                          relative rounded-2xl overflow-hidden transition-all duration-300
                          ${isSelected
                            ? isCorrect ? 'scale-[1.03]' : 'scale-95'
                            : selectedAnswer ? 'opacity-40 scale-95' : 'hover:scale-[1.03] active:scale-95'
                          }
                          ${isCorrectAnswer ? 'qs-correct-glow' : ''}
                          ${isWrongAnswer ? 'qs-wrong-crack' : ''}
                        `}
                        style={{
                          aspectRatio: '4/3',
                          border: isSelected
                            ? isCorrect ? '4px solid #7cc643' : '4px solid #ff6b6b'
                            : `3px solid ${gold}44`,
                          boxShadow: isSelected
                            ? isCorrect
                              ? '0 0 30px rgba(124,198,67,0.4), 0 6px 20px rgba(0,0,0,0.3)'
                              : '0 0 30px rgba(255,107,107,0.4), 0 6px 20px rgba(0,0,0,0.3)'
                            : selectedAnswer
                              ? '0 2px 8px rgba(0,0,0,0.2)'
                              : `0 4px 16px rgba(0,0,0,0.3), 0 0 8px ${gold}15`,
                        }}
                      >
                        {/* Full-bleed background image */}
                        {option.image && (
                          <ImageWithFallback
                            src={option.image}
                            alt={option.text?.[language] || ''}
                            className={`absolute inset-0 w-full h-full object-cover ${
                              isWrongAnswer && wrongShake ? 'qs-explode' : ''
                            }`}
                          />
                        )}

                        {/* Dark gradient overlay at bottom for text */}
                        {hasText && (
                          <div
                            className="absolute inset-x-0 bottom-0 flex items-end justify-center p-2 md:p-3"
                            style={{
                              background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
                              minHeight: '40%',
                            }}
                          >
                            <p
                              className="text-lg md:text-xl lg:text-2xl font-black text-center leading-tight"
                              style={{ color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
                            >
                              {option.text![language]}
                            </p>
                          </div>
                        )}

                        {/* No image fallback — dark bg with text centered */}
                        {!option.image && hasText && (
                          <div
                            className="absolute inset-0 flex items-center justify-center p-3"
                            style={{ background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)` }}
                          >
                            <p
                              className="text-xl md:text-2xl font-black text-center"
                              style={{ color: goldLight, textShadow: `0 0 8px ${gold}33` }}
                            >
                              {option.text![language]}
                            </p>
                          </div>
                        )}

                        {/* Selection badge */}
                        {isSelected && (
                          <div
                            className="absolute top-2 right-2 w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center shadow-xl z-10"
                            style={{
                              background: isCorrect
                                ? 'linear-gradient(135deg, #7cc643, #6ab537)'
                                : 'linear-gradient(135deg, #ff6b6b, #ee5a5a)',
                              border: '3px solid white',
                            }}
                          >
                            <span className="text-white text-base md:text-lg font-bold">
                              {isCorrect ? '✓' : '✗'}
                            </span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            }

            // ---- TEXT-ONLY ANSWERS: full-width stacked pills ----
            return (
              <div className="flex flex-col gap-3 md:gap-3.5 mb-4 md:mb-6">
                {question.options!.map((option) => {
                  const isWrongAnswer = selectedAnswer === option.id && !isCorrect;
                  const isSelected = selectedAnswer === option.id;
                  const isCorrectAnswer = isSelected && isCorrect;

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectAnswer(option.id)}
                      disabled={selectedAnswer !== null}
                      className={`
                        relative w-full rounded-xl overflow-hidden transition-all duration-300
                        ${isSelected
                          ? isCorrect ? 'scale-[1.02]' : 'scale-[0.98]'
                          : selectedAnswer ? 'opacity-40 scale-[0.98]' : 'hover:scale-[1.02] active:scale-[0.98]'
                        }
                        ${isCorrectAnswer ? 'qs-correct-glow' : ''}
                        ${isWrongAnswer ? 'qs-wrong-crack' : ''}
                      `}
                      style={{
                        padding: '14px 20px',
                        border: isSelected
                          ? isCorrect ? '3px solid #7cc643' : '3px solid #ff6b6b'
                          : `3px solid ${gold}33`,
                        background: isSelected
                          ? isCorrect
                            ? 'linear-gradient(135deg, rgba(124,198,67,0.15) 0%, rgba(124,198,67,0.05) 100%)'
                            : 'linear-gradient(135deg, rgba(255,107,107,0.15) 0%, rgba(255,107,107,0.05) 100%)'
                          : `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
                        boxShadow: isSelected
                          ? isCorrect
                            ? '0 0 20px rgba(124,198,67,0.3)'
                            : '0 0 20px rgba(255,107,107,0.3)'
                          : selectedAnswer
                            ? '0 2px 6px rgba(0,0,0,0.15)'
                            : `0 3px 12px rgba(0,0,0,0.25), 0 0 6px ${gold}10`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Option letter badge */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0"
                          style={{
                            background: isSelected
                              ? isCorrect
                                ? 'linear-gradient(135deg, #7cc643, #6ab537)'
                                : 'linear-gradient(135deg, #ff6b6b, #ee5a5a)'
                              : `linear-gradient(135deg, ${gold}, #a67c2e)`,
                            color: isSelected ? 'white' : '#2a1f0e',
                            border: isSelected
                              ? isCorrect ? '2px solid #9ed963' : '2px solid #ff8888'
                              : `2px solid ${goldLight}`,
                          }}
                        >
                          {option.id.toUpperCase()}
                        </div>

                        {/* Answer text */}
                        <p
                          className="text-lg md:text-xl lg:text-2xl font-bold text-left flex-1"
                          style={{
                            color: isSelected
                              ? isCorrect ? '#9ed963' : '#ff8888'
                              : goldLight,
                            textShadow: `0 0 6px ${gold}22`,
                          }}
                        >
                          {option.text?.[language]}
                        </p>

                        {/* Selection indicator */}
                        {isSelected && (
                          <span className="text-xl font-bold flex-shrink-0" style={{ color: isCorrect ? '#7cc643' : '#ff6b6b' }}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* === Drag & Drop Type === */}
          {question.type === 'dragdrop' && question.options && (
            <div className="mb-4 md:mb-6">
              {/* Drop Zone */}
              <div
                className="rounded-2xl p-6 mb-6"
                style={{
                  background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
                  border: `2px solid ${gold}44`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <p
                  className="text-center font-bold mb-4 text-lg"
                  style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}
                >
                  {language === 'en' ? 'Drag the correct answer here' : language === 'ms' ? 'Seret jawapan yang betul ke sini' : '将正确答案拖到这里'}
                </p>
                <div
                  onDragOver={(e) => { e.preventDefault(); if (!selectedAnswer) setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    if (draggedItem && !selectedAnswer) handleSelectAnswer(draggedItem);
                  }}
                  className="min-h-40 rounded-xl flex items-center justify-center transition-all"
                  style={{
                    border: selectedAnswer
                      ? '4px solid #7cc64388'
                      : isDraggingOver
                        ? `4px solid ${gold}`
                        : `4px dashed ${gold}44`,
                    background: selectedAnswer
                      ? 'rgba(124,198,67,0.08)'
                      : isDraggingOver
                        ? `${gold}15`
                        : 'rgba(10,10,18,0.3)',
                    transform: isDraggingOver ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isDraggingOver ? `0 0 30px ${gold}33` : 'none',
                  }}
                >
                  {selectedAnswer ? (
                    <div className="text-center p-4">
                      {question.options.find(o => o.id === selectedAnswer)?.image && (
                        <ImageWithFallback
                          src={question.options.find(o => o.id === selectedAnswer)!.image!}
                          alt=""
                          className="w-32 h-32 object-contain mx-auto mb-2"
                        />
                      )}
                      <p className="text-4xl font-black" style={{ color: goldLight }}>
                        {question.options.find(o => o.id === selectedAnswer)?.text?.[language]}
                      </p>
                      {isCorrect !== null && (
                        <div className="text-6xl mt-4">
                          {isCorrect ? '✅' : '❌'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-6xl mb-2">{isDraggingOver ? '✋' : '👇'}</div>
                      <p className="text-lg font-bold" style={{ color: `${parchment}88` }}>
                        {isDraggingOver
                          ? (language === 'en' ? 'Drop here!' : language === 'ms' ? 'Lepaskan di sini!' : '放在这里！')
                          : (language === 'en' ? 'Drag an answer here' : language === 'ms' ? 'Seret jawapan ke sini' : '将答案拖到这里')
                        }
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Draggable Options */}
              <div className="grid grid-cols-2 gap-3">
                {question.options.map((option) => (
                  <div
                    key={option.id}
                    draggable={!selectedAnswer}
                    onDragStart={(e) => { setDraggedItem(option.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDraggedItem(null); setIsDraggingOver(false); }}
                    onClick={() => !selectedAnswer && handleSelectAnswer(option.id)}
                    className={`
                      p-6 rounded-xl transition-all
                      ${selectedAnswer === option.id
                        ? 'opacity-30 scale-90 cursor-not-allowed'
                        : selectedAnswer
                          ? 'opacity-50 cursor-not-allowed'
                          : draggedItem === option.id
                            ? 'scale-95 opacity-50 cursor-grabbing'
                            : 'cursor-grab hover:scale-105 active:scale-95'
                      }
                    `}
                    style={{
                      background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
                      border: draggedItem === option.id
                        ? `3px solid ${gold}`
                        : `3px solid ${gold}33`,
                      boxShadow: draggedItem === option.id
                        ? `0 0 20px ${gold}33`
                        : '0 4px 16px rgba(0,0,0,0.3)',
                    }}
                  >
                    {option.image && (
                      <ImageWithFallback
                        src={option.image}
                        alt=""
                        className="w-full h-24 object-contain mb-2 pointer-events-none"
                      />
                    )}
                    <p
                      className="text-2xl font-black text-center pointer-events-none select-none"
                      style={{ color: goldLight }}
                    >
                      {option.text?.[language]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === Hotspot Type === */}
          {question.type === 'hotspot' && question.hotspotImage && question.options && (
            <div className="mb-4 md:mb-6">
              <div
                className="rounded-2xl p-6"
                style={{
                  background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
                  border: `2px solid ${gold}44`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <p
                  className="text-center font-bold mb-6 text-lg"
                  style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}
                >
                  {language === 'en' ? '👆 Tap on the correct part' : language === 'ms' ? '👆 Ketik bahagian yang betul' : '👆 点击正确的部分'}
                </p>

                <div className="relative max-w-2xl mx-auto">
                  <ImageWithFallback
                    src={question.hotspotImage}
                    alt="Hotspot Question"
                    className="w-full h-auto rounded-xl"
                    style={{ border: `2px solid ${gold}33` }}
                  />

                  {question.options.map((option) => {
                    const isSelected = selectedAnswer === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => !selectedAnswer && handleSelectAnswer(option.id)}
                        disabled={selectedAnswer !== null}
                        style={{
                          position: 'absolute',
                          left: `${option.position?.x || 0}%`,
                          top: `${option.position?.y || 0}%`,
                          width: `${option.position?.width || 15}%`,
                          height: `${option.position?.height || 15}%`,
                        }}
                        className={`
                          rounded-full transition-all
                          ${isSelected
                            ? isCorrect
                              ? 'bg-[#7cc643]/40 border-4 border-[#7cc643] ring-8 ring-[#7cc643]/50 scale-110'
                              : 'bg-[#ff6b6b]/40 border-4 border-[#ff6b6b] ring-8 ring-[#ff6b6b]/50'
                            : selectedAnswer
                              ? 'bg-transparent border-2 border-transparent'
                              : 'border-3 hover:scale-105'
                          }
                        `}
                        {...(!selectedAnswer && !isSelected ? {
                          style: {
                            position: 'absolute' as const,
                            left: `${option.position?.x || 0}%`,
                            top: `${option.position?.y || 0}%`,
                            width: `${option.position?.width || 15}%`,
                            height: `${option.position?.height || 15}%`,
                            background: `${gold}20`,
                            border: `3px solid ${gold}55`,
                          }
                        } : {})}
                      >
                        {isSelected && (
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 text-7xl animate-bounce">
                            {isCorrect ? '✅' : '❌'}
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {!selectedAnswer && (
                    <div
                      className="absolute bottom-3 right-3 text-sm px-3 py-2 rounded-full"
                      style={{ background: 'rgba(10,10,18,0.9)', color: parchment, border: `1px solid ${gold}33` }}
                    >
                      👆 {language === 'en' ? 'Tap the correct area' : language === 'ms' ? 'Ketik kawasan yang betul' : '点击正确区域'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* === Sequence Type === */}
          {question.type === 'sequence' && question.options && sequenceOrder.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div
                className={`rounded-2xl p-6 ${wrongShake && sequenceSubmitted && !isCorrect ? 'qs-shake' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${darkBg} 0%, rgba(20,16,10,0.95) 100%)`,
                  border: `2px solid ${gold}44`,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <p
                  className="text-center font-bold mb-4 text-sm md:text-base whitespace-nowrap"
                  style={{ color: gold, fontFamily: "'Cinzel Decorative', serif" }}
                >
                  {language === 'en' ? '🔀 Tap arrows or drag to reorder' : language === 'ms' ? '🔀 Ketik anak panah atau seret untuk susun' : '🔀 点击箭头或拖动排序'}
                </p>

                <div className="space-y-3">
                  {sequenceOrder.map((optionId, index) => {
                    const option = question.options!.find(opt => opt.id === optionId);
                    if (!option) return null;

                    const correctOrder = question.correctAnswer.split(',');
                    const isItemCorrect = optionId === correctOrder[index];

                    return (
                      <div
                        key={optionId}
                        draggable={!sequenceSubmitted}
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDraggedItem(index.toString()); }}
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedIdx = parseInt(draggedItem || '-1');
                          if (draggedIdx !== -1 && draggedIdx !== index) moveSequenceItem(draggedIdx, index);
                          setDraggedItem(null);
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                        className={`
                          relative rounded-xl p-4 flex items-center gap-4 transition-all duration-200
                          ${sequenceSubmitted
                            ? 'cursor-not-allowed'
                            : draggedItem === index.toString()
                              ? 'opacity-50 scale-95 cursor-grabbing'
                              : 'cursor-grab hover:scale-[1.02]'
                          }
                        `}
                        style={{
                          background: darkBgLight,
                          border: sequenceSubmitted
                            ? isItemCorrect
                              ? '3px solid #7cc643'
                              : '3px solid #ff6b6b'
                            : `3px solid ${gold}33`,
                          boxShadow: sequenceSubmitted
                            ? isItemCorrect
                              ? '0 0 15px rgba(124,198,67,0.2)'
                              : '0 0 15px rgba(255,107,107,0.2)'
                            : '0 4px 12px rgba(0,0,0,0.2)',
                        }}
                      >
                        {/* Drag handle */}
                        <div className="flex items-center gap-2">
                          {!sequenceSubmitted && <div className="text-2xl cursor-grab" style={{ color: `${gold}66` }}>⋮⋮</div>}
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                            style={{
                              background: sequenceSubmitted
                                ? isItemCorrect
                                  ? 'linear-gradient(135deg, #7cc643, #6ab537)'
                                  : 'linear-gradient(135deg, #ff6b6b, #ee5a5a)'
                                : `linear-gradient(135deg, ${gold}, #a67c2e)`,
                              color: sequenceSubmitted ? 'white' : '#2a1f0e',
                              border: sequenceSubmitted
                                ? isItemCorrect ? '2px solid #9ed963' : '2px solid #ff8888'
                                : `2px solid ${goldLight}`,
                            }}
                          >
                            {index + 1}
                          </div>
                        </div>

                        {/* Option content */}
                        <div className="flex-1 min-w-0">
                          {option.image && (
                            <ImageWithFallback
                              src={option.image}
                              alt=""
                              className="w-20 h-20 object-contain mb-2"
                            />
                          )}
                          <p className="text-xl font-bold text-left" style={{ color: goldLight }}>
                            {option.text?.[language]}
                          </p>
                        </div>

                        {/* Status indicator */}
                        {sequenceSubmitted && (
                          <div className="text-3xl">
                            {isItemCorrect ? '✅' : '❌'}
                          </div>
                        )}

                        {/* Up/Down arrow buttons for mobile reorder */}
                        {!sequenceSubmitted && (
                          <div className="flex flex-col gap-1 ml-auto shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={(e) => { e.stopPropagation(); moveSequenceItem(index, index - 1); }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-20"
                              style={{
                                background: index === 0 ? 'transparent' : `${gold}22`,
                                border: `2px solid ${gold}${index === 0 ? '15' : '55'}`,
                              }}
                              aria-label="Move up"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3L13 9H3L8 3Z" fill={index === 0 ? `${gold}33` : gold} />
                              </svg>
                            </button>
                            <button
                              type="button"
                              disabled={index === sequenceOrder.length - 1}
                              onClick={(e) => { e.stopPropagation(); moveSequenceItem(index, index + 1); }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all disabled:opacity-20"
                              style={{
                                background: index === sequenceOrder.length - 1 ? 'transparent' : `${gold}22`,
                                border: `2px solid ${gold}${index === sequenceOrder.length - 1 ? '15' : '55'}`,
                              }}
                              aria-label="Move down"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 13L3 7H13L8 13Z" fill={index === sequenceOrder.length - 1 ? `${gold}33` : gold} />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Submit Button */}
                {!sequenceSubmitted && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={handleSequenceSubmit}
                      className="px-8 py-4 rounded-xl text-lg font-black uppercase tracking-wider
                                hover:scale-105 active:scale-95 transition-all"
                      style={{
                        fontFamily: "'Cinzel Decorative', serif",
                        background: `linear-gradient(135deg, ${gold} 0%, #f0d078 50%, ${gold} 100%)`,
                        color: '#2a1f0e',
                        border: `3px solid ${goldLight}`,
                        boxShadow: `0 4px 20px ${gold}44`,
                        textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                      }}
                    >
                      {language === 'en' ? '✓ Check Answer' : language === 'ms' ? '✓ Semak Jawapan' : '✓ 检查答案'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Next Button — golden fantasy */}
        {selectedAnswer && (
          <div className="px-4 md:px-6 pb-6 md:pb-8">
            <button
              onClick={handleNext}
              className="relative w-full px-8 py-4 rounded-xl text-lg font-black uppercase tracking-wider
                        active:translate-y-1 transition-all duration-150 overflow-hidden group"
              style={{
                fontFamily: "'Cinzel Decorative', serif",
                background: `linear-gradient(135deg, ${gold} 0%, #f0d078 30%, ${goldLight} 50%, #f0d078 70%, ${gold} 100%)`,
                color: '#2a1f0e',
                border: `4px solid ${goldLight}`,
                boxShadow: `0 6px 0 #a67c2e, 0 0 30px ${gold}55`,
                textShadow: '0 1px 0 rgba(255,255,255,0.4)',
              }}
            >
              {/* Shimmer effect */}
              <span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                style={{ backgroundSize: '200% 100%', animation: 'qs-shimmer 2s infinite' }}
              />

              {/* Circular progress ring — pure CSS animation, no JS state updates */}
              <svg className="absolute top-1/2 left-4 -translate-y-1/2 w-8 h-8 -rotate-90">
                <circle cx="16" cy="16" r="14" stroke="rgba(42,31,14,0.3)" strokeWidth="3" fill="none" />
                <circle
                  key={progressKey}
                  cx="16" cy="16" r="14"
                  stroke="#2a1f0e"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="87.96"
                  strokeDashoffset="87.96"
                  className="qs-progress-ring"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(42,31,14,0.5))' }}
                />
              </svg>

              {/* Button text */}
              <span className="relative z-10 ml-8">
                {language === 'en' ? 'Next' : language === 'ms' ? 'Seterusnya' : '下一个'} →
              </span>
            </button>

            {/* Auto-advance hint */}
            <p className="text-center text-xs mt-2" style={{ color: `${parchment}88` }}>
              {language === 'en'
                ? 'Auto-advancing in 3 seconds...'
                : language === 'ms'
                  ? 'Meneruskan secara automatik dalam 3 saat...'
                  : '3秒后自动前进...'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <FantasyFooter hideLinks />
    </div>
  );
};