/**
 * PartnerPortalPage.tsx — FMCG Partner Portal (Prompt 2, Part C)
 *
 * Route: /partner
 * 
 * Auth guard: any logged-in user with fmcg_partner:{email} KV entry.
 * Shows read-only campaign analytics dashboard.
 */
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { PartnerDashboard } from '../components/fmcg/PartnerDashboard';

export function PartnerPortalPage() {
  const ctx = useAppContext();

  // ── Not authenticated → show auth forms ──
  if (!ctx.isAuthenticated) {
    return (
      <div className="relative">
        {ctx.authScreen === 'login' && (
          <LoginForm
            userType="partner"
            onLogin={ctx.handleLogin}
            onSwitchToSignup={() => ctx.setAuthScreen('signup')}
            onSwitchToForgotPassword={() => ctx.setAuthScreen('forgotPassword')}
          />
        )}
        {ctx.authScreen === 'signup' && (
          <SignupForm
            userType="partner"
            onSignup={ctx.handleSignup}
            onSwitchToLogin={() => ctx.setAuthScreen('login')}
          />
        )}
        {ctx.authScreen === 'forgotPassword' && (
          <ForgotPasswordForm
            userType="partner"
            onResetPassword={ctx.handleResetPassword}
            onBack={() => ctx.setAuthScreen('login')}
          />
        )}
      </div>
    );
  }

  // ── Authenticated → show partner dashboard ──
  return <PartnerDashboard onLogout={ctx.handleLogout} />;
}