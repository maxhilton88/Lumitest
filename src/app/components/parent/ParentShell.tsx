import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { MasteryDashboard } from './MasteryDashboard';
import { EarningsHub } from './EarningsHub';
import { PlanBilling } from './PlanBilling';
import { AccountProfile } from './AccountProfile';
import { FantasyBackground, FantasyFooter } from '../FantasyBackground';
import { useLanguage } from '../LanguageContext';
import type { Language } from '../LanguageContext';
import type { ParentPage } from './SideMenu';
import { fetchReferralInfo } from '../../utils/parent-api';
import { type DetailedAnswer } from '../../utils/report-calculations';

import questMapBg from 'figma:asset/9cb2ea9cdf18b02a3a8d26e99ab2e65f990879b0.png';

interface ParentShellProps {
  parentData: any;
  onLogout: () => void;
  onStartTest: () => void;
  onStartPractice: () => void;
  onRefreshParent: () => void;
  /** Data from the child's assessment (if any) */
  childName?: string;
  childAge?: number;
  allAnswers?: DetailedAnswer[];
  moduleResults?: Record<string, { score: number; total: number }>;
  /** True only after all modules are completed and snapshot is persisted.
   *  When false, MasteryDashboard falls back to the last saved backend snapshot
   *  instead of showing partial in-progress answers. */
  assessmentCompleted?: boolean;
  liveQuests?: any[];
  /** If true, open mastery tab directly (first-login from gated report) */
  initialPage?: ParentPage;
  /** Subjects the parent has opted out of */
  excludedSubjects?: string[];
  onExcludedSubjectsChange?: (subjects: string[]) => void;
}

export const ParentShell: React.FC<ParentShellProps> = ({
  parentData,
  onLogout,
  onStartTest,
  onStartPractice,
  onRefreshParent,
  childName = '',
  childAge = 5,
  allAnswers = [],
  moduleResults = {},
  assessmentCompleted = false,
  liveQuests = [],
  initialPage = 'mastery',
  excludedSubjects = [],
  onExcludedSubjectsChange,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const routerNavigate = useNavigate();
  const [activePage, setActivePage] = useState<ParentPage>(initialPage);
  const [referralCredits, setReferralCredits] = useState(0);
  const [pageTransition, setPageTransition] = useState(false);
  const [scrollToShare, setScrollToShare] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // ── Initialize language from saved parentData preference ──
  useEffect(() => {
    const saved = parentData?.language;
    if (saved && (saved === 'en' || saved === 'ms' || saved === 'zh')) {
      setLanguage(saved as Language);
    }
  }, [parentData?.language]);

  // Sync activePage when the URL-derived initialPage changes (e.g. browser back/forward)
  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  // Load referral credits
  useEffect(() => {
    fetchReferralInfo()
      .then((info) => setReferralCredits(info?.referral_credits || 0))
      .catch(() => {});
  }, []);

  // Page transition animation + URL sync
  const handleNavigate = (page: ParentPage) => {
    if (page === activePage) return;

    // Special actions: training & quest trigger child flows, not pages
    if (page === 'training') {
      onStartPractice();
      return;
    }
    if (page === 'quest') {
      onStartTest();
      return;
    }

    setPageTransition(true);
    // Update URL to match the active page (e.g. /mastery, /plan)
    routerNavigate(`/${page}`, { replace: true });
    setTimeout(() => {
      setActivePage(page);
      setPageTransition(false);
      // Scroll the content area to top so new page starts from the top
      contentRef.current?.scrollTo({ top: 0 });
    }, 150);
  };

  // Navigate to plan page from Game Dashboard upgrade prompts
  const handleShowUpgrade = () => handleNavigate('plan');

  const renderPage = () => {
    switch (activePage) {
      case 'mastery':
        return (
          <MasteryDashboard
            childName={childName || parentData?.child_name || 'Explorer'}
            childAge={childAge || parentData?.child_age || 5}
            allAnswers={allAnswers}
            moduleResults={moduleResults}
            assessmentCompleted={assessmentCompleted}
            liveQuests={liveQuests}
            parentData={parentData}
            onShowUpgrade={handleShowUpgrade}
          />
        );
      case 'earnings':
        return <EarningsHub parentData={parentData} scrollToShare={scrollToShare} onScrollToShareDone={() => setScrollToShare(false)} />;
      case 'plan':
        return (
          <PlanBilling
            parentData={parentData}
            referralCredits={referralCredits}
            onRefreshParent={onRefreshParent}
            onNavigateToEarnings={() => {
              setScrollToShare(true);
              handleNavigate('earnings');
            }}
          />
        );
      case 'account':
        return (
          <AccountProfile
            parentData={parentData}
            childName={childName || parentData?.child_name || ''}
            childAge={childAge || parentData?.child_age || 5}
            language={language}
            onLanguageChange={(lang) => setLanguage(lang as Language)}
            onLogout={onLogout}
            excludedSubjects={excludedSubjects}
            onExcludedSubjectsChange={onExcludedSubjectsChange}
            onProfileSaved={onRefreshParent}
          />
        );
    }
  };

  return (
    <div className="h-[100dvh] relative overflow-hidden flex">
      {/* Shared fantasy background at shell level */}
      <FantasyBackground bgImage={questMapBg} overlayOpacity={0.75} />

      {/* Floating "Back to Realm" button — replaces the old SideMenu */}
      <button
        onClick={() => routerNavigate('/realm')}
        className="fixed top-4 left-4 z-[70] flex items-center gap-2 px-3.5 py-2.5 rounded-full transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, rgba(20,16,10,0.92), rgba(30,24,14,0.96))',
          border: '1.5px solid rgba(212,164,74,0.35)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5), 0 0 10px rgba(212,164,74,0.12)',
        }}
      >
        <ArrowLeft className="w-4 h-4" style={{ color: '#ffeaa7' }} />
        <span
          style={{
            fontFamily: "'Cherry Bomb One', cursive",
            fontSize: 11,
            fontWeight: 700,
            color: '#ffeaa7',
            textShadow: '0 1px 4px rgba(0,0,0,0.6), 0 0 8px rgba(212,164,74,0.2)',
            letterSpacing: '0.03em',
          }}
        >
          {t('realm.backToRealm')}
        </span>
      </button>

      {/* Content Area */}
      <div
        ref={contentRef}
        className="flex-1 relative z-10 overflow-y-auto"
      >
        <div
          className={`max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-20 transition-all duration-150 ${
            pageTransition ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          {renderPage()}
        </div>

        {/* Footer */}
        <FantasyFooter />
      </div>

      {/* Inject Cinzel + Cherry Bomb One fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};