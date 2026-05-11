/**
 * AccessGate — Shared hook + modal for free/premium daily access limits.
 *
 * useAccessGate(activityType) returns:
 *   - canAccess: boolean (true if under limit)
 *   - checking: boolean (loading state)
 *   - remaining: number (-1 if unlimited)
 *   - maxPerDay: number (-1 if unlimited)
 *   - isPaid: boolean
 *   - recheck: () => void
 *
 * AccessBlockedModal — Dark-fantasy styled upgrade prompt.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Lock, X, Sparkles, Shield, Heart, Copy, Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useRealmContext } from '../../contexts/RealmContext';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../LanguageContext';
import { fetchDailyLog, fetchRewardConfig } from '../../utils/api';
import { toast } from 'sonner@2.0.3';

const F = "'Cherry Bomb One', cursive";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const RED = '#e74c3c';

type ActivityType = 'test' | 'practice' | 'flashcard' | 'video' | 'music' | 'battle';

interface AccessGateResult {
  canAccess: boolean;
  checking: boolean;
  remaining: number; // -1 = unlimited
  maxPerDay: number; // -1 = unlimited
  isPaid: boolean;
  recheck: () => void;
}

export function useAccessGate(activityType: ActivityType): AccessGateResult {
  const { userId } = useRealmContext();
  const { parentData } = useAppContext();
  // CRITICAL: Default canAccess to FALSE (fail-closed) while the async check is in flight.
  // Previously defaulted to TRUE, which allowed a free user to bypass the gate by
  // navigating away and back — the flashcards were interactive during the brief fetch window.
  const [canAccess, setCanAccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [remaining, setRemaining] = useState(-1);
  const [maxPerDay, setMaxPerDay] = useState(-1);

  const subStatus = parentData?.subscription_status || 'free';
  const premiumExpiresAt = parentData?.premium_expires_at;
  const hasFmcgTrial = premiumExpiresAt && new Date(premiumExpiresAt) > new Date();
  const isPaid = subStatus === 'active' || subStatus === 'founder' || !!hasFmcgTrial;

  const check = useCallback(async () => {
    if (!userId) { setChecking(false); return; }
    try {
      const [logResult, configResult] = await Promise.all([
        fetchDailyLog(userId),
        fetchRewardConfig(),
      ]);
      const log = logResult.log || {};
      const config = configResult.config || configResult;
      const activityConfig = config?.activities?.[activityType];
      if (!activityConfig) { setChecking(false); return; }

      const limit = isPaid
        ? (activityConfig.premiumMaxPerDay ?? -1)
        : (activityConfig.freeMaxPerDay ?? -1);
      const currentCount = log[activityType]?.count || 0;

      setMaxPerDay(limit);
      if (limit === -1) {
        setCanAccess(true);
        setRemaining(-1);
      } else {
        const rem = Math.max(0, limit - currentCount);
        setRemaining(rem);
        setCanAccess(rem > 0);
      }
    } catch (err) {
      console.error('[ACCESS GATE] Check failed:', err);
      // Fail open — don't block on error
      setCanAccess(true);
    } finally {
      setChecking(false);
    }
  }, [userId, activityType, isPaid]);

  useEffect(() => { check(); }, [check]);

  return { canAccess, checking, remaining, maxPerDay, isPaid, recheck: check };
}

// ── Activity labels for the modal ──
const ACTIVITY_LABELS: Record<string, Record<ActivityType, string>> = {
  en: { test: 'Realm Tests', practice: 'Training Sessions', flashcard: 'Flashcard Sessions', video: 'Video Episodes', music: 'Music Tracks', battle: 'Battles' },
  ms: { test: 'Ujian Realm', practice: 'Sesi Latihan', flashcard: 'Sesi Kad Imbas', video: 'Video Episod', music: 'Muzik', battle: 'Pertempuran' },
  zh: { test: '领域测试', practice: '训练课程', flashcard: '闪卡课程', video: '视频集数', music: '音乐', battle: '战斗' },
};

interface AccessBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityType: ActivityType;
  maxPerDay: number;
  isPaid: boolean;
  onUpgrade?: () => void;
}

export function AccessBlockedModal({ isOpen, onClose, activityType, maxPerDay, isPaid, onUpgrade }: AccessBlockedModalProps) {
  const { language } = useLanguage();
  const { parentData } = useAppContext();
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);
  const lang = language === 'ms' ? 'ms' : language === 'zh' ? 'zh' : 'en';
  const activityLabel = ACTIVITY_LABELS[lang]?.[activityType] || activityType;

  const referralCode = parentData?.referral_code || '';
  const referralCount = parentData?.referral_count || 0;
  const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';
  const REFERRAL_GOAL = 10;
  const referralProgress = Math.min(referralCount, REFERRAL_GOAL);

  const handleCopyReferral = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    toast.success(lang === 'zh' ? '链接已复制！' : lang === 'ms' ? 'Pautan disalin!' : 'Link copied!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const shareText = lang === 'zh'
      ? `嘿！这个游戏超酷的——我的狐狸已经在冒险了！快来注册，我们一起战斗吧！🦊⚔️ ${referralLink}`
      : lang === 'ms'
      ? `Hey! Game ni best gila — fox aku dah mula adventure! Daftar la, kita battle sama-sama! 🦊⚔️ ${referralLink}`
      : `Hey! This game is super cool — my fox is already on an adventure! Sign up and let's battle together! 🦊⚔️ ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const title = lang === 'zh' ? '每日限制已达' : lang === 'ms' ? 'Had Harian Dicapai' : 'Daily Limit Reached';
  const subtitle = isPaid
    ? (lang === 'zh' ? `你今天已完成 ${maxPerDay} 次${activityLabel}。明天再来吧！`
      : lang === 'ms' ? `Anda telah melengkapkan ${maxPerDay} ${activityLabel} hari ini. Cuba lagi esok!`
      : `You've completed ${maxPerDay} ${activityLabel} today. Come back tomorrow!`)
    : (lang === 'zh' ? `免费用户每天限 ${maxPerDay} 次${activityLabel}。升级解锁无限次数！`
      : lang === 'ms' ? `Pengguna percuma terhad kepada ${maxPerDay} ${activityLabel} sehari. Naik taraf untuk akses tanpa had!`
      : `Free users are limited to ${maxPerDay} ${activityLabel} per day. Upgrade for unlimited access!`);
  const upgradeText = lang === 'zh' ? '升级到高级版' : lang === 'ms' ? 'Naik Taraf Premium' : 'Upgrade to Premium';
  const closeText = lang === 'zh' ? '好的' : lang === 'ms' ? 'OK' : 'Got it';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(5,4,2,0.8)', backdropFilter: 'blur(6px)' }} />
          <motion.div
            className="relative w-[340px] max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-2xl overflow-x-hidden p-6 text-center"
            style={{
              background: 'linear-gradient(180deg, rgba(30,20,45,0.98) 0%, rgba(15,10,25,0.99) 100%)',
              border: `1.5px solid ${isPaid ? 'rgba(147,130,220,0.3)' : 'rgba(212,164,74,0.3)'}`,
              boxShadow: `0 0 40px ${isPaid ? 'rgba(147,130,220,0.1)' : 'rgba(212,164,74,0.1)'}, 0 8px 32px rgba(0,0,0,0.5)`,
            }}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/5 transition-colors">
              <X size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>

            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: isPaid ? 'rgba(147,130,220,0.15)' : 'rgba(212,164,74,0.15)' }}>
              {isPaid ? <Shield size={28} style={{ color: '#9382dc' }} /> : <Lock size={28} style={{ color: GOLD }} />}
            </div>

            <h3 style={{ fontFamily: F, fontSize: 18, color: GOLD_LIGHT }} className="mb-2">{title}</h3>
            <p className="text-[13px] mb-5 leading-relaxed" style={{ color: 'rgba(200,184,138,0.7)' }}>{subtitle}</p>

            {/* Premium preview comparison — only for free users */}
            {!isPaid && (
              <div className="mb-4 rounded-xl p-3 text-left" style={{ background: 'rgba(212,164,74,0.06)', border: '1px solid rgba(212,164,74,0.12)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: `${GOLD}90` }}>
                  {lang === 'zh' ? '高级版解锁' : lang === 'ms' ? 'Premium Membuka' : 'Premium Unlocks'}
                </p>
                {[
                  { free: lang === 'zh' ? '每日限制' : lang === 'ms' ? 'Had harian' : 'Daily limits', premium: lang === 'zh' ? '无限次数' : lang === 'ms' ? 'Tanpa had' : 'Unlimited' },
                  { free: lang === 'zh' ? '基础报告' : lang === 'ms' ? 'Laporan asas' : 'Basic reports', premium: lang === 'zh' ? '详细技能分析' : lang === 'ms' ? 'Analisis kemahiran' : 'Skill analytics' },
                  { free: lang === 'zh' ? '有限视频' : lang === 'ms' ? 'Video terhad' : 'Limited videos', premium: lang === 'zh' ? '完整视频库' : lang === 'ms' ? 'Perpustakaan penuh' : 'Full library' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-2 py-1">
                    <span className="text-[10px] flex-1" style={{ color: 'rgba(200,184,138,0.4)', textDecoration: 'line-through' }}>{row.free}</span>
                    <span className="text-[10px] font-bold" style={{ color: GOLD_LIGHT }}>→ {row.premium}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Referral Section — "Or refer friends for FREE" ── */}
            {!isPaid && referralCode && (
              <div className="mb-4 rounded-xl p-3 text-left" style={{ background: 'rgba(236,72,153,0.06)', border: '1px solid rgba(236,72,153,0.15)' }}>
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <Heart size={14} style={{ color: '#f472b6' }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f472b6' }}>
                    {lang === 'zh' ? '或者 — 免费获取！' : lang === 'ms' ? 'Atau — Dapatkan Percuma!' : 'Or — Get It Free!'}
                  </p>
                </div>

                {/* Refer 10 message */}
                <p className="text-[11px] leading-relaxed mb-2.5" style={{ color: 'rgba(244,114,182,0.8)' }}>
                  {lang === 'zh'
                    ? '推荐10位朋友注册，您的年度订阅完全免费！每次付费推荐可获得RM36.50。'
                    : lang === 'ms'
                    ? 'Rujuk 10 rakan dan langganan tahunan anda PERCUMA! Dapat RM36.50 setiap rujukan berbayar.'
                    : 'Refer 10 friends and your annual subscription is FREE! Earn RM36.50 per paid referral.'}
                </p>

                {/* Progress bar */}
                <div className="mb-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: '#f472b6' }}>
                      <Users size={10} />
                      {referralProgress}/{REFERRAL_GOAL}
                    </span>
                    <span className="text-[9px]" style={{ color: 'rgba(244,114,182,0.5)' }}>
                      {referralProgress >= REFERRAL_GOAL
                        ? (lang === 'zh' ? '已达成！🎉' : lang === 'ms' ? 'Dicapai! 🎉' : 'Achieved! 🎉')
                        : (lang === 'zh' ? `还差${REFERRAL_GOAL - referralProgress}位` : lang === 'ms' ? `${REFERRAL_GOAL - referralProgress} lagi` : `${REFERRAL_GOAL - referralProgress} more to go`)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(244,114,182,0.1)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #f472b6, #ec4899)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(referralProgress / REFERRAL_GOAL) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                </div>

                {/* Share buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyReferral}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95"
                    style={{
                      background: 'rgba(244,114,182,0.12)',
                      border: '1px solid rgba(244,114,182,0.25)',
                      color: '#f9a8d4',
                    }}
                  >
                    {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                    {copiedLink
                      ? (lang === 'zh' ? '已复制' : lang === 'ms' ? 'Disalin' : 'Copied!')
                      : (lang === 'zh' ? '复制链接' : lang === 'ms' ? 'Salin Pautan' : 'Copy Link')}
                  </button>
                  <button
                    onClick={handleShareWhatsApp}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-95"
                    style={{
                      background: 'rgba(37,211,102,0.12)',
                      border: '1px solid rgba(37,211,102,0.25)',
                      color: '#86efac',
                    }}
                  >
                    <svg viewBox="0 0 24 24" width={12} height={12} fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.613.613l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.16 0-4.16-.68-5.803-1.836l-.408-.287-3.067 1.028 1.028-3.067-.287-.408A9.953 9.953 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
                    </svg>
                    WhatsApp
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!isPaid && onUpgrade && (
                <button
                  onClick={() => { onClose(); onUpgrade(); }}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD}, #c4943a)`,
                    color: '#1a0e2e',
                    boxShadow: '0 2px 12px rgba(212,164,74,0.3)',
                  }}
                >
                  <Crown size={16} />
                  {upgradeText}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2 rounded-xl text-sm transition-colors hover:bg-white/5"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {closeText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * showGateNudge — Call after completing a gated activity.
 * If remaining === 1, shows a proactive "last free session" toast.
 */
export function showGateNudge(remaining: number, maxPerDay: number, isPaid: boolean, activityType: ActivityType, lang: string = 'en') {
  if (isPaid || maxPerDay === -1 || remaining !== 1) return;
  const labels: Record<string, Record<ActivityType, string>> = ACTIVITY_LABELS;
  const actLabel = labels[lang]?.[activityType] || activityType;
  const msg = lang === 'zh'
    ? `最后一次免费${actLabel}！升级获取无限次数`
    : lang === 'ms'
    ? `Sesi ${actLabel} percuma terakhir! Naik taraf untuk tanpa had`
    : `Last free ${actLabel} today! Upgrade for unlimited`;
  toast(msg, { duration: 4000, icon: '👑' });
}