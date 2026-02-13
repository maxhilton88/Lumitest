import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Gift } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { parentSignup, parentLogin } from '../../utils/parent-api';
import { parentAuthClient } from '../../utils/supabase-client';
import { FantasyBackground, FantasyPanel, GoldOrnament, FantasyTitle } from '../FantasyBackground';
import { playMenuSelect } from '../../hooks/useSoundEffects';
import { setReferralCookie, clearReferralCookie } from '../../utils/referral-cookie';
import foxyLabBg from 'figma:asset/4b78c7c4d5d7d5a9520d360c0b5d3801a7efe0f7.png';

interface ParentAuthFormProps {
  onSuccess: (parentData: any) => void;
  onBack: () => void;
  defaultReferralCode?: string;
  defaultOriginTag?: string;
}

export const ParentAuthForm: React.FC<ParentAuthFormProps> = ({
  onSuccess,
  onBack,
  defaultReferralCode,
  defaultOriginTag,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState(defaultReferralCode || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReferral, setShowReferral] = useState(!!defaultReferralCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const result = await parentSignup({
          email,
          password,
          name,
          originTag: defaultOriginTag,
          referredBy: referralCode || undefined,
        });
        // Referral consumed — clear the 365-day cookie so it doesn't re-apply
        clearReferralCookie();
        toast.success('Account created! Welcome to Foxy Adventure!');
        onSuccess(result.parent);
      } else {
        const result = await parentLogin(email, password);
        toast.success(`Welcome back, ${result.parent.name}!`);
        onSuccess(result.parent);
      }
    } catch (error) {
      console.error('[PARENT-AUTH]', error);
      toast.error(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Gold color constants matching the game
  const GOLD = '#d4a44a';
  const GOLD_LIGHT = '#ffeaa7';

  return (
    <div className="h-[100dvh] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      {/* Fantasy background with Foxy lab image */}
      <FantasyBackground bgImage={foxyLabBg} overlayOpacity={0.55} />

      {/* Back button — top left */}
      <button
        onClick={() => { playMenuSelect(); onBack(); }}
        className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-2 transition-all group"
        style={{
          color: '#c8b88a',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        }}
      >
      </button>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-4 md:mb-6">
          <FantasyTitle size="lg">
            {mode === 'login' ? 'WELCOME BACK' : 'JOIN THE QUEST'}
          </FantasyTitle>
          <p
            className="text-sm md:text-base mt-2"
            style={{
              color: '#c8b88a',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
              letterSpacing: '0.03em',
            }}
          >
            {mode === 'login'
              ? 'Sign in to your parent account'
              : "Create a free account to track your child's progress"}
          </p>
        </div>

        <GoldOrnament className="mb-4 md:mb-6" />

        {/* Auth Card */}
        <FantasyPanel className="p-6 md:p-8">
          {/* Social login buttons */}
          <div className="space-y-3 mb-5">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: `1.5px solid rgba(212,164,74,0.2)`,
                color: GOLD_LIGHT,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
              onClick={async () => {
                playMenuSelect();
                try {
                  // Persist referral code in cookie before leaving for OAuth
                  if (referralCode) setReferralCookie(referralCode);
                  const redirectUrl = `${window.location.origin}/?auth=parent-oauth`;
                  console.log('[PARENT-AUTH] Starting Google OAuth, redirectTo:', redirectUrl);
                  const { error } = await parentAuthClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: redirectUrl, queryParams: { prompt: 'select_account' } },
                  });
                  if (error) {
                    console.error('[PARENT-AUTH] Google OAuth error:', error);
                    toast.error(error.message || 'Google login failed');
                  }
                } catch (err) {
                  console.error('[PARENT-AUTH] Google OAuth exception:', err);
                  toast.error('Could not start Google login');
                }
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(24,119,242,0.12)',
                border: '1.5px solid rgba(24,119,242,0.25)',
                color: GOLD_LIGHT,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              }}
              onClick={async () => {
                playMenuSelect();
                try {
                  // Persist referral code in cookie before leaving for OAuth
                  if (referralCode) setReferralCookie(referralCode);
                  const redirectUrl = `${window.location.origin}/?auth=parent-oauth`;
                  console.log('[PARENT-AUTH] Starting Facebook OAuth, redirectTo:', redirectUrl);
                  const { error } = await parentAuthClient.auth.signInWithOAuth({
                    provider: 'facebook',
                    options: { redirectTo: redirectUrl, queryParams: { prompt: 'select_account' } },
                  });
                  if (error) {
                    console.error('[PARENT-AUTH] Facebook OAuth error:', error);
                    toast.error(error.message || 'Facebook login failed');
                  }
                } catch (err) {
                  console.error('[PARENT-AUTH] Facebook OAuth exception:', err);
                  toast.error('Could not start Facebook login');
                }
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              Continue with Facebook
            </button>
          </div>

          {/* Divider — gold ornament style */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${GOLD}40)` }} />
            <span
              className="text-xs font-bold tracking-widest"
              style={{ color: `${GOLD}80`, fontFamily: "'Cinzel Decorative', serif" }}
            >
              OR
            </span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to left, transparent, ${GOLD}40)` }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${GOLD}70` }} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${GOLD}30`,
                    color: GOLD_LIGHT,
                  }}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${GOLD}70` }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${GOLD}30`,
                  color: GOLD_LIGHT,
                }}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${GOLD}70` }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                minLength={6}
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm focus:outline-none transition-all"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `1.5px solid ${GOLD}30`,
                  color: GOLD_LIGHT,
                }}
              />
              <button
                type="button"
                onClick={() => { playMenuSelect(); setShowPassword(!showPassword); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: `${GOLD}50` }}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Referral code (signup only) */}
            {mode === 'signup' && (
              <div>
                {!showReferral ? (
                  <button
                    type="button"
                    onClick={() => { playMenuSelect(); setShowReferral(true); }}
                    className="flex items-center gap-2 text-xs transition-colors"
                    style={{ color: `${GOLD}90` }}
                  >
                    <Gift className="w-3 h-3" />
                    Have a referral code?
                  </button>
                ) : (
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: `${GOLD}70` }} />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="Referral code (optional)"
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: `1.5px solid ${GOLD}30`,
                        color: GOLD_LIGHT,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Submit button — game gold glossy style */}
            <button
              type="submit"
              disabled={isLoading}
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
              {isLoading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Free Account'}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-5 text-center text-sm">
            <span style={{ color: `${GOLD}60` }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </span>{' '}
            <button
              onClick={() => { playMenuSelect(); setMode(mode === 'login' ? 'signup' : 'login'); }}
              className="font-bold transition-colors"
              style={{ color: GOLD }}
            >
              {mode === 'login' ? 'Sign Up Free' : 'Sign In'}
            </button>
          </div>
        </FantasyPanel>

        {/* Free tier notice */}
        <p
          className="text-center text-xs mt-4"
          style={{ color: `${GOLD}40`, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
        >
          Free account includes 1 test & 1 video per day
        </p>
      </div>
    </div>
  );
};