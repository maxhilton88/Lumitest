/**
 * routes.tsx — Project Lumi Route Configuration
 *
 * Nested route structure with lazy-loaded page components.
 * MainApp serves as the root layout (state provider + Outlet).
 *
 * ROUTE MAP:
 * /                        SiteLayout → HomePage (public SaaS landing)
 * /parents                 SiteLayout → ParentsPage (parent-focused landing)
 * /kindergarten            SiteLayout → KGMapPage (KinderPartner landing + territory map)
 * /ai-toy                  SiteLayout → AIToyPage (FOXY-o1 product page)
 * /fmcg                    SiteLayout → FMCGPage (FMCG product page)
 * /about                   SiteLayout → AboutPage (about Project Lumi)
 * /blog                    SiteLayout → BlogPage (blog listing)
 * /contact                 SiteLayout → ContactPage (contact information)
 * /pricing                 SiteLayout → PricingPage (plans & pricing)
 * /terms                   SiteLayout → TermsPage (terms of service)
 * /privacy                 SiteLayout → PrivacyPage (privacy policy)
 * /login                   ParentPage (parent/child login + dashboard)
 * /login/:page             ParentPage (deep-link to sub-page)
 * /play/:step              ChildFlowPage (internal: parent-initiated quest steps)
 * /t/:code                 ChildFlowPage (branded entry via school shortCode/slug)
 * /t/:code/:step           ChildFlowPage (branded child flow steps)
 * /reset-password          ResetPasswordPage (password reset callback)
 * /report/:reportId        PublicReportPage (public shareable report)
 * /store                   StorePage (legacy pricing — redirects to /pricing)
 * /dyntube-test            DynTubeTestPage (video integration testing)
 * /realm                   RealmShell (layout) → RealmPage (hub)
 * /realm/bag               RealmShell → BagPage (inventory & shop)
 * /realm/flashcards        RealmShell → RealmFlashcardsPage
 * /realm/library           RealmShell → RealmLibraryPage
 * /realm/audio             RealmShell → RealmAudioPage
 * /realm/practice          RealmShell → RealmPracticePage
 * /realm/test              RealmShell → RealmTestPage
 * /realm/battle            RealmShell → RealmBattlePage
 * /realm/mastery           RealmShell → RealmMasteryPage
 * /realm/quest             RealmShell → RealmQuestPage
 * /kg                      KGPage (auth guard + dashboard)
 * /kinderpartner           → redirects to /kindergarten
 * /kg-map                  → redirects to /kindergarten
 * /kg-signup               KGSignupPage (public claim signup)
 * /kg-register             KGRegisterPage (public claim registration)
 * /kg-find                 KGFindPage (public claim search)
 * /qr                      QRClaimPage (QR code claim)
 * /admin                   AdminPage (auth guard + dashboard)
 * /partner-portal          PartnerPortalPage (partner portal dashboard)
 *
 * CHILD FLOW STEPS (/:step):
 *   (index)   → childWelcome
 *   start     → languageSelect
 *   resume    → resumePrompt
 *   map       → adventureMap
 *   quest     → test (question screen)
 *   victory   → victory
 *   report    → results (full report)
 *   gate      → gatedResults
 */

import React from 'react';
import { Navigate } from 'react-router';

/**
 * Retry wrapper for dynamic imports.
 */
function retryImport<T>(factory: () => Promise<T>, retries = 1): Promise<T> {
  return factory().catch((err) => {
    if (retries > 0) {
      console.warn('[ROUTER] Dynamic import failed, retrying...', err?.message);
      return new Promise<T>((resolve) =>
        setTimeout(() => resolve(retryImport(factory, retries - 1)), 1000)
      );
    }
    console.error('[ROUTER] Dynamic import failed after retries, reloading page', err);
    window.location.reload();
    return new Promise<T>(() => {});
  });
}

// ── Public marketing pages ──
const SiteLayout = React.lazy(() =>
  retryImport(() => import('./components/site/SiteLayout')).then(m => ({ default: m.SiteLayout }))
);
const HomePage = React.lazy(() =>
  retryImport(() => import('./pages/HomePage')).then(m => ({ default: m.HomePage }))
);
const ParentsPage = React.lazy(() =>
  retryImport(() => import('./pages/ParentsPage')).then(m => ({ default: m.ParentsPage }))
);
const AIToyPage = React.lazy(() =>
  retryImport(() => import('./pages/AIToyPage')).then(m => ({ default: m.AIToyPage }))
);
const FMCGPage = React.lazy(() =>
  retryImport(() => import('./pages/FMCGPage')).then(m => ({ default: m.FMCGPage }))
);
const AboutPage = React.lazy(() =>
  retryImport(() => import('./pages/AboutPage')).then(m => ({ default: m.AboutPage }))
);
const BlogPage = React.lazy(() =>
  retryImport(() => import('./pages/BlogPage')).then(m => ({ default: m.BlogPage }))
);
const ContactPage = React.lazy(() =>
  retryImport(() => import('./pages/ContactPage')).then(m => ({ default: m.ContactPage }))
);
const PricingPage = React.lazy(() =>
  retryImport(() => import('./pages/PricingPage')).then(m => ({ default: m.PricingPage }))
);

