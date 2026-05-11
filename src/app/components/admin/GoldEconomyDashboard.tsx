/**
 * GoldEconomyDashboard.tsx — SuperAdmin Gold Economy Analytics
 *
 * Shows economy health metrics: total gold minted, in circulation, spent,
 * Gini coefficient (wealth inequality), gold bracket distribution,
 * level distribution, bag slot usage, top holders, and activity metrics.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Coins, Diamond, Zap, Users, TrendingUp, Crown, RefreshCw,
  Loader2, AlertTriangle, ArrowUpRight, Package, BarChart3,
  Activity, Gauge, Scale,
} from 'lucide-react';
import { fetchEconomyAnalytics } from '../../utils/api';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444', '#6b7280'];

interface EconomyAnalytics {
  totalUsers: number;
  active7d: number;
  active30d: number;
  supply: {
    totalGoldInCirculation: number;
    totalGoldSpent: number;
    totalGoldMinted: number;
    totalDiamondInCirculation: number;
    totalDiamondSpent: number;
    totalXp: number;
  };
  averages: { avgGold: number; avgDiamond: number; medianGold: number };
  maxHolders: {
    gold: { amount: number; userId: string };
    diamond: { amount: number; userId: string };
    level: { level: number; userId: string };
  };
  giniCoefficient: number;
  goldBrackets: Array<{ label: string; count: number }>;
  levelDistribution: Array<{ level: number; count: number }>;
  bagSlotDistribution: Array<{ slots: number; count: number }>;
}

export function GoldEconomyDashboard() {
  const [data, setData] = useState<EconomyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchEconomyAnalytics();
      setData(result);
    } catch (err: any) {
      console.error('[ECONOMY] Load error:', err);
      setError(err.message);
      toast.error(`Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">Loading economy analytics...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-3">{error || 'No data available'}</p>
        <button onClick={load} className="px-4 py-2 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800">
          Retry
        </button>
      </div>
    );
  }

  const velocityRate = data.supply.totalGoldMinted > 0
    ? ((data.supply.totalGoldSpent / data.supply.totalGoldMinted) * 100).toFixed(1)
    : '0.0';

  // Gini health label
  const giniLabel = data.giniCoefficient < 0.3 ? 'Low inequality'
    : data.giniCoefficient < 0.5 ? 'Moderate inequality'
    : data.giniCoefficient < 0.7 ? 'High inequality'
    : 'Very high inequality';
  const giniColor = data.giniCoefficient < 0.3 ? '#16a34a'
    : data.giniCoefficient < 0.5 ? '#d97706'
    : '#dc2626';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Gold Economy Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time economy health &amp; wealth distribution
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ═══ Row 1: Key Metrics ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Users} label="Total Players" value={data.totalUsers.toLocaleString()} color="#6b7280" />
        <MetricCard icon={Activity} label="Active (7d)" value={data.active7d.toLocaleString()} color="#16a34a"
          subtitle={`${data.totalUsers > 0 ? ((data.active7d / data.totalUsers) * 100).toFixed(0) : 0}% of total`} />
        <MetricCard icon={Activity} label="Active (30d)" value={data.active30d.toLocaleString()} color="#2563eb"
          subtitle={`${data.totalUsers > 0 ? ((data.active30d / data.totalUsers) * 100).toFixed(0) : 0}% of total`} />
        <MetricCard icon={Crown} label="Max Level" value={String(data.maxHolders.level.level)} color="#8b5cf6"
          subtitle={data.maxHolders.level.userId.slice(0, 8) + '...'} />
      </div>

      {/* ═══ Row 2: Gold Supply ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Coins className="w-4 h-4 text-amber-500" />
          Gold Supply
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Total Minted</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{data.supply.totalGoldMinted.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">In Circulation</p>
            <p className="text-xl font-bold text-amber-500 mt-1">{data.supply.totalGoldInCirculation.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Spent (Sinks)</p>
            <p className="text-xl font-bold text-gray-700 mt-1">{data.supply.totalGoldSpent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Velocity Rate</p>
            <p className="text-xl font-bold mt-1" style={{ color: parseFloat(velocityRate) > 30 ? '#16a34a' : '#d97706' }}>
              {velocityRate}%
            </p>
            <p className="text-[9px] text-gray-400 mt-0.5">spent / minted</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Avg Gold / Player</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{data.averages.avgGold.toLocaleString()}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">median: {data.averages.medianGold.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* ═══ Row 3: Diamond Supply + Gini ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Diamond className="w-4 h-4 text-purple-500" />
            Diamond Supply
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">In Circulation</p>
              <p className="text-lg font-bold text-purple-600 mt-1">{data.supply.totalDiamondInCirculation.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Spent</p>
              <p className="text-lg font-bold text-gray-700 mt-1">{data.supply.totalDiamondSpent.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Avg / Player</p>
              <p className="text-lg font-bold text-gray-800 mt-1">{data.averages.avgDiamond.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Scale className="w-4 h-4" style={{ color: giniColor }} />
            Wealth Inequality (Gini)
          </h3>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold" style={{ color: giniColor }}>{data.giniCoefficient.toFixed(3)}</p>
              <p className="text-xs mt-1" style={{ color: giniColor }}>{giniLabel}</p>
            </div>
            <div className="flex-1">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(data.giniCoefficient * 100, 100)}%`,
                    background: `linear-gradient(90deg, #16a34a, #d97706, #dc2626)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                <span>0 (equal)</span>
                <span>1 (unequal)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Row 4: Gold Bracket Distribution + Top Holders ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Gold Distribution by Bracket
          </h3>
          {data.goldBrackets.length === 0 ? (
            <p className="text-xs text-gray-300 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.goldBrackets}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Players" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-amber-500" />
            Top Holders
          </h3>
          <div className="space-y-3">
            <TopHolderRow
              icon={<Coins className="w-4 h-4 text-amber-500" />}
              label="Most Gold"
              value={`${data.maxHolders.gold.amount.toLocaleString()} gold`}
              userId={data.maxHolders.gold.userId}
              color="#f59e0b"
            />
            <TopHolderRow
              icon={<Diamond className="w-4 h-4 text-purple-500" />}
              label="Most Diamonds"
              value={`${data.maxHolders.diamond.amount.toLocaleString()} diamonds`}
              userId={data.maxHolders.diamond.userId}
              color="#8b5cf6"
            />
            <TopHolderRow
              icon={<ArrowUpRight className="w-4 h-4 text-green-500" />}
              label="Highest Level"
              value={`Level ${data.maxHolders.level.level}`}
              userId={data.maxHolders.level.userId}
              color="#16a34a"
            />
          </div>

          {/* XP total */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Zap className="w-3 h-3 text-green-500" /> Total XP minted
            </span>
            <span className="text-sm font-bold text-gray-800">{data.supply.totalXp.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ═══ Row 5: Level Distribution + Bag Slots ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            Level Distribution
          </h3>
          {data.levelDistribution.length === 0 ? (
            <p className="text-xs text-gray-300 py-8 text-center">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.levelDistribution}>
                <XAxis dataKey="level" tick={{ fontSize: 10 }} label={{ value: 'Level', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Players" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-teal-500" />
            Bag Slot Distribution
          </h3>
          {data.bagSlotDistribution.length === 0 ? (
            <p className="text-xs text-gray-300 py-8 text-center">No data</p>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={data.bagSlotDistribution}
                    dataKey="count"
                    nameKey="slots"
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    innerRadius={30}
                    label={({ slots }: any) => `${slots}s`}
                    labelLine={false}
                  >
                    {data.bagSlotDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: any) => [`${v} players`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {data.bagSlotDistribution.map((entry, i) => (
                  <div key={entry.slots} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-gray-600">{entry.slots} slots</span>
                    <span className="ml-auto font-medium text-gray-800">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function MetricCard({ icon: Icon, label, value, color, subtitle }: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}12` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function TopHolderRow({ icon, label, value, userId, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  userId: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-700">{label}</p>
        <p className="text-sm font-bold" style={{ color }}>{value}</p>
      </div>
      <span className="text-[9px] text-gray-400 font-mono truncate max-w-[80px]">{userId}</span>
    </div>
  );
}
