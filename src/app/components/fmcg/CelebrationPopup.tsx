/**
 * CelebrationPopup.tsx — Brand-themed reward celebration (Prompt 2, Part A)
 *
 * Full-screen celebration shown after a successful QR claim.
 * Features:
 * - Brand logo + colour theming
 * - Animated reward cards (gold, diamonds, items, bag slots)
 * - Confetti-like particles
 * - CTA to view bag / continue to realm
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Coins, Diamond, Package, Crown, Sparkles, ArrowRight, Gift, Timer,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface Reward {
  type: string;
  amount: number;
  label: string;
  emoji?: string;
  fallback?: boolean;
}

interface CelebrationPopupProps {
  brandName: string;
  brandColour: string;
  brandLogoUrl: string;
  campaignName: string;
  rewards: Reward[];
  onContinue: () => void;
}

const REWARD_ICONS: Record<string, React.ElementType> = {
  gold: Coins,
  diamonds: Diamond,
  bagSlot: Package,
  customItem: Crown,
  existingItem: Gift,
  premiumDays: Timer,
};

const REWARD_COLOURS: Record<string, string> = {
  gold: '#d97706',
  diamonds: '#8b5cf6',
  bagSlot: '#059669',
  customItem: '#ec4899',
  existingItem: '#2563eb',
  premiumDays: '#e8722a',
};

// Confetti particle
function Particle({ delay, brandColour }: { delay: number; brandColour: string }) {
  const colors = [brandColour, '#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const size = 6 + Math.random() * 8;
  const x = -20 + Math.random() * 140; // % from left
  const rotation = Math.random() * 360;

  return (
    <motion.div
      className="absolute rounded-sm"
      style={{
        width: size,
        height: size * 0.6,
        background: color,
        left: `${x}%`,
        top: -10,
        rotate: rotation,
      }}
      initial={{ y: -20, opacity: 1 }}
      animate={{
        y: [0, 400 + Math.random() * 300],
        x: [-30 + Math.random() * 60],
        rotate: rotation + 360 + Math.random() * 360,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: 2.5 + Math.random() * 1.5,
        delay: delay,
        ease: 'easeOut',
      }}
    />
  );
}

export function CelebrationPopup({
  brandName,
  brandColour,
  brandLogoUrl,
  campaignName,
  rewards,
  onContinue,
}: CelebrationPopupProps) {
  const [showRewards, setShowRewards] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const t1 = setTimeout(() => setShowRewards(true), 600);
    const t2 = setTimeout(() => setShowCta(true), 1200 + rewards.length * 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [rewards.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(180deg, ${brandColour}20 0%, #111827 70%)` }}>

      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 40 }).map((_, i) => (
          <Particle key={i} delay={i * 0.06} brandColour={brandColour} />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm mx-4 text-center">
        {/* Brand logo + "Congratulations" */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="mb-6"
        >
          {brandLogoUrl ? (
            <img src={brandLogoUrl} alt={brandName}
              className="h-14 mx-auto mb-3 object-contain drop-shadow-lg" />
          ) : (
            <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
              style={{ background: brandColour }}>
              {brandName.charAt(0)}
            </div>
          )}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Sparkles size={18} style={{ color: brandColour }} />
              <h1 className="text-2xl font-bold text-white">{t('celebrate.rewardUnlocked')}</h1>
              <Sparkles size={18} style={{ color: brandColour }} />
            </div>
            <p className="text-sm text-gray-300">
              {t('celebrate.thanksTo')} <span className="font-semibold" style={{ color: brandColour }}>{brandName}</span>{t('celebrate.youGot')}
            </p>
          </motion.div>
        </motion.div>

        {/* Reward cards */}
        <AnimatePresence>
          {showRewards && (
            <motion.div className="space-y-2 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {rewards.map((reward, i) => {
                const Icon = REWARD_ICONS[reward.type] || Gift;
                const color = REWARD_COLOURS[reward.type] || brandColour;

                return (
                  <motion.div
                    key={i}
                    initial={{ x: -40, opacity: 0, scale: 0.8 }}
                    animate={{ x: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 * i, type: 'spring', stiffness: 200, damping: 18 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm"
                    style={{
                      background: `${color}12`,
                      borderColor: `${color}30`,
                    }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ background: `${color}20` }}>
                      {reward.emoji ? (
                        <span className="text-xl">{reward.emoji}</span>
                      ) : (
                        <Icon size={20} style={{ color }} />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold text-white">{reward.label}</p>
                      {reward.fallback && (
                        <p className="text-[10px] text-gray-400">{t('celebrate.bonusConversion')}</p>
                      )}
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15 * i + 0.3, type: 'spring' }}
                    >
                      <Sparkles size={14} style={{ color }} />
                    </motion.div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <AnimatePresence>
          {showCta && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
            >
              <button
                onClick={onContinue}
                className="w-full px-6 py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-110 transition-all"
                style={{ background: brandColour }}
              >
                {t('celebrate.viewBag')} <ArrowRight size={16} />
              </button>
              <p className="text-[10px] text-gray-500 mt-3">
                {t('qr.poweredBy')} &times; {brandName}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}