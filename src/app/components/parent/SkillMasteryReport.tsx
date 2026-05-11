/**
 * SkillMasteryReport.tsx — Per-subject, per-topic mastery visualization
 *
 * Shows skill-level mastery data grouped by subject → topic.
 * Uses the KSSR taxonomy skill codes for drill-down.
 * Dark fantasy RPG aesthetic matching the rest of the app.
 *
 * This component works with both:
 *   - Live session data (from adaptive engine)
 *   - Stored mastery data (from KV/Postgres, when available)
 */
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronDown, ChevronRight, Trophy, Target, TrendingUp,
  Sparkles, Shield, BookOpen, AlertTriangle,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { SUBJECT_BY_CODE, AGE_INFO, displayLabelFromAge, type SubjectCode } from '../../data/kssr-taxonomy';
import type { SubjectMastery } from '../../utils/adaptive-engine';

const F = "'Cherry Bomb One', cursive";
const CINZEL = "'Cinzel Decorative', serif";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

// ── Mastery tier thresholds ──

function getMasteryTier(pct: number): { label: string; labelMs: string; labelZh: string; color: string; icon: React.ReactNode } {
  if (pct >= 80) return { label: 'Mastered', labelMs: 'Dikuasai', labelZh: '已掌握', color: '#22c55e', icon: <Trophy className="w-3.5 h-3.5" /> };
  if (pct >= 60) return { label: 'Proficient', labelMs: 'Mahir', labelZh: '熟练', color: '#3b82f6', icon: <Shield className="w-3.5 h-3.5" /> };
  if (pct >= 40) return { label: 'Developing', labelMs: 'Berkembang', labelZh: '发展中', color: '#f59e0b', icon: <TrendingUp className="w-3.5 h-3.5" /> };
  return { label: 'Needs Practice', labelMs: 'Perlu Latihan', labelZh: '需要练习', color: '#ef4444', icon: <AlertTriangle className="w-3.5 h-3.5" /> };
}

// ── Progress bar component ──

