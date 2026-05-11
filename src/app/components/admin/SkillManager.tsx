/**
 * SkillManager.tsx — Admin panel for managing Battle Skills (Aeluris 7-element system)
 *
 * Full CRUD for elemental skills used in Battle Mode:
 * - 7 Aeluris elements: Fire, Water, Wood, Thunder, Earth, Shadow, Gold
 * - Trilingual names + descriptions (EN/BM/ZH)
 * - Subject mapping (which question pool the skill draws from)
 * - Power type (attack/defense/heal/buff/debuff/special)
 * - Base damage + accuracy
 * - Age range targeting
 * - Icon via RPG Asset Manager slug
 * - Custom color + glow for battle UI
 * - Sort order and active toggle
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp,
  Flame, Zap, Mountain, Droplets, Swords,
  Eye, EyeOff, BookOpen,
  Moon, Sparkles, TreePine,
  Download,
} from 'lucide-react';
import {
  fetchBattleSkills, saveBattleSkill, deleteBattleSkill,
  fetchRPGAssets, uploadRPGAsset, invalidateRPGAssetsCache,
  type BattleSkillDef, type RPGAsset,
} from '../../utils/api';

import { ALL_SEED_SPIRITS } from './spirit-seed-data';

// ── Constants (Aeluris 7-element system) ──
const ELEMENTS = ['fire', 'water', 'wood', 'thunder', 'earth', 'shadow', 'gold'] as const;
const SUBJECTS = ['mandarin', 'english', 'math', 'science', 'bm'] as const;
const POWER_TYPES = ['attack', 'defense', 'heal', 'buff', 'debuff', 'special'] as const;

const ELEMENT_META: Record<string, { label: string; icon: any; color: string; bg: string; defaultSubject: string }> = {
  fire:    { label: 'Fire',    icon: Flame,     color: '#e05a2b', bg: 'bg-red-50',    defaultSubject: 'mandarin' },
  water:   { label: 'Water',   icon: Droplets,  color: '#2e7fbf', bg: 'bg-blue-50',   defaultSubject: 'bm' },
  wood:    { label: 'Wood',    icon: TreePine,   color: '#4a9c3f', bg: 'bg-green-50',  defaultSubject: 'science' },
  thunder: { label: 'Thunder', icon: Zap,       color: '#c49a1a', bg: 'bg-yellow-50', defaultSubject: 'english' },
  earth:   { label: 'Earth',   icon: Mountain,  color: '#7a6a52', bg: 'bg-amber-50',  defaultSubject: 'math' },
  shadow:  { label: 'Shadow',  icon: Moon,      color: '#6b4fa8', bg: 'bg-purple-50', defaultSubject: 'bm' },
  gold:    { label: 'Gold',    icon: Sparkles,  color: '#d4a843', bg: 'bg-yellow-50', defaultSubject: 'mandarin' },
};

const POWER_TYPE_META: Record<string, { label: string; emoji: string }> = {
  attack:  { label: 'Attack',  emoji: '⚔️' },
  defense: { label: 'Defense', emoji: '🛡️' },
  heal:    { label: 'Heal',    emoji: '💚' },
  buff:    { label: 'Buff',    emoji: '⬆️' },
  debuff:  { label: 'Debuff',  emoji: '⬇️' },
  special: { label: 'Special', emoji: '🌟' },
};

const SUBJECT_LABELS: Record<string, string> = {
  mandarin: 'Mandarin (Chinese)',
  english: 'English',
  math: 'Mathematics',
  science: 'Science',
  bm: 'Bahasa Melayu',
};

function emptySkill(): Partial<BattleSkillDef> {
  return {
    id: '',
    name: '',
    nameMs: '',
    nameZh: '',
    description: '',
    descriptionMs: '',
    descriptionZh: '',
    subject: 'english',
    element: 'thunder',
    baseDamage: 25,
    accuracy: 95,
    powerType: 'attack',
    iconSlug: '',
    color: '#eab308',
    glowColor: '#fef08a',
    ageMin: 4,
    ageMax: 12,
    sortOrder: 999,
    isActive: true,
  };
}

// ── Extract unique moves from spirit seed data ──
function extractUniqueMoves(): Partial<BattleSkillDef>[] {
  const seen = new Map<string, Partial<BattleSkillDef>>();
  let sortOrder = 1;

  for (const spirit of ALL_SEED_SPIRITS) {
    for (const move of spirit.moves) {
      const slug = move.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (seen.has(slug)) continue;

      const elemMeta = ELEMENT_META[move.element];
      const isStatusMove = move.power === 0;
      // Map category: phys/spec → attack, stat with 0 power → buff
      const powerType = isStatusMove
        ? (move.name.match(/guard|shield|armour|veil|cloak|wall|form/i) ? 'defense'
          : move.name.match(/drain|nightmare|cry|quicksand/i) ? 'debuff'
          : move.name.match(/breath|surge|light|rod/i) ? 'buff'
          : 'buff')
        : 'attack';

      // Accuracy: high-power moves are less accurate
      const accuracy = isStatusMove ? 100
        : move.power >= 120 ? 80
        : move.power >= 90 ? 85
        : move.power >= 60 ? 90
        : 95;

      seen.set(slug, {
        id: slug,
        name: move.name,
        nameMs: '',
        nameZh: '',
        description: `${move.category === 'phys' ? 'Physical' : move.category === 'spec' ? 'Special' : 'Status'} ${elemMeta?.label || move.element} move (Power ${move.power})`,
        descriptionMs: '',
        descriptionZh: '',
        element: move.element,
        subject: elemMeta?.defaultSubject || 'english',
        baseDamage: move.power,
        accuracy,
        powerType,
        iconSlug: '',
        color: elemMeta?.color || '#888888',
        glowColor: (elemMeta?.color || '#888888') + '60',
        ageMin: 4,
        ageMax: 12,
        sortOrder: sortOrder++,
        isActive: true,
      });
    }
  }

  return Array.from(seen.values());
}

export function SkillManager() {
  const [skills, setSkills] = useState<BattleSkillDef[]>([]);
  const [rpgAssets, setRpgAssets] = useState<RPGAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<BattleSkillDef> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skillRes, assetRes] = await Promise.all([
        fetchBattleSkills(),
        fetchRPGAssets(),
      ]);
      setSkills(skillRes.skills || []);
      setRpgAssets(assetRes.assets || []);
    } catch (err: any) {
      console.error('[SkillManager] Load error:', err);
      toast.error(`Failed to load skills: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.id || !editing.name || !editing.subject || !editing.element || editing.baseDamage === undefined) {
      toast.error('Please fill in ID, Name, Element, Subject, and Base Damage');
      return;
    }
    setSaving(true);
    try {
      await saveBattleSkill(editing);
      toast.success(`Skill "${editing.name}" saved`);
      setEditing(null);
      setIsNew(false);
      await load();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteBattleSkill(id);
      toast.success(`Deleted "${name}"`);
      await load();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const getAssetUrl = (slug: string) => {
    if (!slug) return null;
    const asset = rpgAssets.find(a => a.slug === slug);
    return asset?.publicUrl || null;
  };

  // When element changes, auto-set subject + color
  const handleElementChange = (element: string) => {
    const meta = ELEMENT_META[element];
    if (!meta) return;
    setEditing(prev => ({
      ...prev,
      element,
      subject: meta.defaultSubject,
      color: meta.color,
      glowColor: meta.color + '40', // lighter version
    }));
  };

  /** Direct upload icon to R2 as RPG asset, then auto-select slug */
  const handleDirectUpload = async (file: File) => {
    if (!editing) return;
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const slug = `skill-${baseName}-${Date.now().toString(36)}`;
    setUploading(true);
    try {
      await uploadRPGAsset(file, slug, 'icon');
      invalidateRPGAssetsCache();
      const allAssets = await fetchRPGAssets();
      setRpgAssets(allAssets.assets || []);
      setEditing(prev => prev ? { ...prev, iconSlug: slug } : prev);
      toast.success(`Icon uploaded as "${slug}"`);
    } catch (err: any) {
      console.error('[SkillManager] Upload error:', err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  /** Sync all unique moves from spirit-seed-data into battle_skill:* KV entries */
  const handleSyncFromSeeds = async () => {
    const allMoves = extractUniqueMoves();
    const existingIds = new Set(skills.map(s => s.id));
    const newMoves = allMoves.filter(m => !existingIds.has(m.id!));

    if (newMoves.length === 0) {
      toast.info(`All ${allMoves.length} spirit moves already synced. Nothing to do.`);
      return;
    }

    const msg = `Sync ${newMoves.length} new moves from Spirit Compendium?\n\n` +
      `Total unique moves: ${allMoves.length}\n` +
      `Already exist: ${allMoves.length - newMoves.length}\n` +
      `New to create: ${newMoves.length}\n\n` +
      `Existing skills will NOT be overwritten.`;

    if (!confirm(msg)) return;

    setSyncing(true);
    setSyncProgress({ done: 0, total: newMoves.length });
    let created = 0;
    let failed = 0;

    for (const move of newMoves) {
      try {
        await saveBattleSkill(move);
        created++;
      } catch (err: any) {
        console.error(`[SkillManager] Failed to sync "${move.name}":`, err);
        failed++;
      }
      setSyncProgress({ done: created + failed, total: newMoves.length });
    }

    setSyncing(false);
    if (failed > 0) {
      toast.warning(`Synced ${created} moves, ${failed} failed. Check console for details.`);
    } else {
      toast.success(`Successfully synced ${created} battle skills from Spirit Compendium!`);
    }
    await load();
  };

  // ── EDIT FORM ──
  if (editing) {
    const iconUrl = getAssetUrl(editing.iconSlug || '');
    const elemMeta = ELEMENT_META[editing.element || 'thunder'];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New Battle Skill' : `Edit: ${editing.name}`}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(null); setIsNew(false); }}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <X size={14} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* ID */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Skill ID (unique slug)</label>
            <input
              type="text"
              value={editing.id || ''}
              onChange={e => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
              disabled={!isNew}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="e.g. foxfire"
            />
          </div>

          {/* Name (EN) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name (English)</label>
            <input
              type="text"
              value={editing.name || ''}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Foxfire"
            />
          </div>

          {/* Name (BM) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name (Bahasa Melayu)</label>
            <input
              type="text"
              value={editing.nameMs || ''}
              onChange={e => setEditing({ ...editing, nameMs: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Api Rubah"
            />
          </div>

          {/* Name (ZH) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name (Chinese)</label>
            <input
              type="text"
              value={editing.nameZh || ''}
              onChange={e => setEditing({ ...editing, nameZh: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="狐火"
            />
          </div>

          {/* Element */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Element</label>
            <div className="flex gap-1.5">
              {ELEMENTS.map(el => {
                const meta = ELEMENT_META[el];
                const Icon = meta.icon;
                const isActive = editing.element === el;
                return (
                  <button
                    key={el}
                    onClick={() => handleElementChange(el)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs font-medium border transition-all ${
                      isActive
                        ? `${meta.bg} border-current shadow-sm`
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                    style={isActive ? { color: meta.color, borderColor: meta.color + '60' } : undefined}
                  >
                    <Icon size={16} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject (auto-linked from element, but editable) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Subject (Question Pool)
              <span className="text-gray-400 font-normal ml-1">- auto-linked to element</span>
            </label>
            <select
              value={editing.subject || 'english'}
              onChange={e => setEditing({ ...editing, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            >
              {SUBJECTS.map(s => (
                <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 mt-1">
              When this skill is used in battle, questions are pulled from this subject pool.
            </p>
          </div>

          {/* Base Damage */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base Damage</label>
            <input
              type="number"
              value={editing.baseDamage ?? 25}
              onChange={e => setEditing({ ...editing, baseDamage: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              min={1}
              max={200}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Actual damage = baseDamage + ATK - opponent DEF (+ speed/streak bonuses)
            </p>
          </div>

          {/* Accuracy */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Accuracy (%)</label>
            <input
              type="number"
              value={editing.accuracy ?? 95}
              onChange={e => setEditing({ ...editing, accuracy: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              min={0}
              max={100}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Chance the move lands (0-100). Most attacks are 90-100.
            </p>
          </div>

          {/* Power Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Power Type</label>
            <div className="flex flex-wrap gap-1.5">
              {POWER_TYPES.map(pt => {
                const meta = POWER_TYPE_META[pt];
                const isActive = (editing.powerType || 'attack') === pt;
                return (
                  <button
                    key={pt}
                    onClick={() => setEditing({ ...editing, powerType: pt })}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isActive
                        ? 'bg-gray-900 text-white border-gray-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-[11px]">{meta.emoji}</span>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Age Range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Age Range</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editing.ageMin ?? 4}
                onChange={e => setEditing({ ...editing, ageMin: Number(e.target.value) })}
                className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                min={4} max={12}
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="number"
                value={editing.ageMax ?? 12}
                onChange={e => setEditing({ ...editing, ageMax: Number(e.target.value) })}
                className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                min={4} max={12}
              />
              <span className="text-gray-400 text-xs">years old</span>
            </div>
          </div>

          {/* Description (EN) */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Description (English)</label>
            <textarea
              value={editing.description || ''}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              rows={2}
              placeholder="A blazing attack fueled by Mandarin mastery..."
            />
          </div>

          {/* Description (BM) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description (BM)</label>
            <textarea
              value={editing.descriptionMs || ''}
              onChange={e => setEditing({ ...editing, descriptionMs: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              rows={2}
              placeholder="Serangan berapi..."
            />
          </div>

          {/* Description (ZH) */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description (ZH)</label>
            <textarea
              value={editing.descriptionZh || ''}
              onChange={e => setEditing({ ...editing, descriptionZh: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              rows={2}
              placeholder="火焰攻击..."
            />
          </div>

          {/* Icon (RPG Asset slug) */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Skill Icon
            </label>
            <div className="flex items-center gap-3">
              <select
                value={editing.iconSlug || ''}
                onChange={e => setEditing({ ...editing, iconSlug: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="">-- No icon (uses element emoji) --</option>
                {rpgAssets.map(a => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug} ({a.category})
                  </option>
                ))}
              </select>
              {iconUrl ? (
                <img src={iconUrl} alt="" className="w-12 h-12 rounded-lg object-contain bg-gray-100 border" />
              ) : (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center border border-dashed border-gray-300"
                  style={{ background: (editing.color || '#666') + '15' }}
                >
                  {elemMeta && <elemMeta.icon size={20} style={{ color: editing.color || '#666' }} />}
                </div>
              )}
            </div>
            {/* Direct upload */}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleDirectUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Plus size={12} />
                    Upload New Icon
                  </>
                )}
              </button>
              <span className="text-[10px] text-gray-400">
                Or select an existing asset above. No icon = element default.
              </span>
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">UI Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editing.color || '#ffffff'}
                onChange={e => setEditing({ ...editing, color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={editing.color || '#ffffff'}
                onChange={e => setEditing({ ...editing, color: e.target.value })}
                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 font-mono"
                placeholder="#ef4444"
              />
            </div>
          </div>

          {/* Glow Color */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Glow Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={editing.glowColor || '#ffffff'}
                onChange={e => setEditing({ ...editing, glowColor: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={editing.glowColor || '#ffffff'}
                onChange={e => setEditing({ ...editing, glowColor: e.target.value })}
                className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 font-mono"
                placeholder="#fef08a"
              />
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sort Order</label>
            <input
              type="number"
              value={editing.sortOrder ?? 999}
              onChange={e => setEditing({ ...editing, sortOrder: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              min={0}
            />
          </div>

          {/* Active Toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <button
              onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                editing.isActive
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              {editing.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
              {editing.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-900">
          <p className="text-[10px] font-medium text-gray-500 mb-3 uppercase tracking-wider">Battle UI Preview</p>
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center border-2"
              style={{
                background: (editing.color || '#666') + '20',
                borderColor: (editing.color || '#666') + '60',
                boxShadow: `0 0 16px ${(editing.glowColor || editing.color || '#666')}40`,
              }}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="" className="w-8 h-8 object-contain" />
              ) : (
                elemMeta && <elemMeta.icon size={24} style={{ color: editing.color || '#fff' }} />
              )}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{editing.name || 'Skill Name'}</p>
              <p className="text-gray-400 text-xs">
                {ELEMENT_META[editing.element || 'thunder']?.label} · {SUBJECT_LABELS[editing.subject || 'english']} · DMG {editing.baseDamage || 0}
              </p>
              <p className="text-gray-500 text-[10px] mt-0.5">
                {editing.description || 'No description set'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Battle Skills</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Elemental skills for PvP battles. Each skill links to a subject question pool.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncFromSeeds}
            disabled={syncing}
            className="px-3 py-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1.5 disabled:opacity-50"
          >
            {syncing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
                Syncing {syncProgress.done}/{syncProgress.total}...
              </>
            ) : (
              <>
                <Download size={14} /> Sync from Spirits
              </>
            )}
          </button>
          <button
            onClick={() => { setEditing(emptySkill()); setIsNew(true); }}
            className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
          >
            <Plus size={14} /> New Skill
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : skills.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Swords className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-900">No battle skills yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Create your first skill to define the elemental attack system.
            Each skill maps to a school subject — answering questions correctly powers the attack.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={handleSyncFromSeeds}
              disabled={syncing}
              className="px-4 py-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin" />
                  Syncing {syncProgress.done}/{syncProgress.total}...
                </>
              ) : (
                <>
                  <Download size={14} /> Sync All from Spirit Compendium
                </>
              )}
            </button>
            <button
              onClick={() => { setEditing(emptySkill()); setIsNew(true); }}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Manually
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Element legend */}
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Elements:</span>
            {ELEMENTS.map(el => {
              const meta = ELEMENT_META[el];
              const Icon = meta.icon;
              const count = skills.filter(s => s.element === el).length;
              return (
                <div key={el} className="flex items-center gap-1">
                  <Icon size={12} style={{ color: meta.color }} />
                  <span className="text-[11px] text-gray-600">{meta.label}</span>
                  <span className="text-[10px] text-gray-400">({count})</span>
                </div>
              );
            })}
          </div>

          {/* Skill cards */}
          {skills.map(skill => {
            const elemMeta = ELEMENT_META[skill.element] || ELEMENT_META.thunder;
            const ElemIcon = elemMeta.icon;
            const iconUrl = getAssetUrl(skill.iconSlug);
            const isExpanded = expandedId === skill.id;

            return (
              <div
                key={skill.id}
                className={`border rounded-xl overflow-hidden transition-all ${
                  skill.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                {/* Header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : skill.id)}
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border"
                    style={{
                      background: skill.color + '15',
                      borderColor: skill.color + '30',
                    }}
                  >
                    {iconUrl ? (
                      <img src={iconUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <ElemIcon size={18} style={{ color: skill.color }} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 truncate">{skill.name}</span>
                      {!skill.isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 uppercase">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                        style={{ background: skill.color + '15', color: skill.color }}
                      >
                        <ElemIcon size={10} />
                        {elemMeta.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                        <BookOpen size={10} />
                        {SUBJECT_LABELS[skill.subject] || skill.subject}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        DMG {skill.baseDamage}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Age {skill.ageMin}-{skill.ageMax}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setEditing({ ...skill }); setIsNew(false); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(skill.id, skill.name); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-gray-400 font-medium mb-1">ID / Slug</p>
                        <p className="text-gray-700 font-mono text-[11px]">{skill.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-1">Icon Asset</p>
                        <p className="text-gray-700">{skill.iconSlug || '(default element icon)'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-1">Sort Order</p>
                        <p className="text-gray-700">{skill.sortOrder}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-1">Name (BM)</p>
                        <p className="text-gray-700">{skill.nameMs || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-1">Name (ZH)</p>
                        <p className="text-gray-700">{skill.nameZh || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium mb-1">Colors</p>
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded border" style={{ background: skill.color }} />
                          <span className="text-gray-500 font-mono text-[10px]">{skill.color}</span>
                          <div className="w-4 h-4 rounded border ml-1" style={{ background: skill.glowColor }} />
                          <span className="text-gray-500 font-mono text-[10px]">{skill.glowColor}</span>
                        </div>
                      </div>
                      {skill.description && (
                        <div className="col-span-3">
                          <p className="text-gray-400 font-medium mb-1">Description (EN)</p>
                          <p className="text-gray-600">{skill.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}