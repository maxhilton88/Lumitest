/**
 * EvolutionCeremony.tsx — Full-screen evolution celebration modal
 *
 * Shown when Foxy evolves to a new stage (baby → young → warrior).
 * Features particle burst, golden glow, stage name reveal, and reward summary.
 */
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Crown, Star } from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { getStageEmoji, getStageName, getEvolutionDef, getEvolutionRewardItemId, type EvolutionStage } from '../../utils/evolution';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';

interface EvolutionCeremonyProps {
  newStage: EvolutionStage;
  isOpen: boolean;
  onClose: () => void;
}

export function EvolutionCeremony({ newStage, isOpen, onClose }: EvolutionCeremonyProps) {
  const { language } = useLanguage();
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowReward(false);
      const timer = setTimeout(() => setShowReward(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const def = getEvolutionDef(newStage);
  const emoji = getStageEmoji(newStage);
  const name = getStageName(newStage, language);
  const rewardDesc = def?.reward.description[language as 'en' | 'ms' | 'zh'] || def?.reward.description.en || '';
  const rewardItemId = getEvolutionRewardItemId(newStage);

  const title = language === 'zh' ? '进化！' : language === 'ms' ? 'Evolusi!' : 'Evolution!';
  const subtitle = language === 'zh'
    ? `Foxy进化成了${name}！`
    : language === 'ms'
    ? `Foxy telah berevolusi menjadi ${name}!`
    : `Foxy evolved into ${name}!`;
  const continueText = language === 'zh' ? '继续冒险' : language === 'ms' ? 'Teruskan Pengembaraan' : 'Continue Adventure';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[500] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop with golden radial glow */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, rgba(212,164,74,0.15) 0%, rgba(5,4,2,0.95) 70%)',
            backdropFilter: 'blur(8px)',
          }} />

          {/* Particle burst */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: 4 + Math.random() * 6,
                height: 4 + Math.random() * 6,
                background: i % 3 === 0 ? GOLD : i % 3 === 1 ? '#ffd700' : '#fff',
                left: '50%',
                top: '40%',
              }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 300,
                opacity: 0,
                scale: 0,
              }}
              transition={{ duration: 1.5 + Math.random(), delay: 0.2 + Math.random() * 0.5 }}
            />
          ))}

          {/* Main card */}
          <motion.div
            className="relative w-[320px] max-w-[90vw] rounded-2xl overflow-hidden p-6 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(30,20,45,0.98) 0%, rgba(15,10,25,0.99) 100%)',
              border: '2px solid rgba(212,164,74,0.4)',
              boxShadow: '0 0 60px rgba(212,164,74,0.2), 0 0 120px rgba(212,164,74,0.1), 0 8px 32px rgba(0,0,0,0.5)',
            }}
            initial={{ scale: 0.5, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.2 }}
          >
            {/* Sparkle icons */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <Sparkles size={16} style={{ color: GOLD }} />
              <span style={{ fontFamily: CINZEL, fontSize: 11, color: GOLD, letterSpacing: 2 }}>{title}</span>
              <Sparkles size={16} style={{ color: GOLD }} />
            </div>

            {/* Stage emoji — big + pulsing */}
            <motion.div
              className="text-6xl mb-3"
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {emoji}
            </motion.div>

            {/* Stage name */}
            <motion.h2
              style={{ fontFamily: F, fontSize: 24, color: GOLD_LIGHT, marginBottom: 4 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {name}
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              style={{ fontFamily: F, fontSize: 13, color: 'rgba(200,184,138,0.8)', marginBottom: 16 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {subtitle}
            </motion.p>

            {/* Reward box */}
            <AnimatePresence>
              {showReward && def && (
                <motion.div
                  className="rounded-xl p-3 mb-4"
                  style={{
                    background: 'rgba(212,164,74,0.08)',
                    border: '1px solid rgba(212,164,74,0.2)',
                  }}
                  initial={{ opacity: 0, y: 10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  transition={{ type: 'spring', damping: 20 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Crown size={14} style={{ color: '#ffd700' }} />
                    <span style={{ fontFamily: CINZEL, fontSize: 10, color: GOLD, letterSpacing: 1 }}>
                      {language === 'zh' ? '进化奖励' : language === 'ms' ? 'Ganjaran Evolusi' : 'Evolution Reward'}
                    </span>
                  </div>
                  <p style={{ fontFamily: F, fontSize: 12, color: GOLD_LIGHT }}>{rewardDesc}</p>
                  {rewardItemId && (
                    <div className="flex items-center justify-center gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid rgba(212,164,74,0.15)' }}>
                      <span style={{ fontSize: 14 }}>{newStage === 'warrior' ? '\u2694\uFE0F' : '\u{1F5E1}\uFE0F'}</span>
                      <span style={{ fontFamily: F, fontSize: 11, color: newStage === 'warrior' ? '#c084fc' : '#60a5fa' }}>
                        {language === 'zh' ? '进化奖励装备已加入背包！'
                          : language === 'ms' ? 'Item evolusi ditambah ke beg!'
                          : 'Evolution gear added to bag!'}
                      </span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Continue button */}
            <motion.button
              onClick={onClose}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, #c4943a)`,
                color: '#1a0e2e',
                boxShadow: '0 2px 16px rgba(212,164,74,0.4)',
                fontFamily: F,
              }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.8 }}
            >
              <Star size={16} />
              {continueText}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}