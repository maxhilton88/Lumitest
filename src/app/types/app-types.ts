// Shared types used across route components and contexts
// Extracted from App.tsx to avoid circular imports.

export type AuthScreen = 'login' | 'signup' | 'forgotPassword';
export type ChildScreen = 'childWelcome' | 'languageSelect' | 'resumePrompt' | 'adventureMap' | 'test' | 'victory' | 'gatedResults' | 'results';

export interface BrandingSettings {
  schoolName: string;
  logoUrl: string;
  primaryColor: string;
  kindergartenUrl: string;
  testPageBgColor: string;
  mapBackgroundImage: string;
  testBackgroundImage: string;
  // Contact info (persisted to school KV record)
  email: string;
  phone: string;
  whatsappNo: string;
  address: string;
}

export interface DetailedAnswer {
  questionId: string;
  answerId: string;
  correctAnswer: string;
  isCorrect: boolean;
  quest: string;
  ageDifficulty: number;
  /** KSSR taxonomy metadata (optional — populated from question data) */
  skillCode?: string;
  kssrLevel?: string;
  topic?: string;
  skillName?: string;
}

export interface LiveQuest {
  id: string;
  subject: string;
  name: { en: string; ms: string; zh: string };
  status: string;
  question_count: number;
  icon: string;
  is_mandarin: boolean;
  image_path: string | null;
  created_at: string;
  signed_image_url: string | null;
}