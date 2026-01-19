import React, { useState } from 'react';
import { GlossyButton } from '../GlossyButton';
import { FoxyCharacter } from '../FoxyCharacter';
import { useLanguage } from '../LanguageContext';
import { Input } from '../ui/input';
import forestBackground from 'figma:asset/a581931d108e11fed5631f15572c62563a4ab3d4.png';

interface LeadGateScreenProps {
  onSubmit: (data: { childName: string; parentName: string; whatsapp: string }) => void;
}

export const LeadGateScreen: React.FC<LeadGateScreenProps> = ({ onSubmit }) => {
  const { language, t } = useLanguage();
  const [formData, setFormData] = useState({
    childName: '',
    parentName: '',
    whatsapp: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.childName && formData.parentName && formData.whatsapp) {
      onSubmit(formData);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Nature-themed celebration background */}
      <div className="absolute inset-0">
        <img
          src={forestBackground}
          alt="Forest Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
      </div>
      
      {/* Floating celebration leaves */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-3xl animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          >
            {['🌟', '🌳', '⭐', '🍃', '✨'][Math.floor(Math.random() * 5)]}
          </div>
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        {/* Celebration Foxy */}
        <div className="mb-8 animate-in zoom-in duration-700">
          <FoxyCharacter 
            size="lg"
            message={t('greatJob')}
          />
        </div>

        {/* Main message */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border-4 border-white max-w-md w-full mb-8">
          <h2 className="text-4xl font-black text-center text-[#3d7c54] mb-4">
            🎉 {t('greatJob')} 🎉
          </h2>
          <p className="text-center text-[#2d5f3f] font-bold text-lg leading-relaxed">
            {t('enterWhatsApp')}
          </p>
        </div>

        {/* Lead capture form */}
        <form onSubmit={handleSubmit} className="bg-white/95 backdrop-blur-md rounded-3xl p-8 shadow-2xl border-4 border-white max-w-md w-full space-y-6">
          <div>
            <label className="block text-[#2d5f3f] font-black mb-2 text-sm uppercase tracking-wide">
              {t('childName')} *
            </label>
            <Input
              type="text"
              value={formData.childName}
              onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
              placeholder={language === 'en' ? 'Enter child\'s name' : language === 'ms' ? 'Masukkan nama anak' : '输入孩子姓名'}
              className="w-full px-4 py-6 rounded-2xl border-4 border-[#7cc643] focus:border-[#3d7c54] text-lg font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-[#2d5f3f] font-black mb-2 text-sm uppercase tracking-wide">
              {t('parentName')} *
            </label>
            <Input
              type="text"
              value={formData.parentName}
              onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
              placeholder={language === 'en' ? 'Enter your name' : language === 'ms' ? 'Masukkan nama anda' : '输入您的姓名'}
              className="w-full px-4 py-6 rounded-2xl border-4 border-[#7cc643] focus:border-[#3d7c54] text-lg font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-[#2d5f3f] font-black mb-2 text-sm uppercase tracking-wide">
              {t('whatsappNumber')} *
            </label>
            <Input
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              placeholder="+60 12-345 6789"
              className="w-full px-4 py-6 rounded-2xl border-4 border-[#7cc643] focus:border-[#3d7c54] text-lg font-medium"
              required
            />
          </div>

          <div className="pt-4">
            <GlossyButton
              color="yellow"
              size="lg"
              className="w-full"
            >
              {t('viewResults')} 🎯
            </GlossyButton>
          </div>
        </form>

        {/* Privacy note */}
        <p className="text-white font-bold text-sm text-center mt-6 max-w-md drop-shadow-lg">
          {language === 'en' 
            ? '🔒 Your information is safe and will only be used to send your results'
            : language === 'ms'
            ? '🔒 Maklumat anda selamat dan hanya digunakan untuk hantar keputusan'
            : '🔒 您的信息是安全的，仅用于发送结果'
          }
        </p>
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