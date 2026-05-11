/**
 * GoldEconomyManager.tsx — SuperAdmin Gold Economy Settings panel
 *
 * English-only. Manages realm_reward_config stored in KV.
 * Bible v5: Session-based rewards.
 * Part A: Activity Reward Table (6 activities with gold, xp, daily limit, access limits, age gate)
 * Part B: Age-Scaled Rewards (sessionXp + accuracy gold tiers)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Coins, Zap, Shield, Save, RotateCcw, Loader2,
  ToggleLeft, ToggleRight, Swords, BookOpen, Play,
  Music, Gamepad2, GraduationCap, Trophy, Star,
  AlertCircle, Check, ChevronDown, ChevronUp,
  Lock, Crown, Infinity, Users,
} from 'lucide-react';
import { fetchRewardConfig, saveRewardConfig } from '../../utils/api';
import type {
  RealmRewardConfig,
  ActivityType,
  ActivityReward,
  AgeBonusEntry,
} from '../../types/reward-config';
import { DEFAULT_REWARD_CONFIG } from '../../types/reward-config';

const ACTIVITY_META: Record<ActivityType, { label: string; icon: React.ReactNode; desc: string }> = {
  test:      { label: 'Complete a Test',      icon: <GraduationCap className="w-4 h-4" />, desc: 'Session XP + gold via Part B' },
  practice:  { label: 'Complete a Practice',  icon: <BookOpen className="w-4 h-4" />,      desc: 'Session XP + gold via Part B' },
  flashcard: { label: 'Flash Card Session',   icon: <Star className="w-4 h-4" />,          desc: 'Flat reward, age-gated 4-6' },
  video:     { label: 'Watch a Video',        icon: <Play className="w-4 h-4" />,          desc: '0g/0xp — pure content' },
  music:     { label: 'Listen to Music',      icon: <Music className="w-4 h-4" />,         desc: '0g/0xp — pure content' },
  battle:    { label: 'Battle with Friends',  icon: <Gamepad2 className="w-4 h-4" />,      desc: 'Separate battle formula' },
};

const ACTIVITY_ORDER: ActivityType[] = ['test', 'practice', 'flashcard', 'video', 'music', 'battle'];

export function GoldEconomyManager() {
  const [config, setConfig] = useState<RealmRewardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showBonusTable, setShowBonusTable] = useState(true);

  // Load config on mount
  useEffect(() => {
    (async () => {
      try {
        const fetched = await fetchRewardConfig();
        if (fetched) {
          // Migrate v1 → v2: add sessionXp if missing
          if (fetched.ageBonuses && fetched.ageBonuses[0] && fetched.ageBonuses[0].sessionXp === undefined) {
            fetched.ageBonuses = fetched.ageBonuses.map((e: any) => ({
              ...e,
              sessionXp: e.sessionXp ?? Math.round(20 * (1 + (e.age - 4) * 0.375)),
            }));
          }
          setConfig(fetched);
        } else {
          setConfig({ ...DEFAULT_REWARD_CONFIG });
        }
      } catch (err) {
        console.error('[GOLD ECONOMY] Load error:', err);
        toast.error('Failed to load reward config');
        setConfig({ ...DEFAULT_REWARD_CONFIG });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Update activity field
  const updateActivity = useCallback((type: ActivityType, field: keyof ActivityReward, value: any) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        activities: {
          ...prev.activities,
          [type]: { ...prev.activities[type], [field]: value },
        },
      };
    });
    setIsDirty(true);
  }, []);

  // Update age bonus
  const updateAgeBonus = useCallback((ageIdx: number, tier: 'above80' | 'above90' | 'perfect', field: 'gold' | 'xp', value: number) => {
    setConfig(prev => {
      if (!prev) return prev;
      const bonuses = [...prev.ageBonuses];
      bonuses[ageIdx] = {
        ...bonuses[ageIdx],
        [tier]: { ...bonuses[ageIdx][tier], [field]: value },
      };
      return { ...prev, ageBonuses: bonuses };
    });
    setIsDirty(true);
  }, []);

  // Update session XP
  const updateSessionXp = useCallback((ageIdx: number, value: number) => {
    setConfig(prev => {
      if (!prev) return prev;
      const bonuses = [...prev.ageBonuses];
      bonuses[ageIdx] = { ...bonuses[ageIdx], sessionXp: value };
      return { ...prev, ageBonuses: bonuses };
    });
    setIsDirty(true);
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const result = await saveRewardConfig(config);
      if (result.config) setConfig(result.config);
      setIsDirty(false);
      toast.success('Gold Economy settings saved!');
    } catch (err: any) {
      console.error('[GOLD ECONOMY] Save error:', err);
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setConfig({ ...DEFAULT_REWARD_CONFIG, updatedAt: new Date().toISOString() });
    setIsDirty(true);
    toast.info('Reset to v2 defaults — save to apply');
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 text-sm">Loading Gold Economy settings...</span>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            Gold Economy Settings
            <span className="text-xs font-normal text-gray-400 ml-1">v{config.version || 1}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Session-based rewards — applies to all schools
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`px-4 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 transition-all ${
              isDirty
                ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          You have unsaved changes
        </div>
      )}

      {/* ═══ Part A: Activity Reward Table ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            Part A: Activity Reward Table
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Base rewards per activity. Test & Practice use Part B (session-based). Video & Music = 0g/0xp.
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Header row */}
          <div className="gap-2 px-5 py-2 bg-gray-50/50 text-xs font-medium text-gray-500" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.5fr' }}>
            <div>Activity</div>
            <div className="text-center">Gold</div>
            <div className="text-center">XP</div>
            <div className="text-center">Gold Cap</div>
            <div className="text-center">Free/Day</div>
            <div className="text-center">Premium/Day</div>
            <div className="text-center">Age Gate</div>
            <div className="text-center">Info</div>
          </div>

          {ACTIVITY_ORDER.map(type => {
            const meta = ACTIVITY_META[type];
            const act = config.activities[type];
            const isTestOrPractice = type === 'test' || type === 'practice';
            const hasAgeGate = act.ageMin !== undefined || act.ageMax !== undefined;

            return (
              <div key={type} className="gap-2 px-5 py-3 items-center hover:bg-gray-50/50 transition-colors" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1.2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.2fr 1.5fr' }}>
                {/* Activity name */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
                    {meta.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                </div>

                {/* Gold */}
                <div className="flex justify-center">
                  {isTestOrPractice ? (
                    <span className="text-xs text-gray-400 italic">Part B</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={act.gold}
                        onChange={e => updateActivity(type, 'gold', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 px-1.5 py-1 text-sm text-center border border-gray-200 rounded-md focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* XP */}
                <div className="flex justify-center">
                  {isTestOrPractice ? (
                    <span className="text-xs text-gray-400 italic">Part B</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-green-500" />
                      <input
                        type="number"
                        min={0}
                        max={9999}
                        value={act.xp}
                        onChange={e => updateActivity(type, 'xp', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-14 px-1.5 py-1 text-sm text-center border border-gray-200 rounded-md focus:ring-1 focus:ring-green-400 focus:border-green-400 outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Gold Cap Toggle */}
                <div className="flex justify-center">
                  <button
                    onClick={() => updateActivity(type, 'dailyLimit', !act.dailyLimit)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      act.dailyLimit
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-green-50 text-green-700 border border-green-200'
                    }`}
                  >
                    {act.dailyLimit ? (
                      <>
                        <ToggleRight className="w-3.5 h-3.5" />
                        <span>On</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-3.5 h-3.5" />
                        <span>Off</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Free Max/Day */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="number"
                      min={-1}
                      max={999}
                      value={act.freeMaxPerDay ?? -1}
                      onChange={e => updateActivity(type, 'freeMaxPerDay', parseInt(e.target.value) || -1)}
                      className="w-12 px-1 py-1 text-sm text-center border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none"
                      title="-1 = unlimited"
                    />
                  </div>
                </div>

                {/* Premium Max/Day */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5 text-purple-500" />
                    <input
                      type="number"
                      min={-1}
                      max={999}
                      value={act.premiumMaxPerDay ?? -1}
                      onChange={e => updateActivity(type, 'premiumMaxPerDay', parseInt(e.target.value) || -1)}
                      className="w-12 px-1 py-1 text-sm text-center border border-gray-200 rounded-md focus:ring-1 focus:ring-purple-400 focus:border-purple-400 outline-none"
                      title="-1 = unlimited"
                    />
                  </div>
                </div>

                {/* Age Gate */}
                <div className="flex justify-center">
                  {type === 'flashcard' ? (
                    <div className="flex items-center gap-0.5 text-xs">
                      <Users className="w-3 h-3 text-blue-400 mr-0.5" />
                      <input
                        type="number" min={4} max={12}
                        value={act.ageMin ?? 4}
                        onChange={e => updateActivity(type, 'ageMin', Math.max(4, Math.min(12, parseInt(e.target.value) || 4)))}
                        className="w-9 px-0.5 py-1 text-xs text-center border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 outline-none"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="number" min={4} max={12}
                        value={act.ageMax ?? 12}
                        onChange={e => updateActivity(type, 'ageMax', Math.max(4, Math.min(12, parseInt(e.target.value) || 12)))}
                        className="w-9 px-0.5 py-1 text-xs text-center border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </div>

                {/* Info */}
                <div className="text-center">
                  <span className="text-xs text-gray-400">{meta.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-2.5 bg-blue-50 border-t border-blue-100 space-y-1">
          <p className="text-xs text-blue-600 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <strong>Session-based model:</strong> Test & Practice rewards come from Part B. Video & Music = 0g/0xp. Flashcard age-gated.
          </p>
          <p className="text-xs text-blue-600 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <strong>Free/Day</strong> & <strong>Premium/Day</strong> = Max sessions per day.{' '}
            <strong>-1</strong> = Unlimited.
          </p>
        </div>
      </div>

      {/* ═══ Part B: Session XP + Accuracy Gold Bonuses ═══ */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowBonusTable(!showBonusTable)}
          className="w-full px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Part B: Session XP + Accuracy Gold (Test & Practice)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 text-left">
              Session XP always awarded on completion. Gold bonuses only if accuracy ≥80%.
            </p>
          </div>
          {showBonusTable ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showBonusTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 w-20">Age</th>
                  <th className="px-2 py-2.5 text-center text-xs font-medium text-green-600 border-l border-gray-100">
                    <div className="flex items-center justify-center gap-1">
                      <Zap className="w-3 h-3" />
                      Session XP
                    </div>
                  </th>
                  <th className="px-2 py-2.5 text-center text-xs font-medium text-amber-600 border-l border-gray-100">
                    <div className="flex items-center justify-center gap-1">≥80% Gold</div>
                  </th>
                  <th className="px-2 py-2.5 text-center text-xs font-medium text-orange-600 border-l border-gray-100">
                    <div className="flex items-center justify-center gap-1">≥90% Gold</div>
                  </th>
                  <th className="px-2 py-2.5 text-center text-xs font-medium text-red-600 border-l border-gray-100">
                    <div className="flex items-center justify-center gap-1">100% Gold</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {config.ageBonuses.map((entry, idx) => (
                  <tr key={entry.age} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-gray-700">
                          {entry.age}
                        </span>
                      </div>
                    </td>
                    {/* Session XP */}
                    <td className="px-1 py-1.5 border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1">
                        <Zap className="w-3 h-3 text-green-500" />
                        <input
                          type="number" min={0} max={9999}
                          value={entry.sessionXp ?? 0}
                          onChange={e => updateSessionXp(idx, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-1 text-xs text-center border border-green-200 rounded focus:ring-1 focus:ring-green-400 outline-none bg-green-50/30"
                        />
                      </div>
                    </td>
                    {/* ≥80% Gold */}
                    <td className="px-1 py-1.5 border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="w-3 h-3 text-amber-500" />
                        <input
                          type="number" min={0} max={9999}
                          value={entry.above80.gold}
                          onChange={e => updateAgeBonus(idx, 'above80', 'gold', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-1 text-xs text-center border border-gray-200 rounded focus:ring-1 focus:ring-amber-400 outline-none"
                        />
                      </div>
                    </td>
                    {/* ≥90% Gold */}
                    <td className="px-1 py-1.5 border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="w-3 h-3 text-amber-500" />
                        <input
                          type="number" min={0} max={9999}
                          value={entry.above90.gold}
                          onChange={e => updateAgeBonus(idx, 'above90', 'gold', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-1 text-xs text-center border border-gray-200 rounded focus:ring-1 focus:ring-amber-400 outline-none"
                        />
                      </div>
                    </td>
                    {/* 100% Gold */}
                    <td className="px-1 py-1.5 border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1">
                        <Coins className="w-3 h-3 text-amber-500" />
                        <input
                          type="number" min={0} max={9999}
                          value={entry.perfect.gold}
                          onChange={e => updateAgeBonus(idx, 'perfect', 'gold', Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 px-1.5 py-1 text-xs text-center border border-gray-200 rounded focus:ring-1 focus:ring-amber-400 outline-none"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2.5 bg-purple-50 border-t border-purple-100 space-y-1">
          <p className="text-xs text-purple-600 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />
            <strong>Session XP</strong> = always awarded on session completion (even 0% accuracy).
          </p>
          <p className="text-xs text-purple-600 flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
            <strong>Gold bonuses</strong> = only if accuracy ≥80%. Tiers are mutually exclusive (highest wins).
          </p>
        </div>
      </div>

      {/* Config metadata */}
      <div className="text-xs text-gray-400 flex items-center justify-between px-1">
        <span>Version {config.version}</span>
        <span>Last updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Never'}</span>
      </div>
    </div>
  );
}
