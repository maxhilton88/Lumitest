// ParentPage — Route component for / (root)
// Handles parent auth guard + ParentShell rendering
// Rebuilt to force fresh chunk generation
import React from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router';
import { useAppContext } from '../contexts/AppContext';
import { ParentAuthForm } from '../components/auth/ParentAuthForm';
import { ParentShell } from '../components/parent/ParentShell';
import { PracticeScreen } from '../components/screens/PracticeScreen';
import { WhatsAppPromptModal } from '../components/WhatsAppPromptModal';
import { ChildOnboarding } from '../components/onboarding/ChildOnboarding';
import { parentLogout, parentValidateSession, getStoredParentData, updateParentProfile } from '../utils/parent-api';
import { resolveSchool } from '../utils/api';
import { setReferralCookie, getReferralCookie } from '../utils/referral-cookie';
import { toast } from 'sonner@2.0.3';
import type { ParentPage as ParentPageType } from '../components/parent/SideMenu';
import { playMusic, isMusicEnabled } from '../utils/music-service';
import { getSchoolAge } from '../utils/level-utils';
import { TrialExpiredModal, useTrialExpiredCheck } from '../components/fmcg/TrialExpiredModal';
import type { SubjectCode } from '../data/kssr-taxonomy';

// Dev mode: always store leads under hey@pitchdeck.my's kindergarten
const DEV_KINDERGARTEN_EMAIL = 'hey@pitchdeck.my';

