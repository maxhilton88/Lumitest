import React from 'react';
import { GlossyButton } from '../GlossyButton';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';
import forestWithFox from 'figma:asset/c69ab2873b937348bf448e37c8e87a0e753b1d7f.png';

interface ChildWelcomePageProps {
  onStartAdventure: () => void;
}

export const ChildWelcomePage: React.FC<ChildWelcomePageProps> = ({ onStartAdventure }) => {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      {/* Full-screen background image WITH FOX */}
      <div className="absolute inset-0">
        <img 
          src={forestWithFox}
          alt="Foxy Adventure Background"
          className="w-full h-full object-cover"
        />
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
        {/* Glow effects */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00d4aa] rounded-full blur-[120px] opacity-20" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00fff5] rounded-full blur-[120px] opacity-15" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-8 max-w-4xl">
        {/* Logo/Brand */}
        <div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black mb-6"
              style={{
                background: 'linear-gradient(135deg, #c6ff00 0%, #00ff88 50%, #00fff5 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 0 40px rgba(198, 255, 0, 0.3)'
              }}>
            FOXY ADVENTURE
          </h1>
        </div>

        {/* Tagline */}
        <div className="space-y-3">
          <p className="text-2xl md:text-3xl lg:text-4xl font-bold text-white text-[32px]">
            {language === 'en' ? 'Is your child ready for Standard 1?' 
              : language === 'ms' ? 'Adakah anak anda bersedia untuk Tahun 1?'
              : '您的孩子准备好上一年级了吗？'}
          </p>
          <p className="text-lg md:text-xl lg:text-2xl text-[rgb(248,252,252)] font-semibold text-[16px] font-bold font-normal font-[Abel]">
            {language === 'en' ? 'Join Foxy on a 5-minute KSSR adventure to find out!'
              : language === 'ms' ? 'Sertai Foxy dalam pengembaraan KSSR selama 5 minit untuk mengetahui!'
              : '加入Foxy，进行5分钟的KSSR冒险，找出答案！'}
          </p>
        </div>

        {/* Language Selector */}
        <div className="pt-4">
          <p className="text-lg md:text-xl font-bold text-white mb-4">
            {language === 'en' ? 'Choose Your Language' 
              : language === 'ms' ? 'Pilih Bahasa Anda' 
              : '选择语言'}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setLanguage('en')}
              className={`
                px-8 py-3 rounded-2xl font-bold transition-all text-lg
                ${language === 'en' 
                  ? 'bg-[#c6ff00] text-[#1a2f2a] shadow-lg scale-105 border-4 border-[#e0ff66]' 
                  : 'bg-white/20 text-white hover:bg-white/30 border-2 border-white/40'}
              `}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('ms')}
              className={`
                px-8 py-3 rounded-2xl font-bold transition-all text-lg
                ${language === 'ms' 
                  ? 'bg-[#c6ff00] text-[#1a2f2a] shadow-lg scale-105 border-4 border-[#e0ff66]' 
                  : 'bg-white/20 text-white hover:bg-white/30 border-2 border-white/40'}
              `}
            >
              B. Melayu
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={`
                px-8 py-3 rounded-2xl font-bold transition-all text-lg
                ${language === 'zh' 
                  ? 'bg-[#c6ff00] text-[#1a2f2a] shadow-lg scale-105 border-4 border-[#e0ff66]' 
                  : 'bg-white/20 text-white hover:bg-white/30 border-2 border-white/40'}
              `}
            >
              中文
            </button>
          </div>
        </div>

        {/* Start Button */}
        <div className="pt-8">
          <button
            onClick={onStartAdventure}
            className="group relative px-16 py-6 rounded-full text-2xl font-black uppercase tracking-wide
                      bg-gradient-to-r from-[#c6ff00] to-[#7cc643] 
                      text-[#1a2f2a] 
                      shadow-[0_8px_0_#5a9431,0_0_40px_rgba(198,255,0,0.6)]
                      hover:shadow-[0_6px_0_#5a9431,0_0_50px_rgba(198,255,0,0.8)]
                      active:translate-y-2
                      active:shadow-[0_4px_0_#5a9431,0_0_30px_rgba(198,255,0,0.5)]
                      transition-all duration-150
                      border-4 border-[#e0ff66]
                      animate-pulse
                      hover:scale-110"
          >
            {language === 'en' ? 'START ADVENTURE'
              : language === 'ms' ? 'MULA PENGEMBARAAN'
              : '开始冒险'}
            
            {/* Glowing ring effect */}
            <span className="absolute inset-0 rounded-full bg-[#c6ff00] opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300"></span>
            
            {/* Sparkle effect */}
            <span className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</span>
          </button>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-8 left-8 text-6xl opacity-30 animate-bounce">🌳</div>
      <div className="absolute bottom-8 right-8 text-6xl opacity-30 animate-pulse">🦊</div>

      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-white text-sm">
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