/**
 * usePWA.ts — PWA install detection & prompt hook
 *
 * Detects:
 *  - Whether the app is already running in standalone mode (installed)
 *  - Whether the user is on iOS or Android
 *  - Captures the `beforeinstallprompt` event for Android Chrome install
 *  - Tracks user dismissal in localStorage
 *
 * Returns:
 *  - isInstalled: true if already in standalone mode
 *  - isIOS: true if iOS Safari
 *  - isAndroid: true if Android browser
 *  - canPrompt: true if Android `beforeinstallprompt` is available
 *  - promptInstall: triggers the native Android install dialog
 *  - isDismissed: user dismissed the banner
 *  - dismiss: dismisses the banner (persists for 14 days)
 *  - shouldShowBanner: convenience flag — not installed, not dismissed, on mobile
 */
import { useState, useEffect, useCallback, useRef } from 'react';

const DISMISS_KEY = 'foxy_pwa_banner_dismissed';
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getIsStandalone(): boolean {
  // iOS Safari
  if ('standalone' in window.navigator && (window.navigator as any).standalone === true) {
    return true;
  }
  // All other browsers (Chrome, Edge, Firefox, Samsung Internet)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // TWA (Trusted Web Activity) on Android
  if (document.referrer.startsWith('android-app://')) {
    return true;
  }
  return false;
}

function getIsIOS(): boolean {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function getIsAndroid(): boolean {
  return /Android/i.test(window.navigator.userAgent);
}

function getIsDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true); // default true to avoid flash
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    // Detect platform & install state
    setIsInstalled(getIsStandalone());
    setIsIOS(getIsIOS());
    setIsAndroid(getIsAndroid());
    setIsDismissed(getIsDismissed());

    // Listen for the Android install prompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault(); // Prevent the mini-infobar on mobile
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      deferredPrompt.current = null;
      setCanPrompt(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Also listen for display-mode changes (e.g. user installs while page is open)
    const mq = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mq.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mq.removeEventListener('change', handleChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt.current) return;
    try {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      deferredPrompt.current = null;
      setCanPrompt(false);
    } catch (err) {
      console.warn('[usePWA] Install prompt failed:', err);
    }
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }, []);

  // Should we show the banner?
  const isMobile = isIOS || isAndroid;
  const shouldShowBanner = !isInstalled && !isDismissed && isMobile;

  return {
    isInstalled,
    isIOS,
    isAndroid,
    canPrompt,
    promptInstall,
    isDismissed,
    dismiss,
    shouldShowBanner,
  };
}
