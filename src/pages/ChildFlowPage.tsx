// ChildFlowPage — Route component for /, /play/:step, /t/:code, and /t/:code/:step
// Renders the child assessment flow state machine (welcome → language → quest map → test → results).
// Phase 3: Bidirectional sync between childScreen state and URL segments.
import React, { useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { useAppContext } from '../contexts/AppContext';
import { ChildWelcomePage } from '../components/screens/ChildWelcomePage';
import { WelcomeScreen } from '../components/screens/WelcomeScreen';
import { ResumeSessionDialog } from '../components/screens/ResumeSessionDialog';
import { QuestSelector } from '../components/screens/QuestSelector';
import { QuestionScreen } from '../components/screens/QuestionScreen';
import { VictoryScreen } from '../components/screens/VictoryScreen';
import { FullReportScreen } from '../components/screens/FullReportScreen';
import { GatedReportScreen } from '../components/screens/GatedReportScreen';
import {
  calculateTotalStars,
  calculateTP,
  calculateReadiness,
  calculateSubjectBreakdowns,
} from '../utils/report-calculations';
import { toast } from 'sonner@2.0.3';
import type { ChildScreen } from '../types/app-types';
import { setReferralCookie } from '../utils/referral-cookie';
import { MusicToggle } from '../components/MusicToggle';
import {
  playMusic,
  pauseMusic,
  isMusicEnabled,
  isMusicPlaying,
} from '../utils/music-service';

// ── Step ↔ ChildScreen mapping ──
const STEP_TO_SCREEN: Record<string, ChildScreen> = {
  start:   'languageSelect',
  resume:  'resumePrompt',
  map:     'adventureMap',
  quest:   'test',
  victory: 'victory',
  report:  'results',
  gate:    'gatedResults',
};

const SCREEN_TO_STEP: Record<ChildScreen, string | null> = {
  childWelcome:   null,   // index route — no step segment
  languageSelect: 'start',
  resumePrompt:   'resume',
  adventureMap:   'map',
  test:           'quest',
  victory:        'victory',
  results:        'report',
  gatedResults:   'gate',
};

export function ChildFlowPage() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { code, step } = useParams<{ code?: string; step?: string }>();

  // ── Capture parent-to-parent referral code from ?ref= on /t/:code URLs ──
  // Persist into the 365-day cookie so it survives the entire branded KG
  // funnel and is available when the visitor eventually signs up at /.
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const refCode = searchParams.get('ref');
    if (refCode) {
      console.log('[CHILD-FLOW] Captured referral code from /t/ URL:', refCode);
      setReferralCookie(refCode);
    }
  }, []); // Run once on mount

  // ── Save pending assessment to localStorage when gated results screen shows ──
  // This data survives the OAuth redirect so it can be persisted after signup.
  useEffect(() => {
    if (ctx.childScreen !== 'gatedResults') return;
    try {
      const answersData = ctx.allDetailedAnswers;
      if (answersData.length === 0) return;

      const tp = calculateTP(answersData);
      const readiness = calculateReadiness(answersData);
      const stars = calculateTotalStars(ctx.moduleResults);

      const questNameMap: Record<string, { name: string; icon: string }> = {};
      ctx.liveQuests.forEach((q: any) => {
        questNameMap[q.id] = { name: q.name?.en || q.subject, icon: q.icon };
      });
      new Set(answersData.map((a: any) => a.quest)).forEach((id: string) => {
        if (!questNameMap[id]) questNameMap[id] = { name: id, icon: '' };
      });

      const breakdowns = calculateSubjectBreakdowns(answersData, questNameMap);
      const subjectSummary = breakdowns.map((b: any) => ({
        name: b.questName,
        pct: b.overallPercentage,
        functionalAge: b.functionalAge,
      }));

      const totalCorrect = answersData.filter((a: any) => a.isCorrect).length;
      const totalQuestions = answersData.length;
      const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

      const pendingData = {
        snapshot: {
          childAge: ctx.age,
          overallPct,
          totalStars: stars.earned,
          maxStars: stars.possible,
          tpLevel: tp.level,
          readinessPct: readiness.percentage,
          totalQuestions,
          totalCorrect,
          subjectSummary,
        },
        leadInfo: {
          phone: ctx.leadData.whatsapp,
          childName: ctx.leadData.childName,
          parentName: ctx.leadData.parentName,
          childAge: ctx.age,
          schoolId: ctx.resolvedSchoolId || null,
        },
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem('foxy_pending_assessment', JSON.stringify(pendingData));
      console.log('[GATED] Saved pending assessment to localStorage for OAuth bridge', {
        totalQuestions,
        overallPct,
        phone: ctx.leadData.whatsapp ? '***' : '(none)',
      });
    } catch (err) {
      console.error('[GATED] Failed to save pending assessment:', err);
    }
  }, [ctx.childScreen]);

  // Prevent infinite sync loops
  const syncSource = useRef<'url' | 'state' | null>(null);

  // ── URL → State sync (runs when URL changes, e.g. browser back/forward or initial load) ──
  useEffect(() => {
    if (syncSource.current === 'state') {
      syncSource.current = null;
      return; // Skip — this URL change was caused by state→URL sync
    }

    const screenFromUrl = step ? STEP_TO_SCREEN[step] : 'childWelcome';
    if (screenFromUrl && screenFromUrl !== ctx.childScreen) {
      syncSource.current = 'url';
      ctx.setChildScreen(screenFromUrl);
    }
  }, [step]);

  // ── State → URL sync (runs when childScreen changes via handlers in App.tsx) ──
  useEffect(() => {
    if (syncSource.current === 'url') {
      syncSource.current = null;
      return; // Skip — this state change was caused by URL→state sync
    }

    const expectedStep = SCREEN_TO_STEP[ctx.childScreen];

    // Determine the base path for URL construction
    const basePath = code ? `/t/${code}` : '/play';
    const welcomePath = code ? `/t/${code}` : '/';

    let targetPath: string;
    if (expectedStep === null) {
      // childWelcome → go to the index route
      targetPath = welcomePath;
    } else {
      targetPath = `${basePath}/${expectedStep}`;
    }

    // Only navigate if the current path doesn't match
    if (location.pathname !== targetPath) {
      syncSource.current = 'state';
      navigate(targetPath, { replace: false });
    }
  }, [ctx.childScreen]);

  // ── Music lifecycle: auto-start after form submit, stop before signup ──
  const musicScreens = new Set<ChildScreen>(['resumePrompt', 'adventureMap', 'test', 'victory']);
  const showMusicToggle = musicScreens.has(ctx.childScreen);

  useEffect(() => {
    // Auto-start music when entering test flow screens (after user gesture from form submit)
    if (musicScreens.has(ctx.childScreen) && !isMusicPlaying() && isMusicEnabled()) {
      playMusic();
    }
    // Auto-pause music when leaving test flow (entering signup/report)
    if (ctx.childScreen === 'gatedResults' || ctx.childScreen === 'results') {
      if (isMusicPlaying()) {
        pauseMusic();
      }
    }
  }, [ctx.childScreen]);

  // ── Render the current screen ──
  return (
    <div className="relative">
      {/* Floating music toggle — visible during test flow screens */}
      {showMusicToggle && (
        <div className="fixed top-4 right-4 z-50">
          <MusicToggle />
        </div>
      )}

      {ctx.childScreen === 'childWelcome' && (
        <ChildWelcomePage onStartAdventure={ctx.handleStartAdventure} />
      )}

      {ctx.childScreen === 'languageSelect' && (
        <WelcomeScreen
          onStart={ctx.handleLanguageStart}
          onBack={() => ctx.setChildScreen('childWelcome')}
          brandingSettings={ctx.brandingSettings}
        />
      )}

      {ctx.childScreen === 'resumePrompt' && ctx.pendingResumeLead && (
        <ResumeSessionDialog
          childName={ctx.leadData.childName || ctx.pendingResumeLead.child_name}
          completedCount={ctx.pendingResumeLead.completed_modules?.length || 0}
          totalCount={
            ctx.liveQuests.length > 0
              ? ctx.liveQuests.filter(q => !q.is_mandarin || ctx.includeMandarinTest).length
              : (ctx.includeMandarinTest ? 5 : 4)
          }
          onResume={ctx.handleResumeSession}
          onStartFresh={ctx.handleStartFresh}
          onBack={() => {
            if (ctx.parentInitiatedQuestRef.current) {
              ctx.parentInitiatedQuestRef.current = false;
              navigate('/');
            } else {
              ctx.setChildScreen('languageSelect');
            }
          }}
        />
      )}

      {ctx.childScreen === 'adventureMap' && (
        <QuestSelector
          includeMandarinTest={ctx.includeMandarinTest}
          onModuleSelect={ctx.handleModuleSelect}
          completedModules={ctx.completedModules}
          moduleResults={ctx.moduleResults}
          brandingSettings={{
            ...ctx.brandingSettings,
            questCardImages: ctx.questCardImageUrls,
          }}
          justCompletedModule={ctx.justCompletedModule}
          onAnimationComplete={() => ctx.setJustCompletedModule(null)}
          onBack={() => {
            if (ctx.parentInitiatedQuestRef.current) {
              ctx.parentInitiatedQuestRef.current = false;
              navigate('/');
            } else {
              ctx.setChildScreen('childWelcome');
            }
          }}
          liveQuests={ctx.liveQuests}
        />
      )}

      {ctx.childScreen === 'test' && (
        <QuestionScreen
          question={ctx.currentTestQuestions[ctx.currentQuestionIndex]}
          questionNumber={ctx.currentQuestionIndex + 1}
          totalQuestions={ctx.currentTestQuestions.length}
          onAnswer={ctx.handleAnswer}
          onNext={ctx.handleNext}
          brandingSettings={ctx.brandingSettings}
        />
      )}

      {ctx.childScreen === 'victory' && (
        <VictoryScreen
          totalStars={calculateTotalStars(ctx.moduleResults).earned}
          onContinue={() => {
            if (ctx.isParentAuthenticated && ctx.parentData) {
              ctx.setChildScreen('results');
              ctx.persistAssessmentSnapshot();
            } else {
              ctx.setChildScreen('gatedResults');
            }
          }}
        />
      )}

      {ctx.childScreen === 'results' && (
        <FullReportScreen
          childName={ctx.leadData.childName}
          childAge={ctx.age}
          allAnswers={ctx.allDetailedAnswers}
          moduleResults={ctx.moduleResults}
          liveQuests={ctx.liveQuests}
          brandingSettings={ctx.brandingSettings}
          onShare={ctx.handleShare}
        />
      )}

      {ctx.childScreen === 'gatedResults' && (
        <GatedReportScreen
          childName={ctx.leadData.childName}
          childAge={ctx.age}
          allAnswers={ctx.allDetailedAnswers}
          moduleResults={ctx.moduleResults}
          liveQuests={ctx.liveQuests}
          brandingSettings={ctx.brandingSettings}
          onParentAuthSuccess={(pd: any) => {
            ctx.setIsParentAuthenticated(true);
            ctx.setParentData(pd);
            toast.success('Report unlocked!');
            ctx.setChildScreen('results');
            ctx.persistAssessmentSnapshot();
          }}
          onSkip={() => ctx.setChildScreen('results')}
        />
      )}
    </div>
  );
}