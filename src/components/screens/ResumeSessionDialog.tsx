import React from 'react';
import { FoxyCharacter } from '../FoxyCharacter';
import { GlossyButton } from '../GlossyButton';
import { useLanguage } from '../LanguageContext';
import { FantasyBackground, FantasyPanel } from '../FantasyBackground';
import { Sparkles, RotateCcw, ArrowLeft } from 'lucide-react';

interface ResumeSessionDialogProps {
  childName: string;
  completedCount: number;
  totalCount: number;
  onResume: () => void;
  onStartFresh: () => void;
  onBack?: () => void;
}

export const ResumeSessionDialog: React.FC<ResumeSessionDialogProps> = ({
  childName,
  completedCount,
  totalCount,
  onResume,
  onStartFresh,
  onBack,
}) => {
  const { language } = useLanguage();

  const messages = {
    en: {
      welcomeBack: 'Welcome Back!',
      remember: `Hey ${childName}! Foxy remembers you!`,
      progress: `You've completed ${completedCount} of ${totalCount} adventures.`,
      continueQ: 'Want to continue where you left off?',
      resume: 'Continue Adventure',
      startFresh: 'Start Over',
    },
    ms: {
      welcomeBack: 'Selamat Kembali!',
      remember: `Hai ${childName}! Foxy ingat kamu!`,
      progress: `Kamu telah selesaikan ${completedCount} daripada ${totalCount} pengembaraan.`,
      continueQ: 'Mahu sambung di tempat terakhir?',
      resume: 'Sambung Pengembaraan',
      startFresh: 'Mula Semula',
    },
    zh: {
      welcomeBack: '欢迎回来！',
      remember: `嗨 ${childName}！小狐狸还记得你！`,
      progress: `你已经完成了 ${totalCount} 个冒险中的 ${completedCount} 个。`,
      continueQ: '要从上次的地方继续吗？',
      resume: '继续冒险',
      startFresh: '重新开始',
    },
  };

  const t = messages[language as keyof typeof messages] || messages.en;

  return (
    <FantasyBackground>
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] px-4 py-8">
        {/* Back Button - Top Left */}
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-4 md:top-6 md:left-6 z-20 group flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(30,22,12,0.7)',
              border: '1.5px solid rgba(212,164,74,0.3)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" style={{ color: '#d4a44a' }} />
            <span
              className="text-xs md:text-sm font-bold hidden sm:inline"
              style={{ color: '#c8b88a', fontFamily: "'Cinzel Decorative', serif" }}
            >
              {language === 'en' ? 'Back' : language === 'ms' ? 'Kembali' : '返回'}
            </span>
          </button>
        )}

        {/* Foxy character */}
        <div className="mb-4">
          <FoxyCharacter size="lg" />
        </div>

        <FantasyPanel className="w-full max-w-sm mx-auto p-6 text-center">
          {/* Welcome back title */}
          <h1 className="text-2xl font-bold text-amber-100 mb-2 drop-shadow-lg">
            {t.welcomeBack}
          </h1>

          {/* Message */}
          <p className="text-amber-200/90 text-sm mb-1">
            {t.remember}
          </p>

          {/* Progress indicator */}
          <div className="my-4 px-2">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              {Array.from({ length: totalCount }).map((_, i) => (
                <div
                  key={i}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < completedCount
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 scale-100'
                      : 'bg-white/10 text-amber-200/40 border border-amber-200/20'
                  }`}
                >
                  {i < completedCount ? '★' : (i + 1)}
                </div>
              ))}
            </div>
            <p className="text-amber-300/80 text-xs">
              {t.progress}
            </p>
          </div>

          <p className="text-amber-200/70 text-sm mb-5">
            {t.continueQ}
          </p>

          {/* Buttons */}
          <div className="space-y-3">
            <GlossyButton
              onClick={onResume}
              className="w-full"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t.resume}
            </GlossyButton>

            <button
              onClick={onStartFresh}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-200/60 hover:text-amber-200 transition-colors rounded-xl hover:bg-white/5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t.startFresh}
            </button>
          </div>
        </FantasyPanel>
      </div>
    </FantasyBackground>
  );
};