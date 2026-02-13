/**
 * routes.tsx — Foxy Adventure Route Configuration
 *
 * Nested route structure with lazy-loaded page components.
 * MainApp serves as the root layout (state provider + Outlet).
 *
 * ROUTE MAP:
 * /                        ParentPage (parent/child login + dashboard)
 * /:page                   ParentPage (deep-link to sub-page, e.g. /game, /mastery)
 * /play/:step              ChildFlowPage (internal: parent-initiated quest steps)
 * /t/:code                 ChildFlowPage (branded entry via school shortCode/slug)
 * /t/:code/:step           ChildFlowPage (branded child flow steps)
 * /kg                      KGPage (auth guard + dashboard)
 * /admin                   AdminPage (auth guard + dashboard)
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

// Lazy-loaded page components (code-split per route)
const ChildFlowPage = React.lazy(() =>
  import('./pages/ChildFlowPage').then(m => ({ default: m.ChildFlowPage }))
);
const ParentPage = React.lazy(() =>
  import('./pages/ParentPage').then(m => ({ default: m.ParentPage }))
);
const KGPage = React.lazy(() =>
  import('./pages/KGPage').then(m => ({ default: m.KGPage }))
);
const AdminPage = React.lazy(() =>
  import('./pages/AdminPage').then(m => ({ default: m.AdminPage }))
);

// Redirect helper for legacy /parent URLs → /
const ParentRedirect = () => {
  const search = window.location.search;
  return <Navigate to={`/${search}`} replace />;
};
const ParentSubRedirect = () => {
  // Redirect /parent/:page → /:page (e.g. /parent/game → /game)
  const page = window.location.pathname.replace(/^\/parent\/?/, '') || '';
  const search = window.location.search;
  return <Navigate to={`/${page}${search}`} replace />;
};

// MainApp is the root layout — it owns all state and provides AppContext.
// It is imported inside App.tsx where createBrowserRouter is called.
// This file exports only the child route definitions.
export const childRoutes = [
  // ── Parent/child landing (root) ──
  { index: true, Component: ParentPage },

  // ── Parent deep-link pages (e.g. /game, /mastery, /plan) ──
  // Listed explicitly to avoid clashing with other top-level routes
  { path: 'game', Component: ParentPage },
  { path: 'mastery', Component: ParentPage },
  { path: 'library', Component: ParentPage },
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

  // ── Kindergarten staff ──
  { path: 'kg', Component: KGPage },
  { path: 'kg/*', Component: KGPage },

  // ── Super Admin ──
  { path: 'admin', Component: AdminPage },
  { path: 'admin/*', Component: AdminPage },

  // ── Catch-all → redirect to root (parent login) ──
  { path: '*', element: <Navigate to="/" replace /> },
];
