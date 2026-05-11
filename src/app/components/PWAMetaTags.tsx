/**
 * PWAMetaTags.tsx — Injects PWA / iOS Add-to-Home-Screen meta tags into <head>
 *
 * CRITICAL: iOS Safari reads apple-mobile-web-app-capable at HTML parse time,
 * NOT after JavaScript runs. We inject the tags at MODULE LOAD TIME (top-level
 * side effect) so they exist in the DOM as early as possible — before React mounts.
 * The useEffect is kept as a safety net for any late-arriving SPA navigations.
 *
 * Tags injected:
 * - <link rel="manifest" href="/manifest.json">
 * - <meta name="mobile-web-app-capable" content="yes">
 * - <meta name="apple-mobile-web-app-capable" content="yes">
 * - <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
 * - <meta name="apple-mobile-web-app-title" content="Foxy Adventure">
 * - <meta name="theme-color" content="#000000">
 * - <link rel="apple-touch-icon" href="...">
 * - <meta name="viewport" ... (with viewport-fit=cover for notched devices)
 *
 * NOTE: Service Worker registration is now ENABLED for production at projectlumi.org.
 * Previously disabled while hosted on Figma Make.
 */
import { useEffect } from 'react';
import foxyFavicon from 'figma:asset/8527c899b55ef437b387a6edcbe43793fac09b8b.png';

function ensureMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (el) {
    el.content = content;
  } else {
    el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
  }
}

function ensureLink(rel: string, href: string, extra?: Record<string, string>) {
  const selector = extra
    ? `link[rel="${rel}"]`
    : `link[rel="${rel}"][href="${href}"]`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (el) {
    el.href = href;
  } else {
    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => el!.setAttribute(k, v));
    }
    document.head.appendChild(el);
  }
}

function ensureViewport() {
  const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (vp) {
    const current = vp.content;
    if (!current.includes('viewport-fit')) {
      vp.content = current + ', viewport-fit=cover';
    }
  } else {
    ensureMeta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
}

/**
 * Inject ALL PWA meta tags. Called once at module load (before React),
 * and again inside useEffect as a safety net.
 */
function injectPWATags() {
  // ── Page title ──
  document.title = 'Foxy Adventure — Screen Time That Builds School Readiness';

  // ── iOS Safari "Add to Home Screen" — MUST come BEFORE manifest link ──
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', 'Foxy Adventure');

  // ── SEO meta tags ──
  ensureMeta('description', "Malaysia's #1 KSSR readiness platform. Gamified RPG assessments in BM, EN & ZH that turn after-school screen time into real learning — ages 4 to 12.");

  // Android Chrome "Add to Home Screen"
  ensureMeta('mobile-web-app-capable', 'yes');

  // Theme color
  ensureMeta('theme-color', '#000000');

  // Apple touch icon (PNG — iOS rejects SVG)
  ensureLink('apple-touch-icon', foxyFavicon, { sizes: '192x192' });

  // Viewport with notch support
  ensureViewport();

  // Web App Manifest — AFTER all Apple meta tags
  ensureLink('manifest', '/manifest.json');

  // Browser favicon
  ensureLink('icon', foxyFavicon, { type: 'image/png' });
}

/**
 * Register the Service Worker for PWA install support and offline caching.
 * Enabled now that the app is deployed to projectlumi.org.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Only register SW on production domain — Figma Make preview doesn't serve sw.js correctly
    const host = window.location.hostname;
    if (host !== 'projectlumi.org' && host !== 'www.projectlumi.org') {
      console.log('[PWA] Skipping SW registration (non-production host:', host, ')');
      return;
    }
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
  }
}

// ═══════════════════════════════════════════════════════════
// IMMEDIATE INJECTION — runs at module import time,
// BEFORE React mounts. This is the key fix for iOS Safari.
// ═══════════════════════════════════════════════════════════
injectPWATags();

export function PWAMetaTags() {
  // Safety-net: re-run after React mount in case DOM was replaced
  useEffect(() => {
    injectPWATags();
    registerServiceWorker();
  }, []);

  // This component renders nothing — it's purely side-effects
  return null;
}