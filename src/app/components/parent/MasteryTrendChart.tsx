/**
 * MasteryTrendChart.tsx — "Skill Progress Over Time" line chart
 *
 * Displays per-subject mastery percentage trends from daily KV snapshots.
 * Dark-fantasy RPG aesthetic with gold/parchment palette.
 * Trilingual labels (EN/BM/ZH). 7/14/30 day range toggle.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Loader2, Sparkles } from 'lucide-react';
import { FantasyPanel, GoldOrnament } from '../FantasyBackground';
import { useLanguage } from '../LanguageContext';
import { SUBJECT_BY_QUEST_ID } from '../../data/kssr-taxonomy';
import { fetchMasteryTrend, type MasteryTrendSnapshot } from '../../utils/mastery-api';

const F = "'Cherry Bomb One', cursive";
const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';
const PARCHMENT = '#c8b88a';

// Subject line colors — vibrant but dark-fantasy appropriate
const SUBJECT_LINE_COLORS: Record<string, string> = {
  english: '#60a5fa',
  numbers: '#f59e0b',
  bahasa: '#34d399',
  mandarin: '#f472b6',
  science: '#a78bfa',
  sejarah: '#fb923c',
  geography: '#2dd4bf',
};

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

interface MasteryTrendChartProps {
  /** If provided, uses this data instead of fetching */
  snapshots?: MasteryTrendSnapshot[];
  /** Controls visibility — only renders when parent dashboard is ready */
  visible?: boolean;
}

