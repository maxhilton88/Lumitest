/**
 * SiteLayout.tsx — Wrapper for public marketing pages
 * 
 * Provides shared SiteHeader + SiteFooter around an Outlet.
 * Scrolls to top on every route change.
 */
import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function SiteLayout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ScrollToTop />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
