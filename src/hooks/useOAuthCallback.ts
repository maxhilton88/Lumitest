/**
 * useOAuthCallback — Extracted from App.tsx (Stage 5)
 *
 * Detects returning users from Google/Facebook OAuth redirects.
 * Handles both PKCE flow (?code=...) and implicit flow (#access_token=...).
 * Three strategies: onAuthStateChange, manual exchangeCodeForSession, fallback getSession.
 */
import { useEffect } from 'react';
import { toast } from 'sonner@2.0.3';
import { parentAuthClient } from '../utils/supabase-client';
import { parentOAuthComplete, saveAssessmentSnapshot, recordUsage } from '../utils/parent-api';
import { getReferralCookie, clearReferralCookie } from '../utils/referral-cookie';

interface UseOAuthCallbackParams {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  setIsParentAuthenticated: (v: boolean) => void;
  setParentData: (v: any) => void;
}

export function useOAuthCallback({
  navigate,
  setIsParentAuthenticated,
  setParentData,
}: UseOAuthCallbackParams) {
  useEffect(() => {
    // ── GUARD: Never run on /reset-password — the ?code= param there is a
    // password-recovery PKCE code, NOT an OAuth code.  Without this guard the
    // hook consumes the code, calls parentOAuthComplete (which fails), and
    // redirects to "/" before ResetPasswordPage can render.
    if (window.location.pathname === '/reset-password') {
      console.log('[APP] OAuth hook skipping — on /reset-password');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthReturn = urlParams.get('auth') === 'parent-oauth';
    const authCode = urlParams.get('code');
    const rawHash = window.location.hash;
    const hasHashToken = rawHash.includes('access_token');
    const hasHashError = rawHash.includes('error');

    if (!isOAuthReturn && !authCode && !hasHashToken && !hasHashError) return;

    console.log('[APP] OAuth return detected', {
      isOAuthReturn,
      hasCode: !!authCode,
      hasHashToken,
      hasHashError,
      hash: rawHash || '(empty)',
      origin: window.location.origin,
      href: window.location.href,
    });

    // ── Check for OAuth error in hash FIRST ──
    if (hasHashError) {
      const hashParams = new URLSearchParams(rawHash.replace('#', ''));
      const errorType = hashParams.get('error') || 'unknown';
      const errorDesc = hashParams.get('error_description') || 'No description';
      const errorCode = hashParams.get('error_code') || '';
      console.error('[APP] OAuth error returned in URL hash:', { errorType, errorDesc, errorCode });
      toast.error(
        `Social login error: ${decodeURIComponent(errorDesc.replace(/\+/g, ' '))} (${errorType})`
      );
      navigate('/', { replace: true });
      return;
    }
    if (urlParams.has('error')) {
      const errorType = urlParams.get('error') || 'unknown';
      const errorDesc = urlParams.get('error_description') || 'No description';
      const errorCode = urlParams.get('error_code') || '';
      console.error('[APP] OAuth error returned in URL query:', { errorType, errorDesc, errorCode });
      toast.error(
        `Social login error: ${decodeURIComponent(errorDesc.replace(/\+/g, ' '))} (${errorType})`
      );
      navigate('/', { replace: true });
      return;
    }

    let handled = false;

    const completeOAuth = async (accessToken: string) => {
      if (handled) return;
      handled = true;

      try {
        // Read referral code from the 365-day cookie (set before OAuth redirect)
        const referredBy = getReferralCookie() || undefined;

        // Read pending assessment from localStorage (saved before OAuth redirect)
        let pendingAssessment: any = null;
        try {
          const pendingRaw = localStorage.getItem('foxy_pending_assessment');
          if (pendingRaw) {
            const parsed = JSON.parse(pendingRaw);
            // Only use if saved within the last hour (avoid stale data)
            const savedAt = new Date(parsed.savedAt).getTime();
            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            if (savedAt > oneHourAgo) {
              pendingAssessment = parsed;
              console.log('[APP] Found pending assessment from pre-signup test', {
                totalQuestions: parsed.snapshot?.totalQuestions,
                phone: parsed.leadInfo?.phone ? '***' : '(none)',
                schoolId: parsed.leadInfo?.schoolId || '(none)',
              });
            } else {
              console.log('[APP] Pending assessment found but expired (>1hr), ignoring');
              localStorage.removeItem('foxy_pending_assessment');
            }
          }
        } catch (parseErr) {
          console.warn('[APP] Failed to parse pending assessment:', parseErr);
        }

        // Derive originTag from pending assessment's schoolId
        const originTag = pendingAssessment?.leadInfo?.schoolId || undefined;
        const leadInfo = pendingAssessment?.leadInfo
          ? {
              phone: pendingAssessment.leadInfo.phone,
              childName: pendingAssessment.leadInfo.childName,
              childAge: pendingAssessment.leadInfo.childAge,
            }
          : undefined;

        console.log('[APP] OAuth session acquired, completing parent record...', {
          referredBy: referredBy || '(none)',
          originTag: originTag || '(none)',
          hasLeadInfo: !!leadInfo,
        });
        const result = await parentOAuthComplete(accessToken, referredBy, originTag, leadInfo);

        if (result.parent) {
          // Clear the referral cookie after successful signup so it doesn't re-apply
          if (result.isNew && referredBy) {
            clearReferralCookie();
          }
          setIsParentAuthenticated(true);
          setParentData(result.parent);

          // ── Persist pending assessment data (the OAuth bridge) ──
          if (pendingAssessment?.snapshot) {
            try {
              console.log('[APP] Persisting pre-signup assessment snapshot...');
              const snapshotResult = await saveAssessmentSnapshot(pendingAssessment.snapshot);
              if (snapshotResult) {
                console.log('[APP] Pre-signup assessment snapshot saved successfully');
              }

              // Record usage for the test
              await recordUsage(
                'test',
                pendingAssessment.snapshot.totalQuestions,
                pendingAssessment.snapshot.totalCorrect,
              ).catch((err: any) => console.warn('[APP] recordUsage after OAuth failed (non-blocking):', err));

              // Clean up pending data
              localStorage.removeItem('foxy_pending_assessment');
              console.log('[APP] Pending assessment persisted and cleaned up');
            } catch (snapshotErr) {
              console.error('[APP] Failed to persist pending assessment (non-blocking):', snapshotErr);
              // Don't block the auth flow — the user is still signed in
            }
          }

          toast.success(
            result.isNew
              ? `Welcome to Foxy Adventure, ${result.parent.name}!`
              : `Welcome back, ${result.parent.name}!`
          );
          navigate('/game', { replace: true });
        }
      } catch (err) {
        console.error('[APP] OAuth completion error:', err);
        toast.error(err instanceof Error ? err.message : 'Social login failed');
        navigate('/', { replace: true });
      }
    };

    // Strategy 1: Listen for auth state changes
    const {
      data: { subscription },
    } = parentAuthClient.auth.onAuthStateChange((event, session) => {
      console.log('[APP] Auth state change:', event, !!session);
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
        session?.access_token
      ) {
        completeOAuth(session.access_token);
      }
    });

    // Strategy 2: Manual PKCE code exchange as safety net
    if (authCode) {
      console.log('[APP] PKCE code found in URL, attempting manual exchange...');
      parentAuthClient.auth.exchangeCodeForSession(authCode).then(({ data, error }) => {
        if (error) {
          console.warn('[APP] Manual code exchange failed (may already be handled):', error.message);
        } else if (data?.session?.access_token) {
          console.log('[APP] Manual code exchange succeeded');
          completeOAuth(data.session.access_token);
        }
      });
    }

    // Strategy 3: Fallback — check getSession after a delay
    const fallbackTimer = setTimeout(async () => {
      if (handled) return;
      try {
        const { data } = await parentAuthClient.auth.getSession();
        if (data?.session?.access_token) {
          console.log('[APP] Fallback getSession succeeded');
          completeOAuth(data.session.access_token);
        } else {
          console.warn('[APP] OAuth: no session found after all strategies (3 s)');
          toast.error('Social login session not found. Please try again.');
          navigate('/', { replace: true });
        }
      } catch (err) {
        console.error('[APP] OAuth fallback error:', err);
        navigate('/', { replace: true });
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);
}