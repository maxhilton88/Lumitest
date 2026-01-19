import React, { useState } from 'react';
import { GlossyButton } from '../GlossyButton';
import { FoxyCharacter } from '../FoxyCharacter';
import { MusicToggle } from '../MusicToggle';
import { useLanguage } from '../LanguageContext';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import forestBackground from 'figma:asset/6159593dc1e129bc0f365325080d4c6d97363b06.png';
import { toast } from 'sonner@2.0.3';
import { useFormValidation, VALIDATION_PATTERNS } from '../../hooks/useFormValidation';
import { FormInput } from '../ui/form-input';

interface WelcomeScreenProps {
  onStart: (childName: string, parentName: string, whatsapp: string, age: number, includeMandarinTest: boolean) => void;
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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, brandingSettings }) => {
  const { language, t } = useLanguage();
  const [age, setAge] = useState<number>(5);
  const [includeMandarinTest, setIncludeMandarinTest] = useState<boolean>(false);

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
      onStart(values.childName, values.parentName, values.whatsapp, age, includeMandarinTest);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Beautiful forest background */}
      <div className="absolute inset-0">
        <img
          src={forestBackground}
          alt="Forest Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
      </div>
      
      {/* Music Toggle - Top Right */}
      <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
        <MusicToggle />
      </div>
      
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-4 md:p-6 lg:p-8 pb-24 md:pb-32">
        {/* School Logo */}
        {brandingSettings.logoUrl && (
          <div className="mt-4 md:mt-6 bg-white/90 rounded-full p-3 md:p-4 shadow-xl">
            <ImageWithFallback
              src={brandingSettings.logoUrl}
              alt="School Logo"
              className="w-16 h-16 md:w-20 md:h-20 object-contain"
            />
          </div>
        )}
        
        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 md:gap-8 max-w-2xl w-full mt-4 md:mt-8 mb-8">
          {/* Title */}
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4"
                style={{
                  textShadow: '0 0 20px rgba(0, 255, 245, 0.5), 3px 3px 0px rgba(0, 168, 150, 0.8)'
                }}>
              {language === 'en' ? 'Let\'s Get Started!' : language === 'ms' ? 'Mari Bermula!' : '让我们开始！'}
            </h1>
          </div>
          
          {/* Form Card */}
          <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 md:p-8 shadow-2xl border-4 border-white w-full max-w-md">
            {/* Child Name Input */}
            <div className="mb-6">
              <label className="block text-center text-[#2d5f3f] font-bold mb-2 text-base md:text-lg">
                {language === 'en' ? 'Child\'s Name' : language === 'ms' ? 'Nama Anak' : '孩子姓名'}
              </label>
              <input
                type="text"
                name="childName"
                value={values.childName}
                onChange={(e) => handleChange('childName', e.target.value)}
                onBlur={() => handleBlur('childName')}
                placeholder={language === 'en' ? 'Enter name...' : language === 'ms' ? 'Masukkan nama...' : '输入姓名...'}
                className={`w-full px-4 py-3 rounded-2xl border-4 text-center font-bold text-lg bg-white text-[#2d5f3f] focus:outline-none ${
                  errors.childName && touched.childName ? 'border-red-500' : 'border-[#7cc643] focus:border-[#3d7c54]'
                }`}
              />
              {errors.childName && touched.childName && (
                <p className="text-red-500 text-sm mt-1 text-center">
                  {errors.childName}
                </p>
              )}
            </div>

            {/* Parent Name Input */}
            <div className="mb-6">
              <label className="block text-center text-[#2d5f3f] font-bold mb-2 text-base md:text-lg">
                {language === 'en' ? 'Parent\'s Name' : language === 'ms' ? 'Nama Ibu Bapa' : '家长姓名'}
              </label>
              <input
                type="text"
                name="parentName"
                value={values.parentName}
                onChange={(e) => handleChange('parentName', e.target.value)}
                onBlur={() => handleBlur('parentName')}
                placeholder={language === 'en' ? 'Enter name...' : language === 'ms' ? 'Masukkan nama...' : '输入姓名...'}
                className={`w-full px-4 py-3 rounded-2xl border-4 text-center font-bold text-lg bg-white text-[#2d5f3f] focus:outline-none ${
                  errors.parentName && touched.parentName ? 'border-red-500' : 'border-[#7cc643] focus:border-[#3d7c54]'
                }`}
              />
              {errors.parentName && touched.parentName && (
                <p className="text-red-500 text-sm mt-1 text-center">
                  {errors.parentName}
                </p>
              )}
            </div>

            {/* WhatsApp Input */}
            <div className="mb-6">
              <label className="block text-center text-[#2d5f3f] font-bold mb-2 text-base md:text-lg">
                {language === 'en' ? 'WhatsApp Number' : language === 'ms' ? 'Nombor WhatsApp' : 'WhatsApp号码'}
              </label>
              <input
                type="tel"
                name="whatsapp"
                value={values.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                onBlur={() => handleBlur('whatsapp')}
                placeholder={language === 'en' ? '+60123456789' : language === 'ms' ? '+60123456789' : '+60123456789'}
                className={`w-full px-4 py-3 rounded-2xl border-4 text-center font-bold text-lg bg-white text-[#2d5f3f] focus:outline-none ${
                  errors.whatsapp && touched.whatsapp ? 'border-red-500' : 'border-[#7cc643] focus:border-[#3d7c54]'
                }`}
              />
              {errors.whatsapp && touched.whatsapp && (
                <p className="text-red-500 text-sm mt-1 text-center">
                  {errors.whatsapp}
                </p>
              )}
              <p className="text-center text-sm text-gray-600 mt-2">
                {language === 'en' ? "(We'll send your child's report here)" : language === 'ms' ? "(Kami akan hantar laporan anak anda ke sini)" : "(我们将在此发送您孩子的报告)"}
              </p>
            </div>

            {/* Age Selector */}
            <div className="mb-6">
              <label className="block text-center text-[#2d5f3f] font-bold mb-2 text-sm md:text-base">
                {language === 'en' ? 'Child\'s Age' : language === 'ms' ? 'Umur Anak' : '孩子年龄'}
              </label>
              <select
                value={age}
                onChange={(e) => setAge(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-2xl border-4 border-[#7cc643] text-center font-bold text-lg bg-white text-[#2d5f3f] focus:outline-none focus:border-[#3d7c54] cursor-pointer"
              >
                <option value={4}>4 {language === 'en' ? 'years old' : language === 'ms' ? 'tahun' : '岁'}</option>
                <option value={5}>5 {language === 'en' ? 'years old' : language === 'ms' ? 'tahun' : '岁'}</option>
                <option value={6}>6 {language === 'en' ? 'years old' : language === 'ms' ? 'tahun' : '岁'}</option>
                <option value={7}>7 {language === 'en' ? 'years old' : language === 'ms' ? 'tahun' : '岁'}</option>
              </select>
            </div>

            {/* Mandarin Test Toggle */}
            <div className="flex items-center justify-between p-3 bg-[#f0f9f0] rounded-2xl border-2 border-[#7cc643]">
              <div className="flex-1">
                <p className="text-[#2d5f3f] font-bold text-sm md:text-base">
                  {language === 'en' ? 'Include Mandarin Test' : language === 'ms' ? 'Termasuk Ujian Mandarin' : '包含华语测试'}
                </p>
                <p className="text-[#5d4037] text-xs mt-1">
                  {language === 'en' ? '(EN & BM are mandatory)' : language === 'ms' ? '(EN & BM wajib)' : '(英语和马来语必考)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncludeMandarinTest(!includeMandarinTest)}
                className={`
                  relative w-14 h-8 rounded-full transition-all duration-300
                  ${includeMandarinTest ? 'bg-[#7cc643]' : 'bg-gray-300'}
                `}
              >
                <div
                  className={`
                    absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300
                    ${includeMandarinTest ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
        
        {/* Start button */}
        <div className="w-full max-w-sm md:max-w-md space-y-3">
          <GlossyButton
            onClick={handleStart}
            color="white"
            size="lg"
            className="w-full"
          >
            {t('start')}
          </GlossyButton>
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