// KGPage — Route component for /kg/*
// Handles KG auth guard + KindergartenDashboard rendering.
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { KindergartenDashboard } from '../components/dashboards/KindergartenDashboard';

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
