/**
 * KGSignupPage — Claim code verification & claim flow (standalone page)
 *
 * Route: /kg-signup?code=CLAIM_CODE
 *
 * For KG owners who have a claim code (from map pin popup or admin).
 * Two steps: enter/verify code → fill account form → submit claim.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  MapPin, Eye, EyeOff, Phone, Search, Shield, KeyRound,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { validateClaimCode, submitClaimSignup } from '../utils/api';

type FlowMode = 'check' | 'claim';

const INPUT_CLS = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-950 transition-colors bg-white placeholder:text-gray-300';

export function KGSignupPage() {
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const initialCode = urlParams.get('code') || '';

  const [mode, setMode] = useState<FlowMode>('check');

  // Claim code validation
  const [claimCode, setClaimCode] = useState(initialCode);
  const [validating, setValidating] = useState(false);
  const [kgInfo, setKgInfo] = useState<{
    id: string; name: string; address?: string; city?: string; state?: string; postcode?: string;
  } | null>(null);
  const [codeError, setCodeError] = useState('');

  // Account form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Validate claim code
  const handleValidateCode = useCallback(async (code: string) => {
    if (!code || code.length < 4) return;
    setValidating(true);
    setCodeError('');
    setKgInfo(null);
    try {
      const result = await validateClaimCode(code);
      if (result.valid && result.kindergarten) {
        setKgInfo(result.kindergarten);
        setMode('claim');
      } else {
        setCodeError(result.error || 'Invalid claim code');
      }
    } catch (err: any) {
      setCodeError(err.message);
    } finally {
      setValidating(false);
    }
  }, []);

  // Auto-validate on mount if code is in URL
  useEffect(() => {
    if (initialCode) {
      handleValidateCode(initialCode);
    }
  }, [initialCode, handleValidateCode]);

  // Submit claim
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters');
      return;
    }
    if (!kgInfo) {
      setSubmitError('Please validate your claim code first');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitClaimSignup({
        claim_code: claimCode.toUpperCase(),
        name,
        email,
        password,
        whatsapp: whatsapp || undefined,
      });

      if (result.success) {
        setSubmitted(true);
        toast.success('Claim submitted successfully!');
      }
    } catch (err: any) {
      setSubmitError(err.message);
      console.error('[KG-SIGNUP] Claim error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── SUCCESS ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header onBack={() => navigate('/kinderpartner')} />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 bg-gray-950 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-950 tracking-tight mb-1">
              Claim Submitted
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              {kgInfo?.name && <><strong className="text-gray-600">{kgInfo.name}</strong><br /></>}
              An admin will verify your identity and approve your claim.
            </p>

            <div className="border border-gray-100 rounded-lg p-4 mb-8 text-left">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-gray-700">What happens next?</p>
                  <ol className="mt-2 space-y-1.5 text-xs text-gray-500">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-300 font-mono">1</span>
                      Admin reviews your application (1-2 business days)
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-300 font-mono">2</span>
                      You'll receive dashboard access upon approval
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-300 font-mono">3</span>
                      Start managing assessments for your students
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/kg')}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-950 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Go to Sign In
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN FORM ──
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header onBack={() => navigate('/kinderpartner')} />

      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[400px]">

          {/* ── CHECK MODE: Enter claim code ── */}
          {mode === 'check' && (
            <div className="animate-in fade-in duration-300">
              <button
                onClick={() => navigate('/kinderpartner')}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to KinderPartner
              </button>

              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-100 rounded-full mb-4">
                  <KeyRound className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Claim Code</span>
                </div>
                <h1 className="text-[22px] font-semibold text-gray-950 tracking-tight leading-tight mb-1">
                  Enter your claim code
                </h1>
                <p className="text-sm text-gray-400">
                  Verify your code to claim your kindergarten listing.
                </p>
              </div>

              {/* Claim code input */}
              <div className="mb-4">
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                  Claim Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={claimCode}
                    onChange={(e) => {
                      setClaimCode(e.target.value.toUpperCase());
                      setKgInfo(null);
                      setCodeError('');
                    }}
                    placeholder="e.g. ABCD1234"
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm font-mono uppercase tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:normal-case placeholder:text-gray-300 focus:outline-none focus:border-gray-950 transition-colors"
                    maxLength={10}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && claimCode.length >= 4) {
                        handleValidateCode(claimCode);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleValidateCode(claimCode)}
                    disabled={validating || !claimCode || claimCode.length < 4}
                    className="px-4 py-2.5 bg-gray-950 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Code validation result */}
              {codeError && (
                <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-600">{codeError}</p>
                </div>
              )}

              {kgInfo && (
                <div className="mb-4 px-3.5 py-3 border border-emerald-200 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">{kgInfo.name}</span>
                  </div>
                  {(kgInfo.city || kgInfo.state) && (
                    <p className="text-[11px] text-emerald-600 pl-[22px]">
                      {[kgInfo.city, kgInfo.state, kgInfo.postcode].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              )}

              {/* Helper text */}
              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 leading-relaxed">
                  <strong className="text-gray-700">Don't have a code?</strong>{' '}
                  Find your kindergarten on the{' '}
                  <button onClick={() => navigate('/kinderpartner')} className="underline underline-offset-2 text-gray-700 hover:text-gray-950 transition-colors">
                    interactive map
                  </button>{' '}
                  or{' '}
                  <button onClick={() => navigate('/kg-register')} className="underline underline-offset-2 text-gray-700 hover:text-gray-950 transition-colors">
                    register a new kindergarten
                  </button>.
                </p>
              </div>

              <LoginLink />
            </div>
          )}

          {/* ── CLAIM MODE: Create account for verified KG ── */}
          {mode === 'claim' && kgInfo && (
            <div className="animate-in fade-in duration-300">
              <button
                onClick={() => { setMode('check'); setKgInfo(null); setCodeError(''); setSubmitError(''); }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>

              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-50 rounded-full mb-4">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="text-[10px] font-medium text-emerald-700 uppercase tracking-wider">Code Verified</span>
                </div>
                <h1 className="text-[22px] font-semibold text-gray-950 tracking-tight leading-tight mb-1">
                  Claim your listing
                </h1>
                <p className="text-sm text-gray-400">
                  Create your account to manage <strong className="text-gray-600">{kgInfo.name}</strong>
                </p>
              </div>

              {/* KG info badge */}
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 rounded-lg mb-6">
                <div className="w-8 h-8 bg-gray-950 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-950 truncate">{kgInfo.name}</p>
                  {(kgInfo.city || kgInfo.state) && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {[kgInfo.city, kgInfo.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <form onSubmit={handleClaimSubmit} className="space-y-4">
                <FormField label="Full Name" required>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Puan Siti Aminah" required
                    className={INPUT_CLS}
                  />
                </FormField>

                <FormField label="Email" required>
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com" required
                    className={INPUT_CLS}
                  />
                </FormField>

                <FormField label="WhatsApp" hint="for verification">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
                    <input
                      type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="e.g. 0123456789"
                      className={`${INPUT_CLS} pl-9`}
                    />
                  </div>
                </FormField>

                <FormField label="Password" required>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      required
                      minLength={6}
                      className={`${INPUT_CLS} pr-10`}
                    />
                    <button
                      type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </FormField>

                <FormField label="Confirm Password" required>
                  <input
                    type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password" required minLength={6}
                    className={INPUT_CLS}
                  />
                </FormField>

                {submitError && (
                  <div className="px-3.5 py-2.5 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-600">{submitError}</p>
                  </div>
                )}

                <button
                  type="submit" disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-950 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-40 transition-all mt-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Claim <ArrowRight className="w-3.5 h-3.5" /></>}
                </button>
              </form>

              <LoginLink />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gray-950 rounded-lg flex items-center justify-center">
          <Building2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-gray-950 tracking-tight">KinderPartner</span>
      </div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <MapPin className="w-3 h-3" />
        View Map
      </button>
    </div>
  );
}

function FormField({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
        {hint && <span className="normal-case tracking-normal font-normal ml-1 text-gray-300">({hint})</span>}
        {required && <span className="text-red-300 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function LoginLink() {
  const navigate = useNavigate();
  return (
    <div className="mt-6 text-center">
      <p className="text-[11px] text-gray-300">
        Already have an account?{' '}
        <button onClick={() => navigate('/kg')} className="text-gray-500 hover:text-gray-950 transition-colors underline underline-offset-2">
          Sign in
        </button>
      </p>
    </div>
  );
}

export default KGSignupPage;
