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
 * NOTE: Service Worker registration is DISABLED while hosted on Figma Make.
 * Apple meta tags alone are sufficient for iOS standalone mode. SW will be
 * re-enabled once deployed to foxy.projectlumi.org.
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
  // ── iOS Safari "Add to Home Screen" — MUST come BEFORE manifest link ──
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', 'Foxy Adventure');

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

// ═══════════════════════════════════════════════════════════
// IMMEDIATE INJECTION — runs at module import time,
// BEFORE React mounts. This is the key fix for iOS Safari.
// ═══════════════════════════════════════════════════════════
injectPWATags();

export function PWAMetaTags() {
  // Safety-net: re-run after React mount in case DOM was replaced
  useEffect(() => {
    injectPWATags();
  }, []);

  // This component renders nothing — it's purely side-effects
  return null;
}