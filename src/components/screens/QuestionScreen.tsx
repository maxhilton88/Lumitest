import React, { useState, useEffect } from 'react';
import { GlossyButton } from '../GlossyButton';
import { VoiceButton } from '../VoiceButton';
import { FoxyCharacter } from '../FoxyCharacter';
import { ProgressBar } from '../ProgressBar';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Confetti } from '../Confetti';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

export interface Question {
  id: string;
  type: 'mcq' | 'dragdrop' | 'hotspot' | 'matching' | 'sequence';
  question: {
    en: string;
    ms: string;
    zh: string;
  };
  options?: Array<{
    id: string;
    text?: { en: string; ms: string; zh: string };
    image?: string;
    position?: { x: number; y: number; width: number; height: number }; // For hotspot areas
  }>;
  correctAnswer: string;
  foxyMessage?: {
    en: string;
    ms: string;
    zh: string;
  };
  hotspotImage?: string; // Main image for hotspot questions
}

interface QuestionScreenProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answerId: string) => void;
  onNext: () => void;
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
  brandingSettings
}) => {
  const { language, t } = useLanguage();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const [progress, setProgress] = useState(0);
  const { playCorrectSound, playWrongSound } = useSoundEffects();
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  // For sequence questions - track the order
  const [sequenceOrder, setSequenceOrder] = useState<string[]>([]);
  const [sequenceSubmitted, setSequenceSubmitted] = useState(false);

  // Initialize sequence order when question loads
  useEffect(() => {
    if (question.type === 'sequence' && question.options) {
      // Shuffle the options for the sequence question
      const shuffled = [...question.options].sort(() => Math.random() - 0.5);
      setSequenceOrder(shuffled.map(opt => opt.id));
      setSequenceSubmitted(false);
    }
  }, [question.id]);

  // Auto-advance timer - 3 seconds
  useEffect(() => {
    if (selectedAnswer) {
      setProgress(0);
      const timer = setTimeout(() => {
        handleNext();
      }, 3000);

      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + (100 / 30), 100));
      }, 100);

      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    }
  }, [selectedAnswer]);

  // Auto-play question audio when question loads
  useEffect(() => {
    const playQuestionAudio = () => {
      if ('speechSynthesis' in window) {
        const questionText = question.question[language];
        const utterance = new SpeechSynthesisUtterance(questionText);
        
        // Map languages to speech synthesis voices
        const languageMap = {
          en: 'en-US',
          ms: 'ms-MY',
          zh: 'zh-CN'
        };
        
        utterance.lang = languageMap[language];
        utterance.rate = 0.9;
        utterance.pitch = 1.1;
        
        window.speechSynthesis.cancel(); // Cancel any ongoing speech
        
        // Small delay to ensure smooth playback
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 300);
      }
    };

    playQuestionAudio();

    // Cleanup: cancel speech when component unmounts
    return () => {
      window.speechSynthesis.cancel();
    };
  }, [question.id, language]); // Re-run when question changes or language changes

  const handleSelectAnswer = (answerId: string) => {
    setSelectedAnswer(answerId);
    const correct = answerId === question.correctAnswer;
    setIsCorrect(correct);
    onAnswer(answerId);

    if (correct) {
      // Correct answer: play success sound and show confetti
      playCorrectSound();
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else {
      // Wrong answer: play boom sound and shake
      playWrongSound();
      setWrongShake(true);
      setTimeout(() => setWrongShake(false), 600);
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setShowConfetti(false);
    setWrongShake(false);
    setSequenceOrder([]);
    setSequenceSubmitted(false);
    onNext();
  };

  const handleSequenceSubmit = () => {
    if (question.type === 'sequence' && question.options) {
      // Check if the entire sequence is correct
      const correctOrder = question.correctAnswer.split(','); // e.g., "a,b,c,d"
      const isSequenceCorrect = sequenceOrder.every((id, idx) => id === correctOrder[idx]);
      
      setSelectedAnswer(isSequenceCorrect ? 'correct' : 'wrong');
      setIsCorrect(isSequenceCorrect);
      setSequenceSubmitted(true);
      onAnswer(sequenceOrder.join(','));

      if (isSequenceCorrect) {
        playCorrectSound();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
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

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Confetti effect for correct answers */}
      <Confetti isActive={showConfetti} />

      {/* Forest background with overlay */}
      <div className="absolute inset-0">
        <img
          src={forestBackground}
          alt="Forest Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/40" />
        {/* Decorative forest silhouettes */}
        <div className="absolute bottom-0 left-0 w-48 h-48 md:w-64 md:h-64 bg-[#2d5f3f] rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 right-0 w-48 h-48 md:w-64 md:h-64 bg-[#3d7c54] rounded-full blur-3xl opacity-30" />
        <div className="absolute top-0 left-1/4 w-32 h-32 md:w-48 md:h-48 bg-white rounded-full blur-2xl opacity-20" />
      </div>

      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-4xl mx-auto w-full">
        {/* Progress Bar */}
        <ProgressBar current={questionNumber} total={totalQuestions} />

        {/* Foxy Character */}
        <div className="px-4 md:px-6 pt-4">
          <FoxyCharacter 
            size="md"
            message={question.foxyMessage?.[language] || question.question[language]}
          />
        </div>

        {/* Question Section */}
        <div className="flex-1 flex flex-col px-4 md:px-6 py-4 md:py-6">
          {/* Question text with voice button */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-4 md:p-6 shadow-xl border-4 border-white mb-4 md:mb-6">
            <div className="flex items-start gap-3 md:gap-4">
              <VoiceButton 
                text={question.question[language]} 
                language={language} 
              />
              <div className="flex-1">
                <p className="text-lg md:text-xl lg:text-2xl font-bold text-[#2d5f3f] leading-relaxed">
                  {question.question[language]}
                </p>
              </div>
            </div>
          </div>

          {/* Answer Options - Different types */}
          {question.type === 'mcq' && question.options && (
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6 mb-4 md:mb-6">
              {question.options.map((option) => {
                const isWrongAnswer = selectedAnswer === option.id && !isCorrect;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelectAnswer(option.id)}
                    disabled={selectedAnswer !== null}
                    className={`
                      relative
                      aspect-square
                      rounded-2xl md:rounded-3xl
                      overflow-hidden
                      transition-all
                      duration-300
                      border-4
                      ${selectedAnswer === option.id
                        ? isCorrect
                          ? 'border-[#7cc643] scale-105 shadow-2xl'
                          : 'border-[#ff6b6b] scale-95'
                        : selectedAnswer
                          ? 'opacity-50 scale-95 border-white'
                          : 'hover:scale-105 active:scale-95 border-white shadow-lg'
                      }
                      ${isWrongAnswer && wrongShake ? 'animate-shake' : ''}
                    `}
                  >
                    {/* Option content */}
                    <div 
                      className={`
                        absolute inset-0 bg-white p-3 md:p-4 flex flex-col items-center justify-center
                        ${isWrongAnswer && wrongShake ? 'animate-explode' : ''}
                      `}
                    >
                      {option.image && (
                        <ImageWithFallback
                          src={option.image}
                          alt={option.text?.[language] || ''}
                          className="w-full h-full object-contain"
                        />
                      )}
                      {option.text && (
                        <p className="text-2xl md:text-3xl lg:text-4xl font-black text-[#2d5f3f] mt-2 text-center">
                          {option.text[language]}
                        </p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    {selectedAnswer === option.id && (
                      <div className="absolute top-2 right-2 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white flex items-center justify-center shadow-xl border-4 border-white">
                        <span className="text-2xl md:text-3xl">
                          {isCorrect ? '✅' : '❌'}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Drag & Drop Type */}
          {question.type === 'dragdrop' && question.options && (
            <div className="mb-4 md:mb-6">
              {/* Drop Zone */}
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border-4 border-white mb-6">
                <p className="text-center text-[#2d5f3f] font-bold mb-4 text-xl">
                  {language === 'en' ? 'Drag the correct answer here' : language === 'ms' ? 'Seret jawapan yang betul ke sini' : '将正确答案拖到这里'}
                </p>
                <div 
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!selectedAnswer) setIsDraggingOver(true);
                  }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    if (draggedItem && !selectedAnswer) {
                      handleSelectAnswer(draggedItem);
                    }
                  }}
                  className={`
                    min-h-40 rounded-2xl flex items-center justify-center transition-all
                    ${selectedAnswer 
                      ? 'border-4 border-solid border-[#7cc643] bg-[#7cc643]/10' 
                      : isDraggingOver
                      ? 'border-4 border-solid border-[#7cc643] bg-[#7cc643]/20 scale-105'
                      : 'border-4 border-dashed border-[#7cc643]/40 bg-[#7cc643]/5'
                    }
                  `}
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
                      <p className="text-4xl font-black text-[#2d5f3f]">
                        {question.options.find(o => o.id === selectedAnswer)?.text?.[language]}
                      </p>
                      {selectedAnswer && isCorrect !== null && (
                        <div className="text-6xl mt-4">
                          {isCorrect ? '✅' : '❌'}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-6xl mb-2">{isDraggingOver ? '✋' : '👇'}</div>
                      <p className="text-gray-400 text-lg font-bold">
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
                    onDragStart={(e) => {
                      setDraggedItem(option.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setIsDraggingOver(false);
                    }}
                    onClick={() => !selectedAnswer && handleSelectAnswer(option.id)}
                    className={`
                      p-6 rounded-2xl border-4 bg-white transition-all cursor-grab active:cursor-grabbing
                      ${selectedAnswer === option.id 
                        ? 'opacity-30 scale-90 border-gray-300 cursor-not-allowed' 
                        : selectedAnswer
                          ? 'opacity-50 border-gray-300 cursor-not-allowed'
                          : draggedItem === option.id
                          ? 'scale-95 opacity-50 border-[#7cc643]'
                          : 'hover:scale-105 active:scale-95 border-white shadow-lg hover:border-[#7cc643]'
                      }
                    `}
                  >
                    {option.image && (
                      <ImageWithFallback
                        src={option.image}
                        alt=""
                        className="w-full h-24 object-contain mb-2 pointer-events-none"
                      />
                    )}
                    <p className="text-2xl font-black text-[#2d5f3f] text-center pointer-events-none select-none">
                      {option.text?.[language]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hotspot Type */}
          {question.type === 'hotspot' && question.hotspotImage && question.options && (
            <div className="mb-4 md:mb-6">
              <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 border-4 border-white">
                <p className="text-center text-[#2d5f3f] font-bold mb-6 text-xl">
                  {language === 'en' ? '👆 Tap on the correct part' : language === 'ms' ? '👆 Ketik bahagian yang betul' : '👆 点击正确的部分'}
                </p>
                
                {/* Main Image with Clickable Hotspot Areas */}
                <div className="relative max-w-2xl mx-auto">
                  <ImageWithFallback
                    src={question.hotspotImage}
                    alt="Hotspot Question"
                    className="w-full h-auto rounded-2xl"
                  />
                  
                  {/* Clickable Hotspot Areas */}
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
                              : 'bg-blue-500/20 border-3 border-blue-500/40 hover:bg-blue-500/40 hover:border-blue-500 hover:ring-4 hover:ring-blue-500/50 hover:scale-105'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 text-7xl animate-bounce">
                            {isCorrect ? '✅' : '❌'}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Hint overlay */}
                  {!selectedAnswer && (
                    <div className="absolute bottom-3 right-3 bg-black/70 text-white text-sm px-3 py-2 rounded-full backdrop-blur-sm">
                      👆 {language === 'en' ? 'Tap the correct area' : language === 'ms' ? 'Ketik kawasan yang betul' : '点击正确区域'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sequence Type */}
          {question.type === 'sequence' && question.options && sequenceOrder.length > 0 && (
            <div className="mb-4 md:mb-6">
              <div className={`bg-white/95 backdrop-blur-md rounded-3xl p-6 border-4 border-white ${wrongShake && sequenceSubmitted && !isCorrect ? 'animate-shake' : ''}`}>
                <p className="text-center text-[#2d5f3f] font-bold mb-4 text-lg">
                  {language === 'en' ? '🔀 Drag to arrange in the correct order' : language === 'ms' ? '🔀 Seret untuk susun mengikut urutan yang betul' : '🔀 拖动以按正确顺序排列'}
                </p>
                
                {/* Draggable sequence items */}
                <div className="space-y-3">
                  {sequenceOrder.map((optionId, index) => {
                    const option = question.options!.find(opt => opt.id === optionId);
                    if (!option) return null;
                    
                    // Check if this specific item is in the correct position
                    const correctOrder = question.correctAnswer.split(',');
                    const isItemCorrect = optionId === correctOrder[index];
                    
                    return (
                      <div
                        key={optionId}
                        draggable={!sequenceSubmitted}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedItem(index.toString());
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const draggedIdx = parseInt(draggedItem || '-1');
                          if (draggedIdx !== -1 && draggedIdx !== index) {
                            moveSequenceItem(draggedIdx, index);
                          }
                          setDraggedItem(null);
                        }}
                        onDragEnd={() => setDraggedItem(null)}
                        className={`
                          relative bg-white/80 backdrop-blur-sm rounded-2xl p-4 
                          border-4 transition-all duration-200
                          flex items-center gap-4
                          ${sequenceSubmitted
                            ? 'cursor-not-allowed'
                            : draggedItem === index.toString()
                            ? 'opacity-50 scale-95 cursor-grabbing'
                            : 'cursor-grab hover:scale-102 hover:border-[#7cc643] shadow-lg'
                          }
                          ${sequenceSubmitted && isItemCorrect
                            ? 'border-[#7cc643] bg-[#7cc643]/10'
                            : sequenceSubmitted && !isItemCorrect
                            ? 'border-[#ff6b6b] bg-[#ff6b6b]/10'
                            : 'border-white'}
                        `}
                      >
                        {/* Drag handle */}
                        <div className="flex items-center gap-2">
                          {!sequenceSubmitted && <div className="text-2xl cursor-grab">⋮⋮</div>}
                          <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-black ${
                            sequenceSubmitted && isItemCorrect 
                              ? 'bg-[#7cc643]' 
                              : sequenceSubmitted && !isItemCorrect 
                              ? 'bg-[#ff6b6b]' 
                              : 'bg-[#7cc643]'
                          }`}>
                            {index + 1}
                          </div>
                        </div>
                        
                        {/* Option content */}
                        <div className="flex-1">
                          {option.image && (
                            <ImageWithFallback
                              src={option.image}
                              alt=""
                              className="w-20 h-20 object-contain mb-2"
                            />
                          )}
                          <p className="text-xl font-bold text-[#2d5f3f] text-left">
                            {option.text?.[language]}
                          </p>
                        </div>

                        {/* Status indicator (after submit) */}
                        {sequenceSubmitted && (
                          <div className="text-3xl">
                            {isItemCorrect ? '✅' : '❌'}
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
                      className="px-8 py-4 rounded-2xl text-lg font-black uppercase
                                bg-gradient-to-r from-[#7cc643] to-[#6ab537]
                                text-white shadow-lg border-4 border-[#9ed963]
                                hover:scale-105 active:scale-95 transition-all"
                    >
                      {language === 'en' ? '✓ Check Answer' : language === 'ms' ? '✓ Semak Jawapan' : '✓ 检查答案'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
              20%, 40%, 60%, 80% { transform: translateX(10px); }
            }
            @keyframes explode {
              0% { transform: scale(1) rotate(0deg); opacity: 1; }
              50% { transform: scale(0.9) rotate(-2deg); opacity: 0.8; }
              100% { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            .animate-shake {
              animation: shake 0.6s ease-in-out;
            }
            .animate-explode {
              animation: explode 0.6s ease-in-out;
            }
          `}</style>
        </div>

        {/* Next Button */}
        {selectedAnswer && (
          <div className="px-4 md:px-6 pb-6 md:pb-8">
            <button
              onClick={handleNext}
              className="relative w-full px-8 py-4 rounded-2xl text-lg font-black uppercase tracking-wide
                        bg-gradient-to-r from-[#7cc643] to-[#6ab537]
                        text-white
                        shadow-[0_6px_0_#5a9431,0_0_30px_rgba(124,198,67,0.5)]
                        hover:shadow-[0_4px_0_#5a9431,0_0_40px_rgba(124,198,67,0.7)]
                        active:translate-y-1
                        active:shadow-[0_3px_0_#5a9431,0_0_20px_rgba(124,198,67,0.4)]
                        transition-all duration-150
                        border-4 border-[#9ed963]
                        overflow-hidden
                        group"
            >
              {/* Magical sparkle background */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" 
                    style={{
                      backgroundSize: '200% 100%',
                      animation: 'shimmer 2s infinite'
                    }} />
              
              {/* Circular progress ring */}
              <svg className="absolute top-1/2 left-4 -translate-y-1/2 w-8 h-8 -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="3"
                  fill="none"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  stroke="white"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="87.96"
                  strokeDashoffset={87.96 - (87.96 * progress) / 100}
                  className="transition-all duration-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                />
              </svg>

              {/* Button text */}
              <span className="relative z-10 ml-8">
                {language === 'en' ? 'Next' : language === 'ms' ? 'Seterusnya' : '下一个'} →
              </span>

              {/* Sparkles */}
              <span className="absolute top-2 right-2 text-xl animate-pulse">✨</span>
              <span className="absolute bottom-2 right-8 text-lg animate-bounce" style={{ animationDelay: '0.2s' }}>⭐</span>
            </button>

            <style>{`
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            `}</style>

            {/* Auto-advance hint */}
            <p className="text-center text-white/70 text-xs mt-2">
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
      <div className="absolute bottom-2 left-0 right-0 z-10 text-center text-white text-xs md:text-sm">
        <p>
          <a 
            href="https://projectlumi.org/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-[#c6ff00] transition-colors"
          >
            © Project Lumi
          </a>
          {' . All Rights Reserved.'}
        </p>
      </div>
    </div>
  );
};