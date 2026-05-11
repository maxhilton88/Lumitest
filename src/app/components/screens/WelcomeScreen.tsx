import React, { useState } from 'react';
import { GlossyButton } from '../GlossyButton';
import { FoxyCharacter } from '../FoxyCharacter';
import { useLanguage } from '../LanguageContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { FantasyBackground, FantasyTitle, FantasyPanel, FantasyFooter, GoldOrnament } from '../FantasyBackground';
import forestBackground from 'figma:asset/68d6bd2e43cad595055726bdcc1540be302ccdcf.png';
import { toast } from 'sonner@2.0.3';
import { useFormValidation, VALIDATION_PATTERNS } from '../../hooks/useFormValidation';
import { FormInput } from '../ui/form-input';
import { ArrowLeft } from 'lucide-react';
import { deriveLevelFromBirthdate, getBirthdateBounds, isBirthdateInRange, getSchoolAge } from '../../utils/level-utils';

interface WelcomeScreenProps {
  onStart: (childName: string, parentName: string, whatsapp: string, age: number, excludedSubjects: string[]) => void;
  onBack?: () => void;
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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onBack, brandingSettings }) => {
  const { language, t } = useLanguage();
  const [birthdate, setBirthdate] = useState<string>('');
  const [includeMandarinTest, setIncludeMandarinTest] = useState<boolean>(language === 'zh');
  const birthdateBounds = getBirthdateBounds();
  const derivedLevel = birthdate && isBirthdateInRange(birthdate) ? deriveLevelFromBirthdate(birthdate) : null;

  // Auto-enable Mandarin toggle when Chinese language is selected
  React.useEffect(() => {
    if (language === 'zh') {
      setIncludeMandarinTest(true);
    }
  }, [language]);

  // Form validation
  const {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleBlur,
    validateForm
  } = useFormValidation(
    {
      childName: '',
      parentName: '',
      whatsapp: ''
    },
    {
      childName: {
        required: true,
        minLength: 2,
        message: language === 'en' ? "Child's name is required (min 2 characters)" : language === 'ms' ? 'Nama anak diperlukan (min 2 aksara)' : '需要孩子姓名（至少2个字符）'
      },
      parentName: {
        required: true,
        minLength: 2,
        message: language === 'en' ? "Parent's name is required (min 2 characters)" : language === 'ms' ? 'Nama ibu bapa diperlukan (min 2 aksara)' : '需要家长姓名（至少2个字符）'
      },
      whatsapp: {
        required: true,
        pattern: VALIDATION_PATTERNS.whatsapp,
        message: language === 'en' ? 'Please enter a valid WhatsApp number' : language === 'ms' ? 'Sila masukkan nombor WhatsApp yang sah' : '请输入有效的WhatsApp号码'
      }
    }
  );

  const handleStart = () => {
    if (validateForm()) {
      const age = birthdate && isBirthdateInRange(birthdate) ? getSchoolAge(birthdate) : 5;
      // Convert boolean toggle to excludedSubjects array
      const excludedSubjects = includeMandarinTest ? [] : ['ZH'];
      onStart(values.childName, values.parentName, values.whatsapp, age, excludedSubjects);
    }
  };

  return (
    <div className="h-[100dvh] relative overflow-hidden flex flex-col">
      {/* Fantasy background with forest image */}
      <FantasyBackground bgImage={forestBackground} overlayOpacity={0.65} />

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

      <div className="relative z-10 flex-1 flex flex-col items-center overflow-y-auto p-4 md:p-6 lg:p-8 pb-16 md:pb-20">
        {/* School Logo */}
        {brandingSettings.logoUrl && (
          <div
            className="mt-4 md:mt-6 rounded-full p-3 md:p-4 shadow-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(30,22,12,0.9) 0%, rgba(20,16,10,0.95) 100%)',
              border: '2px solid rgba(212,164,74,0.4)',
              boxShadow: '0 0 20px rgba(212,164,74,0.15)',
            }}
          >
            <ImageWithFallback
              src={brandingSettings.logoUrl}
              alt="School Logo"
              className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-full"
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6 max-w-2xl w-full mt-4 md:mt-8 mb-4 md:mb-6">
          {/* Title */}
          <div className="text-center">
            <GoldOrnament className="mb-3" />
            <FantasyTitle size="md">
              {language === 'en' ? "Let's Get Started!" : language === 'ms' ? 'Mari Bermula!' : '让我们开始！'}
            </FantasyTitle>
          </div>

          {/* Form Card — Fantasy Panel */}
          <FantasyPanel className="p-5 md:p-7 w-full max-w-md" gold={false}>
            {/* Child Name Input */}
            <div className="mb-5">
              <label
                className="block text-center font-bold mb-2 text-sm md:text-base"
                style={{ color: '#d4a44a', fontFamily: "'Cinzel Decorative', serif" }}
              >
                {language === 'en' ? "Child's Name" : language === 'ms' ? 'Nama Anak' : '孩子姓名'}
              </label>
              <input
                type="text"
                name="childName"
                value={values.childName}
                onChange={(e) => handleChange('childName', e.target.value)}
                onBlur={() => handleBlur('childName')}
                placeholder={language === 'en' ? 'Enter name...' : language === 'ms' ? 'Masukkan nama...' : '输入姓名...'}
                className={`w-full px-4 py-3 rounded-xl text-center font-bold text-base focus:outline-none transition-colors ${
                  errors.childName && touched.childName
                    ? 'border-red-500/80'
                    : 'border-[#d4a44a]/40 focus:border-[#d4a44a]'
                }`}
                style={{
                  background: 'rgba(10,10,18,0.6)',
                  color: '#ffeaa7',
                  border: errors.childName && touched.childName
                    ? '2px solid rgba(239,68,68,0.7)'
                    : '2px solid rgba(212,164,74,0.3)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
              {errors.childName && touched.childName && (
                <p className="text-red-400 text-xs mt-1 text-center">{errors.childName}</p>
              )}
            </div>

            {/* Parent Name Input */}
            <div className="mb-5">
              <label
                className="block text-center font-bold mb-2 text-sm md:text-base"
                style={{ color: '#d4a44a', fontFamily: "'Cinzel Decorative', serif" }}
              >
                {language === 'en' ? "Parent's Name" : language === 'ms' ? 'Nama Ibu Bapa' : '家长姓名'}
              </label>
              <input
                type="text"
                name="parentName"
                value={values.parentName}
                onChange={(e) => handleChange('parentName', e.target.value)}
                onBlur={() => handleBlur('parentName')}
                placeholder={language === 'en' ? 'Enter name...' : language === 'ms' ? 'Masukkan nama...' : '输入姓名...'}
                className={`w-full px-4 py-3 rounded-xl text-center font-bold text-base focus:outline-none transition-colors ${
                  errors.parentName && touched.parentName
                    ? 'border-red-500/80'
                    : 'border-[#d4a44a]/40 focus:border-[#d4a44a]'
                }`}
                style={{
                  background: 'rgba(10,10,18,0.6)',
                  color: '#ffeaa7',
                  border: errors.parentName && touched.parentName
                    ? '2px solid rgba(239,68,68,0.7)'
                    : '2px solid rgba(212,164,74,0.3)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
              {errors.parentName && touched.parentName && (
                <p className="text-red-400 text-xs mt-1 text-center">{errors.parentName}</p>
              )}
            </div>

            {/* WhatsApp Input */}
            <div className="mb-5">
              <label
                className="block text-center font-bold mb-2 text-sm md:text-base"
                style={{ color: '#d4a44a', fontFamily: "'Cinzel Decorative', serif" }}
              >
                {language === 'en' ? 'WhatsApp Number' : language === 'ms' ? 'Nombor WhatsApp' : 'WhatsApp号码'}
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={values.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                onBlur={() => handleBlur('whatsapp')}
                placeholder="0123456789"
                className={`w-full px-4 py-3 rounded-xl text-center font-bold text-base focus:outline-none transition-colors ${
                  errors.whatsapp && touched.whatsapp
                    ? 'border-red-500/80'
                    : 'border-[#d4a44a]/40 focus:border-[#d4a44a]'
                }`}
                style={{
                  background: 'rgba(10,10,18,0.6)',
                  color: '#ffeaa7',
                  border: errors.whatsapp && touched.whatsapp
                    ? '2px solid rgba(239,68,68,0.7)'
                    : '2px solid rgba(212,164,74,0.3)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                }}
              />
              {errors.whatsapp && touched.whatsapp && (
                <p className="text-red-400 text-xs mt-1 text-center">{errors.whatsapp}</p>
              )}
              <p className="text-center text-xs mt-1.5" style={{ color: '#c8b88aaa' }}>
                {language === 'en' ? "(We'll send your child's report here)" : language === 'ms' ? "(Kami akan hantar laporan anak anda ke sini)" : "(我们将在此发送您孩子的报告)"}
              </p>
            </div>

            {/* Birthdate Picker */}
            <div className="mb-5">
              <label
                className="block text-center font-bold mb-2 text-sm md:text-base"
                style={{ color: '#d4a44a', fontFamily: "'Cinzel Decorative', serif" }}
              >
                {language === 'en' ? "Child's Birthdate" : language === 'ms' ? 'Tarikh Lahir Anak' : '孩子出生日期'}
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                min={birthdateBounds.min}
                max={birthdateBounds.max}
                className="w-full px-4 py-3 rounded-xl text-center font-bold text-base focus:outline-none cursor-pointer"
                style={{
                  background: 'rgba(10,10,18,0.6)',
                  color: '#ffeaa7',
                  border: '2px solid rgba(212,164,74,0.3)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
                  colorScheme: 'dark',
                }}
              />
              {derivedLevel && (
                <div
                  className="mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{
                    background: `${derivedLevel.tierColor}15`,
                    border: `1px solid ${derivedLevel.tierColor}30`,
                  }}
                >
                  <span
                    className="text-xs font-bold"
                    style={{ color: derivedLevel.tierColor, fontFamily: "'Cherry Bomb One', cursive" }}
                  >
                    {derivedLevel.tierLabel}
                  </span>
                  <span className="text-xs" style={{ color: '#c8b88aaa' }}>
                    — {derivedLevel.level} ({language === 'en' ? `Age ${derivedLevel.age}` : language === 'ms' ? `Umur ${derivedLevel.age}` : `${derivedLevel.age}岁`})
                  </span>
                </div>
              )}
              <p className="text-center text-xs mt-1.5" style={{ color: '#c8b88a77' }}>
                {language === 'en' ? "We'll auto-serve age-appropriate questions"
                  : language === 'ms' ? 'Kami akan menyediakan soalan mengikut umur secara automatik'
                  : '我们将自动提供适龄问题'}
              </p>
            </div>

            {/* Mandarin Test Toggle */}
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{
                background: 'rgba(212,164,74,0.08)',
                border: '1px solid rgba(212,164,74,0.2)',
              }}
            >
              <div className="flex-1">
                <p className="font-bold text-sm md:text-base" style={{ color: '#d4a44a' }}>
                  {language === 'en' ? 'Include Mandarin Test' : language === 'ms' ? 'Termasuk Ujian Mandarin' : '包含华语测试'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#c8b88aaa' }}>
                  {language === 'en' ? '(EN & BM are mandatory)' : language === 'ms' ? '(EN & BM wajib)' : '(英语和马来语必考)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncludeMandarinTest(!includeMandarinTest)}
                className="relative w-14 h-8 rounded-full transition-all duration-300"
                style={{
                  background: includeMandarinTest
                    ? 'linear-gradient(135deg, #d4a44a, #f0d078)'
                    : 'rgba(60,50,30,0.6)',
                  border: includeMandarinTest
                    ? '2px solid #ffeaa7'
                    : '2px solid rgba(212,164,74,0.2)',
                }}
              >
                <div
                  className="absolute top-0.5 w-6 h-6 rounded-full shadow-md transition-all duration-300"
                  style={{
                    left: includeMandarinTest ? '26px' : '2px',
                    background: includeMandarinTest ? '#2a1f0e' : '#c8b88a',
                  }}
                />
              </button>
            </div>
          </FantasyPanel>
        </div>

        {/* Start button */}
        <div className="w-full max-w-sm md:max-w-md flex-shrink-0 pb-4">
          <GlossyButton
            onClick={handleStart}
            color="gold"
            size="lg"
            className="w-full"
          >
            {t('start')}
          </GlossyButton>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0">
        <FantasyFooter />
      </div>
    </div>
  );
};