function MasteryBar({ pct, color, height = 6 }: { pct: number; color: string; height?: number }) {
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: 'rgba(255,255,255,0.06)' }}
    >
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(pct, 2)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 8px ${color}40`,
        }}
      />
    </div>
  );
}

// ── Subject card ──

function SubjectCard({
  mastery,
  language,
}: {
  mastery: SubjectMastery;
  language: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const subj = SUBJECT_BY_CODE[mastery.subject];
  if (!subj) return null;

  const tier = getMasteryTier(mastery.overallPct);
  const levelInfo = AGE_INFO[mastery.functionalAge || 4] || AGE_INFO[4];
  const tierLabel = language === 'ms' ? tier.labelMs : language === 'zh' ? tier.labelZh : tier.label;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(20,16,10,0.95), rgba(28,22,14,0.98))',
        border: `1.5px solid ${subj.color}25`,
      }}
    >
      {/* Header — clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center gap-3 transition-colors"
        style={{ background: expanded ? `${subj.color}08` : 'transparent' }}
      >
        {/* Subject icon */}
        <span className="text-xl shrink-0">{subj.icon}</span>

        {/* Name + bar */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontFamily: F, fontSize: 14, color: subj.color }}>
              {subj.name[language as 'en' | 'ms' | 'zh'] || subj.name.en}
            </span>
            <span style={{ fontFamily: F, fontSize: 13, color: tier.color }}>
              {mastery.overallPct}%
            </span>
          </div>
          <MasteryBar pct={mastery.overallPct} color={subj.color} />
        </div>

        {/* Tier badge */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
          style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}30` }}
        >
          <span style={{ color: tier.color }}>{tier.icon}</span>
          <span style={{ fontFamily: F, fontSize: 9, color: tier.color }}>
            {tierLabel}
          </span>
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronRight className="w-4 h-4" style={{ color: `${PARCHMENT}40` }} />
        </motion.div>
      </button>

      {/* Expanded topic details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {/* Functional level badge */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: `${levelInfo.tierColor}10`, border: `1px solid ${levelInfo.tierColor}20` }}
              >
                <Sparkles className="w-3.5 h-3.5" style={{ color: levelInfo.tierColor }} />
                <span style={{ fontFamily: F, fontSize: 10, color: levelInfo.tierColor }}>
                  {language === 'en' ? 'Functional Level' : language === 'ms' ? 'Tahap Fungsional' : '功能水平'}:
                </span>
                <span style={{ fontFamily: F, fontSize: 12, color: levelInfo.tierColor }}>
                  {mastery.functionalLevel} ({levelInfo.tierLabel})
                </span>
              </div>

              {/* Topic breakdown */}
              {mastery.topicMastery.map((topic, i) => {
                const topicTier = getMasteryTier(topic.pct);
                return (
                  <div
                    key={`${mastery.subject}-${topic.topic}-${i}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className="truncate"
                          style={{ fontFamily: F, fontSize: 11, color: `${PARCHMENT}99`, maxWidth: '70%' }}
                        >
                          {topic.topic}
                        </span>
                        <span style={{ fontFamily: F, fontSize: 11, color: topicTier.color }}>
                          {topic.correct}/{topic.total}
                        </span>
                      </div>
                      <MasteryBar pct={topic.pct} color={topicTier.color} height={4} />
                    </div>

                    {/* Percentage */}
                    <span
                      className="shrink-0 w-10 text-right"
                      style={{ fontFamily: F, fontSize: 11, color: topicTier.color }}
                    >
                      {topic.pct}%
                    </span>
                  </div>
                );
              })}

              {/* Summary line */}
              <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${subj.color}15` }}>
                <span style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}50` }}>
                  {language === 'en' ? 'Total' : language === 'ms' ? 'Jumlah' : '总计'}
                </span>
                <span style={{ fontFamily: F, fontSize: 12, color: subj.color }}>
                  {mastery.overallCorrect}/{mastery.overallTotal}{' '}
                  ({mastery.overallPct}%)
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface SkillMasteryReportProps {
  /** Mastery data by subject */
  masteryData: SubjectMastery[];
  /** Child's name */
  childName?: string;
  /** Child's derived level */
  childLevel?: string;
}

export function SkillMasteryReport({
  masteryData,
  childName = 'Explorer',
  childLevel,
}: SkillMasteryReportProps) {
  const { language } = useLanguage();

  // Sort subjects: worst performing first (needs practice first)
  const sorted = useMemo(() =>
    [...masteryData].sort((a, b) => a.overallPct - b.overallPct),
    [masteryData]
  );

  // Overall stats
  const totalCorrect = sorted.reduce((s, m) => s + m.overallCorrect, 0);
  const totalQuestions = sorted.reduce((s, m) => s + m.overallTotal, 0);
  const overallPct = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const overallTier = getMasteryTier(overallPct);
  const overallTierLabel = language === 'ms' ? overallTier.labelMs : language === 'zh' ? overallTier.labelZh : overallTier.label;

  if (masteryData.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: `${PARCHMENT}30` }} />
        <p style={{ fontFamily: F, fontSize: 14, color: `${PARCHMENT}50` }}>
          {language === 'en' ? 'No mastery data yet. Complete a quest to see your report!'
            : language === 'ms' ? 'Tiada data penguasaan lagi. Selesaikan satu pencarian untuk melihat laporan!'
            : '暂无掌握数据。完成一个任务后查看报告！'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall summary card */}
      <div
        className="rounded-xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(20,16,10,0.95), rgba(28,22,14,0.98))',
          border: `1.5px solid ${GOLD}20`,
          boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 20px ${GOLD}05`,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}50`, letterSpacing: '0.1em' }}>
              {language === 'en' ? 'SKILL MASTERY' : language === 'ms' ? 'PENGUASAAN KEMAHIRAN' : '技能掌握'}
            </p>
            <p style={{ fontFamily: F, fontSize: 16, color: GOLD_LIGHT }}>
              {childName}
              {childLevel && (
                <span style={{ fontSize: 11, color: `${PARCHMENT}60`, marginLeft: 6 }}>
                  ({childLevel})
                </span>
              )}
            </p>
          </div>

          {/* Overall badge */}
          <div
            className="flex flex-col items-center px-3 py-2 rounded-xl"
            style={{ background: `${overallTier.color}12`, border: `1.5px solid ${overallTier.color}30` }}
          >
            <span style={{ fontFamily: F, fontSize: 24, color: overallTier.color, lineHeight: 1 }}>
              {overallPct}%
            </span>
            <span style={{ fontFamily: F, fontSize: 8, color: `${overallTier.color}88`, marginTop: 2 }}>
              {overallTierLabel}
            </span>
          </div>
        </div>

        {/* Overall bar */}
        <MasteryBar pct={overallPct} color={GOLD} height={8} />

        <div className="flex items-center justify-between mt-2">
          <span style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}40` }}>
            {totalCorrect}/{totalQuestions}{' '}
            {language === 'en' ? 'correct' : language === 'ms' ? 'betul' : '正确'}
          </span>
          <span style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}40` }}>
            {sorted.length}{' '}
            {language === 'en' ? 'subjects' : language === 'ms' ? 'subjek' : '科目'}
          </span>
        </div>
      </div>

      {/* Subjects needing attention (worst first) */}
      {sorted.some(m => m.overallPct < 50) && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          <Target className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
          <span style={{ fontFamily: F, fontSize: 10, color: '#ef4444cc' }}>
            {language === 'en' ? 'Focus areas below — practice these topics first!'
              : language === 'ms' ? 'Bidang tumpuan di bawah — latih topik ini dahulu!'
              : '以下为重点区域 — 先练习这些主题！'}
          </span>
        </div>
      )}

      {/* Subject cards */}
      <div className="space-y-2">
        {sorted.map((mastery, i) => (
          <SubjectCard
            key={mastery.subject}
            mastery={mastery}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}