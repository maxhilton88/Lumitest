/**
 * PracticeGateManager.tsx — SuperAdmin Practice Gate Settings panel
 *
 * English-only. Manages practice_gate_config stored in KV.
 * Each rule defines: age range + subject + time limit + min questions + passing score.
 * Matching logic: most specific rule wins (exact subject > 'all').
 * If no rule matches a child's age+subject, practice runs in legacy infinite mode.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Save, RotateCcw, Loader2, Plus, Trash2, Clock, BookOpen,
  ToggleLeft, ToggleRight, AlertCircle, Check, GraduationCap,
  Target, Timer, HelpCircle, Copy,
} from 'lucide-react';
import { fetchPracticeGateConfig, savePracticeGateConfig } from '../../utils/api';
import {
  type PracticeGateConfig,
  type PracticeGateRule,
  PRACTICE_SUBJECTS,
  DEFAULT_PRACTICE_GATE_CONFIG,
} from '../../types/practice-gate-config';

function genId() {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function PracticeGateManager() {
  const [config, setConfig] = useState<PracticeGateConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Load config on mount
  useEffect(() => {
    (async () => {
      try {
        const fetched = await fetchPracticeGateConfig();
        if (fetched) {
          setConfig(fetched);
        } else {
          setConfig({ ...DEFAULT_PRACTICE_GATE_CONFIG });
        }
      } catch (err) {
        console.error('[PRACTICE-GATE] Load error:', err);
        toast.error('Failed to load practice gate config');
        setConfig({ ...DEFAULT_PRACTICE_GATE_CONFIG });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      const result = await savePracticeGateConfig(config);
      if (result.config) setConfig(result.config);
      setIsDirty(false);
      toast.success('Practice gate config saved!');
    } catch (err: any) {
      console.error('[PRACTICE-GATE] Save error:', err);
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const handleReset = useCallback(() => {
    setConfig({ ...DEFAULT_PRACTICE_GATE_CONFIG, updatedAt: new Date().toISOString() });
    setIsDirty(true);
    toast.info('Reset to defaults (save to apply)');
  }, []);

  const updateRule = useCallback((ruleId: string, updates: Partial<PracticeGateRule>) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rules: prev.rules.map(r => r.id === ruleId ? { ...r, ...updates } : r),
      };
    });
    setIsDirty(true);
  }, []);

  const addRule = useCallback(() => {
    const newRule: PracticeGateRule = {
      id: genId(),
      ageMin: 4,
      ageMax: 6,
      subject: 'all',
      timeLimitSeconds: 180,
      minQuestions: 5,
      passingScore: 60,
      isActive: true,
    };
    setConfig(prev => {
      if (!prev) return prev;
      return { ...prev, rules: [...prev.rules, newRule] };
    });
    setIsDirty(true);
  }, []);

  const duplicateRule = useCallback((rule: PracticeGateRule) => {
    const dup: PracticeGateRule = { ...rule, id: genId() };
    setConfig(prev => {
      if (!prev) return prev;
      const idx = prev.rules.findIndex(r => r.id === rule.id);
      const rules = [...prev.rules];
      rules.splice(idx + 1, 0, dup);
      return { ...prev, rules };
    });
    setIsDirty(true);
  }, []);

  const deleteRule = useCallback((ruleId: string) => {
    setConfig(prev => {
      if (!prev) return prev;
      return { ...prev, rules: prev.rules.filter(r => r.id !== ruleId) };
    });
    setIsDirty(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading practice gate config...</span>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" />
            Practice Gate Settings
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Configure session rules for practice mode. Each rule sets the time limit, minimum questions,
            and passing score for a specific age range and subject. Unanswered questions when the timer
            runs out count as wrong answers.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              isDirty
                ? 'bg-black text-white hover:bg-gray-800'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Info callout ── */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <HelpCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <div className="text-xs text-indigo-700 space-y-1">
          <p><strong>How matching works:</strong> When a child starts practice, the system finds the best matching rule by age + subject. An exact subject match (e.g. "English") takes priority over "All Subjects". If no rule matches, practice runs in infinite/legacy mode (no timer, no score).</p>
          <p><strong>Timer behavior:</strong> When the timer expires, any remaining unanswered questions (up to the minimum) are counted as wrong. The session ends and shows a summary with the score.</p>
        </div>
      </div>

      {/* ── Rules Table ── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-10">On</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Age Range</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Subject</th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  <span className="flex items-center gap-1"><Timer className="w-3 h-3" />Time Limit</span>
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />Min Questions</span>
                </th>
                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                  <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" />Pass %</span>
                </th>
                <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {config.rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No rules configured. Practice will run in infinite mode for all children.
                  </td>
                </tr>
              )}
              {config.rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onUpdate={updateRule}
                  onDelete={deleteRule}
                  onDuplicate={duplicateRule}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add Rule ── */}
      <button
        onClick={addRule}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all w-full justify-center"
      >
        <Plus className="w-4 h-4" />
        Add Rule
      </button>

      {/* ── Preview ── */}
      {config.rules.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Coverage Preview
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(age => {
              const matchingRules = config.rules.filter(
                r => r.isActive && age >= r.ageMin && age <= r.ageMax
              );
              const hasAll = matchingRules.some(r => r.subject === 'all');
              const specificSubjects = matchingRules.filter(r => r.subject !== 'all').map(r => r.subject);
              return (
                <div
                  key={age}
                  className={`px-3 py-2 rounded-lg border text-center ${
                    matchingRules.length > 0
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="text-xs font-bold text-gray-700">Age {age}</div>
                  {matchingRules.length > 0 ? (
                    <div className="text-[10px] text-green-700 mt-0.5">
                      {hasAll ? 'All subjects' : specificSubjects.join(', ')}
                      <br />
                      {matchingRules.length} rule{matchingRules.length > 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] text-red-600 mt-0.5">No rules (infinite)</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Last updated ── */}
      {config.updatedAt && (
        <p className="text-[11px] text-gray-400 text-right">
          Last updated: {new Date(config.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   RULE ROW
   ═══════════════════════════════════════════════ */
function RuleRow({
  rule,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  rule: PracticeGateRule;
  onUpdate: (id: string, updates: Partial<PracticeGateRule>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (rule: PracticeGateRule) => void;
}) {
  const dimmed = !rule.isActive;

  return (
    <tr className={`transition-colors ${dimmed ? 'opacity-50 bg-gray-50/50' : 'hover:bg-gray-50/50'}`}>
      {/* Toggle */}
      <td className="px-4 py-3">
        <button onClick={() => onUpdate(rule.id, { isActive: !rule.isActive })}>
          {rule.isActive
            ? <ToggleRight className="w-5 h-5 text-green-500" />
            : <ToggleLeft className="w-5 h-5 text-gray-400" />
          }
        </button>
      </td>

      {/* Age Range */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <select
            value={rule.ageMin}
            onChange={(e) => {
              const v = Number(e.target.value);
              onUpdate(rule.id, { ageMin: v, ageMax: Math.max(v, rule.ageMax) });
            }}
            className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <span className="text-gray-400 text-xs">to</span>
          <select
            value={rule.ageMax}
            onChange={(e) => onUpdate(rule.id, { ageMax: Number(e.target.value) })}
            className="w-14 px-1.5 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
          >
            {[4, 5, 6, 7, 8, 9, 10, 11, 12].filter(a => a >= rule.ageMin).map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </td>

      {/* Subject */}
      <td className="px-4 py-3">
        <select
          value={rule.subject}
          onChange={(e) => onUpdate(rule.id, { subject: e.target.value })}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300 min-w-[120px]"
        >
          {PRACTICE_SUBJECTS.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </td>

      {/* Time Limit */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={30}
            max={3600}
            step={30}
            value={rule.timeLimitSeconds}
            onChange={(e) => onUpdate(rule.id, { timeLimitSeconds: Math.max(30, Number(e.target.value)) })}
            className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <span className="text-[10px] text-gray-400">{formatTime(rule.timeLimitSeconds)}</span>
        </div>
      </td>

      {/* Min Questions */}
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          max={100}
          value={rule.minQuestions}
          onChange={(e) => onUpdate(rule.id, { minQuestions: Math.max(1, Number(e.target.value)) })}
          className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </td>

      {/* Pass % */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={rule.passingScore}
            onChange={(e) => onUpdate(rule.id, { passingScore: Math.max(0, Math.min(100, Number(e.target.value))) })}
            className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <span className="text-[10px] text-gray-400">%</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onDuplicate(rule)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title="Duplicate rule"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(rule.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
            title="Delete rule"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}
