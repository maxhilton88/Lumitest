import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { SideMenu, type ParentPage } from './SideMenu';
import { GameDashboard } from './GameDashboard';
import { MasteryDashboard } from './MasteryDashboard';
import { VideoLibrary } from './VideoLibrary';
import { EarningsHub } from './EarningsHub';
import { PlanBilling } from './PlanBilling';
import { AccountProfile } from './AccountProfile';
import { FantasyBackground, FantasyFooter } from '../FantasyBackground';
import { useLanguage } from '../LanguageContext';
import type { Language } from '../LanguageContext';
import { fetchReferralInfo, getStoredParentData } from '../../utils/parent-api';
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
  /** Mandarin quest toggle */
  includeMandarinTest: boolean;
  onMandarinToggle: (val: boolean) => void;
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
  initialPage = 'game',
  includeMandarinTest,
  onMandarinToggle,
}) => {
  const { language, setLanguage } = useLanguage();
  const routerNavigate = useNavigate();
  const [activePage, setActivePage] = useState<ParentPage>(initialPage);
  const [referralCredits, setReferralCredits] = useState(0);
  const [pageTransition, setPageTransition] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Sync activePage when the URL-derived initialPage changes (e.g. browser back/forward)
  useEffect(() => {
    setActivePage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load referral credits
  useEffect(() => {
    fetchReferralInfo()
      .then((info) => setReferralCredits(info?.referral_credits || 0))
      .catch(() => {});
  }, []);

  // Page transition animation + URL sync
  const handleNavigate = (page: ParentPage) => {
    if (page === activePage) return;
    setPageTransition(true);
    // Update URL to match the active page (e.g. /mastery, /plan)
    routerNavigate(`/${page}`);
    setTimeout(() => {
      setActivePage(page);
      setPageTransition(false);
    }, 150);
  };

  // Navigate to plan page from Game Dashboard upgrade prompts
  const handleShowUpgrade = () => handleNavigate('plan');

  const renderPage = () => {
    switch (activePage) {
      case 'game':
        return (
          <GameDashboard
            parentData={parentData}
            onStartTest={onStartTest}
            onStartPractice={onStartPractice}
            onShowUpgrade={handleShowUpgrade}
            moduleResults={moduleResults}
            assessmentCompleted={assessmentCompleted}
            onViewResults={() => handleNavigate('mastery')}
            onOpenLibrary={() => handleNavigate('library')}
          />
        );
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
          />
        );
      case 'library':
        return (
          <VideoLibrary
            parentData={parentData}
            onShowUpgrade={handleShowUpgrade}
          />
        );
      case 'earnings':
        return <EarningsHub parentData={parentData} />;
      case 'plan':
        return (
          <PlanBilling
            parentData={parentData}
            referralCredits={referralCredits}
            onRefreshParent={onRefreshParent}
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
            includeMandarinTest={includeMandarinTest}
            onMandarinToggle={onMandarinToggle}
          />
        );
    }
  };

  return (
    <div className="h-[100dvh] relative overflow-hidden flex">
      {/* Shared fantasy background at shell level */}
      <FantasyBackground bgImage={questMapBg} overlayOpacity={0.75} />

      {/* Side Menu */}
      <SideMenu
        activePage={activePage}
        onNavigate={handleNavigate}
        childName={childName || parentData?.child_name}
        parentName={parentData?.name}
        onLogout={onLogout}
        language={language}
        onLanguageChange={(lang) => setLanguage(lang as Language)}
      />

      {/* Content Area */}
      <div
        className="flex-1 relative z-10 overflow-y-auto"
        style={{
          marginLeft: isMobile ? 0 : '64px',
          transition: 'margin-left 0.3s ease',
        }}
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

      {/* Inject Cinzel font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />
    </div>
  );
};