// ── Existing pages ──
const ChildFlowPage = React.lazy(() =>
  retryImport(() => import('./pages/ChildFlowPage')).then(m => ({ default: m.ChildFlowPage }))
);
const ParentPage = React.lazy(() =>
  retryImport(() => import('./pages/ParentPage')).then(m => ({ default: m.ParentPage }))
);
const KGPage = React.lazy(() =>
  retryImport(() => import('./pages/KGPage')).then(m => ({ default: m.KGPage }))
);
const AdminPage = React.lazy(() =>
  retryImport(() => import('./pages/AdminPage')).then(m => ({ default: m.AdminPage }))
);
const ResetPasswordPage = React.lazy(() =>
  retryImport(() => import('./pages/ResetPasswordPage')).then(m => ({ default: m.ResetPasswordPage }))
);
const PublicReportPage = React.lazy(() =>
  retryImport(() => import('./pages/PublicReportPage')).then(m => ({ default: m.PublicReportPage }))
);
const StorePage = React.lazy(() =>
  retryImport(() => import('./pages/StorePage')).then(m => ({ default: m.StorePage }))
);
const PrivacyPage = React.lazy(() =>
  retryImport(() => import('./pages/PrivacyPage')).then(m => ({ default: m.PrivacyPage }))
);
const TermsPage = React.lazy(() =>
  retryImport(() => import('./pages/TermsPage')).then(m => ({ default: m.TermsPage }))
);
const DynTubeTestPage = React.lazy(() =>
  retryImport(() => import('./pages/DynTubeTestPage')).then(m => ({ default: m.default }))
);
const RealmPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmPage')).then(m => ({ default: m.RealmPage }))
);
const BagPage = React.lazy(() =>
  retryImport(() => import('./pages/BagPage')).then(m => ({ default: m.BagPage }))
);
const RealmShell = React.lazy(() =>
  retryImport(() => import('./components/realm/RealmShell')).then(m => ({ default: m.RealmShell }))
);
const RealmFlashcardsPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmFlashcardsPage')).then(m => ({ default: m.RealmFlashcardsPage }))
);
const RealmLibraryPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmLibraryPage')).then(m => ({ default: m.RealmLibraryPage }))
);
const RealmAudioPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmAudioPage')).then(m => ({ default: m.RealmAudioPage }))
);
const RealmPracticePage = React.lazy(() =>
  retryImport(() => import('./pages/RealmPracticePage')).then(m => ({ default: m.RealmPracticePage }))
);
const RealmTestPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmTestPage')).then(m => ({ default: m.RealmTestPage }))
);
const RealmBattlePage = React.lazy(() =>
  retryImport(() => import('./pages/RealmBattlePage')).then(m => ({ default: m.RealmBattlePage }))
);
const RealmMasteryPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmMasteryPage')).then(m => ({ default: m.RealmMasteryPage }))
);
const RealmQuestPage = React.lazy(() =>
  retryImport(() => import('./pages/RealmQuestPage')).then(m => ({ default: m.RealmQuestPage }))
);
const KGMapPage = React.lazy(() =>
  retryImport(() => import('./pages/KGMapPage')).then(m => ({ default: m.KGMapPage }))
);
const KGSignupPage = React.lazy(() =>
  retryImport(() => import('./pages/KGSignupPage')).then(m => ({ default: m.KGSignupPage }))
);
const KGRegisterPage = React.lazy(() =>
  retryImport(() => import('./pages/KGRegisterPage')).then(m => ({ default: m.KGRegisterPage }))
);
const KGFindPage = React.lazy(() =>
  retryImport(() => import('./pages/KGFindPage')).then(m => ({ default: m.KGFindPage }))
);
const QRClaimPage = React.lazy(() =>
  retryImport(() => import('./pages/QRClaimPage')).then(m => ({ default: m.QRClaimPage }))
);
const PartnerPortalPage = React.lazy(() =>
  retryImport(() => import('./pages/PartnerPortalPage')).then(m => ({ default: m.PartnerPortalPage }))
);

