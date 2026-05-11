/**
 * App.tsx — Foxy Adventure Root (Stages 4-6 Complete)
 *
 * MainApp is the root layout: owns auth state, branding, and UI chrome.
 * Test/quest session state lives in useTestSession hook.
 * OAuth and Stripe callbacks live in dedicated hooks.
 * All page components consume state via AppContext (unchanged interface).
 *
 * Title: Foxy Adventure — Screen Time That Builds School Readiness
 */
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { LanguageProvider } from './components/LanguageContext';
import { TaxonomyProvider } from './contexts/TaxonomyContext';
import { parentValidateSession, getStoredParentData } from './utils/parent-api';
import type { UserType } from './components/DevNavigation';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from './utils/supabase/info';
import { adminAuthClient, getFreshAdminToken } from './utils/supabase-client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { createBrowserRouter, RouterProvider, useLocation, useNavigate, Outlet } from 'react-router';
import { AppContext } from './contexts/AppContext';
import { childRoutes } from './routes';
import { useTestSession } from './hooks/useTestSession';
import { useOAuthCallback } from './hooks/useOAuthCallback';
import { useCheckoutCallback } from './hooks/useCheckoutCallback';
import type { AuthScreen, BrandingSettings } from './types/app-types';
import { PWAMetaTags } from './components/PWAMetaTags';

