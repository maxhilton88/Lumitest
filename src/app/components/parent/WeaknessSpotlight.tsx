/**
 * WeaknessSpotlight.tsx — "Areas to Improve" panel for MasteryDashboard
 *
 * Fetches the cumulative KV mastery profile and highlights
 * the weakest skills per subject so parents immediately know
 * what their child needs to practice.
 *
 * Dark-fantasy RPG aesthetic matching the rest of the app.
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle, Target, TrendingUp, Shield, Trophy,
  ChevronDown, ChevronRight, Swords, Flame, BookOpen,
  Sparkles, ArrowRight, Zap,
} from 'lucide-react';
import { FantasyPanel, GoldOrnament } from '../FantasyBackground';
import { useLanguage } from '../LanguageContext';
import { SUBJECT_BY_QUEST_ID } from '../../data/kssr-taxonomy';
import type { MasteryProfile, MasterySubject } from '../../utils/mastery-api';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

// ── Weakness tiers ──

interface WeakSkill {
  skillCode: string;
  skillName: string;
  topicName: string;
  level: string;
  totalAttempts: number;
  totalCorrect: number;
  percentage: number;
  subjectId: string;
  subjectIcon: string;
  subjectName: string;
  subjectColor: string;
}

function getSeverity(pct: number): { label: string; labelMs: string; labelZh: string; color: string; bg: string; icon: React.ReactNode } {
  if (pct <= 20) return { label: 'Critical', labelMs: 'Kritikal', labelZh: '严重', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <Flame className="w-3.5 h-3.5" /> };
  if (pct <= 40) return { label: 'Weak', labelMs: 'Lemah', labelZh: '薄弱', color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
  if (pct <= 60) return { label: 'Developing', labelMs: 'Berkembang', labelZh: '发展中', color: '#eab308', bg: 'rgba(234,179,8,0.08)', icon: <TrendingUp className="w-3.5 h-3.5" /> };
  return { label: 'Good', labelMs: 'Baik', labelZh: '良好', color: '#22c55e', bg: 'rgba(34,197,94,0.08)', icon: <Shield className="w-3.5 h-3.5" /> };
}

// ── Subject weakness card ──

function SubjectWeaknessCard({
  subjectId,
  subjectData,
  weakSkills,
  onPractice,
}: {
  subjectId: string;
  subjectData: MasterySubject;
  weakSkills: WeakSkill[];
  onPractice?: (subjectId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { language, t } = useLanguage();

  const subjectDef = SUBJECT_BY_QUEST_ID[subjectId];
  const subjectName = subjectDef?.name?.[language as 'en' | 'ms' | 'zh'] || subjectDef?.name?.en || subjectId;
  const subjectIcon = subjectDef?.icon || '\u{1F4DD}';
  const subjectColor = subjectDef?.color || GOLD;
  const overallPct = subjectData.percentage;
  const severity = getSeverity(overallPct);

  // Group weak skills by topic
  const topicGroups = useMemo(() => {
    const groups: Record<string, WeakSkill[]> = {};
    for (const sk of weakSkills) {
      const key = sk.topicName || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(sk);
    }
    // Sort topics by worst average percentage
    return Object.entries(groups).sort((a, b) => {
      const avgA = a[1].reduce((s, sk) => s + sk.percentage, 0) / a[1].length;
      const avgB = b[1].reduce((s, sk) => s + sk.percentage, 0) / b[1].length;
      return avgA - avgB;
    });
  }, [weakSkills]);

  const weakCount = weakSkills.filter(s => s.percentage < 50).length;
  const severityLabel = language === 'ms' ? severity.labelMs : language === 'zh' ? severity.labelZh : severity.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(20,16,10,0.95), rgba(28,22,14,0.98))',
        border: `1.5px solid ${subjectColor}25`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center gap-3 transition-colors"
        style={{ background: expanded ? `${subjectColor}08` : 'transparent' }}
      >
        <span className="text-xl shrink-0">{subjectIcon}</span>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontFamily: F, fontSize: 14, color: subjectColor }}>
              {subjectName}
            </span>
            <span style={{ fontFamily: F, fontSize: 13, color: severity.color }}>
              {overallPct}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(overallPct, 2)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                background: `linear-gradient(90deg, ${subjectColor}cc, ${subjectColor})`,
                boxShadow: `0 0 8px ${subjectColor}40`,
              }}
            />
          </div>
        </div>

        {/* Weak count badge */}
        {weakCount > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
            style={{ background: `${severity.color}15`, border: `1px solid ${severity.color}30` }}
          >
            <span style={{ color: severity.color }}>{severity.icon}</span>
            <span style={{ fontFamily: F, fontSize: 9, color: severity.color }}>
              {weakCount} {language === 'en' ? 'weak' : language === 'ms' ? 'lemah' : '\u8584\u5F31'}
            </span>
          </div>
        )}

        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4" style={{ color: `${PARCHMENT}40` }} />
        </motion.div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Per-topic breakdown */}
              {topicGroups.map(([topicName, skills]) => {
                const topicCorrect = skills.reduce((s, sk) => s + sk.totalCorrect, 0);
                const topicTotal = skills.reduce((s, sk) => s + sk.totalAttempts, 0);
                const topicPct = topicTotal > 0 ? Math.round((topicCorrect / topicTotal) * 100) : 0;
                const topicSev = getSeverity(topicPct);

                return (
                  <div key={topicName}>
                    {/* Topic header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3" style={{ color: `${PARCHMENT}50` }} />
                        <span style={{ fontFamily: F, fontSize: 11, color: `${PARCHMENT}90` }}>
                          {topicName}
                        </span>
                      </div>
                      <span style={{ fontFamily: F, fontSize: 10, color: topicSev.color }}>
                        {topicPct}% ({topicCorrect}/{topicTotal})
                      </span>
                    </div>

                    {/* Individual skills within topic */}
                    <div className="space-y-1 pl-1">
                      {skills.map((sk) => {
                        const skSev = getSeverity(sk.percentage);
                        return (
                          <div
                            key={sk.skillCode}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg"
                            style={{ background: skSev.bg }}
                          >
                            <span style={{ color: skSev.color }} className="shrink-0">{skSev.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span
                                  className="truncate"
                                  style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}88`, maxWidth: '65%' }}
                                  title={sk.skillName || sk.skillCode}
                                >
                                  {sk.skillName || sk.skillCode}
                                </span>
                                <span style={{ fontFamily: F, fontSize: 10, color: skSev.color }}>
                                  {sk.totalCorrect}/{sk.totalAttempts}
                                </span>
                              </div>
                              {/* Skill bar */}
                              <div className="w-full h-1 rounded-full mt-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(sk.percentage, 2)}%`,
                                    background: `linear-gradient(90deg, ${skSev.color}aa, ${skSev.color})`,
                                  }}
                                />
                              </div>
                            </div>
                            <span
                              className="shrink-0 w-9 text-right"
                              style={{ fontFamily: F, fontSize: 11, color: skSev.color }}
                            >
                              {sk.percentage}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Summary */}
              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: `1px solid ${subjectColor}15` }}
              >
                <span style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}50` }}>
                  {subjectData.totalCorrect}/{subjectData.totalAttempts}{' '}
                  {language === 'en' ? 'correct overall' : language === 'ms' ? 'betul keseluruhan' : '\u603B\u4F53\u6B63\u786E'}
                </span>
                {onPractice && weakCount > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPractice(subjectId); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors"
                    style={{
                      background: `${subjectColor}15`,
                      border: `1px solid ${subjectColor}30`,
                    }}
                  >
                    <Swords className="w-3 h-3" style={{ color: subjectColor }} />
                    <span style={{ fontFamily: F, fontSize: 9, color: subjectColor }}>
                      {language === 'en' ? 'Practice' : language === 'ms' ? 'Latihan' : '\u7EC3\u4E60'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Top weakness alert banner ──

function TopWeaknessAlert({ weakSkills }: { weakSkills: WeakSkill[] }) {
  const { language } = useLanguage();
  if (weakSkills.length === 0) return null;

  // Show top 3 weakest skills across all subjects
  const top3 = weakSkills.slice(0, 3);

  return (
    <div
      className="rounded-xl p-4 space-y-2"
      style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(249,115,22,0.04))',
        border: '1px solid rgba(239,68,68,0.15)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Target className="w-4 h-4" style={{ color: '#ef4444' }} />
        </div>
        <div>
          <p style={{ fontFamily: F, fontSize: 12, color: '#ef4444' }}>
            {language === 'en' ? 'Priority Focus Areas' : language === 'ms' ? 'Bidang Tumpuan Utama' : '\u91CD\u70B9\u5173\u6CE8\u9886\u57DF'}
          </p>
          <p style={{ fontFamily: F, fontSize: 9, color: `${PARCHMENT}55` }}>
            {language === 'en' ? 'These skills need the most attention' : language === 'ms' ? 'Kemahiran ini memerlukan perhatian paling tinggi' : '\u8FD9\u4E9B\u6280\u80FD\u9700\u8981\u6700\u591A\u5173\u6CE8'}
          </p>
        </div>
      </div>

      {top3.map((sk, i) => (
        <div
          key={sk.skillCode}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-black"
            style={{
              background: `linear-gradient(135deg, ${sk.subjectColor}30, ${sk.subjectColor}10)`,
              border: `1.5px solid ${sk.subjectColor}40`,
              color: sk.subjectColor,
              fontFamily: CINZEL,
            }}
          >
            {i + 1}
          </div>
          <span className="text-sm shrink-0">{sk.subjectIcon}</span>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontFamily: F, fontSize: 11, color: GOLD_LIGHT }} title={sk.skillName || sk.skillCode}>
              {sk.skillName || sk.topicName || sk.skillCode}
            </p>
            <p style={{ fontFamily: F, fontSize: 9, color: `${PARCHMENT}55` }}>
              {sk.subjectName} {sk.level ? `\u2022 ${sk.level}` : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span style={{ fontFamily: F, fontSize: 13, color: getSeverity(sk.percentage).color }}>
              {sk.percentage}%
            </span>
            <p style={{ fontFamily: F, fontSize: 8, color: `${PARCHMENT}40` }}>
              {sk.totalCorrect}/{sk.totalAttempts}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main exported component ──

interface WeaknessSpotlightProps {
  masteryProfile: MasteryProfile | null;
  loading?: boolean;
  onPractice?: (subjectId: string) => void;
}

export function WeaknessSpotlight({ masteryProfile, loading, onPractice }: WeaknessSpotlightProps) {
  const { language, t } = useLanguage();

  // Build flat list of all weak skills across subjects
  const { allWeakSkills, subjectWeakMap } = useMemo(() => {
    if (!masteryProfile?.subjects) return { allWeakSkills: [], subjectWeakMap: new Map<string, WeakSkill[]>() };

    const all: WeakSkill[] = [];
    const bySubject = new Map<string, WeakSkill[]>();

    for (const subj of masteryProfile.subjects) {
      const skills = subj.skills || [];
      const subjectDef = SUBJECT_BY_QUEST_ID[subj.subjectId];
      const subjectName = subjectDef?.name?.[language as 'en' | 'ms' | 'zh'] || subjectDef?.name?.en || subj.subjectId;
      const subjectIcon = subjectDef?.icon || '\u{1F4DD}';
      const subjectColor = subjectDef?.color || GOLD;

      const weakForSubject: WeakSkill[] = [];

      if (skills.length > 0) {
        // Use per-skill granularity when available
        for (const sk of skills) {
          if (sk.totalAttempts < 1) continue;
          const enriched: WeakSkill = {
            ...sk,
            subjectId: subj.subjectId,
            subjectIcon,
            subjectName,
            subjectColor,
          };
          if (sk.percentage < 70) {
            weakForSubject.push(enriched);
            all.push(enriched);
          }
        }
      } else if (subj.topics && subj.topics.length > 0) {
        // Fallback: use topic-level data for untagged questions
        for (const topic of subj.topics) {
          if (topic.totalAttempts < 1) continue;
          const pct = topic.percentage;
          if (pct < 70) {
            const enriched: WeakSkill = {
              skillCode: topic.skillCodes?.[0] || `${subj.subjectId}-${topic.topicName}`,
              skillName: topic.topicName,
              topicName: topic.topicName,
              level: '',
              totalAttempts: topic.totalAttempts,
              totalCorrect: topic.totalCorrect,
              percentage: pct,
              subjectId: subj.subjectId,
              subjectIcon,
              subjectName,
              subjectColor,
            };
            weakForSubject.push(enriched);
            all.push(enriched);
          }
        }
      }

      if (weakForSubject.length > 0) {
        bySubject.set(subj.subjectId, weakForSubject);
      }
    }

    // Sort all by percentage ascending (weakest first)
    all.sort((a, b) => a.percentage - b.percentage);

    return { allWeakSkills: all, subjectWeakMap: bySubject };
  }, [masteryProfile, language]);

  // Loading state
  if (loading) {
    return (
      <FantasyPanel className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}>
            <Target className="w-5 h-5" style={{ color: '#ef4444' }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>
              {language === 'en' ? 'Areas to Improve' : language === 'ms' ? 'Bidang Penambahbaikan' : '\u9700\u8981\u6539\u8FDB\u7684\u9886\u57DF'}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              {language === 'en' ? 'Loading mastery data...' : language === 'ms' ? 'Memuatkan data penguasaan...' : '\u52A0\u8F7D\u638C\u63E1\u6570\u636E...'}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}08` }} />
          ))}
        </div>
      </FantasyPanel>
    );
  }

  // No mastery data yet
  if (!masteryProfile || masteryProfile.subjects.length === 0) {
    return (
      <FantasyPanel className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}>
            <Target className="w-5 h-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>
              {language === 'en' ? 'Areas to Improve' : language === 'ms' ? 'Bidang Penambahbaikan' : '\u9700\u8981\u6539\u8FDB\u7684\u9886\u57DF'}
            </h3>
          </div>
        </div>
        <div className="text-center py-8">
          <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: `${PARCHMENT}25` }} />
          <p style={{ fontFamily: F, fontSize: 13, color: `${PARCHMENT}50` }}>
            {language === 'en' ? 'Complete quests & practice to reveal weak spots!' : language === 'ms' ? 'Selesaikan pencarian & latihan untuk mendedahkan titik lemah!' : '\u5B8C\u6210\u4EFB\u52A1\u548C\u7EC3\u4E60\u4EE5\u53D1\u73B0\u5F31\u70B9\uFF01'}
          </p>
        </div>
      </FantasyPanel>
    );
  }

  // All skills are strong — congratulations
  if (allWeakSkills.length === 0) {
    return (
      <FantasyPanel className="p-5 md:p-6" gold>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
            <Trophy className="w-5 h-5" style={{ color: '#22c55e' }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>
              {language === 'en' ? 'All Skills Strong!' : language === 'ms' ? 'Semua Kemahiran Kuat!' : '\u6240\u6709\u6280\u80FD\u5F3A\u5927\uFF01'}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              {language === 'en' ? 'Keep it up — no weak areas detected.' : language === 'ms' ? 'Teruskan — tiada bidang lemah dikesan.' : '\u7EE7\u7EED\u4FDD\u6301 \u2014 \u672A\u53D1\u73B0\u5F31\u70B9\u3002'}
            </p>
          </div>
        </div>
      </FantasyPanel>
    );
  }

  // Sort subjects by weakness (worst first)
  const sortedSubjects = [...masteryProfile.subjects]
    .filter(s => subjectWeakMap.has(s.subjectId))
    .sort((a, b) => a.percentage - b.percentage);

  return (
    <FantasyPanel className="p-5 md:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <Target className="w-5 h-5" style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>
            {language === 'en' ? 'Areas to Improve' : language === 'ms' ? 'Bidang Penambahbaikan' : '\u9700\u8981\u6539\u8FDB\u7684\u9886\u57DF'}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>
            {language === 'en'
              ? `${allWeakSkills.length} skill${allWeakSkills.length !== 1 ? 's' : ''} below 70% across ${sortedSubjects.length} subject${sortedSubjects.length !== 1 ? 's' : ''}`
              : language === 'ms'
                ? `${allWeakSkills.length} kemahiran di bawah 70% merentas ${sortedSubjects.length} subjek`
                : `${sortedSubjects.length}\u4E2A\u79D1\u76EE\u4E2D\u6709${allWeakSkills.length}\u9879\u6280\u80FD\u4F4E\u4E8E70%`}
          </p>
        </div>
      </div>

      {/* Top 3 weakest alert banner */}
      <TopWeaknessAlert weakSkills={allWeakSkills.filter(s => s.percentage < 50)} />

      {/* Per-subject weakness cards */}
      <div className="space-y-2 mt-4">
        {sortedSubjects.map((subj) => (
          <SubjectWeaknessCard
            key={subj.subjectId}
            subjectId={subj.subjectId}
            subjectData={subj}
            weakSkills={subjectWeakMap.get(subj.subjectId) || []}
            onPractice={onPractice}
          />
        ))}
      </div>

      <GoldOrnament className="mt-4" />
    </FantasyPanel>
  );
}