// Redirect helpers
const ParentRedirect = () => {
  const search = window.location.search;
  return <Navigate to={`/login${search}`} replace />;
};
const ParentSubRedirect = () => {
  const page = window.location.pathname.replace(/^\/parent\/?/, '') || '';
  const search = window.location.search;
  return <Navigate to={`/login/${page}${search}`} replace />;
};

// MainApp is the root layout — it owns all state and provides AppContext.
// It is imported inside App.tsx where createBrowserRouter is called.
// This file exports only the child route definitions.
export const childRoutes = [
  // ── Public marketing pages (wrapped in SiteLayout with header + footer) ──
  {
    Component: SiteLayout,
    children: [
      { index: true, Component: HomePage },
      { path: 'parents', Component: ParentsPage },
      { path: 'kindergarten', Component: KGMapPage },
      { path: 'ai-toy', Component: AIToyPage },
      { path: 'fmcg', Component: FMCGPage },
      { path: 'about', Component: AboutPage },
      { path: 'blog', Component: BlogPage },
      { path: 'contact', Component: ContactPage },
      { path: 'pricing', Component: PricingPage },
      { path: 'terms', Component: TermsPage },
      { path: 'privacy', Component: PrivacyPage },
    ],
  },

  // ── Parent/child login + dashboard (moved from / to /login) ──
  { path: 'login', Component: ParentPage },

  // ── Parent deep-link pages (e.g. /mastery, /plan) — now under /login/* ──
  { path: 'mastery', Component: ParentPage },
  { path: 'earnings', Component: ParentPage },
  { path: 'plan', Component: ParentPage },
  { path: 'account', Component: ParentPage },

  // ── Child flow (internal: parent-initiated quest) ──
  { path: 'play/:step', Component: ChildFlowPage },

  // ── Child flow (branded via /t/:code) ──
  { path: 't/:code', Component: ChildFlowPage },
  { path: 't/:code/:step', Component: ChildFlowPage },

  // ── Legacy /parent redirects (backwards compat) ──
  { path: 'parent', Component: ParentRedirect },
  { path: 'parent/*', Component: ParentSubRedirect },

  // ── Legacy /home redirect → /login ──
  { path: 'home', element: <Navigate to="/login" replace /> },

  // ── Password reset callback ──
  { path: 'reset-password', Component: ResetPasswordPage },

  // ── Public shareable report ──
  { path: 'report/:reportId', Component: PublicReportPage },

  // ── Legacy store → pricing redirect ──
  { path: 'store', Component: StorePage },

  // ── DynTube test page ──
  { path: 'dyntube-test', Component: DynTubeTestPage },

  // ── Foxy Realm (RPG home screen) ──
  {
    path: 'realm',
    Component: RealmShell,
    children: [
      { index: true, Component: RealmPage },
      { path: 'bag', Component: BagPage },
      { path: 'flashcards', Component: RealmFlashcardsPage },
      { path: 'library', Component: RealmLibraryPage },
      { path: 'audio', Component: RealmAudioPage },
      { path: 'practice', Component: RealmPracticePage },
      { path: 'test', Component: RealmTestPage },
      { path: 'battle', Component: RealmBattlePage },
      { path: 'mastery', Component: RealmMasteryPage },
      { path: 'quest', Component: RealmQuestPage },
    ],
  },

  // ── Kindergarten staff ──
  { path: 'kg', Component: KGPage },
  { path: 'kg/*', Component: KGPage },

  // ── Legacy redirects ──
  { path: 'kg-map', element: <Navigate to="/kindergarten" replace /> },
  { path: 'kinderpartner', element: <Navigate to="/kindergarten" replace /> },

  // ── KG Claim Signup (public) ──
  { path: 'kg-signup', Component: KGSignupPage },

  // ── KG Claim Registration (public) ──
  { path: 'kg-register', Component: KGRegisterPage },

  // ── KG Claim Search (public) ──
  { path: 'kg-find', Component: KGFindPage },

  // ── QR Claim (public) ──
  { path: 'qr', Component: QRClaimPage },

  // ── Super Admin ──
  { path: 'admin', Component: AdminPage },
  { path: 'admin/*', Component: AdminPage },

  // ── Partner Portal ──
  { path: 'partner-portal', Component: PartnerPortalPage },
  { path: 'partner-portal/*', Component: PartnerPortalPage },

  // ── Catch-all → redirect to home ──
  { path: '*', element: <Navigate to="/" replace /> },
];