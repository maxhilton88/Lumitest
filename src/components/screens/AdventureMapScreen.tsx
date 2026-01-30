import React from 'react';
import mapBackground from 'figma:asset/6159593dc1e129bc0f365325080d4c6d97363b06.png';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';

interface AdventureMapScreenProps {
  age: number;
  includeMandarinTest: boolean;
  onModuleSelect: (moduleId: string) => void;
  completedModules: string[];
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

export const AdventureMapScreen: React.FC<AdventureMapScreenProps> = ({
  age,
  includeMandarinTest,
  onModuleSelect,
  completedModules,
  brandingSettings
}) => {
  const { language } = useLanguage();

  const modules = [
    {
      id: 'english',
      name: {
        en: 'English Forest',
        ms: 'Hutan Bahasa Inggeris',
        zh: '英语森林'
      },
      subtitle: {
        en: 'Language & Literacy',
        ms: 'Bahasa & Literasi',
        zh: '语言与读写'
      },
      icon: '🌳',
      color: '#7cc643',
      position: { top: '70%', left: '25%' }
    },
    {
      id: 'numbers',
      name: {
        en: 'Numbers Island',
        ms: 'Pulau Nombor',
        zh: '数字岛'
      },
      subtitle: {
        en: 'Mathematics',
        ms: 'Matematik',
        zh: '数学'
      },
      icon: '🔢',
      color: '#4a90e2',
      position: { top: '50%', left: '50%' }
    },
    {
      id: 'bahasamalaysia',
      name: {
        en: 'Rimba Bahasa',
        ms: 'Rimba Bahasa',
        zh: '马来语丛林'
      },
      subtitle: {
        en: 'Bahasa Malaysia',
        ms: 'Bahasa Malaysia',
        zh: '马来语'
      },
      icon: '🇲🇾',
      color: '#e74c3c',
      position: { top: '35%', left: '70%' }
    },
    {
      id: 'mandarin',
      name: {
        en: 'Mandarin Mountain',
        ms: 'Gunung Mandarin',
        zh: '华语山'
      },
      subtitle: {
        en: 'Chinese Language',
        ms: 'Bahasa Cina',
        zh: '华语'
      },
      icon: '🏔️',
      color: '#f39c12',
      position: { top: '25%', left: '30%' },
      locked: !includeMandarinTest
    },
    {
      id: 'science',
      name: {
        en: 'Mystery Jungle',
        ms: 'Hutan Misteri',
        zh: '神秘丛林'
      },
      subtitle: {
        en: 'Science & Discovery',
        ms: 'Sains & Penemuan',
        zh: '科学与探索'
      },
      icon: '🔬',
      color: '#9b59b6',
      position: { top: '60%', left: '75%' }
    },
    {
      id: 'treasure',
      name: {
        en: 'Treasure Chest',
        ms: 'Peti Harta',
        zh: '宝藏箱'
      },
      subtitle: {
        en: 'Your Results!',
        ms: 'Keputusan Anda!',
        zh: '你的成绩！'
      },
      icon: '🎁',
      color: '#ffd700',
      position: { top: '15%', left: '50%' }
    }
  ];

  const isModuleUnlocked = (moduleIndex: number) => {
    if (moduleIndex === 0) return true; // First module always unlocked
    return completedModules.includes(modules[moduleIndex - 1].id);
  };

  const isModuleActive = (moduleId: string) => {
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    return isModuleUnlocked(moduleIndex) && !completedModules.includes(moduleId);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#87CEEB]">
      {/* Beautiful Map Background with Dark Overlay */}
      <div className="absolute inset-0">
        <img
          src={brandingSettings.mapBackgroundImage || mapBackground}
          alt="Adventure Map"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Foxy Character at Start */}
      <div className="absolute z-10" style={{ top: '75%', left: '15%' }}>
        <div className="relative animate-bounce">
          <div className="text-6xl drop-shadow-2xl">🦊</div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 rounded-full blur-sm" />
        </div>
      </div>

      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>

      {/* Adventure Modules */}
      <div className="relative z-10 h-screen">
        {modules.map((module, index) => {
          const isCompleted = completedModules.includes(module.id);
          const isUnlocked = isModuleUnlocked(index);
          const isActive = isModuleActive(module.id);
          const isLocked = module.locked || !isUnlocked;

          return (
            <button
              key={module.id}
              onClick={() => !isLocked && !isCompleted && onModuleSelect(module.id)}
              disabled={isLocked || isCompleted}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{
                top: module.position.top,
                left: module.position.left,
                filter: isLocked ? 'grayscale(100%)' : 'none',
                opacity: isLocked ? 0.5 : 1
              }}
            >
              {/* Glow effect for active module */}
              {isActive && (
                <div 
                  className="absolute inset-0 rounded-full blur-xl animate-pulse"
                  style={{
                    background: module.color,
                    opacity: 0.6,
                    transform: 'scale(1.5)'
                  }}
                />
              )}

              {/* Module Icon Container */}
              <div className="relative">
                <div
                  className={`
                    w-20 h-20 md:w-24 md:h-24 rounded-full
                    flex items-center justify-center
                    shadow-2xl border-4 border-white
                    transition-all duration-300
                    ${isActive ? 'scale-110 animate-pulse' : ''}
                    ${!isLocked && !isCompleted ? 'hover:scale-125 active:scale-100' : ''}
                  `}
                  style={{
                    background: isLocked 
                      ? 'linear-gradient(135deg, #666 0%, #999 100%)'
                      : `linear-gradient(135deg, ${module.color} 0%, ${module.color}dd 100%)`,
                    boxShadow: isActive 
                      ? `0 8px 32px ${module.color}88, inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.5)`
                      : '0 8px 20px rgba(0,0,0,0.3), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)'
                  }}
                >
                  <span className="text-4xl md:text-5xl drop-shadow-lg">
                    {isLocked ? '🔒' : isCompleted ? '✅' : module.icon}
                  </span>
                </div>

                {/* Locked overlay text */}
                {module.locked && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                    {language === 'en' ? 'Locked' : language === 'ms' ? 'Terkunci' : '已锁定'}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center text-white text-sm drop-shadow-lg">
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