function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();

  // ── User type derived from URL path (source of truth) ──
  const currentUserType = useMemo<UserType>(() => {
    const p = location.pathname;
    if (p === '/kg' || p.startsWith('/kg/') || p.startsWith('/kg-')) return 'kindergarten';
    if (p.startsWith('/admin')) return 'superadmin';
    if (p.startsWith('/t/') || p.startsWith('/play/')) return 'child';
    return 'parent';
  }, [location.pathname]);

  // ═══════════════════════════════════════════════
  // AUTH STATE
  // ═══════════════════════════════════════════════

  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('access_token');
  });
  const [userRole, setUserRole] = useState<'superadmin' | 'kindergarten' | null>(() => {
    return (localStorage.getItem('user_role') as 'superadmin' | 'kindergarten') || null;
  });

  // Parent auth state
  const [isParentAuthenticated, setIsParentAuthenticated] = useState(() => {
    return !!localStorage.getItem('parent_access_token');
  });
  const [parentData, setParentData] = useState<any>(() => getStoredParentData());

  // ═══════════════════════════════════════════════
  // UI CHROME STATE
  // ═══════════════════════════════════════════════

  const [showPracticeMode, setShowPracticeMode] = useState(false);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const pendingQuestStartRef = React.useRef<(() => void) | null>(null);

  // Branding settings (shared between test flow and KG dashboard)
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings>({
    schoolName: 'Little Stars Kindergarten',
    logoUrl: '',
    primaryColor: '#7cc643',
    kindergartenUrl: 'little-stars',
    testPageBgColor: '#ffffff',
    mapBackgroundImage: '',
    testBackgroundImage: '',
    email: '',
    phone: '',
    whatsappNo: '',
    address: '',
  });

  // ═══════════════════════════════════════════════
  // TEST SESSION (Stage 4 — extracted to hook)
  // ═══════════════════════════════════════════════

  const testSession = useTestSession({
    currentUserType,
    navigate,
    locationPathname: location.pathname,
    brandingSettings,
    setBrandingSettings,
  });

  // ═══════════════════════════════════════════════
  // CALLBACKS (Stage 5 — extracted to hooks)
  // ═══════════════════════════════════════════════

  useOAuthCallback({ navigate, setIsParentAuthenticated, setParentData });
  useCheckoutCallback({ navigate, locationPathname: location.pathname, setParentData });

  // ═══════════════════════════════════════════════
  // SESSION VALIDATION
  // ═══════════════════════════════════════════════

  // KG/Admin session validation
  useEffect(() => {
    const validateSession = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      if (currentUserType !== 'kindergarten' && currentUserType !== 'superadmin') return;

      try {
        const freshToken = await getFreshAdminToken();
        const sessionToken = freshToken || token;
        console.log('Validating session token...', freshToken ? '(auto-refreshed)' : '(localStorage)');
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/auth/session`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${publicAnonKey}`,
              'X-User-Token': `Bearer ${sessionToken}`,
            },
          }
        );

        if (!response.ok) {
          console.warn('Session validation failed, clearing stale token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('user_id');
          localStorage.removeItem('school_id');
          localStorage.removeItem('school_name');
          localStorage.removeItem('school_short_code');
          localStorage.removeItem('school_kindergarten_url');
          adminAuthClient.auth.signOut().catch(() => {});
          setIsAuthenticated(false);
          return;
        }

        const data = await response.json();
        console.log('Session valid:', data.user?.email, data.school?.school_name);

        if (data.school?.school_name) {
          localStorage.setItem('school_name', data.school.school_name);
          setBrandingSettings((prev) => ({
            ...prev,
            schoolName: data.school.school_name,
            // Populate contact info from server school record
            ...(data.school.email && { email: data.school.email }),
            ...(data.school.phone && { phone: data.school.phone }),
            ...(data.school.whatsapp_no && { whatsappNo: data.school.whatsapp_no }),
            ...(data.school.address && { address: data.school.address }),
            ...(data.school.logo_url && { logoUrl: data.school.logo_url }),
          }));
        }

        if (data.school?.short_code) {
          localStorage.setItem('school_short_code', data.school.short_code);
        }

        if (data.school?.kindergarten_url) {
          localStorage.setItem('school_kindergarten_url', data.school.kindergarten_url);
        }

        // Store subscription tier for KG dashboard to read
        localStorage.setItem('school_subscription_tier', data.school?.subscription_tier || 'trial');
        // Store claim status for pending verification screen
        if (data.school?.claim_status) {
          localStorage.setItem('school_claim_status', data.school.claim_status);
        } else {
          localStorage.removeItem('school_claim_status');
        }
        // Store trial expiry for blur-gate logic
        if (data.school?.trial_expires_at) {
          localStorage.setItem('school_trial_expires_at', data.school.trial_expires_at);
        }
        // Store linked Postgres KG ID for territory map
        if (data.school?.linked_pg_kg_id) {
          localStorage.setItem('school_linked_pg_kg_id', data.school.linked_pg_kg_id);
        }

        if (data.user?.role) {
          localStorage.setItem('user_role', data.user.role);
          setUserRole(data.user.role);
        }

        setIsAuthenticated(true);
      } catch (error) {
        console.error('Session validation network error:', error);
      }
    };

    validateSession();
  }, [currentUserType]);

  // Parent session validation
  useEffect(() => {
    if (currentUserType !== 'parent') return;
    const validateParent = async () => {
      const result = await parentValidateSession();
      if (result?.valid && result.parent) {
        setIsParentAuthenticated(true);
        setParentData(result.parent);
        // Sync excluded subjects from parent profile
        if (result.parent.excluded_subjects) {
          testSession.setExcludedSubjects(result.parent.excluded_subjects);
          localStorage.setItem('excluded_subjects', JSON.stringify(result.parent.excluded_subjects));
        } else if (result.parent.include_mandarin_test === false) {
          // Backward compat: old boolean → new array
          testSession.setExcludedSubjects(['ZH']);
          localStorage.setItem('excluded_subjects', JSON.stringify(['ZH']));
        }
      } else {
        setIsParentAuthenticated(false);
        setParentData(null);
      }
    };
    if (isParentAuthenticated) {
      validateParent();
    }
  }, [currentUserType]);

  // ═══════════════════════════════════════════════
  // AUTH HANDLERS
  // ═══════════════════════════════════════════════

  const handleLogin = async (email: string, password: string) => {
    try {
      console.log('Login attempt:', email);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email, password }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Login error:', result);
        toast.error(result.error || 'Invalid credentials');
        return;
      }

      console.log('Login success:', result);

      localStorage.setItem('access_token', result.session.access_token);
      localStorage.setItem('user_id', result.user.id);
      localStorage.setItem('user_email', result.user.email);

      // Store school data (superadmin gets a dummy school object)
      const school = result.school || {};
      localStorage.setItem('school_id', school.id || '');
      localStorage.setItem('school_name', school.school_name || '');
      localStorage.setItem('school_short_code', school.short_code || '');
      localStorage.setItem('school_kindergarten_url', school.kindergarten_url || '');
      localStorage.setItem('school_subscription_tier', school.subscription_tier || 'trial');
      if (school.claim_status) {
        localStorage.setItem('school_claim_status', school.claim_status);
      } else {
        localStorage.removeItem('school_claim_status');
      }
      if (school.trial_expires_at) {
        localStorage.setItem('school_trial_expires_at', school.trial_expires_at);
      }
      if (school.linked_pg_kg_id) {
        localStorage.setItem('school_linked_pg_kg_id', school.linked_pg_kg_id);
      }

      const role = result.user.role || 'kindergarten';
      localStorage.setItem('user_role', role);
      setUserRole(role);
      console.log(`[AUTH] User role: ${role}`);

      await adminAuthClient.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      console.log('[AUTH] Session set on adminAuthClient after login');

      toast.success('Login successful!');
      setIsAuthenticated(true);

      // ── FMCG: Auto-redirect to QR claim if pending code exists (Prompt 2) ──
      const pendingQR = localStorage.getItem('fmcg_pending_code');
      if (pendingQR) {
        console.log('[FMCG] Pending QR code found after login, redirecting:', pendingQR);
        // Small delay to let auth state propagate
        setTimeout(() => {
          window.location.href = `/qr?code=${encodeURIComponent(pendingQR)}`;
        }, 300);
      }
    } catch (error) {
      console.error('Login network error:', error);
      toast.error('Network error. Please try again.');
    }
  };

  const handleSignup = async (data: {
    name: string;
    email: string;
    password: string;
    schoolName?: string;
  }) => {
    try {
      console.log('Signup attempt:', data);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc/auth/signup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            email: data.email,
            password: data.password,
            schoolName: data.schoolName || data.name,
            kindergartenUrl: `${(data.schoolName || data.name).toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Signup error:', result);
        toast.error(result.error || 'Signup failed');
        return;
      }

      console.log('Signup success:', result);
      toast.success('Account created successfully! Please sign in.');
      setAuthScreen('login');
    } catch (error) {
      console.error('Signup network error:', error);
      toast.error('Network error. Please try again.');
    }
  };

  const handleResetPassword = async (email: string) => {
    console.log('[AUTH] Requesting password reset for:', email);
    try {
      const { error } = await adminAuthClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password?source=admin`,
      });
      if (error) {
        console.error('[AUTH] Password reset error:', error);
        toast.error(`Failed to send reset link: ${error.message}`);
        throw error;
      }
      console.log('[AUTH] Password reset email sent to:', email);
      toast.success('Password reset link sent! Check your email.');
    } catch (err: any) {
      console.error('[AUTH] Password reset exception:', err);
      if (!err?.message?.includes('Failed to send')) {
        toast.error('Something went wrong. Please try again.');
      }
      throw err;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('school_id');
    localStorage.removeItem('school_name');
    localStorage.removeItem('school_short_code');
    localStorage.removeItem('school_kindergarten_url');
    localStorage.removeItem('school_subscription_tier');
    localStorage.removeItem('school_claim_status');
    localStorage.removeItem('school_trial_expires_at');
    localStorage.removeItem('school_linked_pg_kg_id');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_email');
    adminAuthClient.auth.signOut().catch(() => {});
    setIsAuthenticated(false);
    setUserRole(null);
    setAuthScreen('login');
    testSession.resetTestState();
    toast.info('Logged out successfully');
  };

  // ═══════════════════════════════════════════════
  // USER TYPE SWITCHING (DEV MODE)
  // ═══════════════════════════════════════════════

  const handleSwitchUserType = (userType: UserType) => {
    const paths: Record<UserType, string> = {
      child: '/t/demo',
      parent: '/login',
      kindergarten: '/kg',
      superadmin: '/admin',
    };
    navigate(paths[userType]);
    if (userType !== 'parent') {
      setIsAuthenticated(false);
      setAuthScreen('login');
    }
    testSession.resetTestState();
    toast.info(`Switched to ${userType} mode`);
  };

  // ═══════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════

  const contextValue = useMemo(
    () => ({
      // Auth (KG/Admin)
      isAuthenticated,
      setIsAuthenticated,
      userRole,
      authScreen,
      setAuthScreen,
      // Auth (Parent)
      isParentAuthenticated,
      setIsParentAuthenticated,
      parentData,
      setParentData,
      // User type
      currentUserType,
      handleSwitchUserType,
      // Child flow (from useTestSession)
      childScreen: testSession.childScreen,
      setChildScreen: testSession.setChildScreen,
      age: testSession.age,
      excludedSubjects: testSession.excludedSubjects,
      setExcludedSubjects: testSession.setExcludedSubjects,
      completedModules: testSession.completedModules,
      currentModule: testSession.currentModule,
      currentQuestionIndex: testSession.currentQuestionIndex,
      currentTestQuestions: testSession.currentTestQuestions,
      allDetailedAnswers: testSession.allDetailedAnswers,
      setAllDetailedAnswers: testSession.setAllDetailedAnswers,
      currentModuleAnswers: testSession.currentModuleAnswers,
      moduleResults: testSession.moduleResults,
      setModuleResults: testSession.setModuleResults,
      assessmentCompleted: testSession.assessmentCompleted,
      leadData: testSession.leadData,
      pendingResumeLead: testSession.pendingResumeLead,
      justCompletedModule: testSession.justCompletedModule,
      setJustCompletedModule: testSession.setJustCompletedModule,
      // Quests & branding
      liveQuests: testSession.liveQuests,
      questCardImageUrls: testSession.questCardImageUrls,
      brandingSettings,
      setBrandingSettings,
      // KG/Admin content
      questionBank: testSession.questionBank,
      setQuestionBank: testSession.setQuestionBank,
      questConfigs: testSession.questConfigs,
      setQuestConfigs: testSession.setQuestConfigs,
      // Overlays
      showPracticeMode,
      setShowPracticeMode,
      showWhatsAppPrompt,
      setShowWhatsAppPrompt,
      // Refs
      parentInitiatedQuestRef: testSession.parentInitiatedQuestRef,
      pendingQuestStartRef,
      resolvedSchoolIdRef: testSession.resolvedSchoolIdRef,
      isResolvingSchool: testSession.isResolvingSchool,
      // Handlers
      handleLogin,
      handleSignup,
      handleResetPassword,
      handleLogout,
      handleStartAdventure: testSession.handleStartAdventure,
      handleLanguageStart: testSession.handleLanguageStart,
      handleModuleSelect: testSession.handleModuleSelect,
      handleAnswer: testSession.handleAnswer,
      handleNext: testSession.handleNext,
      handleShare: testSession.handleShare,
      handleResumeSession: testSession.handleResumeSession,
      handleStartFresh: testSession.handleStartFresh,
      persistAssessmentSnapshot: testSession.persistAssessmentSnapshot,
      setAnswers: testSession.setAnswers,
      setCurrentQuestionIndex: testSession.setCurrentQuestionIndex,
      // School resolution
      resolvedSchoolId: testSession.resolvedSchoolId,
      setResolvedSchoolId: testSession.setResolvedSchoolId,
    }),
    [
      isAuthenticated,
      userRole,
      authScreen,
      isParentAuthenticated,
      parentData,
      currentUserType,
      testSession.childScreen,
      testSession.age,
      testSession.excludedSubjects,
      testSession.completedModules,
      testSession.currentModule,
      testSession.currentQuestionIndex,
      testSession.currentTestQuestions,
      testSession.allDetailedAnswers,
      testSession.currentModuleAnswers,
      testSession.moduleResults,
      testSession.setModuleResults,
      testSession.assessmentCompleted,
      testSession.leadData,
      testSession.pendingResumeLead,
      testSession.justCompletedModule,
      testSession.liveQuests,
      testSession.questCardImageUrls,
      testSession.questionBank,
      testSession.questConfigs,
      testSession.isResolvingSchool,
      testSession.resolvedSchoolId,
      brandingSettings,
      showPracticeMode,
      showWhatsAppPrompt,
    ]
  );

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  return (
    <ErrorBoundary>
      <AppContext.Provider value={contextValue}>
        <LanguageProvider>
          <TaxonomyProvider>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c8b88a] mx-auto mb-4" />
                    <p className="text-[#c8b88a] text-sm font-medium">Loading adventure...</p>
                  </div>
                </div>
              }
            >
              <Outlet />
            </Suspense>
            <Toaster />
            <PWAMetaTags />
          </TaxonomyProvider>
        </LanguageProvider>
      </AppContext.Provider>
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════

const router = createBrowserRouter([
  {
    path: '/',
    Component: MainApp,
    children: childRoutes,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}