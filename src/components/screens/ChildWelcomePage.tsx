import React from 'react';
import { useLanguage } from '../LanguageContext';
import { FantasyBackground, GoldOrnament, FantasyTitle, FantasyFooter } from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import forestWithFox from 'figma:asset/c69ab2873b937348bf448e37c8e87a0e753b1d7f.png';

interface ChildWelcomePageProps {
  onStartAdventure: () => void;
}

export const ChildWelcomePage: React.FC<ChildWelcomePageProps> = ({ onStartAdventure }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col items-center justify-center p-4 md:p-8">
      {/* Fantasy background with fox forest image */}
      <FantasyBackground bgImage={forestWithFox} overlayOpacity={0.5} />

      {/* Content */}
      <div className="relative z-10 text-center space-y-4 md:space-y-8 max-w-4xl w-full">
        {/* Top ornament */}
        <GoldOrnament />

        {/* Title — fantasy gold */}
        <div>
          <FantasyTitle size="xl">
            FOXY ADVENTURE
          </FantasyTitle>
        </div>

        {/* Tagline */}
        <div className="space-y-2 md:space-y-3">
          <p
            className="text-lg md:text-2xl lg:text-3xl font-bold leading-snug"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              color: '#ffeaa7',
              textShadow: '0 0 12px rgba(212,164,74,0.3), 0 2px 4px rgba(0,0,0,0.8)',
            }}
          >
            {language === 'en' ? 'Is your child ready for Standard 1?'
              : language === 'ms' ? 'Adakah anak anda bersedia untuk Tahun 1?'
              : '您的孩子准备好上一年级了吗？'}
          </p>
          <p
            className="text-sm md:text-lg lg:text-xl"
            style={{
              color: '#c8b88a',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              letterSpacing: '0.03em',
            }}
          >
            {language === 'en' ? 'Join Foxy on a 5-minute KSSR adventure to find out!'
              : language === 'ms' ? 'Sertai Foxy dalam pengembaraan KSSR selama 5 minit untuk mengetahui!'
              : '加入Foxy，进行5分钟的KSSR冒险，找出答案！'}
          </p>
        </div>

        {/* Ornament divider */}
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-16 md:w-24 bg-gradient-to-r from-transparent to-[#d4a44a]/40" />
          <div className="text-[#d4a44a]/60 text-xs">&#9830;</div>
          <div className="h-px w-16 md:w-24 bg-gradient-to-l from-transparent to-[#d4a44a]/40" />
        </div>

        {/* Language Selector */}
        <div>
          <p
            className="text-sm md:text-lg font-bold mb-3 md:mb-4 tracking-wider uppercase"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              color: '#c8b88a',
              textShadow: '0 0 8px rgba(200,184,138,0.3)',
            }}
          >
            {language === 'en' ? 'Choose Your Language'
              : language === 'ms' ? 'Pilih Bahasa Anda'
              : '选择语言'}
          </p>
          <div className="flex gap-2 md:gap-3 justify-center">
            {([
              { code: 'en' as const, label: 'English' },
              { code: 'ms' as const, label: 'B. Melayu' },
              { code: 'zh' as const, label: '中文' },
            ]).map((lang) => (
              <button
                key={lang.code}
                onClick={() => { playMenuSelect(); setLanguage(lang.code); }}
                className="px-3 md:px-7 py-2.5 md:py-3 rounded-xl font-bold transition-all text-sm md:text-lg flex-1 max-w-[130px] whitespace-nowrap flex items-center justify-center"
                style={
                  language === lang.code
                    ? {
                        fontFamily: "'Cinzel Decorative', serif",
                        background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 50%, #d4a44a 100%)',
                        color: '#2a1f0e',
                        border: '3px solid #ffeaa7',
                        boxShadow: '0 0 20px rgba(212,164,74,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
                        transform: 'scale(1.05)',
                      }
                    : {
                        fontFamily: "'Cinzel Decorative', serif",
                        background: 'rgba(42,31,14,0.6)',
                        color: '#c8b88a',
                        border: '2px solid rgba(212,164,74,0.3)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      }
                }
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button — golden ornate */}
        <div className="pt-2 md:pt-6">
          <button
            onClick={() => { playMenuSelect(); onStartAdventure(); }}
            className="group relative px-10 md:px-16 py-4 md:py-6 rounded-full text-lg md:text-2xl font-black uppercase tracking-wider
                      transition-all duration-200
                      active:translate-y-1
                      hover:scale-105"
            style={{
              fontFamily: "'Cinzel Decorative', serif",
              background: 'linear-gradient(135deg, #d4a44a 0%, #f0d078 30%, #ffeaa7 50%, #f0d078 70%, #d4a44a 100%)',
              color: '#2a1f0e',
              border: '4px solid #ffeaa7',
              boxShadow: '0 8px 0 #a67c2e, 0 0 40px rgba(212,164,74,0.5), 0 0 80px rgba(212,164,74,0.2)',
              textShadow: '0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            {language === 'en' ? 'START ADVENTURE'
              : language === 'ms' ? 'MULA PENGEMBARAAN'
              : '开始冒险'}

            {/* Golden glow ring on hover */}
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-40 transition-opacity duration-300"
              style={{
                background: 'radial-gradient(circle, rgba(255,234,167,0.4) 0%, transparent 70%)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0">
        <FantasyFooter hideLinks />
      </div>
    </div>
  );
};