export function MasteryTrendChart({ snapshots: externalSnapshots, visible = true }: MasteryTrendChartProps) {
  const { language } = useLanguage();
  const [range, setRange] = useState<RangeOption>(14);
  const [snapshots, setSnapshots] = useState<MasteryTrendSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch trend data
  useEffect(() => {
    if (!visible) return;
    if (externalSnapshots) {
      setSnapshots(externalSnapshots);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchMasteryTrend(30) // Always fetch 30d, filter client-side
      .then(s => { setSnapshots(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [visible, externalSnapshots]);

  // Filter snapshots by range and build chart data
  const { chartData, subjectIds } = useMemo(() => {
    if (snapshots.length === 0) return { chartData: [], subjectIds: [] };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered = snapshots.filter(s => s.date >= cutoffStr);

    // Collect all subject IDs across all snapshots
    const subjectSet = new Set<string>();
    for (const snap of filtered) {
      for (const sid of Object.keys(snap.subjects || {})) {
        subjectSet.add(sid);
      }
    }
    const ids = [...subjectSet].sort();

    // Build recharts-compatible data points
    const data = filtered.map(snap => {
      const point: Record<string, any> = {
        date: snap.date,
        dateLabel: formatDateLabel(snap.date, language),
      };
      for (const sid of ids) {
        point[sid] = snap.subjects?.[sid]?.percentage ?? null;
      }
      return point;
    });

    return { chartData: data, subjectIds: ids };
  }, [snapshots, range, language]);

  // Title translations
  const title = language === 'en' ? 'Skill Progress Over Time'
    : language === 'ms' ? 'Kemajuan Kemahiran Dari Semasa Ke Semasa'
    : '\u6280\u80FD\u8FDB\u6B65\u8D8B\u52BF';

  const subtitle = language === 'en' ? 'Daily mastery percentage by subject'
    : language === 'ms' ? 'Peratusan penguasaan harian mengikut subjek'
    : '\u6BCF\u65E5\u5404\u79D1\u638C\u63E1\u767E\u5206\u6BD4';

  const rangeLabels: Record<RangeOption, string> = {
    7: language === 'en' ? '7d' : language === 'ms' ? '7h' : '7\u5929',
    14: language === 'en' ? '14d' : language === 'ms' ? '14h' : '14\u5929',
    30: language === 'en' ? '30d' : language === 'ms' ? '30h' : '30\u5929',
  };

  if (!visible) return null;

  // Loading
  if (loading) {
    return (
      <FantasyPanel className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}>
            <TrendingUp className="w-5 h-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>{title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>
              {language === 'en' ? 'Loading trend data...' : language === 'ms' ? 'Memuatkan data trend...' : '\u52A0\u8F7D\u8D8B\u52BF\u6570\u636E...'}
            </p>
          </div>
        </div>
        <div className="h-48 rounded-xl animate-pulse flex items-center justify-center" style={{ background: `${GOLD}06`, border: `1px solid ${GOLD}08` }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: `${PARCHMENT}30` }} />
        </div>
      </FantasyPanel>
    );
  }

  // No data
  if (chartData.length < 2) {
    return (
      <FantasyPanel className="p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}>
            <TrendingUp className="w-5 h-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>{title}</h3>
          </div>
        </div>
        <div className="text-center py-8">
          <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: `${PARCHMENT}25` }} />
          <p style={{ fontFamily: F, fontSize: 13, color: `${PARCHMENT}50` }}>
            {language === 'en'
              ? 'Practice for 2+ days to see your progress trend!'
              : language === 'ms'
                ? 'Berlatih selama 2+ hari untuk melihat trend kemajuan!'
                : '\u7EC3\u4E60 2 \u5929\u4EE5\u4E0A\u5373\u53EF\u67E5\u770B\u8FDB\u6B65\u8D8B\u52BF\uFF01'}
          </p>
        </div>
      </FantasyPanel>
    );
  }

  return (
    <FantasyPanel className="p-5 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}25` }}
          >
            <TrendingUp className="w-5 h-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ fontFamily: F, color: GOLD_LIGHT }}>{title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: `${PARCHMENT}80` }}>{subtitle}</p>
          </div>
        </div>

        {/* Range toggle */}
        <div className="flex gap-1 shrink-0">
          {RANGE_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
              style={{
                fontFamily: F,
                background: range === r ? `${GOLD}20` : 'transparent',
                border: `1px solid ${range === r ? `${GOLD}40` : `${PARCHMENT}15`}`,
                color: range === r ? GOLD_LIGHT : `${PARCHMENT}50`,
              }}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full"
        style={{ height: 240 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(200,184,138,0.08)"
              vertical={false}
            />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontFamily: F, fontSize: 9, fill: `${PARCHMENT}55` }}
              axisLine={{ stroke: `${PARCHMENT}15` }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontFamily: F, fontSize: 9, fill: `${PARCHMENT}55` }}
              axisLine={{ stroke: `${PARCHMENT}15` }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip language={language} />} />
            {subjectIds.map(sid => {
              const def = SUBJECT_BY_QUEST_ID[sid];
              const color = def?.color || SUBJECT_LINE_COLORS[sid] || GOLD;
              return (
                <Line
                  key={sid}
                  type="monotone"
                  dataKey={sid}
                  name={getSubjectLabel(sid, language)}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color, stroke: 'rgba(20,16,10,0.8)', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: color, stroke: GOLD_LIGHT, strokeWidth: 2 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Legend (custom, RPG-styled) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
        {subjectIds.map(sid => {
          const def = SUBJECT_BY_QUEST_ID[sid];
          const color = def?.color || SUBJECT_LINE_COLORS[sid] || GOLD;
          const icon = def?.icon || '\u{1F4DD}';
          return (
            <div key={sid} className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
              <span className="text-xs" style={{ lineHeight: 1 }}>{icon}</span>
              <span style={{ fontFamily: F, fontSize: 9, color: `${PARCHMENT}70` }}>
                {getSubjectLabel(sid, language)}
              </span>
            </div>
          );
        })}
      </div>

      <GoldOrnament className="mt-4" />
    </FantasyPanel>
  );
}

// ── Helpers ──

function formatDateLabel(dateStr: string, lang: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate();
    const month = d.toLocaleDateString(
      lang === 'ms' ? 'ms-MY' : lang === 'zh' ? 'zh-CN' : 'en-US',
      { month: 'short' }
    );
    return `${day} ${month}`;
  } catch {
    return dateStr.slice(5); // MM-DD fallback
  }
}

function getSubjectLabel(sid: string, lang: string): string {
  const def = SUBJECT_BY_QUEST_ID[sid];
  if (def?.name) {
    return def.name[lang as 'en' | 'ms' | 'zh'] || def.name.en || sid;
  }
  // Capitalize fallback
  return sid.charAt(0).toUpperCase() + sid.slice(1);
}

// ── Custom Tooltip ──

function CustomTooltip({ active, payload, label, language }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl px-3 py-2.5 shadow-lg"
      style={{
        background: 'rgba(20,16,10,0.95)',
        border: `1px solid ${GOLD}30`,
        backdropFilter: 'blur(8px)',
        minWidth: 140,
      }}
    >
      <p className="mb-1.5" style={{ fontFamily: F, fontSize: 10, color: `${PARCHMENT}70` }}>
        {label}
      </p>
      {payload
        .filter((p: any) => p.value != null)
        .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
        .map((entry: any) => {
          const def = SUBJECT_BY_QUEST_ID[entry.dataKey];
          const icon = def?.icon || '';
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-3 py-0.5">
              <div className="flex items-center gap-1.5">
                {icon && <span className="text-xs">{icon}</span>}
                <span style={{ fontFamily: F, fontSize: 10, color: entry.color }}>
                  {entry.name}
                </span>
              </div>
              <span style={{ fontFamily: F, fontSize: 11, color: GOLD_LIGHT, fontWeight: 700 }}>
                {entry.value}%
              </span>
            </div>
          );
        })}
    </div>
  );
}