export function ParentPage() {
  const ctx = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive initial page from pathname (e.g. /mastery -> 'mastery', /login -> root)
  const rawPage = location.pathname.replace(/^\//, '').replace(/^login\/?/, '') as ParentPageType;
  const validPages: ParentPageType[] = ['mastery', 'earnings', 'plan', 'account'];
  const initialPage: ParentPageType = validPages.includes(rawPage) ? rawPage : 'mastery';

  // ── Auth state ──
  const [isAuthed, setIsAuthed] = React.useState(() => {
    return ctx.isParentAuthenticated;
  });
  const [parentData, setParentData] = React.useState<any>(() => ctx.parentData);
  const [isValidating, setIsValidating] = React.useState(true);
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  // Capture referral code from URL
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCookie(ref);
    }
  }, [location.search]);

  // Validate session on mount
  React.useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      try {
        const result = await parentValidateSession();
        if (!cancelled) {
          if (result?.valid && result.parent) {
            setIsAuthed(true);
            setParentData(result.parent);
            ctx.setIsParentAuthenticated(true);
            ctx.setParentData(result.parent);

            // Sync excluded_subjects to context
            if (result.parent.excluded_subjects) {
              localStorage.setItem('excluded_subjects', JSON.stringify(result.parent.excluded_subjects));
            }

            // Check if child onboarding is needed (no birthdate set)
            if (!result.parent.child_birthdate) {
              setShowOnboarding(true);
            }

            // ── FMCG trial expiry countdown toast ──
            if (result.parent.premium_source === 'fmcg_trial' && result.parent.premium_expires_at) {
              const expiresAt = new Date(result.parent.premium_expires_at);
              const now = new Date();
              const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              // Build brand attribution label from premium_grants
              const grants = result.parent.premium_grants || [];
              const brandNames = [...new Set(grants.map((g: any) => g.brandName).filter(Boolean))];
              const brandLabel = brandNames.length > 0 ? ` (from ${brandNames.join(' + ')})` : '';

              if (daysLeft > 0 && daysLeft <= 3) {
                setTimeout(() => {
                  toast(`Your free premium trial${brandLabel} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''}! Upgrade to keep unlimited access.`, {
                    duration: 8000,
                    icon: '⏳',
                    action: {
                      label: '👑 Renew Now',
                      onClick: () => navigate('/parent/plan'),
                    },
                  });
                }, 2000);
              } else if (daysLeft <= 0) {
                // Trial has expired — graceful downgrade moment
                setTimeout(() => {
                  toast(`Your free premium trial${brandLabel} has ended. Upgrade now to keep unlimited access for your child!`, {
                    duration: 10000,
                    icon: '🔒',
                    action: {
                      label: '👑 Upgrade Now',
                      onClick: () => navigate('/parent/plan'),
                    },
                  });
                }, 2000);
              }
            }
          } else {
            setIsAuthed(false);
            setParentData(null);
          }
        }
      } catch (err) {
        console.error('[ParentPage] Session validation failed:', err);
        if (!cancelled) {
          setIsAuthed(false);
          setParentData(null);
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    };
    validate();
    return () => { cancelled = true; };
  }, []);

  // ── Auth handlers ──
  const handleAuthSuccess = React.useCallback((parent: any) => {
    setIsAuthed(true);
    setParentData(parent);
    ctx.setIsParentAuthenticated(true);
    ctx.setParentData(parent);
    localStorage.setItem('parent_data', JSON.stringify(parent));

    if (parent.excluded_subjects) {
      localStorage.setItem('excluded_subjects', JSON.stringify(parent.excluded_subjects));
    }

    // Check if child onboarding is needed
    if (!parent.child_birthdate) {
      setShowOnboarding(true);
    }

    // Start music if enabled (wrapped defensively — playMusic may fail in some edge cases)
    if (isMusicEnabled()) {
      try {
        const p = playMusic();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (_) { /* ignore music errors on login */ }
    }

    // ── FMCG: Auto-redirect to QR claim if pending code exists ──
    const pendingQR = localStorage.getItem('fmcg_pending_code');
    if (pendingQR) {
      console.log('[FMCG] Pending QR code found after parent auth, redirecting:', pendingQR);
      setTimeout(() => {
        navigate(`/qr?code=${encodeURIComponent(pendingQR)}`);
      }, 300);
    }
  }, [ctx, navigate]);

  const handleLogout = React.useCallback(() => {
    parentLogout();
    setIsAuthed(false);
    setParentData(null);
    ctx.setIsParentAuthenticated(false);
    ctx.setParentData(null);
    navigate('/');
  }, [ctx, navigate]);

  const handleStartTest = React.useCallback(() => {
    navigate('/realm/test');
  }, [navigate]);

  const handleStartPractice = React.useCallback(() => {
    navigate('/realm/practice');
  }, [navigate]);

  const handleRefreshParent = React.useCallback(async () => {
    try {
      const result = await parentValidateSession();
      if (result?.valid && result.parent) {
        setParentData(result.parent);
        ctx.setParentData(result.parent);
        localStorage.setItem('parent_data', JSON.stringify(result.parent));
      }
    } catch (err) {
      console.error('[ParentPage] Refresh parent failed:', err);
    }
  }, [ctx]);

  // ── Child Onboarding completion ──
  const handleOnboardingComplete = React.useCallback(async (data: {
    childName: string;
    birthdate: string;
    excludedSubjects: SubjectCode[];
    characterType?: 'boy' | 'girl';
  }) => {
    try {
      const schoolAge = getSchoolAge(data.birthdate);
      const updates: Record<string, any> = {
        child_name: data.childName,
        child_birthdate: data.birthdate,
        child_age: schoolAge,
        excluded_subjects: data.excludedSubjects,
        character_type: data.characterType || 'boy',
      };
      await updateParentProfile(updates);

      // Refresh parent data
      const updated = { ...parentData, ...updates };
      setParentData(updated);
      ctx.setParentData(updated);
      localStorage.setItem('parent_data', JSON.stringify(updated));
      localStorage.setItem('excluded_subjects', JSON.stringify(data.excludedSubjects));

      setShowOnboarding(false);
      toast.success('Child profile saved!');

      // Navigate to realm
      navigate('/realm');
    } catch (err) {
      console.error('[ParentPage] Onboarding save failed:', err);
      toast.error('Failed to save profile. Please try again.');
    }
  }, [parentData, ctx, navigate]);

  // ── Excluded subjects from parentData ──
  const excludedSubjects: SubjectCode[] = React.useMemo(() => {
    const pd = parentData || getStoredParentData();
    if (pd?.excluded_subjects && Array.isArray(pd.excluded_subjects)) {
      return pd.excluded_subjects;
    }
    // Backward compat: if include_mandarin_test is explicitly false, exclude ZH
    if (pd?.include_mandarin_test === false) {
      return ['ZH'] as SubjectCode[];
    }
    return [];
  }, [parentData]);

  // ── FMCG trial expired interstitial ──
  const trialExpired = useTrialExpiredCheck(parentData);

  // ── Loading state ──
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0814' }}>
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#d4a44a', borderTopColor: 'transparent' }} />
          <p className="text-xs" style={{ color: '#c8b88a80' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // ── Not authenticated — show login ──
  if (!isAuthed) {
    return <ParentAuthForm onSuccess={handleAuthSuccess} />;
  }

  // ── Child onboarding flow ──
  if (showOnboarding) {
    return (
      <div className="min-h-screen" style={{ background: '#0c0814' }}>
        <ChildOnboarding
          onComplete={handleOnboardingComplete}
          initialName={parentData?.child_name || ''}
          initialBirthdate={parentData?.child_birthdate || ''}
        />
      </div>
    );
  }

  // ── Authenticated + onboarded: redirect root "/" to /realm ──
  // Sub-pages like /mastery, /plan, /earnings, /account still render ParentShell
  const isRootPath = location.pathname === '/' || location.pathname === '' || location.pathname === '/login';
  if (isRootPath) {
    return <Navigate to="/realm" replace />;
  }

  // ── Authenticated — show ParentShell for sub-pages ──
  return (
    <>
      <ParentShell
        parentData={parentData}
        onLogout={handleLogout}
        onStartTest={handleStartTest}
        onStartPractice={handleStartPractice}
        onRefreshParent={handleRefreshParent}
        childName={parentData?.child_name || ctx.leadData.childName || 'Explorer'}
        childAge={parentData?.child_age || ctx.age || 5}
        allAnswers={ctx.allDetailedAnswers}
        moduleResults={ctx.moduleResults}
        assessmentCompleted={ctx.assessmentCompleted}
        liveQuests={ctx.liveQuests}
        initialPage={initialPage}
        excludedSubjects={excludedSubjects}
        onExcludedSubjectsChange={async (subjects: SubjectCode[]) => {
          try {
            await updateParentProfile({ excluded_subjects: subjects });
            const updated = { ...parentData, excluded_subjects: subjects };
            setParentData(updated);
            ctx.setParentData(updated);
            localStorage.setItem('parent_data', JSON.stringify(updated));
            localStorage.setItem('excluded_subjects', JSON.stringify(subjects));
          } catch (err) {
            console.error('[ParentPage] Excluded subjects update failed:', err);
            toast.error('Failed to update subject preferences.');
          }
        }}
      />
      <WhatsAppPromptModal
        isOpen={ctx.showWhatsAppPrompt}
        onClose={() => ctx.setShowWhatsAppPrompt(false)}
      />
      {/* ── FMCG Trial Expired Interstitial ── */}
      {trialExpired.showModal && (
        <TrialExpiredModal
          brandNames={trialExpired.brandNames}
          expiredAt={trialExpired.expiredAt}
          onUpgrade={() => {
            trialExpired.dismiss();
            navigate('/plan');
          }}
          onDismiss={trialExpired.dismiss}
        />
      )}
    </>
  );
}

export default ParentPage;