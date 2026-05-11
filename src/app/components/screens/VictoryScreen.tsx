import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { FantasyBackground } from '../FantasyBackground';
import { VictoryBurst } from '../VictoryBurst';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

interface VictoryScreenProps {
  totalStars: number;
  onContinue: () => void;
}

// Inject victory keyframes once
let victoryStylesInjected = false;
function injectVictoryStyles() {
  if (victoryStylesInjected) return;
  victoryStylesInjected = true;
  const style = document.createElement('style');
  style.id = 'victory-screen-css';
  style.textContent = `
@keyframes victory-scale-in{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.15) rotate(3deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes victory-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes victory-star-pop{0%{transform:scale(0) rotate(0);opacity:0}50%{transform:scale(1.3) rotate(180deg);opacity:1}100%{transform:scale(1) rotate(360deg);opacity:1}}
@keyframes victory-glow-pulse{0%,100%{opacity:0.3}50%{opacity:0.7}}
@keyframes victory-confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
@keyframes victory-btn-fade{0%{opacity:0;transform:translateY(20px)}100%{opacity:1;transform:translateY(0)}}
.victory-scale-in{animation:victory-scale-in 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards}
.victory-float{animation:victory-float 3s ease-in-out infinite}
.victory-glow{animation:victory-glow-pulse 2s ease-in-out infinite}
`;
  document.head.appendChild(style);
}

const CONFETTI_PIECES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  left: ((i * 7.3 + 3) % 100),
  delay: (i * 0.15) % 2,
  duration: 3 + (i % 3),
  emoji: ['⭐', '✨', '🌟', '💫', '⭐'][i % 5],
  size: 16 + (i % 3) * 6,
}));

export const VictoryScreen: React.FC<VictoryScreenProps> = ({
  totalStars,
  onContinue,
}) => {
  const { language } = useLanguage();
  const [showButton, setShowButton] = useState(false);
  const [burstActive, setBurstActive] = useState(true);

  useEffect(() => {
    injectVictoryStyles();
    // Show continue button after 4 seconds
    const timer = setTimeout(() => setShowButton(true), 3500);
    // Deactivate burst after animation completes
    const burstTimer = setTimeout(() => setBurstActive(false), 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(burstTimer);
    };
  }, []);

  const title = {
    en: 'QUEST COMPLETE!',
    ms: 'MISI SELESAI!',
    zh: '任务完成！',
  };

  const subtitle = {
    en: 'You are a true hero!',
    ms: 'Kamu seorang wira sejati!',
    zh: '你是真正的英雄！',
  };

  const btnText = {
    en: 'See Your Results',
    ms: 'Lihat Keputusan',
    zh: '查看成绩',
  };

  const lang = language as 'en' | 'ms' | 'zh';

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col items-center justify-center">
      {/* Fantasy background */}
      <FantasyBackground bgImage={forestBackground} overlayOpacity={0.7} />

      {/* Victory burst animation */}
      <VictoryBurst isActive={burstActive} />

      {/* Golden glow behind center */}
      <div
        className="absolute victory-glow"
        style={{
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,164,74,0.35) 0%, rgba(212,164,74,0.1) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 6,
        }}
      />

      {/* Confetti / falling stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[7]">
        {CONFETTI_PIECES.map((c) => (
          <div
            key={c.id}
            className="absolute"
            style={{
              left: `${c.left}%`,
              top: '-30px',
              fontSize: c.size,
              animation: `victory-confetti ${c.duration}s ease-in ${c.delay}s infinite`,
              opacity: 0.8,
            }}
          >
            {c.emoji}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Title */}
        <div className="victory-scale-in" style={{ animationDelay: '0.4s' }}>
          <h1
            className="text-4xl md:text-6xl font-black tracking-wider"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              background: 'linear-gradient(180deg, #ffeaa7 0%, #d4a44a 40%, #c6872e 70%, #ffeaa7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 20px rgba(212,164,74,0.5)) drop-shadow(0 4px 8px rgba(0,0,0,0.8))',
            }}
          >
            {title[lang]}
          </h1>
        </div>

        {/* Subtitle */}
        <div className="victory-scale-in" style={{ animationDelay: '0.7s' }}>
          <p
            className="text-xl md:text-2xl font-bold"
            style={{
              color: '#ffeaa7',
              textShadow: '0 0 12px rgba(212,164,74,0.4), 0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            {subtitle[lang]}
          </p>
        </div>

        {/* Stars earned */}
        <div
          className="victory-scale-in flex items-center gap-3 mt-2"
          style={{ animationDelay: '1s' }}
        >
          <div
            className="px-6 py-3 rounded-full flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(30,22,12,0.9) 0%, rgba(50,38,20,0.9) 100%)',
              border: '2px solid #d4a44a',
              boxShadow: '0 0 20px rgba(212,164,74,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
          >
            <span className="text-3xl">⭐</span>
            <span
              className="text-2xl md:text-3xl font-black"
              style={{
                color: '#ffeaa7',
                textShadow: '0 0 8px rgba(212,164,74,0.5)',
              }}
            >
              × {totalStars}
            </span>
          </div>
        </div>

        {/* Continue button — fades in after 4s */}
        <div
          className="mt-8"
          style={{
            opacity: showButton ? 1 : 0,
            transform: showButton ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s ease-out',
          }}
        >
          <button
            onClick={onContinue}
            className="group relative px-8 py-4 rounded-full font-black text-lg md:text-xl uppercase tracking-wider transition-all duration-200 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
              color: '#2a1f0e',
              border: '3px solid #ffeaa7',
              boxShadow: '0 0 25px rgba(212,164,74,0.4), 0 6px 0 #a67c2e',
            }}
          >
            <span className="flex items-center gap-2">
              {btnText[lang]}
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};