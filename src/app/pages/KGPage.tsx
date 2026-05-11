// KGPage — Route component for /kg/*
// Handles KG auth guard + KindergartenDashboard rendering.
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { KindergartenDashboard } from '../components/dashboards/KindergartenDashboard';
import { Clock, AlertCircle, LogOut } from 'lucide-react';

export function KGPage() {
  const ctx = useAppContext();

  // ── Not authenticated → show auth forms ──
  if (!ctx.isAuthenticated) {
    return (
      <div className="relative">
        {ctx.authScreen === 'login' && (
          <LoginForm
            userType="kindergarten"
            onLogin={ctx.handleLogin}
            onSwitchToSignup={() => ctx.setAuthScreen('signup')}
            onSwitchToForgotPassword={() => ctx.setAuthScreen('forgotPassword')}
          />
        )}

        {ctx.authScreen === 'signup' && (
          <SignupForm
            userType="kindergarten"
            onSignup={ctx.handleSignup}
            onSwitchToLogin={() => ctx.setAuthScreen('login')}
          />
        )}

        {ctx.authScreen === 'forgotPassword' && (
          <ForgotPasswordForm
            userType="kindergarten"
            onResetPassword={ctx.handleResetPassword}
            onBack={() => ctx.setAuthScreen('login')}
          />
        )}
      </div>
    );
  }

  // ── Pending claim → show verification screen ──
  const claimStatus = localStorage.getItem('school_claim_status');
  const subscriptionTier = localStorage.getItem('school_subscription_tier');
  if (claimStatus === 'pending' || subscriptionTier === 'pending_claim') {
    const schoolName = localStorage.getItem('school_name') || 'your kindergarten';
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Verification</h1>
          <p className="text-sm text-gray-500 mb-4">
            Your claim for <strong className="text-gray-900">{schoolName}</strong> is being reviewed.
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">What happens next?</p>
                <ul className="text-xs text-amber-600 mt-2 space-y-1.5 list-disc list-inside">
                  <li>An admin will verify your identity (usually via WhatsApp call)</li>
                  <li>Once approved, you'll have full access to your kindergarten dashboard</li>
                  <li>This usually takes 1-2 business days</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={ctx.handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Rejected claim ──
  if (claimStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Claim Rejected</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your claim was not approved. Please contact support for more information.
          </p>
          <button
            onClick={ctx.handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── Authenticated → show KG dashboard ──
  return (
    <div className="relative">
      <KindergartenDashboard
        schoolName={ctx.brandingSettings.schoolName}
        onLogout={ctx.handleLogout}
        brandingSettings={ctx.brandingSettings}
        setBrandingSettings={ctx.setBrandingSettings}
      />
    </div>
  );
}