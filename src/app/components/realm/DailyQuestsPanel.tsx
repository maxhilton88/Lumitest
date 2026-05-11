/**
 * DailyQuestsPanel — Floating panel showing today's daily activity progress.
 * Shows 6 activity types with completion status, per-activity gold/XP rewards,
 * total daily potential, and "Go" buttons for navigation.
 *
 * Fetches from GET /realm/daily-log/:userId + realm_reward_config
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen, Swords, Music, Play, ScrollText, Shield,
  X, Coins, Sparkles, CheckCircle2, Trophy, ChevronRight,
  Zap,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useRealmContext } from '../../contexts/RealmContext';
import { fetchDailyLog, fetchRewardConfig } from '../../utils/api';
import { DEFAULT_REWARD_CONFIG } from '../../types/reward-config';
import type { RealmRewardConfig, ActivityType } from '../../types/reward-config';
import { useNavigate } from 'react-router';

const F = "'Cherry Bomb One', cursive";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const GREEN = '#7cc643';
const XP_PURPLE = '#a78bfa';

interface ActivityDef {
  key: ActivityType;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  route: string;
}

const ACTIVITIES: ActivityDef[] = [
  { key: 'test',      labelKey: 'realm.test',       icon: <ScrollText size={16} />, color: '#e74c3c', route: '/realm/test' },
  { key: 'practice',  labelKey: 'realm.practice',   icon: <Swords size={16} />,     color: GREEN,     route: '/realm/practice' },
  { key: 'flashcard', labelKey: 'realm.flashcards',  icon: <BookOpen size={16} />,   color: '#3498db', route: '/realm/flashcards' },
  { key: 'video',     labelKey: 'realm.video',       icon: <Play size={16} />,       color: '#9b59b6', route: '/realm/library' },
  { key: 'music',     labelKey: 'realm.music',       icon: <Music size={16} />,      color: '#e67e22', route: '/realm/audio' },
  { key: 'battle',    labelKey: 'realm.battle',      icon: <Shield size={16} />,     color: '#e74c3c', route: '/realm/battle' },
];

export type DailyLog = Record<string, { count: number; goldAwarded: boolean }>;

interface DailyQuestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DailyQuestsPanel({ isOpen, onClose }: DailyQuestsPanelProps) {
  const { t, language } = useLanguage();
  const { userId } = useRealmContext();
  const navigate = useNavigate();
  const [log, setLog] = useState<DailyLog>({});
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<RealmRewardConfig>(DEFAULT_REWARD_CONFIG);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [logResult, cfgResult] = await Promise.all([
        fetchDailyLog(userId),
        fetchRewardConfig().catch(() => null),
      ]);
      setLog(logResult.log || {});
      if (cfgResult) setConfig(cfgResult);
    } catch (err) {
      console.error('[DAILY QUESTS] Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      loadData();
    }
  }, [isOpen, loadData]);

  const completedCount = ACTIVITIES.filter(a => (log[a.key]?.count || 0) > 0).length;

  // Calculate totals from config
  const totalGold = ACTIVITIES.reduce((sum, a) => sum + (config.activities[a.key]?.gold || 0), 0);
  const totalXp = ACTIVITIES.reduce((sum, a) => sum + (config.activities[a.key]?.xp || 0), 0);
  const earnedGold = ACTIVITIES.reduce((sum, a) => {
    const entry = log[a.key];
    return sum + ((entry?.goldAwarded) ? (config.activities[a.key]?.gold || 0) : 0);
  }, 0);
  const earnedXp = ACTIVITIES.reduce((sum, a) => {
    const entry = log[a.key];
    return sum + ((entry?.count || 0) > 0 ? (config.activities[a.key]?.xp || 0) : 0);
  }, 0);

  const title = language === 'zh' ? '每日任务' : language === 'ms' ? 'Misi Harian' : 'Daily Quests';
  const subtitle = language === 'zh'
    ? `${completedCount}/${ACTIVITIES.length} 已完成`
    : language === 'ms'
    ? `${completedCount}/${ACTIVITIES.length} selesai`
    : `${completedCount}/${ACTIVITIES.length} completed`;

  const goLabel = language === 'zh' ? '去' : language === 'ms' ? 'Pergi' : 'Go';
  const claimedLabel = language === 'zh' ? '已领' : language === 'ms' ? 'Selesai' : 'Claimed';

  const handleGo = (route: string) => {
    onClose();
    navigate(route);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: 'rgba(5,4,2,0.75)', backdropFilter: 'blur(4px)' }} />

          {/* Panel */}
          <motion.div
            className="relative w-[360px] max-w-[92vw] rounded-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, rgba(20,15,35,0.98) 0%, rgba(12,8,20,0.99) 100%)',
              border: '1.5px solid rgba(212,164,74,0.3)',
              boxShadow: '0 0 40px rgba(212,164,74,0.1), 0 8px 32px rgba(0,0,0,0.5)',
            }}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Trophy size={18} style={{ color: GOLD }} />
                  <h3 style={{ fontFamily: F, fontSize: 16, color: GOLD_LIGHT }}>{title}</h3>
                </div>
                <p className="text-[11px] mt-1" style={{ color: 'rgba(200,184,138,0.6)' }}>{subtitle}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/5 transition-colors">
                <X size={18} style={{ color: 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>

            {/* ── Total Potential Loot Banner ── */}
            <div className="mx-4 mb-3 rounded-xl px-4 py-3" style={{
              background: 'linear-gradient(135deg, rgba(212,164,74,0.08) 0%, rgba(167,139,250,0.06) 100%)',
              border: '1px solid rgba(212,164,74,0.15)',
            }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(200,184,138,0.5)' }}>
                {language === 'zh' ? '今日总奖励' : language === 'ms' ? 'Jumlah Ganjaran Hari Ini' : "Today's Total Loot"}
              </p>
              <div className="flex items-center gap-4">
                {/* Gold */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(212,164,74,0.15)' }}>
                    <Coins size={14} style={{ color: GOLD }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: GOLD_LIGHT, fontFamily: F }}>
                      {earnedGold}<span className="text-[10px] font-normal" style={{ color: 'rgba(200,184,138,0.4)' }}>/{totalGold}</span>
                    </p>
                    <p className="text-[9px] -mt-0.5" style={{ color: 'rgba(200,184,138,0.35)' }}>Gold</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

                {/* XP */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(167,139,250,0.12)' }}>
                    <Zap size={14} style={{ color: XP_PURPLE }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold" style={{ color: '#c4b5fd', fontFamily: F }}>
                      {earnedXp}<span className="text-[10px] font-normal" style={{ color: 'rgba(167,139,250,0.4)' }}>/{totalXp}</span>
                    </p>
                    <p className="text-[9px] -mt-0.5" style={{ color: 'rgba(167,139,250,0.35)' }}>XP</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${GREEN}, ${GOLD})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / ACTIVITIES.length) * 100}%` }}
                  transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Activity list */}
            <div className="px-4 pb-3 space-y-1.5 max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(212,164,74,0.2) transparent' }}>
              {loading ? (
                <div className="py-8 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${GOLD}40`, borderTopColor: 'transparent' }} />
                </div>
              ) : (
                ACTIVITIES.map((activity, i) => {
                  const entry = log[activity.key];
                  const done = (entry?.count || 0) > 0;
                  const goldClaimed = entry?.goldAwarded || false;
                  const actGold = config.activities[activity.key]?.gold || 0;
                  const actXp = config.activities[activity.key]?.xp || 0;

                  return (
                    <motion.div
                      key={activity.key}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{
                        background: done ? 'rgba(124,198,67,0.06)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${done ? 'rgba(124,198,67,0.15)' : 'rgba(255,255,255,0.05)'}`,
                      }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.05 }}
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background: done ? `${activity.color}20` : 'rgba(255,255,255,0.04)',
                          color: done ? activity.color : 'rgba(255,255,255,0.3)',
                        }}
                      >
                        {activity.icon}
                      </div>

                      {/* Label + reward chips */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[12px] font-medium truncate"
                          style={{ color: done ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)' }}
                        >
                          {t(activity.labelKey)}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="flex items-center gap-0.5 text-[9px] font-bold"
                            style={{ color: goldClaimed ? 'rgba(212,164,74,0.35)' : actGold > 0 ? GOLD : 'rgba(212,164,74,0.25)' }}
                          >
                            <Coins size={9} /> +{actGold}
                            {goldClaimed && <CheckCircle2 size={8} className="ml-0.5" />}
                          </span>
                          <span
                            className="flex items-center gap-0.5 text-[9px] font-bold"
                            style={{ color: done ? 'rgba(167,139,250,0.4)' : actXp > 0 ? XP_PURPLE : 'rgba(167,139,250,0.25)' }}
                          >
                            <Zap size={9} /> +{actXp}
                            {done && <CheckCircle2 size={8} className="ml-0.5" />}
                          </span>
                          {actGold === 0 && actXp === 0 && (
                            <span className="text-[8px] italic" style={{ color: 'rgba(200,184,138,0.3)' }}>
                              {language === 'zh' ? '未设置' : language === 'ms' ? 'Belum set' : 'not set'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Go / Claimed button */}
                      <button
                        onClick={() => handleGo(activity.route)}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                        style={done ? {
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.3)',
                        } : {
                          background: `linear-gradient(135deg, ${GOLD}dd, ${GOLD}99)`,
                          border: `1px solid ${GOLD}50`,
                          color: '#1a1510',
                          boxShadow: `0 2px 8px ${GOLD}30`,
                        }}
                      >
                        {done ? (
                          <>
                            <CheckCircle2 size={12} />
                            {claimedLabel}
                          </>
                        ) : (
                          <>
                            {goLabel}
                            <ChevronRight size={12} />
                          </>
                        )}
                      </button>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer notes */}
            <div className="px-5 pb-4 pt-2 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-1.5">
                <Coins size={10} style={{ color: GOLD }} />
                <span className="text-[10px]" style={{ color: 'rgba(200,184,138,0.5)' }}>
                  {language === 'zh' ? '金币每日仅奖励一次' : language === 'ms' ? 'Emas diberikan sekali sehari' : 'Gold awarded once daily per activity'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={10} style={{ color: XP_PURPLE }} />
                <span className="text-[10px]" style={{ color: 'rgba(200,184,138,0.5)' }}>
                  {language === 'zh' ? 'XP 每次都可获得' : language === 'ms' ? 'XP diberikan setiap kali' : 'XP awarded every time'}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * useDailyLog — Hook to fetch daily log for badge display.
 * Returns log data and a refresh function.
 */
export function useDailyLog() {
  const { userId } = useRealmContext();
  const [log, setLog] = useState<DailyLog>({});

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const result = await fetchDailyLog(userId);
      setLog(result.log || {});
    } catch (err) {
      console.error('[DAILY LOG] Fetch error:', err);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { log, refresh };
}