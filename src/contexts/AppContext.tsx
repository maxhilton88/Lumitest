// AppContext — provides shared state from the root layout (MainApp) to all page components.
// Phase 2: Replaces prop-drilling through the monolithic renderContent() switch.
import React, { createContext, useContext } from 'react';
import type { Question } from '../components/screens/QuestionScreen';
import type { UserType } from '../components/DevNavigation';
import type {
  AuthScreen,
  ChildScreen,
  BrandingSettings,
  DetailedAnswer,
  LiveQuest,
} from '../types/app-types';

export interface AppContextValue {
  // ── Auth (KG/Admin) ──
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
  userRole: 'superadmin' | 'kindergarten' | null;
  authScreen: AuthScreen;
  setAuthScreen: (s: AuthScreen) => void;

  // ── Auth (Parent) ──
  isParentAuthenticated: boolean;
  setIsParentAuthenticated: (v: boolean) => void;
  parentData: any;
  setParentData: (v: any) => void;

  // ── User type (derived from URL) ──
  currentUserType: UserType;
  handleSwitchUserType: (userType: UserType) => void;

  // ── Child flow state ──
  childScreen: ChildScreen;
  setChildScreen: (s: ChildScreen) => void;
  age: number;
  includeMandarinTest: boolean;
  setIncludeMandarinTest: (v: boolean) => void;
  completedModules: string[];
  currentModule: string;
  currentQuestionIndex: number;
  currentTestQuestions: Question[];
  allDetailedAnswers: DetailedAnswer[];
  currentModuleAnswers: DetailedAnswer[];
  moduleResults: Record<string, { score: number; total: number }>;
  assessmentCompleted: boolean;
  leadData: { childName: string; parentName: string; whatsapp: string };
  pendingResumeLead: any;
  justCompletedModule: string | null;
  setJustCompletedModule: (v: string | null) => void;

  // ── Quests & branding ──
  liveQuests: LiveQuest[];
  questCardImageUrls: Record<string, string>;
  brandingSettings: BrandingSettings;
  setBrandingSettings: (s: BrandingSettings | ((prev: BrandingSettings) => BrandingSettings)) => void;

  // ── KG/Admin content management ──
  questionBank: Question[];
  setQuestionBank: (q: Question[]) => void;
  questConfigs: Record<string, { language: 'global' | 'en' | 'ms' | 'zh'; numberOfQuestions: number; skillFilters: string[] }>;
  setQuestConfigs: (c: any) => void;

  // ── Overlays ──
  showPracticeMode: boolean;
  setShowPracticeMode: (v: boolean) => void;
  showWhatsAppPrompt: boolean;
  setShowWhatsAppPrompt: (v: boolean) => void;

  // ── Refs ──
  parentInitiatedQuestRef: React.MutableRefObject<boolean>;
  pendingQuestStartRef: React.MutableRefObject<(() => void) | null>;
  resolvedSchoolIdRef: React.MutableRefObject<string | null>;
  isResolvingSchool: boolean;

  // ── Handlers ──
  handleLogin: (email: string, password: string) => Promise<void>;
  handleSignup: (data: { name: string; email: string; password: string; schoolName?: string }) => Promise<void>;
  handleResetPassword: (email: string) => Promise<void>;
  handleLogout: () => void;
  handleStartAdventure: () => Promise<void>;
  handleLanguageStart: (childName: string, parentName: string, whatsapp: string, selectedAge: number, selectedIncludeMandarinTest: boolean) => Promise<void>;
  handleModuleSelect: (moduleId: string) => Promise<void>;
  handleAnswer: (answerId: string) => void;
  handleNext: () => void;
  handleShare: () => void;
  handleResumeSession: () => void;
  handleStartFresh: () => void;
  persistAssessmentSnapshot: (answersToUse?: DetailedAnswer[]) => Promise<void>;
  setAnswers: (a: { questionId: string; answerId: string }[]) => void;
  setCurrentQuestionIndex: (n: number) => void;

  // ── School resolution (for /t/:code) ──
  resolvedSchoolId: string | null;
  setResolvedSchoolId: (v: string | null) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppContext.Provider> (inside MainApp)');
  }
  return ctx;
}