// AdminPage — Route component for /admin/*
// Handles admin auth guard + role check + SuperAdminDashboard rendering.
import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';
import { SuperAdminDashboard } from '../components/dashboards/SuperAdminDashboard';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function AdminPage() {
  const ctx = useAppContext();

  // ── Not authenticated → show auth forms ──
  if (!ctx.isAuthenticated) {
    return (
      <div className="relative">
        {ctx.authScreen === 'login' && (
          <LoginForm
            userType="superadmin"
            onLogin={ctx.handleLogin}
            onSwitchToSignup={() => ctx.setAuthScreen('signup')}
            onSwitchToForgotPassword={() => ctx.setAuthScreen('forgotPassword')}
          />
        )}

        {ctx.authScreen === 'signup' && (
          <SignupForm
            userType="superadmin"
            onSignup={ctx.handleSignup}
            onSwitchToLogin={() => ctx.setAuthScreen('login')}
          />
        )}

        {ctx.authScreen === 'forgotPassword' && (
          <ForgotPasswordForm
            userType="superadmin"
            onResetPassword={ctx.handleResetPassword}
            onBack={() => ctx.setAuthScreen('login')}
          />
        )}
      </div>
    );
  }

  // ── Authenticated but NOT a super admin → access denied ──
  if (ctx.userRole !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 text-sm mb-6">
              This area is restricted to super administrators. Your account has the role{' '}
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-xs">
                {ctx.userRole || 'kindergarten'}
              </span>.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.href = '/kg'}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to KG Dashboard
              </button>
              <button
                onClick={ctx.handleLogout}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Sign out & use a different account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated + superadmin → show admin dashboard ──
  return (
    <div className="relative">
      <SuperAdminDashboard
        onLogout={ctx.handleLogout}
        questionBank={ctx.questionBank}
        setQuestionBank={ctx.setQuestionBank}
        questConfigs={ctx.questConfigs}
        setQuestConfigs={ctx.setQuestConfigs}
      />
    </div>
  );
}
