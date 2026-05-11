/**
 * EarnMorePopup.tsx — "How to Earn More" popup for Gold/Diamond taps
 *
 * Kid-voice referral: "Hey this game is super cool! Sign up and let's battle together!"
 * Shows ways to earn: daily quests, battles, referral sharing.
 * Dark-fantasy RPG aesthetic matching the realm.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Swords, ScrollText, Heart, Copy, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useLanguage } from '../LanguageContext';
import { copyToClipboard } from '../../utils/clipboard';
import { fetchReferralInfo } from '../../utils/parent-api';

const F = "'Cherry Bomb One', cursive";

interface EarnMorePopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'gold' | 'diamond';
}

export function EarnMorePopup({ isOpen, onClose, type }: EarnMorePopupProps) {
  const { t } = useLanguage();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const isGold = type === 'gold';
  const accentColor = isGold ? '#ffd700' : '#a855f7';
  const glowColor = isGold ? 'rgba(255,215,0,0.3)' : 'rgba(168,85,247,0.3)';

  const loadReferral = async () => {
    if (referralCode) return;
    setLoading(true);
    try {
      const info = await fetchReferralInfo();
      setReferralCode(info.referralCode || info.code || null);
    } catch (err) {
      console.error('[EARN_MORE] Failed to load referral code:', err);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = referralCode
    ? `https://app.projectlumi.org/login?ref=${referralCode}`
    : null;

  const kidShareText = t('realm.referralShareText');

  const handleCopy = async () => {
    if (!referralLink) return;
    const ok = await copyToClipboard(referralLink);
    if (ok) {
      setCopied(true);
      toast.success(t('realm.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (!referralLink) return;
    const text = `${kidShareText}\n\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const earnMethods = isGold
    ? [
        { icon: <ScrollText size={18} />, label: t('realm.earnDaily'), desc: t('realm.earnDailyDesc'), color: '#ffd700' },
        { icon: <Swords size={18} />, label: t('realm.earnBattle'), desc: t('realm.earnBattleDesc'), color: '#ef4444' },
        { icon: <Heart size={18} />, label: t('realm.earnReferral'), desc: t('realm.earnReferralDesc'), color: '#f472b6' },
      ]
    : [
        { icon: <Swords size={18} />, label: t('realm.earnBattleDiamond'), desc: t('realm.earnBattleDiamondDesc'), color: '#a855f7' },
        { icon: <Heart size={18} />, label: t('realm.earnReferral'), desc: t('realm.earnReferralDesc'), color: '#f472b6' },
      ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'rgba(5,4,2,0.7)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10"
            style={{
              width: 300,
              maxHeight: '80vh',
              overflowY: 'auto',
              background: 'linear-gradient(145deg, rgba(28,22,12,0.96) 0%, rgba(15,12,6,0.98) 100%)',
              border: `2px solid ${glowColor}`,
              borderRadius: 20,
              padding: '20px 16px 16px',
              boxShadow: `0 12px 48px rgba(0,0,0,0.7), 0 0 24px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            initial={{ scale: 0.7, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: -10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span
                style={{
                  fontFamily: F,
                  fontSize: 15,
                  color: accentColor,
                  textShadow: `0 2px 6px rgba(0,0,0,0.8), 0 0 12px ${glowColor}`,
                }}
              >
                {isGold ? t('realm.earnMoreGold') : t('realm.earnMoreDiamond')}
              </span>
              <motion.button
                onClick={onClose}
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
                whileTap={{ scale: 0.85 }}
              >
                <X size={14} color="rgba(200,184,138,0.7)" />
              </motion.button>
            </div>

            {/* Divider */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: `linear-gradient(90deg, transparent, ${accentColor}40, transparent)`,
              }}
            />

            {/* Earn methods */}
            <div className="flex flex-col gap-2 mb-4">
              {earnMethods.map((method, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${method.color}20`,
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: `${method.color}15`,
                      border: `1px solid ${method.color}30`,
                    }}
                  >
                    <span style={{ color: method.color }}>{method.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontFamily: F,
                        fontSize: 12,
                        color: method.color,
                        textShadow: `0 1px 3px rgba(0,0,0,0.6)`,
                        lineHeight: 1.2,
                      }}
                    >
                      {method.label}
                    </div>
                    <div
                      style={{
                        fontFamily: F,
                        fontSize: 10,
                        color: 'rgba(200,184,138,0.6)',
                        lineHeight: 1.3,
                        marginTop: 2,
                      }}
                    >
                      {method.desc}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Divider */}
            <div
              className="mb-3"
              style={{
                height: 1,
                background: `linear-gradient(90deg, transparent, rgba(244,114,182,0.25), transparent)`,
              }}
            />

            {/* Kid-voice referral section */}
            <div className="px-1">
              <div
                className="p-3 rounded-xl mb-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(244,114,182,0.08), rgba(168,85,247,0.06))',
                  border: '1px solid rgba(244,114,182,0.2)',
                }}
              >
                <span
                  style={{
                    fontFamily: F,
                    fontSize: 11,
                    color: '#f9a8d4',
                    lineHeight: 1.4,
                    display: 'block',
                  }}
                >
                  {kidShareText}
                </span>
              </div>

              {/* Share buttons */}
              {referralLink ? (
                <div className="flex gap-2">
                  <motion.button
                    onClick={handleWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(37,211,102,0.15), rgba(37,211,102,0.08))',
                      border: '1.5px solid rgba(37,211,102,0.3)',
                      fontFamily: F,
                      fontSize: 11,
                      color: '#25D366',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </motion.button>
                  <motion.button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.05))',
                      border: '1.5px solid rgba(255,215,0,0.25)',
                      fontFamily: F,
                      fontSize: 11,
                      color: '#ffd700',
                    }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t('realm.copied') : t('realm.copyLink')}
                  </motion.button>
                </div>
              ) : (
                <motion.button
                  onClick={loadReferral}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(244,114,182,0.12), rgba(168,85,247,0.08))',
                    border: '1.5px solid rgba(244,114,182,0.3)',
                    fontFamily: F,
                    fontSize: 12,
                    color: '#f472b6',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Heart size={14} />
                  {loading ? t('realm.loading') : t('realm.inviteFriend')}
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
