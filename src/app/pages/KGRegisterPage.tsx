/**
 * KGRegisterPage — New kindergarten registration (standalone page)
 *
 * Route: /kg-register
 *
 * For KG owners who can't find their listing and don't have a claim code.
 * Submits to POST /kg-db/new-kg-signup.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  Phone, Eye, EyeOff, Shield, Plus,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { submitNewKGSignup } from '../utils/api';

const INPUT_CLS = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-950 transition-colors bg-white placeholder:text-gray-300';

const MALAYSIAN_STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur',
  'W.P. Labuan', 'W.P. Putrajaya',
];

export function KGRegisterPage() {
  const navigate = useNavigate();

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [kgName, setKgName] = useState('');
  const [kgAddress, setKgAddress] = useState('');
  const [kgCity, setKgCity] = useState('');
  const [kgState, setKgState] = useState('');
  const [kgPostcode, setKgPostcode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!kgName.trim()) {
      setSubmitError('Please enter your kindergarten name');
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitNewKGSignup({
        kg_name: kgName.trim(),
        kg_address: kgAddress || undefined,
        kg_city: kgCity || undefined,
        kg_state: kgState || undefined,
        kg_postcode: kgPostcode || undefined,
        name,
        email,
        password,
        whatsapp: whatsapp || undefined,
      });

      if (result.success) {
        setSubmitted(true);
        toast.success('Registration submitted!');
      }
    } catch (err: any) {
      setSubmitError(err.message);
      console.error('[KG-REGISTER] Register error:', err);
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
              Registration Submitted
            </h1>
            <p className="text-sm text-gray-400 mb-6">
              <strong className="text-gray-600">{kgName}</strong><br />
              Our team will review and set up your kindergarten profile.
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

  // ── FORM ──
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header onBack={() => navigate('/kinderpartner')} />

      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-[400px]">
          <button
            onClick={() => navigate('/kinderpartner')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-6 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to KinderPartner
          </button>

          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-gray-100 rounded-full mb-4">
              <Plus className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">New Registration</span>
            </div>
            <h1 className="text-[22px] font-semibold text-gray-950 tracking-tight leading-tight mb-1">
              Register your kindergarten
            </h1>
            <p className="text-sm text-gray-400">
              Tell us about your kindergarten. We'll review and set up your profile.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* KG section */}
            <div className="pb-4 border-b border-gray-100">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Kindergarten Details</p>

              <div className="space-y-3">
                <FormField label="Kindergarten Name" required>
                  <input
                    type="text" value={kgName} onChange={(e) => setKgName(e.target.value)}
                    placeholder="e.g. Tadika Cahaya Bestari" required
                    className={INPUT_CLS}
                  />
                </FormField>

                <FormField label="Address">
                  <input
                    type="text" value={kgAddress} onChange={(e) => setKgAddress(e.target.value)}
                    placeholder="Street address"
                    className={INPUT_CLS}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="City">
                    <input
                      type="text" value={kgCity} onChange={(e) => setKgCity(e.target.value)}
                      placeholder="City"
                      className={INPUT_CLS}
                    />
                  </FormField>
                  <FormField label="Postcode">
                    <input
                      type="text" value={kgPostcode} onChange={(e) => setKgPostcode(e.target.value)}
                      placeholder="e.g. 47300"
                      className={INPUT_CLS}
                    />
                  </FormField>
                </div>

                <FormField label="State">
                  <select
                    value={kgState} onChange={(e) => setKgState(e.target.value)}
                    className={`${INPUT_CLS} appearance-none`}
                  >
                    <option value="">Select state</option>
                    {MALAYSIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
              </div>
            </div>

            {/* Owner section */}
            <div className="pt-2">
              <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Your Account</p>

              <div className="space-y-3">
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
              </div>
            </div>

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
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Registration <ArrowRight className="w-3.5 h-3.5" /></>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-[11px] text-gray-300">
              Already have an account?{' '}
              <button onClick={() => navigate('/kg')} className="text-gray-500 hover:text-gray-950 transition-colors underline underline-offset-2">
                Sign in
              </button>
            </p>
          </div>
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
        Back
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

export default KGRegisterPage;
