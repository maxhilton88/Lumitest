/**
 * RealmShell.tsx — Persistent layout for all /realm/* routes.
 *
 * Provides:
 * - RealmContext (shared stats, wallet, R2 assets, music)
 * - Dark fantasy background + ambient particles (consistent atmosphere)
 * - Loading screen on first entry
 * - Back-to-hub button on sub-pages (bag, flashcards, etc.)
 * - Smooth crossfade transition on route changes via AnimatePresence
 * - Cherry Bomb One + Cinzel Decorative fonts
 * - Music continuity (no restart between pages — powered by music-service.ts singleton)
 */
import React from 'react';
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { RealmProvider, useRealmContext } from '../../contexts/RealmContext';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../LanguageContext';
import { EvolutionCeremony } from './EvolutionCeremony';
import { RewardToastOverlay } from './RewardToastOverlay';
import { LevelUpCelebration } from './LevelUpCelebration';

const F = "'Cherry Bomb One', cursive";

/** Inner shell that can consume RealmContext */
function RealmShellInner() {
  const { assets, isLoading, isLandscape, pendingEvolution, clearPendingEvolution } = useRealmContext();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine if we're on the hub (index) vs a sub-page
  const isHub = location.pathname === '/realm' || location.pathname === '/realm/';
  // Pages that manage their own chrome (back button, background) — don't show shell's back button
  const selfChromedPages = ['/realm/bag', '/realm/practice', '/realm/test', '/realm/battle', '/realm/mastery', '/realm/quest'];
  const hasSelfChrome = selfChromedPages.some(p => location.pathname.startsWith(p));

  return (
    <div
      className="relative w-full h-dvh overflow-hidden select-none"
      style={{
        margin: '0 auto',
        background: '#0a0a12',
      }}
    >
      {/* ── Loading Screen ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="realm-loader"
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0a0a12 0%, #1a1610 50%, #0a0a12 100%)' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <div className="relative w-20 h-20 mb-5">
              <div
                className="absolute inset-0 rounded-full"
                style={{ border: '2.5px solid rgba(212,164,74,0.12)' }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '3px solid transparent',
                  borderTopColor: '#ffd700',
                  borderRightColor: '#b8860b',
                  animation: 'realmSpin 0.8s linear infinite',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: 28, animation: 'realmPulse 1.5s ease-in-out infinite' }}>
                  {/* Fox icon placeholder */}
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ffd700" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" opacity="0.2" fill="#ffd700" />
                    <circle cx="9" cy="11" r="1" fill="#0a0a12" />
                    <circle cx="15" cy="11" r="1" fill="#0a0a12" />
                    <path d="M9 16c1 1 5 1 6 0" stroke="#0a0a12" strokeWidth="1" />
                  </svg>
                </span>
              </div>
            </div>
            <p
              style={{
                fontFamily: F,
                fontSize: 14,
                color: '#ffd700',
                textShadow: '0 0 16px rgba(255,215,0,0.3)',
                letterSpacing: '0.08em',
              }}
            >
              {t('realm.loading')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shared Background (persistent across all realm pages) ── */}
      {assets.realmBg && (
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <img
            src={assets.realmBg}
            alt="Realm"
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.92) saturate(1.2) contrast(1.05)' }}
          />
          {/* Top darkening for HUD readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(8,6,3,0.55) 0%, rgba(8,6,3,0.15) 22%, transparent 40%, transparent 65%, rgba(8,6,3,0.3) 100%)',
            }}
          />
          {/* Vignette */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(8,6,3,0.35) 100%)',
            }}
          />
        </motion.div>
      )}

      {/* Dark base when no background loaded */}
      {!assets.realmBg && !isLoading && (
        <div
          className="absolute inset-0 z-0"
          style={{ background: 'linear-gradient(135deg, #0a0a12 0%, #1a1610 50%, #0a0a12 100%)' }}
        />
      )}

      {/* ── Ambient floating particles ── */}
      {!isLoading && (
        <div className="absolute inset-0 pointer-events-none z-[1] overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <div
              key={`amb-${i}`}
              className="absolute rounded-full"
              style={{
                width: 2 + Math.random() * 3,
                height: 2 + Math.random() * 3,
                background:
                  i % 3 === 0
                    ? 'rgba(255,215,0,0.5)'
                    : i % 3 === 1
                      ? 'rgba(168,85,247,0.4)'
                      : 'rgba(200,220,255,0.35)',
                left: `${5 + Math.random() * 90}%`,
                bottom: `${5 + Math.random() * 50}%`,
                animation: `ambFloat ${5 + Math.random() * 6}s ease-in-out infinite ${Math.random() * 4}s`,
                filter: `blur(${Math.random() > 0.5 ? 1 : 0}px)`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── Back-to-Hub button (only on sub-pages, not the hub itself) ── */}
      {!isLoading && !isHub && !hasSelfChrome && (
        <motion.button
          onClick={() => navigate('/realm')}
          className="absolute z-50 flex items-center gap-1.5 px-3 py-2 rounded-full"
          style={{
            top: isLandscape ? 70 : 16,
            left: 12,
            background: 'linear-gradient(135deg, rgba(20,16,10,0.92), rgba(30,24,14,0.96))',
            border: '1.5px solid rgba(255,215,0,0.3)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5), 0 0 8px rgba(255,215,0,0.1)',
          }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
        >
          <ArrowLeft className="w-4 h-4" style={{ color: '#d4a44a' }} />
          <span
            style={{
              fontFamily: F,
              fontSize: 11,
              color: '#d4a44a',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {t('realm.backToRealm')}
          </span>
        </motion.button>
      )}

      {/* ── Page content with crossfade transition ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className="absolute inset-0 z-[2]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>

      {/* ── Evolution Ceremony Modal (Bible v5: baby→young→warrior) ── */}
      {pendingEvolution && (
        <EvolutionCeremony
          newStage={pendingEvolution}
          isOpen={!!pendingEvolution}
          onClose={clearPendingEvolution}
        />
      )}

      {/* ── Reward Toast Overlay ("+X Gold", "+X XP" popups) ── */}
      <RewardToastOverlay />

      {/* ── Level-Up Celebration (full-screen splash) ── */}
      <LevelUpCelebration />

      {/* ── Fonts ── */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cherry+Bomb+One&family=Cinzel+Decorative:wght@400;700;900&display=swap"
        rel="stylesheet"
      />

      {/* ── Shared keyframes ── */}
      <style>{`
        @keyframes realmSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes realmPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }
        @keyframes ambFloat {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 0.8; }
          85% { opacity: 0.5; }
          100% { transform: translateY(-180px) translateX(25px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/** Top-level shell wraps everything in RealmProvider */
export function RealmShell() {
  // Auth guard — redirect unauthenticated users to login
  const { isParentAuthenticated } = useAppContext();
  if (!isParentAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <RealmProvider>
      <RealmShellInner />
    </RealmProvider>
  );
}