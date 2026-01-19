import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'ms' | 'zh';

interface Translations {
  [key: string]: {
    en: string;
    ms: string;
    zh: string;
  };
}

const translations: Translations = {
  welcome: {
    en: 'Ready for Standard 1?',
    ms: 'Bersedia untuk Tahun 1?',
    zh: '准备好上一年级了吗？'
  },
  selectLanguage: {
    en: 'Select Language',
    ms: 'Pilih Bahasa',
    zh: '选择语言'
  },
  start: {
    en: "Let's Start!",
    ms: 'Mari Mula!',
    zh: '开始吧！'
  },
  greatJob: {
    en: 'Great job!',
    ms: 'Bagus sekali!',
    zh: '做得好！'
  },
  enterWhatsApp: {
    en: "Ask mommy to enter WhatsApp to see your KSSR report card!",
    ms: 'Minta ibu masukkan WhatsApp untuk lihat kad laporan KSSR anda!',
    zh: '请妈妈输入WhatsApp号码查看您的KSSR成绩单！'
  },
  childName: {
    en: "Child's Name",
    ms: 'Nama Anak',
    zh: '孩子姓名'
  },
  parentName: {
    en: "Parent's Name",
    ms: 'Nama Ibu Bapa',
    zh: '家长姓名'
  },
  whatsappNumber: {
    en: 'WhatsApp Number',
    ms: 'Nombor WhatsApp',
    zh: 'WhatsApp号码'
  },
  viewResults: {
    en: 'View Results',
    ms: 'Lihat Keputusan',
    zh: '查看结果'
  },
  shareOnSocial: {
    en: 'Share on Social Media',
    ms: 'Kongsi di Media Sosial',
    zh: '分享到社交媒体'
  },
  yourScore: {
    en: 'Your Score',
    ms: 'Skor Anda',
    zh: '你的分数'
  },
  nationalAverage: {
    en: 'National Average',
    ms: 'Purata Nasional',
    zh: '全国平均水平'
  },
  advanced: {
    en: 'Advanced',
    ms: 'Cemerlang',
    zh: '优秀'
  },
  ready: {
    en: 'Ready for School',
    ms: 'Bersedia ke Sekolah',
    zh: '准备好上学'
  },
  developing: {
    en: 'Developing',
    ms: 'Sedang Berkembang',
    zh: '发展中'
  },
  question: {
    en: 'Question',
    ms: 'Soalan',
    zh: '问题'
  },
  next: {
    en: 'Next',
    ms: 'Seterusnya',
    zh: '下一个'
  },
  english: {
    en: 'English',
    ms: 'Inggeris',
    zh: '英语'
  },
  malay: {
    en: 'Malay',
    ms: 'Bahasa Melayu',
    zh: '马来语'
  },
  chinese: {
    en: 'Chinese',
    ms: 'Cina',
    zh: '中文'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
