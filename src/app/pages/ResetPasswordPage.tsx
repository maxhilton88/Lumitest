/**
 * ResetPasswordPage — Handles the password reset callback from Supabase.
 *
 * When a user clicks the reset link in their email, Supabase redirects here
 * with session tokens (either ?code= for PKCE or #access_token= for implicit).
 *
 * The `?source=parent` or `?source=admin` query param (set by the caller)
 * determines which Supabase client AND which visual design to use:
 *   - parent  → parentAuthClient  (PKCE) + dark-fantasy RPG theme
 *   - admin   → adminAuthClient   (implicit) + clean corporate theme
 *
 * Flow:
 *   1. Exchange tokens for a session
 *   2. Show a "set new password" form
 *   3. Call supabase.auth.updateUser({ password })
 *   4. Redirect to the appropriate login page
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner@2.0.3';
import { adminAuthClient, parentAuthClient } from '../utils/supabase-client';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, ArrowLeft, Shield, KeyRound } from 'lucide-react';
import { FantasyBackground, FantasyPanel, FantasyTitle, GoldOrnament } from '../components/FantasyBackground';
import foxyLabBg from 'figma:asset/4b78c7c4d5d7d5a9520d360c0b5d3801a7efe0f7.png';

// ── Color constants (matching ParentAuthForm) ──
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Determine which auth client to use based on ?source= param
  const params = new URLSearchParams(window.location.search);
  const source = params.get('source') || 'admin';
  const isParent = source === 'parent';
  const authClient = isParent ? parentAuthClient : adminAuthClient;

  // On mount: extract and exchange tokens from the URL
  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (!cancelled) setSessionReady(true);
    };
    const markError = (msg: string) => {
      if (!cancelled) setError(msg);
    };

    const handleTokenExchange = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');

        // ── Case 1: PKCE flow — ?code= in search params ──
        if (code) {
          console.log(`[RESET-PW] Found PKCE code, exchanging via ${source}AuthClient...`);
          const { data, error: exchangeError } = await authClient.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            // For parentAuthClient (detectSessionInUrl: true), the code may have
            // already been auto-exchanged.  Check for an existing session before
            // declaring failure.
            if (isParent) {
              console.warn('[RESET-PW] Manual exchange failed, checking existing session...', exchangeError.message);
              const { data: sessionData } = await authClient.auth.getSession();
              if (sessionData?.session) {
                console.log('[RESET-PW] Found existing parent session (auto-exchanged)');
                markReady();
                return;
              }
            }
            console.error('[RESET-PW] Code exchange failed:', exchangeError);
            markError(exchangeError.message);
            return;
          }
          console.log('[RESET-PW] PKCE session established for:', data.user?.email);
          markReady();
          return;
        }

        // ── Case 2: Implicit flow — #access_token= in hash ──
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          console.log(`[RESET-PW] Found hash tokens, setting session via ${source}AuthClient...`);
          const hashParams = new URLSearchParams(hash.replace('#', ''));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');
          const type = hashParams.get('type');

          if (type !== 'recovery') {
            console.warn('[RESET-PW] Hash type is not recovery:', type);
          }

          if (access_token && refresh_token) {
            const { error: sessionError } = await authClient.auth.setSession({
              access_token,
              refresh_token,
            });
            if (sessionError) {
              console.error('[RESET-PW] setSession failed:', sessionError);
              markError(sessionError.message);
              return;
            }
            console.log('[RESET-PW] Implicit session established');
            markReady();
            return;
          }
        }

        // ── Case 3: parentAuthClient may have auto-exchanged (detectSessionInUrl)
        //    OR the code was already consumed.  Check getSession first, then
        //    fall back to listening for PASSWORD_RECOVERY auth event. ──
        const { data: existingSession } = await authClient.auth.getSession();
        if (existingSession?.session) {
          console.log(`[RESET-PW] Found existing ${source} session — marking ready`);
          markReady();
          return;
        }

        // Listen for PASSWORD_RECOVERY auth event as final fallback
        const { data: { subscription } } = authClient.auth.onAuthStateChange((event, session) => {
          console.log(`[RESET-PW] Auth event on ${source}AuthClient:`, event);
          if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
            markReady();
          }
        });
        cleanupRef.current = () => subscription.unsubscribe();

        // If nothing found after a short delay, show error
        setTimeout(() => {
          if (!cancelled) {
            setSessionReady((prev) => {
              if (!prev) {
                setError('Invalid or expired reset link. Please request a new one.');
              }
              return prev;
            });
          }
        }, 5000);
      } catch (err: any) {
        console.error('[RESET-PW] Token exchange error:', err);
        markError(err.message || 'Failed to process reset link');
      }
    };

    handleTokenExchange();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await authClient.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error('[RESET-PW] Update password error:', updateError);
        toast.error(`Failed to update password: ${updateError.message}`);
        return;
      }

      console.log('[RESET-PW] Password updated successfully');
      setSuccess(true);
      toast.success('Password updated successfully!');

      // Sign out after password reset so user logs in fresh
      await authClient.auth.signOut();
    } catch (err: any) {
      console.error('[RESET-PW] Password update exception:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    if (isParent) {
      navigate('/login', { replace: true });
    } else {
      navigate('/kg', { replace: true });
    }
  };

  // Render the appropriate themed variant
  return isParent ? (
    <ParentResetView
      sessionReady={sessionReady}
      error={error}
      success={success}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onGoToLogin={handleGoToLogin}
    />
  ) : (
    <AdminResetView
      sessionReady={sessionReady}
      error={error}
      success={success}
      password={password}
      setPassword={setPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onGoToLogin={handleGoToLogin}
    />
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARENT: Dark-Fantasy RPG Theme
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ResetViewProps {
  sessionReady: boolean;
  error: string | null;
  success: boolean;
  password: string;
  setPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onGoToLogin: () => void;
}

function ParentResetView({
  sessionReady, error, success, password, setPassword,
  confirmPassword, setConfirmPassword, showPassword, setShowPassword,
  isSubmitting, onSubmit, onGoToLogin,
}: ResetViewProps) {
  return (
    <div className="h-[100dvh] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      {/* Fantasy background */}
      <FantasyBackground bgImage={foxyLabBg} overlayOpacity={0.55} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-4 md:mb-6">
          <FantasyTitle size="lg">
            {success ? 'QUEST COMPLETE' : error ? 'SCROLL EXPIRED' : 'NEW PASSWORD'}
          </FantasyTitle>
          <p
            className="text-sm md:text-base mt-2"
            style={{
              color: PARCHMENT,
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              letterSpacing: '0.03em',
            }}
          >
            {success
              ? 'Your password has been forged anew'
              : error
                ? 'This magic scroll has lost its power'
                : sessionReady
                  ? 'Forge a new password for your account'
                  : 'Verifying your magic scroll...'}
          </p>
        </div>

        <GoldOrnament className="mb-4 md:mb-6" />

        {/* Card */}
        <FantasyPanel className="p-6 md:p-8">

          {/* Loading state */}
          {!sessionReady && !error && !success && (
            <div className="text-center py-8">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div
                  className="absolute inset-0 rounded-full animate-spin"
                  style={{
                    border: `3px solid ${GOLD}20`,
                    borderTopColor: GOLD,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" style={{ color: GOLD }} />
                </div>
              </div>
              <p className="text-sm" style={{ color: `${PARCHMENT}80` }}>
                Deciphering the magic scroll...
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(220,38,38,0.12)', border: `2px solid rgba(220,38,38,0.3)` }}
              >
                <AlertCircle className="w-6 h-6 text-red-400" />
              </div>
              <h3
                className="text-base font-bold mb-2"
                style={{ fontFamily: "'Cinzel Decorative', serif", color: '#fca5a5' }}
              >
                Scroll Expired
              </h3>
              <p className="text-sm mb-6" style={{ color: `${PARCHMENT}70` }}>
                {error}
              </p>
              <button
                onClick={onGoToLogin}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                  color: '#2a1f0e',
                  border: `3px solid ${GOLD_LIGHT}`,
                  boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                  fontFamily: "'Cinzel Decorative', serif",
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="text-center py-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: `${GOLD}15`, border: `2px solid ${GOLD}40` }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <h3
                className="text-base font-bold mb-2"
                style={{ fontFamily: "'Cinzel Decorative', serif", color: GOLD_LIGHT }}
              >
                Password Forged!
              </h3>
              <p className="text-sm mb-6" style={{ color: `${PARCHMENT}80` }}>
                Your new password is ready. Return to sign in and begin your adventure.
              </p>
              <button
                onClick={onGoToLogin}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                  color: '#2a1f0e',
                  border: `3px solid ${GOLD_LIGHT}`,
                  boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                  fontFamily: "'Cinzel Decorative', serif",
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                Return to Sign In
              </button>
            </div>
          )}

          {/* Password form */}
          {sessionReady && !success && (
            <form onSubmit={onSubmit} className="space-y-5">
              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: `${GOLD}90`, fontFamily: "'Cinzel Decorative', serif" }}
                >
                  New Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: `${GOLD}70` }}
                  />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-10 py-3 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${GOLD}30`,
                      color: GOLD_LIGHT,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: `${GOLD}60` }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-xs font-bold uppercase tracking-wider mb-2"
                  style={{ color: `${GOLD}90`, fontFamily: "'Cinzel Decorative', serif" }}
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: `${GOLD}70` }}
                  />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${GOLD}30`,
                      color: GOLD_LIGHT,
                    }}
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs mt-1.5" style={{ color: '#fca5a5' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              {/* Submit button — RPG gold style */}
              <button
                type="submit"
                disabled={isSubmitting || password.length < 6 || password !== confirmPassword}
                className="w-full py-3.5 px-4 rounded-xl font-black text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-[0.98] active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                  color: '#2a1f0e',
                  border: `3px solid ${GOLD_LIGHT}`,
                  boxShadow: `0 4px 0 #a67c2e, 0 0 20px ${GOLD}30`,
                  fontFamily: "'Cinzel Decorative', serif",
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                }}
              >
                {isSubmitting ? 'Forging...' : 'Forge New Password'}
              </button>
            </form>
          )}
        </FantasyPanel>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs" style={{ color: `${PARCHMENT}50` }}>
            <a
              href="https://projectlumi.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:opacity-80"
            >
              © Project Lumi
            </a>
            <span className="mx-1">·</span>
            <span>All Rights Reserved</span>
          </p>
        </div>
      </div>
    </div>
  );
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// KG / ADMIN: Clean Corporate Theme (matches LoginForm / ForgotPasswordForm)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AdminResetView({
  sessionReady, error, success, password, setPassword,
  confirmPassword, setConfirmPassword, showPassword, setShowPassword,
  isSubmitting, onSubmit, onGoToLogin,
}: ResetViewProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">L</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {success ? 'Password Updated' : 'Set New Password'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {success
              ? 'You can now sign in with your new password'
              : error
                ? 'There was a problem with your reset link'
                : sessionReady
                  ? 'Enter your new password below'
                  : 'Verifying your reset link...'}
          </p>
        </div>

        {/* Card */}
        <div className="border border-gray-100 rounded-lg p-8">

          {/* Loading state */}
          {!sessionReady && !error && !success && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-gray-900 mx-auto mb-4" />
              <p className="text-sm text-gray-500">Verifying reset link...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Link Expired</h3>
              <p className="text-sm text-gray-600 mb-6">
                {error}
              </p>
              <button
                onClick={onGoToLogin}
                className="w-full px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Set!</h3>
              <p className="text-sm text-gray-600 mb-6">
                Your password has been updated. You can now sign in with your new password.
              </p>
              <button
                onClick={onGoToLogin}
                className="w-full px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Password form */}
          {sessionReady && !success && (
            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-900 transition-colors"
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || password.length < 6 || password !== confirmPassword}
                className="w-full px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-500">
          <a
            href="https://projectlumi.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition-colors"
          >
            © Project Lumi
          </a>
          <span className="mx-1">·</span>
          <span>All Rights Reserved</span>
        </div>
      </div>
    </div>
  );
}