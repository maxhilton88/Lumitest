import React, { useState } from 'react';
import { LanguageProvider } from './components/LanguageContext';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { AdventureMapScreen } from './components/screens/AdventureMapScreen';
import { QuestionScreen, Question } from './components/screens/QuestionScreen';
import { LeadGateScreen } from './components/screens/LeadGateScreen';
import { ResultsScreen } from './components/screens/ResultsScreen';
import { ChildWelcomePage } from './components/screens/ChildWelcomePage';
import { LoginForm } from './components/auth/LoginForm';
import { SignupForm } from './components/auth/SignupForm';
import { ForgotPasswordForm } from './components/auth/ForgotPasswordForm';
import { KindergartenDashboard } from './components/dashboards/KindergartenDashboard';
import { SuperAdminDashboard } from './components/dashboards/SuperAdminDashboard';
import { DevNavigation, UserType } from './components/DevNavigation';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import { ErrorBoundary } from './components/ErrorBoundary';

// Sample questions for the test
const sampleQuestions: Question[] = [
  {
    id: '1',
    type: 'mcq',
    question: {
      en: 'Which letter comes after A?',
      ms: 'Huruf apa selepas A?',
      zh: '哪个字母在A后面？'
    },
    options: [
      { id: 'a', text: { en: 'B', ms: 'B', zh: 'B' } },
      { id: 'b', text: { en: 'C', ms: 'C', zh: 'C' } },
      { id: 'c', text: { en: 'D', ms: 'D', zh: 'D' } },
      { id: 'd', text: { en: 'Z', ms: 'Z', zh: 'Z' } }
    ],
    correctAnswer: 'a',
    foxyMessage: {
      en: "Let's find the letter that comes after A!",
      ms: 'Mari cari huruf selepas A!',
      zh: '让我们找到A后面的字母！'
    }
  },
  {
    id: '2',
    type: 'dragdrop',
    question: {
      en: 'Drag the animal that lives in water',
      ms: 'Seret haiwan yang hidup dalam air',
      zh: '拖动住在水里的动物'
    },
    options: [
      { id: 'a', text: { en: '🐟 Fish', ms: '🐟 Ikan', zh: '🐟 鱼' } },
      { id: 'b', text: { en: '🐕 Dog', ms: '🐕 Anjing', zh: '🐕 狗' } },
      { id: 'c', text: { en: '🐈 Cat', ms: '🐈 Kucing', zh: '🐈 猫' } },
      { id: 'd', text: { en: '🐦 Bird', ms: '🐦 Burung', zh: '🐦 鸟' } }
    ],
    correctAnswer: 'a',
    foxyMessage: {
      en: "Which animal swims in the water?",
      ms: 'Haiwan mana yang berenang dalam air?',
      zh: '哪种动物在水里游泳？'
    }
  },
  {
    id: '3',
    type: 'hotspot',
    question: {
      en: 'Tap on the face',
      ms: 'Ketik pada muka',
      zh: '点击脸部'
    },
    hotspotImage: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800',
    options: [
      { 
        id: 'a', 
        text: { en: 'Face', ms: 'Muka', zh: '脸' },
        position: { x: 35, y: 15, width: 30, height: 25 }
      },
      { 
        id: 'b', 
        text: { en: 'Hand', ms: 'Tangan', zh: '手' },
        position: { x: 10, y: 50, width: 20, height: 20 }
      },
      { 
        id: 'c', 
        text: { en: 'Body', ms: 'Badan', zh: '身体' },
        position: { x: 30, y: 45, width: 40, height: 40 }
      },
      { 
        id: 'd', 
        text: { en: 'Legs', ms: 'Kaki', zh: '腿' },
        position: { x: 35, y: 70, width: 30, height: 25 }
      }
    ],
    correctAnswer: 'a',
    foxyMessage: {
      en: "Can you find the face?",
      ms: 'Bolehkah kamu cari muka?',
      zh: '你能找到脸吗？'
    }
  },
  {
    id: '4',
    type: 'sequence',
    question: {
      en: 'Put these daily activities in the correct order',
      ms: 'Susun aktiviti harian ini mengikut urutan yang betul',
      zh: '按正确顺序排列这些日常活动'
    },
    options: [
      { id: 'a', text: { en: '🌅 Wake up', ms: '🌅 Bangun tidur', zh: '🌅 起床' } },
      { id: 'b', text: { en: '🍳 Eat breakfast', ms: '🍳 Sarapan', zh: '🍳 吃早餐' } },
      { id: 'c', text: { en: '🚌 Go to school', ms: '🚌 Pergi sekolah', zh: '🚌 去学校' } },
      { id: 'd', text: { en: '🌙 Sleep', ms: '🌙 Tidur', zh: '🌙 睡觉' } }
    ],
    correctAnswer: 'a,b,c,d',
    foxyMessage: {
      en: "What do you do first in the morning?",
      ms: 'Apa yang kamu buat dahulu pada waktu pagi?',
      zh: '早上你先做什么？'
    }
  },
  {
    id: '5',
    type: 'mcq',
    question: {
      en: 'What is 1 + 1?',
      ms: 'Berapa 1 + 1?',
      zh: '1 + 1 等于几？'
    },
    options: [
      { id: 'a', text: { en: '1', ms: '1', zh: '1' } },
      { id: 'b', text: { en: '2', ms: '2', zh: '2' } },
      { id: 'c', text: { en: '3', ms: '3', zh: '3' } },
      { id: 'd', text: { en: '4', ms: '4', zh: '4' } }
    ],
    correctAnswer: 'b',
    foxyMessage: {
      en: "Let's add together!",
      ms: 'Mari tambah bersama!',
      zh: '让我们一起加！'
    }
  }
];

