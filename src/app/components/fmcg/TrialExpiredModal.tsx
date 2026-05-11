/**
 * TrialExpiredModal.tsx — Graceful downgrade interstitial (Prompt 2)
 *
 * Shown ONCE when the parent's FMCG premium trial has expired and they
 * don't have an active Stripe subscription. Brand-attributed, trilingual,
 * with a warm upgrade CTA. Dismissal stored in localStorage so it only
 * appears once per expiry cycle.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Lock, X, Sparkles, Shield, Clock, ChevronRight, Star } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

interface TrialExpiredModalProps {
  brandNames: string[];
  expiredAt: string;
  onUpgrade: () => void;
  onDismiss: () => void;
}

const F = "'Cherry Bomb One', cursive";

const LOST_FEATURES = {
  en: [
    { icon: Star, text: 'Unlimited daily quests' },
    { icon: Shield, text: 'Full video library' },
    { icon: Sparkles, text: 'Detailed skill analytics' },
    { icon: Crown, text: 'All practice modes' },
  ],
  ms: [
    { icon: Star, text: 'Misi harian tanpa had' },
    { icon: Shield, text: 'Perpustakaan video penuh' },
    { icon: Sparkles, text: 'Analisis kemahiran terperinci' },
    { icon: Crown, text: 'Semua mod latihan' },
  ],
  zh: [
    { icon: Star, text: '无限每日任务' },
    { icon: Shield, text: '完整视频库' },
    { icon: Sparkles, text: '详细技能分析' },
    { icon: Crown, text: '所有练习模式' },
  ],
};

const COPY = {
  en: {
    title: 'Your Free Trial Has Ended',
    subtitle: (brands: string) =>
      brands
        ? `Thank you to ${brands} for sponsoring your premium access! Your trial period has now ended.`
        : 'Your complimentary premium trial has ended.',
    losingAccess: "You're now on the free plan. Here's what you'll miss:",
    upgradeBtn: 'Continue with Premium',
    upgradePrice: 'Only RM1/day',
    dismissBtn: 'Stay on Free Plan',
    footer: "Your child's progress is safe — upgrade anytime to resume.",
  },
  ms: {
    title: 'Percubaan Percuma Anda Telah Tamat',
    subtitle: (brands: string) =>
      brands
        ? `Terima kasih kepada ${brands} kerana menaja akses premium anda! Tempoh percubaan anda telah tamat.`
        : 'Percubaan premium percuma anda telah tamat.',
    losingAccess: 'Anda kini menggunakan pelan percuma. Berikut yang anda akan terlepas:',
    upgradeBtn: 'Teruskan dengan Premium',
    upgradePrice: 'Hanya RM1/hari',
    dismissBtn: 'Kekal Pelan Percuma',
    footer: 'Kemajuan anak anda selamat — naik taraf bila-bila masa.',
  },
  zh: {
    title: '您的免费试用已结束',
    subtitle: (brands: string) =>
      brands
        ? `感谢 ${brands} 赞助您的高级访问！您的试用期已结束。`
        : '您的免费高级试用已结束。',
    losingAccess: '您现在使用免费计划。以下是您将错过的：',
    upgradeBtn: '继续使用高级版',
    upgradePrice: '每天仅RM1',
    dismissBtn: '留在免费计划',
    footer: '您孩子的进度是安全的 — 随时升级即可恢复。',
  },
};

export function TrialExpiredModal({ brandNames, expiredAt, onUpgrade, onDismiss }: TrialExpiredModalProps) {
  const { language } = useLanguage();
  const lang = (language === 'ms' ? 'ms' : language === 'zh' ? 'zh' : 'en') as keyof typeof COPY;
  const copy = COPY[lang];
  const features = LOST_FEATURES[lang];
  const brandLabel = brandNames.length > 0 ? brandNames.join(' + ') : '';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[350] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(5,4,2,0.88)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={onDismiss}
        />

        {/* Modal card */}
        <motion.div
          className="relative w-[380px] max-w-[92vw] rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #1e1520 0%, #0d0a10 100%)',
            border: '1.5px solid rgba(212,164,74,0.25)',
            boxShadow: '0 0 60px rgba(212,164,74,0.08), 0 12px 48px rgba(0,0,0,0.6)',
          }}
          initial={{ scale: 0.85, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.85, y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-white/5 transition-colors"
          >
            <X size={16} style={{ color: 'rgba(255,255,255,0.35)' }} />
          </button>

          {/* Top gradient accent */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background: 'linear-gradient(90deg, rgba(212,164,74,0.6), rgba(168,85,247,0.4), rgba(212,164,74,0.6))',
            }}
          />

          {/* Content */}
          <div className="px-6 pt-7 pb-6">
            {/* Icon */}
            <motion.div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(212,164,74,0.15), rgba(168,85,247,0.1))',
                border: '2px solid rgba(212,164,74,0.2)',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.15 }}
            >
              <Clock size={30} style={{ color: '#d4a44a' }} />
            </motion.div>

            {/* Title */}
            <h2
              className="text-center mb-2"
              style={{
                fontFamily: F,
                fontSize: 20,
                color: '#ffeaa7',
                textShadow: '0 2px 8px rgba(212,164,74,0.2)',
              }}
            >
              {copy.title}
            </h2>

            {/* Subtitle with brand attribution */}
            <p
              className="text-center text-[13px] leading-relaxed mb-5"
              style={{ color: 'rgba(200,184,138,0.65)' }}
            >
              {copy.subtitle(brandLabel)}
            </p>

            {/* What you're losing */}
            <div
              className="rounded-xl p-4 mb-5"
              style={{
                background: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.12)',
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wider mb-3"
                style={{ color: 'rgba(239,68,68,0.6)' }}
              >
                <Lock size={11} className="inline mr-1 -mt-0.5" />
                {copy.losingAccess}
              </p>
              <div className="space-y-2">
                {features.map((feat, i) => {
                  const Icon = feat.icon;
                  return (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2.5"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.08 }}
                    >
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(212,164,74,0.1)',
                          border: '1px solid rgba(212,164,74,0.15)',
                        }}
                      >
                        <Icon size={12} style={{ color: '#d4a44a' }} />
                      </div>
                      <span
                        className="text-[12px] line-through"
                        style={{ color: 'rgba(200,184,138,0.4)' }}
                      >
                        {feat.text}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-2.5">
              {/* Upgrade — golden */}
              <motion.button
                className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #b8860b, #d4a44a)',
                  color: '#1a0e05',
                  boxShadow: '0 4px 20px rgba(212,164,74,0.3)',
                  fontFamily: F,
                  fontSize: 15,
                }}
                whileTap={{ scale: 0.97 }}
                onClick={onUpgrade}
              >
                <Crown size={18} />
                {copy.upgradeBtn}
                <ChevronRight size={16} />
              </motion.button>

              {/* Price tag */}
              <p
                className="text-center text-[11px]"
                style={{ color: 'rgba(212,164,74,0.5)' }}
              >
                {copy.upgradePrice} &bull; RM365/year
              </p>

              {/* Dismiss */}
              <button
                className="w-full py-2.5 rounded-xl text-[13px] transition-colors hover:bg-white/3"
                style={{
                  color: 'rgba(200,184,138,0.4)',
                  border: '1px solid rgba(200,184,138,0.08)',
                }}
                onClick={onDismiss}
              >
                {copy.dismissBtn}
              </button>
            </div>

            {/* Reassurance footer */}
            <p
              className="text-center text-[10px] mt-4"
              style={{ color: 'rgba(200,184,138,0.25)' }}
            >
              {copy.footer}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * useTrialExpiredCheck — Hook that detects if FMCG trial has expired and
 * returns modal state. Only shows once per expiry cycle (uses localStorage).
 */
export function useTrialExpiredCheck(parentData: any): {
  showModal: boolean;
  brandNames: string[];
  expiredAt: string;
  dismiss: () => void;
} {
  const [showModal, setShowModal] = useState(false);
  const [brandNames, setBrandNames] = useState<string[]>([]);
  const [expiredAt, setExpiredAt] = useState('');

  useEffect(() => {
    if (!parentData) return;

    const subStatus = parentData.subscription_status;
    const premiumExpiry = parentData.premium_expires_at;
    const premiumSource = parentData.premium_source;

    // Only trigger for FMCG trial users whose trial has expired
    // Don't show if they have an active Stripe subscription
    if (premiumSource !== 'fmcg_trial') return;
    if (subStatus === 'active') {
      // Still active (might be within expiry window or Stripe active)
      if (premiumExpiry && new Date(premiumExpiry) > new Date()) return;
    }
    if (!premiumExpiry) return;

    const expiryDate = new Date(premiumExpiry);
    if (expiryDate > new Date()) return; // Not expired yet

    // Check if we already showed this modal for this expiry
    const dismissKey = `fmcg_trial_expired_dismissed:${premiumExpiry}`;
    try {
      if (localStorage.getItem(dismissKey)) return;
    } catch (_) {}

    // Extract brand names from premium_grants
    const grants = parentData.premium_grants || [];
    const brands = [...new Set(grants.map((g: any) => g.brandName).filter(Boolean))] as string[];

    setBrandNames(brands);
    setExpiredAt(premiumExpiry);
    setShowModal(true);
  }, [parentData]);

  const dismiss = () => {
    setShowModal(false);
    if (expiredAt) {
      try {
        localStorage.setItem(`fmcg_trial_expired_dismissed:${expiredAt}`, 'true');
      } catch (_) {}
    }
  };

  return { showModal, brandNames, expiredAt, dismiss };
}
