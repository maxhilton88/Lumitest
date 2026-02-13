import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts';

interface SpiderWebChartProps {
  data: { subject: string; functionalAge: number; fullMark: number }[];
  /** Optional: child's actual age for reference ring highlight */
  childAge?: number;
  /** Optional: override chart height (default 320) */
  chartHeight?: number;
  /** Optional: override max width (default 380) */
  maxWidth?: number;
}

const GOLD = '#d4a44a';
const GOLD_LIGHT = '#ffeaa7';

/**
 * Spider Web / Radar chart with concentric AGE rings (4, 5, 6, 7).
 * Axes are dynamically determined by the completed quests.
 */
export const SpiderWebChart: React.FC<SpiderWebChartProps> = ({
  data,
  childAge,
  chartHeight = 320,
  maxWidth = 380,
}) => {
  // Custom tick for angle axis (subject names) — pushed outward to avoid overlapping age labels
  const renderSubjectTick = (props: any) => {
    const { x, y, cx, cy, payload } = props;
    const name = payload.value || '';
    // Truncate long names
    const displayName = name.length > 12 ? name.slice(0, 11) + '…' : name;

    // Push label outward from chart center by 14px
    const dx = x - (cx ?? 0);
    const dy = y - (cy ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const offsetPx = 14;
    const ox = x + (dx / dist) * offsetPx;
    const oy = y + (dy / dist) * offsetPx;

    return (
      <text
        x={ox}
        y={oy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={GOLD_LIGHT}
        fontSize={11}
        fontWeight={700}
        style={{
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          fontFamily: "'Cinzel Decorative', serif",
        }}
      >
        {displayName}
      </text>
    );
  };

  // Custom tick for radius axis (age levels) — offset away from the spoke line
  const renderAgeTick = (props: any) => {
    const { x, y, payload } = props;
    const ageValue = payload.value;
    // Only show labels for ages 4-7
    if (ageValue < 4 || ageValue > 7) return null;

    const isChildAge = childAge && ageValue === childAge;

    return (
      <text
        x={x + 6}
        y={y - 6}
        fill={isChildAge ? '#ffeaa7' : 'rgba(200,184,138,0.5)'}
        fontSize={isChildAge ? 11 : 9}
        fontWeight={isChildAge ? 800 : 400}
        style={{
          paintOrder: 'stroke',
          stroke: 'rgba(26,18,10,0.7)',
          strokeWidth: isChildAge ? 3 : 2,
          strokeLinejoin: 'round',
        }}
      >
        {`Age ${ageValue}`}
      </text>
    );
  };

  return (
    <div className="w-full" style={{ maxWidth, margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadarChart cx="50%" cy="50%" outerRadius="65%" data={data}>
          {/* Concentric rings for age levels */}
          <PolarGrid
            stroke="rgba(212,164,74,0.2)"
            gridType="polygon"
          />

          {/* Subject axes */}
          <PolarAngleAxis
            dataKey="subject"
            tick={renderSubjectTick}
            stroke="rgba(212,164,74,0.3)"
          />

          {/* Age scale (3 to 7, so ring at 4, 5, 6, 7) */}
          <PolarRadiusAxis
            domain={[3, 7]}
            tickCount={5}
            tick={renderAgeTick}
            stroke="rgba(212,164,74,0.15)"
            axisLine={false}
          />

          {/* Data polygon — the child's functional age per subject */}
          <Radar
            name="Functional Age"
            dataKey="functionalAge"
            stroke={GOLD}
            fill={GOLD}
            fillOpacity={0.25}
            strokeWidth={2}
            dot={{
              r: 5,
              fill: GOLD_LIGHT,
              stroke: GOLD,
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};