type AuthScreen = 'login' | 'signup' | 'forgotPassword';
type ChildScreen = 'childWelcome' | 'languageSelect' | 'adventureMap' | 'test' | 'leadGate' | 'results';

export default function App() {
  // User type management
  const [currentUserType, setCurrentUserType] = useState<UserType>('child');
  
  // Auth state
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Child/Parent flow state
  const [childScreen, setChildScreen] = useState<ChildScreen>('childWelcome');
  const [age, setAge] = useState<number>(5);
  const [includeMandarinTest, setIncludeMandarinTest] = useState<boolean>(false);
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [currentModule, setCurrentModule] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answerId: string }[]>([]);
  const [leadData, setLeadData] = useState({ childName: '', parentName: '', whatsapp: '' });

  // Global music control - persists across pages
  const [musicEnabled, setMusicEnabled] = useState(true);
  
  // GLOBAL QUESTION BANK - Shared across all components
  const [questionBank, setQuestionBank] = useState<Question[]>([]);
  
  // GLOBAL QUEST CONFIGURATION
  const [questConfigs, setQuestConfigs] = useState({
    english: { language: 'en' as const, numberOfQuestions: 20, skillFilters: [] as string[] },
    numbers: { language: 'global' as const, numberOfQuestions: 25, skillFilters: ['Numeracy'] },
    bahasa: { language: 'ms' as const, numberOfQuestions: 20, skillFilters: [] as string[] },
    mandarin: { language: 'zh' as const, numberOfQuestions: 15, skillFilters: [] as string[] },
    science: { language: 'global' as const, numberOfQuestions: 30, skillFilters: ['General Science'] }
  });
  
  // GLOBAL BRANDING SETTINGS
  interface BrandingSettings {
    schoolName: string;
    logoUrl: string;
    primaryColor: string;
    kindergartenUrl: string;
    testPageBgColor: string;
    mapBackgroundImage: string;
    testBackgroundImage: string;
  }
  
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings>({
    schoolName: 'Little Stars Kindergarten',
    logoUrl: '',
    primaryColor: '#7cc643',
    kindergartenUrl: 'little-stars',
    testPageBgColor: '#ffffff',
    mapBackgroundImage: '',
    testBackgroundImage: ''
  });
  
  // Store the loaded questions for current module test
  const [currentTestQuestions, setCurrentTestQuestions] = useState<Question[]>(sampleQuestions);
  
  // DETAILED TEST RESULTS - Store answers with question metadata
  interface DetailedAnswer {
    questionId: string;
    answerId: string;
    correctAnswer: string;
    isCorrect: boolean;
    quest: string;
    ageDifficulty: number;
  }
  
  const [allDetailedAnswers, setAllDetailedAnswers] = useState<DetailedAnswer[]>([]);
  const [currentModuleAnswers, setCurrentModuleAnswers] = useState<DetailedAnswer[]>([]);

  // Note: Background music would be initialized here when the hook is created
  // useBackgroundMusic(musicEnabled);

  // ===== AUTH HANDLERS =====
  const handleLogin = (email: string, password: string) => {
    console.log('Login:', email, password);
    toast.success('Login successful!');
    setIsAuthenticated(true);
  };

  const handleSignup = (data: { name: string; email: string; password: string; schoolName?: string }) => {
    console.log('Signup:', data);
    toast.success('Account created successfully!');
    setIsAuthenticated(true);
  };

  const handleResetPassword = (email: string) => {
    console.log('Reset password for:', email);
    toast.success('Password reset link sent!');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthScreen('login');
    toast.info('Logged out successfully');
  };

  // ===== CHILD FLOW HANDLERS =====
  const handleStartAdventure = () => {
    setChildScreen('languageSelect');
  };

  const handleLanguageStart = (childName: string, parentName: string, whatsapp: string, selectedAge: number, selectedIncludeMandarinTest: boolean) => {
    setLeadData({ childName, parentName, whatsapp });
    setAge(selectedAge);
    setIncludeMandarinTest(selectedIncludeMandarinTest);
    setChildScreen('adventureMap');
    setCompletedModules([]);
  };

  // Load questions from Question Bank based on quest configuration
  const loadQuestionsForModule = (moduleId: string, childAge: number): Question[] => {
    // If Question Bank is empty, use sample questions as fallback
    if (questionBank.length === 0) {
      console.log('Question Bank is empty, using sample questions');
      return sampleQuestions;
    }

    // Get quest configuration
    const config = questConfigs[moduleId as keyof typeof questConfigs];
    if (!config) {
      console.log(`No config found for ${moduleId}, using sample questions`);
      return sampleQuestions;
    }

    // Filter questions by quest and language
    let filteredQuestions = questionBank.filter(q => {
      // Match quest
      const matchesQuest = q.quest === moduleId;
      
      // Match language (global means any language is ok)
      const matchesLanguage = config.language === 'global' || q.language === 'global' || q.language === config.language;
      
      // Match skill filters (if any)
      const matchesSkills = config.skillFilters.length === 0 || 
                           (q.skills && q.skills.some(skill => config.skillFilters.includes(skill)));
      
      return matchesQuest && matchesLanguage && matchesSkills;
    });

    // If no questions found, use sample questions
    if (filteredQuestions.length === 0) {
      console.log(`No questions found for ${moduleId} in Question Bank, using sample questions`);
      return sampleQuestions;
    }

    // Balance questions across age levels
    const questionsPerAge: Record<number, Question[]> = {
      4: [],
      5: [],
      6: [],
      7: []
    };

    filteredQuestions.forEach(q => {
      if (q.ageDifficulty && questionsPerAge[q.ageDifficulty]) {
        questionsPerAge[q.ageDifficulty].push(q);
      }
    });

    // Try to get equal distribution across ages
    const targetQuestionsPerAge = Math.ceil(config.numberOfQuestions / 4);
    const selectedQuestions: Question[] = [];

    // Select questions from each age level
    [4, 5, 6, 7].forEach(ageLevel => {
      const ageQuestions = questionsPerAge[ageLevel];
      const shuffled = [...ageQuestions].sort(() => Math.random() - 0.5);
      const toTake = Math.min(targetQuestionsPerAge, shuffled.length);
      selectedQuestions.push(...shuffled.slice(0, toTake));
    });

    // If we don't have enough questions, add more randomly
    if (selectedQuestions.length < config.numberOfQuestions) {
      const remaining = filteredQuestions.filter(q => !selectedQuestions.includes(q));
      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
      selectedQuestions.push(...shuffled.slice(0, config.numberOfQuestions - selectedQuestions.length));
    }

    // Shuffle final questions
    const finalQuestions = selectedQuestions
      .slice(0, config.numberOfQuestions)
      .sort(() => Math.random() - 0.5);

    console.log(`Loaded ${finalQuestions.length} questions for ${moduleId}`);
    return finalQuestions.length > 0 ? finalQuestions : sampleQuestions;
  };

  const handleModuleSelect = (moduleId: string) => {
    // Load questions based on quest config and child's age
    const loadedQuestions = loadQuestionsForModule(moduleId, age);
    setCurrentTestQuestions(loadedQuestions);
    
    setCurrentModule(moduleId);
    setChildScreen('test');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentModuleAnswers([]); // Reset current module detailed answers
    toast.success(`Starting ${moduleId} adventure!`);
  };

  const handleAnswer = (answerId: string) => {
    const currentQuestion = currentTestQuestions[currentQuestionIndex];
    
    // Store basic answer
    setAnswers([...answers, { questionId: currentQuestion.id, answerId }]);
    
    // Store detailed answer with metadata
    const detailedAnswer: DetailedAnswer = {
      questionId: currentQuestion.id,
      answerId: answerId,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: answerId === currentQuestion.correctAnswer,
      quest: currentQuestion.quest || currentModule,
      ageDifficulty: currentQuestion.ageDifficulty || age
    };
    
    setCurrentModuleAnswers([...currentModuleAnswers, detailedAnswer]);
  };

  const handleNext = () => {
    if (currentQuestionIndex < currentTestQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Module completed - add current module answers to all answers
      setAllDetailedAnswers([...allDetailedAnswers, ...currentModuleAnswers]);
      
      setCompletedModules([...completedModules, currentModule]);
      
      // Check if all modules are completed
      const totalModules = includeMandarinTest ? 5 : 4;
      if (completedModules.length + 1 >= totalModules) {
        setChildScreen('leadGate');
      } else {
        setChildScreen('adventureMap');
        toast.success(`${currentModule} completed! Choose your next adventure!`);
      }
    }
  };

  const handleLeadSubmit = (data: { childName: string; parentName: string; whatsapp: string }) => {
    setLeadData(data);
    setChildScreen('results');
  };

  const handleShare = () => {
    const score = calculateScore();
    const percentage = Math.round((score / currentTestQuestions.length) * 100);
    
    const shareText = `🎉 ${leadData.childName} scored ${percentage}% on the KSSR readiness test! Ready for Standard 1! 🎓`;
    
    if (navigator.share) {
      navigator.share({
        title: 'KSSR Test Results',
        text: shareText,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success('Result copied to clipboard!');
    }
  };

  const calculateScore = () => {
    return answers.filter((a, idx) => a.answerId === currentTestQuestions[idx].correctAnswer).length;
  };
  
  // Calculate detailed report data from all answers
  const calculateReportData = () => {
    // Map quest IDs to display names
    const questNames: Record<string, string> = {
      english: 'English Forest',
      numbers: 'Numbers Island',
      bahasa: 'Rimba Bahasa',
      mandarin: 'Mandarin Mountain',
      science: 'Mystery Jungle'
    };
    
    // Group answers by quest
    const questGroups: Record<string, DetailedAnswer[]> = {};
    allDetailedAnswers.forEach(answer => {
      const quest = answer.quest || 'unknown';
      if (!questGroups[quest]) {
        questGroups[quest] = [];
      }
      questGroups[quest].push(answer);
    });
    
    // Calculate quest results
    const questResults = Object.keys(questGroups).map(questId => {
      const answers = questGroups[questId];
      const correct = answers.filter(a => a.isCorrect).length;
      return {
        quest: questNames[questId] || questId,
        score: correct,
        total: answers.length
      };
    });
    
    // Group answers by age difficulty
    const ageGroups: Record<number, DetailedAnswer[]> = {
      4: [],
      5: [],
      6: [],
      7: []
    };
    
    allDetailedAnswers.forEach(answer => {
      const ageDiff = answer.ageDifficulty || age;
      if (ageGroups[ageDiff]) {
        ageGroups[ageDiff].push(answer);
      }
    });
    
    // Calculate age performance
    const agePerformance = [4, 5, 6, 7].map(ageLevel => {
      const answers = ageGroups[ageLevel];
      const correct = answers.filter(a => a.isCorrect).length;
      return {
        age: ageLevel,
        correct: correct,
        total: answers.length
      };
    }).filter(perf => perf.total > 0); // Only include ages with questions
    
    const totalCorrect = allDetailedAnswers.filter(a => a.isCorrect).length;
    const totalQuestions = allDetailedAnswers.length;
    
    console.log('Report Data:', { questResults, agePerformance, totalCorrect, totalQuestions });
    
    return {
      questResults,
      agePerformance,
      score: totalCorrect,
      totalQuestions: totalQuestions
    };
  };

  // ===== USER TYPE SWITCHING (DEV MODE) =====
  const handleSwitchUserType = (userType: UserType) => {
    setCurrentUserType(userType);
    setIsAuthenticated(false);
    setAuthScreen('login');
    setChildScreen('childWelcome');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    toast.info(`Switched to ${userType} mode`);
  };

  // ===== RENDER LOGIC =====

  // CHILD/PARENT FLOW (No authentication required)
  if (currentUserType === 'child') {
    return (
      <LanguageProvider>
        <div className="relative">
          {childScreen === 'childWelcome' && (
            <ChildWelcomePage onStartAdventure={handleStartAdventure} />
          )}

          {childScreen === 'languageSelect' && (
            <WelcomeScreen 
              onStart={handleLanguageStart}
              brandingSettings={brandingSettings}
            />
          )}

          {childScreen === 'adventureMap' && (
            <AdventureMapScreen
              age={age}
              includeMandarinTest={includeMandarinTest}
              onModuleSelect={handleModuleSelect}
              completedModules={completedModules}
              brandingSettings={brandingSettings}
            />
          )}

          {childScreen === 'test' && (
            <QuestionScreen
              question={currentTestQuestions[currentQuestionIndex]}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={currentTestQuestions.length}
              onAnswer={handleAnswer}
              onNext={handleNext}
              brandingSettings={brandingSettings}
            />
          )}

          {childScreen === 'leadGate' && (
            <LeadGateScreen onSubmit={handleLeadSubmit} />
          )}

          {childScreen === 'results' && (
            <ResultsScreen
              childName={leadData.childName}
              score={calculateScore()}
              totalQuestions={currentTestQuestions.length}
              onShare={handleShare}
              brandingSettings={brandingSettings}
            />
          )}

          <DevNavigation 
            currentUserType={currentUserType} 
            onSwitchUserType={handleSwitchUserType} 
          />
          <Toaster />
        </div>
      </LanguageProvider>
    );
  }

  // KINDERGARTEN FLOW (Authentication required)
  if (currentUserType === 'kindergarten') {
    if (!isAuthenticated) {
      return (
        <div className="relative">
          {authScreen === 'login' && (
            <LoginForm
              userType="kindergarten"
              onLogin={handleLogin}
              onSwitchToSignup={() => setAuthScreen('signup')}
              onSwitchToForgotPassword={() => setAuthScreen('forgotPassword')}
            />
          )}

          {authScreen === 'signup' && (
            <SignupForm
              userType="kindergarten"
              onSignup={handleSignup}
              onSwitchToLogin={() => setAuthScreen('login')}
            />
          )}

          {authScreen === 'forgotPassword' && (
            <ForgotPasswordForm
              userType="kindergarten"
              onResetPassword={handleResetPassword}
              onBack={() => setAuthScreen('login')}
            />
          )}

          <DevNavigation 
            currentUserType={currentUserType} 
            onSwitchUserType={handleSwitchUserType} 
          />
          <Toaster />
        </div>
      );
    }

    return (
      <div className="relative">
        <KindergartenDashboard 
          schoolName={brandingSettings.schoolName}
          onLogout={handleLogout}
          questionBank={questionBank}
          setQuestionBank={setQuestionBank}
          questConfigs={questConfigs}
          setQuestConfigs={setQuestConfigs}
          brandingSettings={brandingSettings}
          setBrandingSettings={setBrandingSettings}
        />

        <DevNavigation 
          currentUserType={currentUserType} 
          onSwitchUserType={handleSwitchUserType} 
        />
        <Toaster />
      </div>
    );
  }

  // SUPER ADMIN FLOW (Authentication required)
  if (currentUserType === 'superadmin') {
    if (!isAuthenticated) {
      return (
        <div className="relative">
          {authScreen === 'login' && (
            <LoginForm
              userType="superadmin"
              onLogin={handleLogin}
              onSwitchToSignup={() => setAuthScreen('signup')}
              onSwitchToForgotPassword={() => setAuthScreen('forgotPassword')}
            />
          )}

          {authScreen === 'signup' && (
            <SignupForm
              userType="superadmin"
              onSignup={handleSignup}
              onSwitchToLogin={() => setAuthScreen('login')}
            />
          )}

          {authScreen === 'forgotPassword' && (
            <ForgotPasswordForm
              userType="superadmin"
              onResetPassword={handleResetPassword}
              onBack={() => setAuthScreen('login')}
            />
          )}

          <DevNavigation 
            currentUserType={currentUserType} 
            onSwitchUserType={handleSwitchUserType} 
          />
          <Toaster />
        </div>
      );
    }

    return (
      <div className="relative">
        <SuperAdminDashboard 
          onLogout={handleLogout}
          questionBank={questionBank}
          setQuestionBank={setQuestionBank}
          questConfigs={questConfigs}
          setQuestConfigs={setQuestConfigs}
        />

        <DevNavigation 
          currentUserType={currentUserType} 
          onSwitchUserType={handleSwitchUserType} 
        />
        <Toaster />
      </div>
    );
  }

  return null;
}