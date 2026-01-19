import React from 'react';
import { GlossyButton } from '../GlossyButton';
import { LadderComponent } from '../LadderComponent';
import { FoxyCharacter } from '../FoxyCharacter';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';
import { Share2 } from 'lucide-react';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

interface ResultsScreenProps {
  childName: string;
  score: number;
  totalQuestions: number;
  onShare: () => void;
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

export const ResultsScreen: React.FC<ResultsScreenProps> = ({
  childName,
  score,
  totalQuestions,
  onShare,
  brandingSettings
}) => {
  const { language, t } = useLanguage();
  const percentage = Math.round((score / totalQuestions) * 100);

  const getMessage = () => {
    if (percentage >= 80) {
      return language === 'en' 
        ? `${childName} is Advanced and ready to excel!`
        : language === 'ms'
        ? `${childName} cemerlang dan bersedia berjaya!`
        : `${childName}表现优异，准备好大展身手！`;
    }
    if (percentage >= 50) {
      return language === 'en'
        ? `${childName} is ready for Standard 1!`
        : language === 'ms'
        ? `${childName} bersedia untuk Tahun 1!`
        : `${childName}已准备好上一年级！`;
    }
    return language === 'en'
      ? `${childName} is developing well! Keep practicing!`
      : language === 'ms'
      ? `${childName} sedang berkembang dengan baik! Teruskan!`
      : `${childName}发展良好！继续加油！`;
  };

  return (
    <div className="min-h-screen relative overflow-hidden py-6 md:py-8">
      {/* Nature-themed background */}
      <div className="absolute inset-0">
        <img
          src={forestBackground}
          alt="Forest Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>
      
      {/* Celebration effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl md:text-3xl animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          >
            {['🌟', '🎉', '⭐', '🌳', '✨', '🍃'][Math.floor(Math.random() * 6)]}
          </div>
        ))}
      </div>

      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>

      <div className="relative z-10 px-4 md:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <FoxyCharacter 
            size="lg"
            message={language === 'en' ? 'You did amazing!' : language === 'ms' ? 'Anda hebat!' : '你真棒！'}
          />
        </div>

        {/* Results Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-white mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-center text-[#3d7c54] mb-2">
            {language === 'en' ? 'KSSR Report Card' : language === 'ms' ? 'Kad Laporan KSSR' : 'KSSR成绩单'}
          </h1>
          <p className="text-center text-[#2d5f3f] font-bold text-lg md:text-xl mb-6">
            {childName}
          </p>
          
          {/* Score badge */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-[#7cc643] to-[#3d7c54] flex items-center justify-center shadow-2xl border-4 border-white">
                <div className="text-center">
                  <div className="text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                    {percentage}%
                  </div>
                  <div className="text-sm font-bold text-white/90">
                    {score}/{totalQuestions}
                  </div>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 text-3xl md:text-4xl animate-spin-slow">⭐</div>
              <div className="absolute -bottom-2 -left-2 text-2xl md:text-3xl animate-bounce">🎉</div>
            </div>
          </div>

          <p className="text-center text-lg md:text-xl font-bold text-[#2d5f3f] leading-relaxed px-4">
            {getMessage()}
          </p>
        </div>

        {/* Ladder Component */}
        <LadderComponent score={percentage} nationalAverage={60} />

        {/* Action Buttons */}
        <div className="space-y-4 mt-6 md:mt-8 max-w-2xl mx-auto">
          <GlossyButton
            onClick={onShare}
            color="green"
            size="lg"
            className="w-full flex items-center justify-center gap-3"
            icon={<Share2 className="w-5 h-5 md:w-6 md:h-6" />}
          >
            {t('shareOnSocial')}
          </GlossyButton>

          {/* School contact info */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 md:p-6 shadow-xl border-4 border-white text-center">
            <p className="text-[#2d5f3f] font-bold mb-2 text-base md:text-lg">
              {language === 'en' 
                ? '📞 Want to learn more? We\'ll contact you soon!'
                : language === 'ms'
                ? '📞 Ingin tahu lebih lanjut? Kami akan hubungi anda!'
                : '📞 想了解更多？我们会尽快联系您！'
              }
            </p>
            <p className="text-sm md:text-base text-[#5d4037] font-medium">
              {language === 'en'
                ? 'Check your WhatsApp for next steps'
                : language === 'ms'
                ? 'Semak WhatsApp anda untuk langkah seterusnya'
                : '请查看您的WhatsApp了解下一步'
              }
            </p>
          </div>
        </div>
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