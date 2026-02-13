// ParentPage — Route component for / (root)
// Handles parent auth guard + ParentShell rendering.
import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { useAppContext } from '../contexts/AppContext';
import { ParentAuthForm } from '../components/auth/ParentAuthForm';
import { ParentShell } from '../components/parent/ParentShell';
import { PracticeScreen } from '../components/screens/PracticeScreen';
import { WhatsAppPromptModal } from '../components/WhatsAppPromptModal';
import { parentLogout, parentValidateSession, getStoredParentData } from '../utils/parent-api';
import { resolveSchool } from '../utils/api';
import { setReferralCookie, getReferralCookie } from '../utils/referral-cookie';
import { toast } from 'sonner@2.0.3';
import type { ParentPage as ParentPageType } from '../components/parent/SideMenu';

// Dev mode: always store leads under hey@pitchdeck.my's kindergarten
const DEV_KINDERGARTEN_EMAIL = 'hey@pitchdeck.my';

export function ParentPage() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Read referral code from URL query params (e.g. /?ref=FOXYFAN123)
  const parentSearchParams = new URLSearchParams(location.search);
  const urlReferralCode = parentSearchParams.get('ref') || undefined;

  // Persist referral code in a 365-day cookie so it survives page
  // reloads, browser closes, and OAuth round-trips.
  if (urlReferralCode) {
    setReferralCookie(urlReferralCode);
  }

  // Effective referral code: URL param > cookie
  const effectiveReferralCode = urlReferralCode || getReferralCookie() || undefined;

  // ── Not authenticated → show ParentAuthForm ──
  if (!ctx.isParentAuthenticated || !ctx.parentData) {
    return (
      <div className="relative">
        <ParentAuthForm
          onSuccess={(pd: any) => {
            ctx.setIsParentAuthenticated(true);
            ctx.setParentData(pd);
            navigate('/game', { replace: true });
          }}
          onBack={() => ctx.handleSwitchUserType('child')}
          defaultReferralCode={effectiveReferralCode}
        />
      </div>
    );
  }

  // ── Practice mode overlay ──
  if (ctx.showPracticeMode) {
    return (
      <div className="relative">
        <PracticeScreen
          liveQuests={ctx.liveQuests}
          brandingSettings={ctx.brandingSettings}
          questCardImageUrls={ctx.questCardImageUrls}
          onExit={() => ctx.setShowPracticeMode(false)}
        />
      </div>
    );
  }

  // ── Derive parent sub-page from URL for deep-linking ──
  // Root paths: /game, /mastery, /plan, etc. (no /parent prefix)
  const parentSubPath = location.pathname.replace(/^\//, '') || 'game';
  const parentPageFromUrl = (
    ['game', 'mastery', 'library', 'earnings', 'plan', 'account'].includes(parentSubPath)
      ? parentSubPath
      : 'game'
  ) as ParentPageType;

  return (
    <div className="relative">
      <ParentShell
        parentData={ctx.parentData}
        initialPage={parentPageFromUrl}
        onLogout={() => {
          parentLogout();
          ctx.setIsParentAuthenticated(false);
          ctx.setParentData(null);
        }}
        onStartTest={async () => {
          const childName = ctx.parentData?.child_name || 'Explorer';
          const parentName = ctx.parentData?.name || 'Parent';
          const childAge = ctx.parentData?.child_age || 5;
          const mandarin = ctx.includeMandarinTest;

          ctx.parentInitiatedQuestRef.current = true;

          if (!ctx.resolvedSchoolIdRef.current && !ctx.isResolvingSchool) {
            try {
              const school = await resolveSchool({ email: DEV_KINDERGARTEN_EMAIL });
              ctx.setResolvedSchoolId(school.id);
              ctx.resolvedSchoolIdRef.current = school.id;
            } catch (err) {
              console.error('School resolution failed (parent quest):', err);
            }
          }

          const launchQuest = (phone: string) => {
            navigate('/play/map');
            ctx.setChildScreen('adventureMap');
            ctx.setCurrentQuestionIndex(0);
            ctx.setAnswers([]);
            ctx.handleLanguageStart(childName, parentName, phone, childAge, mandarin);
          };

          const phone = ctx.parentData?.phone;
          if (!phone) {
            ctx.pendingQuestStartRef.current = () => {
              const refreshed = getStoredParentData();
              const resolvedPhone = refreshed?.phone || ctx.parentData?.email || 'parent-app';
              ctx.setParentData(refreshed || ctx.parentData);
              launchQuest(resolvedPhone);
            };
            ctx.setShowWhatsAppPrompt(true);
          } else {
            launchQuest(phone);
          }
        }}
        onStartPractice={() => ctx.setShowPracticeMode(true)}
        onRefreshParent={async () => {
          const result = await parentValidateSession();
          if (result?.parent) ctx.setParentData(result.parent);
        }}
        childName={ctx.leadData.childName || ctx.parentData?.child_name}
        childAge={ctx.age || ctx.parentData?.child_age}
        allAnswers={ctx.allDetailedAnswers}
        moduleResults={ctx.moduleResults}
        assessmentCompleted={ctx.assessmentCompleted}
        liveQuests={ctx.liveQuests}
        includeMandarinTest={ctx.includeMandarinTest}
        onMandarinToggle={(val: boolean) => {
          ctx.setIncludeMandarinTest(val);
          localStorage.setItem('include_mandarin_test', JSON.stringify(val));
          import('../utils/parent-api').then(({ updateParentProfile }) => {
            updateParentProfile({ include_mandarin_test: val }).catch((e: any) =>
              console.warn('[MANDARIN] Failed to persist toggle to server:', e)
            );
          });
        }}
      />
      {ctx.showWhatsAppPrompt && (
        <WhatsAppPromptModal
          parentName={ctx.parentData?.name || 'Parent'}
          onComplete={() => {
            ctx.setShowWhatsAppPrompt(false);
            if (ctx.pendingQuestStartRef.current) {
              ctx.pendingQuestStartRef.current();
              ctx.pendingQuestStartRef.current = null;
            }
          }}
          onSkip={() => {
            ctx.setShowWhatsAppPrompt(false);
            if (ctx.pendingQuestStartRef.current) {
              ctx.pendingQuestStartRef.current();
              ctx.pendingQuestStartRef.current = null;
            }
          }}
        />
      )}
    </div>
  );
}