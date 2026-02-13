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
import { parentOAuthComplete } from '../utils/parent-api';
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
        console.log('[APP] OAuth session acquired, completing parent record...', { referredBy: referredBy || '(none)' });
        const result = await parentOAuthComplete(accessToken, referredBy);

        if (result.parent) {
          // Clear the referral cookie after successful signup so it doesn't re-apply
          if (result.isNew && referredBy) {
            clearReferralCookie();
          }
          setIsParentAuthenticated(true);
          setParentData(result.parent);
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