/**
 * InstallBanner.tsx — RPG-styled PWA install prompt
 *
 * A subtle, elegant bottom-sheet banner that appears on mobile devices
 * when the app is not yet installed as a PWA.
 *
 * - Android: "Install" button that triggers `beforeinstallprompt`
 * - iOS: Text instruction to use Share → Add to Home Screen
 * - Dismissible (persists for 14 days via usePWA hook)
 * - Matches the dark-fantasy RPG aesthetic of the parent-facing UI
 */
import React, { useState, useEffect } from 'react';
import { X, Download, Share, Smartphone, Sparkles } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { useLanguage } from './LanguageContext';
import { motion, AnimatePresence } from 'motion/react';

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';
const CINZEL = "'Cinzel Decorative', serif";

export const InstallBanner: React.FC = () => {
  const { t } = useLanguage();
  const { shouldShowBanner, isIOS, canPrompt, promptInstall, dismiss } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  // Delay showing the banner by 3s so it doesn't feel intrusive on first load
  useEffect(() => {
    if (!shouldShowBanner) return;
    const timer = setTimeout(() => setIsVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [shouldShowBanner]);

  if (!shouldShowBanner || !isVisible) return null;

  const handleDismiss = () => {
    setIsVisible(false);
    // Small delay before persisting so the exit animation plays
    setTimeout(dismiss, 300);
  };

  const handleInstall = async () => {
    await promptInstall();
    handleDismiss();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[9998] px-3 pb-3 pointer-events-none"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div
            className="pointer-events-auto relative mx-auto max-w-lg rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(30,22,12,0.97) 0%, rgba(20,16,10,0.98) 100%)',
              border: `1.5px solid ${GOLD}40`,
              boxShadow: `0 -4px 30px rgba(0,0,0,0.5), 0 0 20px ${GOLD}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
              backdropFilter: 'blur(20px)',
            }}
          >
            {/* Subtle gold gradient accent at top */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, transparent, ${GOLD}80, ${GOLD}, ${GOLD}80, transparent)`,
              }}
            />

            {/* Corner accents */}
            {['top-1.5 left-1.5', 'top-1.5 right-1.5'].map((pos, idx) => (
              <div
                key={idx}
                className={`absolute ${pos} w-2.5 h-2.5 pointer-events-none`}
                style={{
                  borderTop: '1.5px solid rgba(212,164,74,0.3)',
                  borderLeft: pos.includes('left') ? '1.5px solid rgba(212,164,74,0.3)' : 'none',
                  borderRight: pos.includes('right') ? '1.5px solid rgba(212,164,74,0.3)' : 'none',
                  borderRadius: '2px',
                }}
              />
            ))}

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-20"
              style={{
                background: `${GOLD}12`,
                border: `1px solid ${GOLD}25`,
              }}
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" style={{ color: `${PARCHMENT}80` }} />
            </button>

            {/* Content */}
            <div className="px-5 py-4 pr-12">
              <div className="flex items-start gap-3.5">
                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    background: `radial-gradient(circle, ${GOLD}18 0%, transparent 70%)`,
                    border: `1.5px solid ${GOLD}30`,
                    boxShadow: `0 0 12px ${GOLD}15`,
                  }}
                >
                  {isIOS ? (
                    <Share className="w-5 h-5" style={{ color: GOLD }} />
                  ) : (
                    <Download className="w-5 h-5" style={{ color: GOLD }} />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4
                      className="text-sm font-bold tracking-wide"
                      style={{ fontFamily: CINZEL, color: GOLD_LIGHT }}
                    >
                      {t('pwa.title')}
                    </h4>
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: `${GOLD}90` }} />
                  </div>

                  {isIOS ? (
                    /* iOS instructions */
                    <div>
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: `${PARCHMENT}85` }}
                      >
                        {t('pwa.iosStep1')}{' '}
                        <span
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded"
                          style={{
                            background: `${GOLD}12`,
                            border: `1px solid ${GOLD}20`,
                            color: GOLD_LIGHT,
                          }}
                        >
                          <Share className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{t('pwa.share')}</span>
                        </span>{' '}
                        {t('pwa.iosStep2')}{' '}
                        <span
                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded"
                          style={{
                            background: `${GOLD}12`,
                            border: `1px solid ${GOLD}20`,
                            color: GOLD_LIGHT,
                          }}
                        >
                          <Smartphone className="w-3 h-3" />
                          <span className="text-[10px] font-bold">{t('pwa.addToHome')}</span>
                        </span>
                        {' '}{t('pwa.iosStep3')}
                      </p>
                    </div>
                  ) : (
                    /* Android install button */
                    <div className="flex items-center gap-3">
                      <p
                        className="text-[11px] leading-relaxed flex-1"
                        style={{ color: `${PARCHMENT}85` }}
                      >
                        {t('pwa.androidDesc')}
                      </p>
                      {canPrompt && (
                        <button
                          onClick={handleInstall}
                          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-[11px] tracking-wider uppercase transition-all hover:brightness-110 active:scale-95"
                          style={{
                            fontFamily: CINZEL,
                            background: `linear-gradient(135deg, ${GOLD} 0%, #f0d078 50%, ${GOLD} 100%)`,
                            color: '#2a1f0e',
                            border: `1.5px solid ${GOLD_LIGHT}`,
                            boxShadow: `0 2px 0 #a67c2e, 0 0 12px ${GOLD}25`,
                          }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {t('pwa.install')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
