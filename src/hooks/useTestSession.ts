/**
 * useTestSession — Extracted from App.tsx (Stage 4)
 *
 * Owns ALL test/quest session state, refs, effects, and handlers:
 *   - Child screen navigation state machine
 *   - Question bank, quest configs, live quests
 *   - Lead creation/update lifecycle
 *   - Module selection, answer tracking, scoring
 *   - Session resume/fresh-start logic
 *   - School resolution for /t/:code branded flows
 *   - Assessment snapshot persistence
 *
 * Called from MainApp in App.tsx — results are spread into AppContext
 * so all page components continue using useAppContext() unchanged.
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner@2.0.3';
import type { Question } from '../components/screens/QuestionScreen';
import type { ChildScreen, BrandingSettings, DetailedAnswer, LiveQuest } from '../types/app-types';
import type { UserType } from '../components/DevNavigation';
import {
  calculateTotalStars,
  calculateTP,
  calculateSubjectBreakdowns,
  calculateReadiness,
  type DetailedAnswer as ReportDetailedAnswer,
} from '../utils/report-calculations';
import {
  submitLead,
  resolveSchool,
  resolveSchoolByCode,
  updateLead,
  lookupLead,
  fetchLiveQuests,
  fetchQuestionBank,
} from '../utils/api';
import { saveAssessmentSnapshot, getStoredParentData } from '../utils/parent-api';

// Demo school ID for child flow (in production, comes from URL)
const DEMO_SCHOOL_ID = 'demo-school-123';

// Dev mode: always store leads under hey@pitchdeck.my's kindergarten
const DEV_KINDERGARTEN_EMAIL = 'hey@pitchdeck.my';

// ── Hook params (dependencies from MainApp) ──
export interface UseTestSessionParams {
  currentUserType: UserType;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  locationPathname: string;
  brandingSettings: BrandingSettings;
  setBrandingSettings: React.Dispatch<React.SetStateAction<BrandingSettings>>;
}

export function useTestSession({
  currentUserType,
  navigate,
  locationPathname,
  brandingSettings,
  setBrandingSettings,
}: UseTestSessionParams) {
  // ── Child/Parent flow state ──
  const [childScreen, setChildScreen] = useState<ChildScreen>('childWelcome');
  const [age, setAge] = useState<number>(5);
  const [includeMandarinTest, setIncludeMandarinTest] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('include_mandarin_test');
      if (stored !== null) return JSON.parse(stored);
      const pd = getStoredParentData();
      if (pd?.include_mandarin_test) return true;
    } catch {}
    return false;
  });
  const [completedModules, setCompletedModules] = useState<string[]>([]);
  const [currentModule, setCurrentModule] = useState<string>('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: string; answerId: string }[]>([]);
  const [leadData, setLeadData] = useState({ childName: '', parentName: '', whatsapp: '' });

  // Resolved school ID for the child test flow
  const [resolvedSchoolId, setResolvedSchoolId] = useState<string | null>(null);
  const [isResolvingSchool, setIsResolvingSchool] = useState(false);
  const resolvedSchoolIdRef = useRef<string | null>(null);

  // Tracks if the quest was initiated from the parent GameDashboard
  const parentInitiatedQuestRef = useRef(false);

  // Lead ID for the current test session
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const currentLeadIdRef = useRef<string | null>(null);
  const leadDataRef = useRef({ childName: '', parentName: '', whatsapp: '' });
  const ageRef = useRef(5);
  const includeMandarinRef = useRef(false);

  // Global question bank
  const [questionBank, setQuestionBank] = useState<Question[]>([]);

  // Global quest configuration
  const [questConfigs, setQuestConfigs] = useState({
    english: { language: 'en' as const, numberOfQuestions: 20, skillFilters: [] as string[] },
    numbers: { language: 'global' as const, numberOfQuestions: 25, skillFilters: ['Numeracy'] },
    bahasa: { language: 'ms' as const, numberOfQuestions: 20, skillFilters: [] as string[] },
    mandarin: { language: 'zh' as const, numberOfQuestions: 15, skillFilters: [] as string[] },
    science: { language: 'global' as const, numberOfQuestions: 30, skillFilters: ['General Science'] },
  });

  // Store the loaded questions for current module test
  const [currentTestQuestions, setCurrentTestQuestions] = useState<Question[]>([]);

  // Detailed test results
  const [allDetailedAnswers, setAllDetailedAnswers] = useState<DetailedAnswer[]>([]);
  const [currentModuleAnswers, setCurrentModuleAnswers] = useState<DetailedAnswer[]>([]);

  // Module results — per-module scores for quest card star ratings
  const [moduleResults, setModuleResults] = useState<Record<string, { score: number; total: number }>>({});

  // Assessment completed flag
  const [assessmentCompleted, setAssessmentCompleted] = useState(false);

  // Unlock animation — track which module was just completed
  const [justCompletedModule, setJustCompletedModule] = useState<string | null>(null);

  // Session resume — stores existing lead data while showing resume prompt
  const [pendingResumeLead, setPendingResumeLead] = useState<any>(null);

  // Live quests from backend
  const [liveQuests, setLiveQuests] = useState<LiveQuest[]>([]);
  const [questCardImageUrls, setQuestCardImageUrls] = useState<Record<string, string>>({});
  const [isLoadingQuests, setIsLoadingQuests] = useState(false);
  const liveQuestsRef = useRef<LiveQuest[]>([]);

  // ───────────────────────────────────────────────
  // EFFECTS
  // ───────────────────────────────────────────────

  // ── School resolution for /t/:code ──
  useEffect(() => {
    const match = locationPathname.match(/^\/t\/([^/]+)/);
    if (!match) return;
    const code = match[1];
    if (resolvedSchoolIdRef.current || isResolvingSchool) return;

    setIsResolvingSchool(true);
    console.log(`[SCHOOL] Resolving from URL code: ${code}`);

    resolveSchoolByCode(code)
      .then((school) => {
        setResolvedSchoolId(school.id);
        resolvedSchoolIdRef.current = school.id;
        if (school.schoolName) {
          setBrandingSettings((prev) => ({
            ...prev,
            schoolName: school.schoolName,
            kindergartenUrl: school.kindergartenUrl || prev.kindergartenUrl,
            ...(school.branding?.primaryColor ? { primaryColor: school.branding.primaryColor } : {}),
            ...(school.branding?.logoUrl ? { logoUrl: school.branding.logoUrl } : {}),
          }));
        }
        console.log(`[SCHOOL] Resolved ${school.schoolName} (${school.id}) from code ${code}`);
        toast.success(`Welcome to ${school.schoolName}!`);
      })
      .catch((err) => {
        console.error(`[SCHOOL] Failed to resolve code ${code}:`, err);
        toast.error(`School "${code}" not found. Using default.`);
      })
      .finally(() => setIsResolvingSchool(false));
  }, [locationPathname]);

  // ── Fetch live quests on mount (child/parent mode) ──
  useEffect(() => {
    if (currentUserType !== 'child' && currentUserType !== 'parent') return;
    if (liveQuests.length > 0) return;

    const loadLiveQuests = async () => {
      setIsLoadingQuests(true);
      try {
        const quests = await fetchLiveQuests();
        console.log(`[QUESTS] Loaded ${quests.length} live quests`);
        setLiveQuests(quests);
        liveQuestsRef.current = quests;

        const imageUrls: Record<string, string> = {};
        for (const q of quests) {
          if (q.signed_image_url) {
            imageUrls[q.id] = q.signed_image_url;
          }
        }
        setQuestCardImageUrls(imageUrls);
        console.log(`[QUESTS] Resolved ${Object.keys(imageUrls).length} quest card images (server-side)`);
      } catch (error) {
        console.error('[QUESTS] Failed to fetch live quests:', error);
      } finally {
        setIsLoadingQuests(false);
      }
    };

    loadLiveQuests();
  }, [currentUserType]);

  // ───────────────────────────────────────────────
  // HELPERS
  // ───────────────────────────────────────────────

  // Transform backend questions → frontend Question[]
  const transformBankQuestions = (bankQuestions: any[], questId: string): Question[] => {
    return bankQuestions.map((bq: any) => {
      const optionsEn = Array.isArray(bq.options_en) ? bq.options_en : [];
      const optionsMs = Array.isArray(bq.options_ms) ? bq.options_ms : [];
      const optionsZh = Array.isArray(bq.options_zh) ? bq.options_zh : [];

      const mergedOptions = optionsEn.map((optEn: any, idx: number) => {
        const optMs = optionsMs[idx] || {};
        const optZh = optionsZh[idx] || {};
        return {
          id: optEn.id || String.fromCharCode(97 + idx),
          text: {
            en: typeof optEn === 'string' ? optEn : (optEn.text || ''),
            ms: typeof optMs === 'string' ? optMs : (optMs.text || ''),
            zh: typeof optZh === 'string' ? optZh : (optZh.text || ''),
          },
        };
      });

      return {
        id: bq.q_id,
        type: (bq.input_type || 'mcq') as Question['type'],
        question: {
          en: bq.question_text_en || '',
          ms: bq.question_text_ms || '',
          zh: bq.question_text_zh || '',
        },
        options: mergedOptions,
        correctAnswer: bq.correct_answer || 'a',
        foxyMessage: bq.visual_prompt
          ? { en: bq.visual_prompt, ms: bq.visual_prompt, zh: bq.visual_prompt }
          : undefined,
        questionImage: bq.image_url || undefined,
        ageDifficulty: bq.age_target,
        quest: questId,
      } as Question & { ageDifficulty?: number; quest?: string };
    });
  };

  // Load questions from local question bank (fallback)
  const loadQuestionsForModule = (moduleId: string, childAge: number): Question[] => {
    if (questionBank.length === 0) {
      console.warn('[QUEST] Local question bank is empty — questions should be loaded from backend');
      return [];
    }

    const config = questConfigs[moduleId as keyof typeof questConfigs];
    if (!config) {
      console.warn(`[QUEST] No config found for ${moduleId} — returning empty`);
      return [];
    }

    let filteredQuestions = questionBank.filter((q) => {
      const matchesQuest = q.quest === moduleId;
      const matchesLanguage =
        config.language === 'global' || q.language === 'global' || q.language === config.language;
      const matchesSkills =
        config.skillFilters.length === 0 ||
        (q.skills && q.skills.some((skill) => config.skillFilters.includes(skill)));
      return matchesQuest && matchesLanguage && matchesSkills;
    });

    if (filteredQuestions.length === 0) {
      console.warn(`[QUEST] No questions found for ${moduleId} in local Question Bank`);
      return [];
    }

    const questionsPerAge: Record<number, Question[]> = { 4: [], 5: [], 6: [], 7: [] };
    filteredQuestions.forEach((q) => {
      if (q.ageDifficulty && questionsPerAge[q.ageDifficulty]) {
        questionsPerAge[q.ageDifficulty].push(q);
      }
    });

    const targetQuestionsPerAge = Math.ceil(config.numberOfQuestions / 4);
    const selectedQuestions: Question[] = [];

    [4, 5, 6, 7].forEach((ageLevel) => {
      const ageQuestions = questionsPerAge[ageLevel];
      const shuffled = [...ageQuestions].sort(() => Math.random() - 0.5);
      const toTake = Math.min(targetQuestionsPerAge, shuffled.length);
      selectedQuestions.push(...shuffled.slice(0, toTake));
    });

    if (selectedQuestions.length < config.numberOfQuestions) {
      const remaining = filteredQuestions.filter((q) => !selectedQuestions.includes(q));
      const shuffled = [...remaining].sort(() => Math.random() - 0.5);
      selectedQuestions.push(...shuffled.slice(0, config.numberOfQuestions - selectedQuestions.length));
    }

    const finalQuestions = selectedQuestions
      .slice(0, config.numberOfQuestions)
      .sort(() => Math.random() - 0.5);

    console.log(`Loaded ${finalQuestions.length} questions for ${moduleId}`);
    return finalQuestions;
  };

  // Calculate detailed report data from answers
  const calculateReportDataFrom = (answersToUse: DetailedAnswer[]) => {
    const questNames: Record<string, string> = {
      english: 'English Forest',
      numbers: 'Numbers Island',
      bahasa: 'Rimba Bahasa',
      mandarin: 'Mandarin Mountain',
      science: 'Mystery Jungle',
    };

    const questGroups: Record<string, DetailedAnswer[]> = {};
    answersToUse.forEach((answer) => {
      const quest = answer.quest || 'unknown';
      if (!questGroups[quest]) questGroups[quest] = [];
      questGroups[quest].push(answer);
    });

    const questResults = Object.keys(questGroups).map((questId) => {
      const qAnswers = questGroups[questId];
      const correct = qAnswers.filter((a) => a.isCorrect).length;
      return { quest: questNames[questId] || questId, score: correct, total: qAnswers.length };
    });

    const ageGroups: Record<number, DetailedAnswer[]> = { 4: [], 5: [], 6: [], 7: [] };
    answersToUse.forEach((answer) => {
      const ageDiff = answer.ageDifficulty || age;
      if (ageGroups[ageDiff]) ageGroups[ageDiff].push(answer);
    });

    const agePerformance = [4, 5, 6, 7]
      .map((ageLevel) => {
        const aAnswers = ageGroups[ageLevel];
        const correct = aAnswers.filter((a) => a.isCorrect).length;
        return { age: ageLevel, correct, total: aAnswers.length };
      })
      .filter((perf) => perf.total > 0);

    const totalCorrect = answersToUse.filter((a) => a.isCorrect).length;
    const totalQuestions = answersToUse.length;

    console.log('Report Data:', { questResults, agePerformance, totalCorrect, totalQuestions });
    return { questResults, agePerformance, score: totalCorrect, totalQuestions };
  };

  // ───────────────────────────────────────────────
  // HANDLERS
  // ───────────────────────────────────────────────

  const handleStartAdventure = async () => {
    setChildScreen('languageSelect');

    if (!resolvedSchoolId && !isResolvingSchool) {
      setIsResolvingSchool(true);
      try {
        const school = await resolveSchool({ email: DEV_KINDERGARTEN_EMAIL });
        setResolvedSchoolId(school.id);
        resolvedSchoolIdRef.current = school.id;
        console.log('School resolved for child flow:', school.schoolName, school.id);
      } catch (error) {
        console.error('Failed to resolve school:', error);
      } finally {
        setIsResolvingSchool(false);
      }
    }
  };

  // Start a brand new session (wipe all progress)
  const startFreshSession = async (
    childName: string,
    parentName: string,
    whatsapp: string,
    selectedAge: number,
    selectedIncludeMandarinTest: boolean,
    schoolId: string
  ) => {
    setCompletedModules([]);
    setAllDetailedAnswers([]);
    setCurrentLeadId(null);
    currentLeadIdRef.current = null;
    setModuleResults({});
    setAssessmentCompleted(false);
    setJustCompletedModule(null);
    setPendingResumeLead(null);
    setChildScreen('adventureMap');

    console.log('[LEAD] Early save (fresh) — school:', schoolId, 'child:', childName, 'phone:', whatsapp);

    try {
      const result = await submitLead({
        schoolId,
        childName,
        parentName,
        whatsapp,
        childAge: selectedAge,
        includeMandarin: selectedIncludeMandarinTest,
        score: 0,
        totalQuestions: 0,
        answers: [],
        questResults: [],
        agePerformance: [],
        status: 'in_progress',
      });

      setCurrentLeadId(result.leadId);
      currentLeadIdRef.current = result.leadId;
      console.log('[LEAD] Early save SUCCESS:', result.leadId, result.isUpdate ? '(retake)' : '(new)');
    } catch (error) {
      console.error('[LEAD] Early save FAILED:', error);
      toast.error(
        `Lead save failed: ${error instanceof Error ? error.message : 'Unknown error'}. Will retry after module.`
      );
    }
  };

  const handleLanguageStart = async (
    childName: string,
    parentName: string,
    whatsapp: string,
    selectedAge: number,
    selectedIncludeMandarinTest: boolean
  ) => {
    setLeadData({ childName, parentName, whatsapp });
    setAge(selectedAge);
    setIncludeMandarinTest(selectedIncludeMandarinTest);
    leadDataRef.current = { childName, parentName, whatsapp };
    ageRef.current = selectedAge;
    includeMandarinRef.current = selectedIncludeMandarinTest;

    const schoolId =
      resolvedSchoolIdRef.current ||
      resolvedSchoolId ||
      localStorage.getItem('school_id') ||
      DEMO_SCHOOL_ID;

    // Check for existing in-progress session
    try {
      console.log('[RESUME] Checking for existing session:', { phone: whatsapp, schoolId });
      const lookupResult = await lookupLead(whatsapp, schoolId);

      if (lookupResult.found && lookupResult.resumable && lookupResult.lead) {
        const existingLead = lookupResult.lead;
        console.log(
          `[RESUME] Found resumable session: ${existingLead.id}, completed: ${existingLead.completed_modules.length} modules`
        );
        setPendingResumeLead(existingLead);
        setChildScreen('resumePrompt');
        return;
      } else {
        console.log('[RESUME] No resumable session found, starting fresh');
      }
    } catch (error) {
      console.error('[RESUME] Lookup failed, starting fresh:', error);
    }

    startFreshSession(childName, parentName, whatsapp, selectedAge, selectedIncludeMandarinTest, schoolId);
  };

  const handleResumeSession = () => {
    if (!pendingResumeLead) return;

    const lead = pendingResumeLead;
    console.log(
      `[RESUME] Restoring session for lead ${lead.id}: ${lead.completed_modules.length} modules done`
    );

    setCurrentLeadId(lead.id);
    currentLeadIdRef.current = lead.id;
    setCompletedModules(lead.completed_modules || []);
    setAllDetailedAnswers(lead.answers || []);
    setAge(lead.child_age || ageRef.current);
    ageRef.current = lead.child_age || ageRef.current;
    setIncludeMandarinTest(lead.include_mandarin_test || false);
    includeMandarinRef.current = lead.include_mandarin_test || false;

    // Rebuild moduleResults from answers
    const restoredModuleResults: Record<string, { score: number; total: number }> = {};
    const answersByQuest: Record<string, any[]> = {};
    (lead.answers || []).forEach((a: any) => {
      const quest = a.quest || 'unknown';
      if (!answersByQuest[quest]) answersByQuest[quest] = [];
      answersByQuest[quest].push(a);
    });
    Object.entries(answersByQuest).forEach(([questId, qAnswers]) => {
      const correct = qAnswers.filter((a: any) => a.isCorrect).length;
      restoredModuleResults[questId] = { score: correct, total: qAnswers.length };
    });
    setModuleResults(restoredModuleResults);
    setAssessmentCompleted(false);
    setJustCompletedModule(null);
    setPendingResumeLead(null);
    setChildScreen('adventureMap');

    toast.success('Welcome back! Continuing your adventure!');
    console.log(`[RESUME] Session restored. Completed modules: [${lead.completed_modules.join(', ')}]`);
  };

  const handleStartFresh = () => {
    const schoolId =
      resolvedSchoolIdRef.current ||
      resolvedSchoolId ||
      localStorage.getItem('school_id') ||
      DEMO_SCHOOL_ID;
    setPendingResumeLead(null);
    startFreshSession(
      leadData.childName,
      leadData.parentName,
      leadData.whatsapp,
      ageRef.current,
      includeMandarinRef.current,
      schoolId
    );
  };

  const handleModuleSelect = async (moduleId: string) => {
    const quest = liveQuestsRef.current.find((q) => q.id === moduleId);
    const subject = quest?.subject;

    if (subject) {
      try {
        console.log(`[QUEST] Fetching questions for subject: ${subject}`);
        const bankQuestions = await fetchQuestionBank({ subject });
        if (bankQuestions.length > 0) {
          const transformed = transformBankQuestions(bankQuestions, moduleId);
          const limit = quest?.question_count || 10;
          const shuffled = [...transformed].sort(() => Math.random() - 0.5).slice(0, limit);
          console.log(
            `[QUEST] Loaded ${shuffled.length} live questions for "${subject}" (${bankQuestions.length} total in bank)`
          );
          setCurrentTestQuestions(shuffled);
          setCurrentModule(moduleId);
          setChildScreen('test');
          setCurrentQuestionIndex(0);
          setAnswers([]);
          setCurrentModuleAnswers([]);
          const questName = quest?.name?.en || subject;
          toast.success(`Starting ${questName}!`);
          return;
        }
      } catch (error) {
        console.error(`[QUEST] Failed to fetch questions for ${subject}:`, error);
      }
    }

    // Fallback: use local loadQuestionsForModule
    console.warn(`[QUEST] Falling back to local questions for ${moduleId}`);
    const loadedQuestions = loadQuestionsForModule(moduleId, age);
    setCurrentTestQuestions(loadedQuestions);
    setCurrentModule(moduleId);
    setChildScreen('test');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentModuleAnswers([]);
    toast.success(`Starting ${moduleId} adventure!`);
  };

  const handleAnswer = (answerId: string) => {
    const currentQuestion = currentTestQuestions[currentQuestionIndex];

    setAnswers([...answers, { questionId: currentQuestion.id, answerId }]);

    const detailedAnswer: DetailedAnswer = {
      questionId: currentQuestion.id,
      answerId,
      correctAnswer: currentQuestion.correctAnswer,
      isCorrect: answerId === currentQuestion.correctAnswer,
      quest: currentQuestion.quest || currentModule,
      ageDifficulty: currentQuestion.ageDifficulty || age,
    };

    setCurrentModuleAnswers([...currentModuleAnswers, detailedAnswer]);
  };

  const handleNext = () => {
    if (currentQuestionIndex < currentTestQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      // Module completed
      const newAllAnswers = [...allDetailedAnswers, ...currentModuleAnswers];
      const newCompletedModules = [...completedModules, currentModule];

      setAllDetailedAnswers(newAllAnswers);
      setCompletedModules(newCompletedModules);

      const moduleScore = currentModuleAnswers.filter((a) => a.isCorrect).length;
      const moduleTotal = currentModuleAnswers.length;
      setModuleResults((prev) => ({
        ...prev,
        [currentModule]: { score: moduleScore, total: moduleTotal },
      }));

      const reportData = calculateReportDataFrom(newAllAnswers);

      const totalQuestsRequired =
        liveQuestsRef.current.length > 0
          ? liveQuestsRef.current.filter((q) => !q.is_mandarin || includeMandarinTest).length
          : includeMandarinTest
            ? 5
            : 4;
      const isLastModule = newCompletedModules.length >= totalQuestsRequired;

      const saveLead = async () => {
        const schoolId =
          resolvedSchoolIdRef.current || localStorage.getItem('school_id') || DEMO_SCHOOL_ID;

        if (currentLeadIdRef.current) {
          console.log(
            `[LEAD] Updating lead ${currentLeadIdRef.current} after module ${currentModule}`
          );
          try {
            await updateLead(currentLeadIdRef.current, {
              score: reportData.score,
              total_questions: reportData.totalQuestions,
              answers: newAllAnswers,
              quest_results: reportData.questResults,
              age_performance: reportData.agePerformance,
              completed_modules: newCompletedModules,
              status: isLastModule ? 'completed' : 'in_progress',
            });
            console.log(
              `[LEAD] Update SUCCESS for ${currentLeadIdRef.current}. Status: ${isLastModule ? 'completed' : 'in_progress'}`
            );
          } catch (error) {
            console.error('[LEAD] Update FAILED:', error);
          }
        } else {
          console.warn(
            '[LEAD] No lead ID found! Early save must have failed. Creating lead now as fallback...'
          );
          try {
            const result = await submitLead({
              schoolId,
              childName: leadDataRef.current.childName,
              parentName: leadDataRef.current.parentName,
              whatsapp: leadDataRef.current.whatsapp,
              childAge: ageRef.current,
              includeMandarin: includeMandarinRef.current,
              score: reportData.score,
              totalQuestions: reportData.totalQuestions,
              answers: newAllAnswers,
              questResults: reportData.questResults,
              agePerformance: reportData.agePerformance,
              status: isLastModule ? 'completed' : 'in_progress',
            });
            currentLeadIdRef.current = result.leadId;
            setCurrentLeadId(result.leadId);
            console.log(`[LEAD] Fallback save SUCCESS: ${result.leadId}`);
          } catch (error) {
            console.error('[LEAD] Fallback save FAILED:', error);
            toast.error('Could not save progress. Please check your connection.');
          }
        }
      };

      // Fire and forget
      saveLead();

      if (isLastModule) {
        toast.success('All adventures completed!');
        setChildScreen('victory');
      } else {
        setJustCompletedModule(currentModule);
        setChildScreen('adventureMap');
      }
    }
  };

  const handleShare = () => {
    const totalCorrect = allDetailedAnswers.filter((a) => a.isCorrect).length;
    const totalQuestions = allDetailedAnswers.length;
    const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

    const assessmentUrl = brandingSettings.kindergartenUrl
      ? `https://projectlumi.org/${brandingSettings.kindergartenUrl}`
      : 'https://projectlumi.org';

    const shareText = `🎉 ${leadData.childName} scored ${percentage}% on the KSSR readiness test at ${brandingSettings.schoolName}! 🎓\n\nTry the free assessment for your child too: ${assessmentUrl}`;

    if (navigator.share) {
      navigator.share({ title: 'KSSR Readiness Assessment Results', text: shareText }).catch(
        console.error
      );
    } else {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  // Persist assessment snapshot to parent dashboard
  const persistAssessmentSnapshot = async (answersToUse?: DetailedAnswer[]) => {
    const answersData = (answersToUse || allDetailedAnswers) as ReportDetailedAnswer[];
    if (answersData.length === 0) {
      console.warn('[SNAPSHOT] No answers to persist, skipping snapshot save');
      return;
    }

    setAssessmentCompleted(true);

    try {
      const questNameMap: Record<string, { name: string; icon: string }> = {};
      liveQuests.forEach((q) => {
        questNameMap[q.id] = { name: q.name?.en || q.subject, icon: q.icon };
      });
      const allQuestIds = new Set(answersData.map((a) => a.quest));
      allQuestIds.forEach((id) => {
        if (!questNameMap[id]) {
          questNameMap[id] = { name: id, icon: '' };
        }
      });

      const tp = calculateTP(answersData);
      const readiness = calculateReadiness(answersData);
      const stars = calculateTotalStars(moduleResults);
      const breakdowns = calculateSubjectBreakdowns(answersData, questNameMap);

      const subjectSummary = breakdowns.map((b) => ({
        name: b.questName,
        pct: b.overallPercentage,
        functionalAge: b.functionalAge,
      }));

      const totalCorrect = answersData.filter((a) => a.isCorrect).length;
      const totalQuestions = answersData.length;
      const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

      console.log('[SNAPSHOT] Persisting assessment snapshot:', {
        childAge: age,
        overallPct,
        tpLevel: tp.level,
        readinessPct: readiness.percentage,
        stars: `${stars.earned}/${stars.possible}`,
        subjects: subjectSummary.length,
      });

      const result = await saveAssessmentSnapshot({
        childAge: age,
        overallPct,
        totalStars: stars.earned,
        maxStars: stars.possible,
        tpLevel: tp.level,
        readinessPct: readiness.percentage,
        totalQuestions,
        totalCorrect,
        subjectSummary,
      });

      if (result) {
        console.log('[SNAPSHOT] Assessment snapshot saved successfully');
      } else {
        console.warn('[SNAPSHOT] Assessment snapshot save returned null (may have failed)');
      }
    } catch (error) {
      console.error('[SNAPSHOT] Failed to persist assessment snapshot:', error);
    }
  };

  // ── Reset test state (called from handleLogout and handleSwitchUserType) ──
  const resetTestState = () => {
    setChildScreen('childWelcome');
    setCurrentQuestionIndex(0);
    setAnswers([]);
  };

  // ───────────────────────────────────────────────
  // RETURN
  // ───────────────────────────────────────────────

  return {
    // State
    childScreen,
    setChildScreen,
    age,
    includeMandarinTest,
    setIncludeMandarinTest,
    completedModules,
    currentModule,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    currentTestQuestions,
    allDetailedAnswers,
    currentModuleAnswers,
    moduleResults,
    assessmentCompleted,
    leadData,
    pendingResumeLead,
    justCompletedModule,
    setJustCompletedModule,
    liveQuests,
    questCardImageUrls,
    questionBank,
    setQuestionBank,
    questConfigs,
    setQuestConfigs,
    answers,
    setAnswers,
    // School resolution
    resolvedSchoolId,
    setResolvedSchoolId,
    resolvedSchoolIdRef,
    isResolvingSchool,
    // Refs
    parentInitiatedQuestRef,
    // Handlers
    handleStartAdventure,
    handleLanguageStart,
    handleModuleSelect,
    handleAnswer,
    handleNext,
    handleShare,
    handleResumeSession,
    handleStartFresh,
    persistAssessmentSnapshot,
    // Reset
    resetTestState,
  };
}
