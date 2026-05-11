/**
 * RPGSpiritManager.tsx — Admin CRUD for Aeluris spirits.
 * Supports dual-type, stat multipliers (HP/ATK/DEF), move categories,
 * region-based organization, Foxy evolution stages, and bulk seeding.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, X, Loader2, ChevronDown, ChevronUp,
  AlertCircle, Edit2, Swords, Star, Download, Search, Filter,
  Sparkles, Crown, Copy,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  rpgGameListEntities, rpgGameSaveEntity, rpgGameDeleteEntity,
  rpgGameSignedUrls,
} from '../../utils/api';
import { RPGMultiSlotUploader } from './RPGAssetUploader';
import {
  ELEMENTS, RARITIES, REGIONS, MOVE_CATEGORIES, SPIRIT_ASSET_SLOTS,
  type SpiritEntity, type SpiritMove, type ElementId, type RarityId,
  type MoveCategoryId, type RegionId,
} from './rpg-types';


const GOLD = '#d4a44a';

function newSpiritDefaults(): Omit<SpiritEntity, 'createdAt' | 'updatedAt'> {
  return {
    id: '',
    type: 'spirit',
    spiritNumber: 0,
    name: '',
    types: ['fire'],
    regionId: 'thornhaven',
    zoneDescription: '',
    rarity: 'common',
    statMultipliers: { hp: 1.0, atk: 1.0, def: 1.0 },
    moves: [{ name: '', element: 'fire', power: 30, category: 'phys' }],
    assets: {},
  };
}

export function RPGSpiritManager() {
  const [spirits, setSpirits] = useState<SpiritEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [editingSpirit, setEditingSpirit] = useState<SpiritEntity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFoxy, setShowFoxy] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const spiritList = await rpgGameListEntities('spirit');
      setSpirits(spiritList as unknown as SpiritEntity[]);

      const allPaths: string[] = [];
      for (const s of spiritList as any[]) {
        if (s.assets) Object.values(s.assets).forEach((p: any) => { if (p) allPaths.push(p); });
      }
      if (allPaths.length > 0) {
        const urls = await rpgGameSignedUrls(allPaths);
        setSignedUrls(urls);
      }
    } catch (err: any) {
      toast.error(`Failed to load spirits: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const startNew = () => {
    const defaults = newSpiritDefaults();
    defaults.id = `spirit-${Date.now().toString(36)}`;
    // Set spirit number to next available
    const maxNum = Math.max(0, ...spirits.map(s => (s as any).spiritNumber || 0));
    defaults.spiritNumber = maxNum + 1;
    setEditingSpirit(defaults as SpiritEntity);
    setIsNew(true);
  };

  const startEdit = (spirit: SpiritEntity) => {
    // Migrate old format if needed
    const migrated: SpiritEntity = {
      ...spirit,
      types: spirit.types || (spirit.element ? [spirit.element] : ['fire']),
      regionId: spirit.regionId || ('thornhaven' as RegionId),
      zoneDescription: spirit.zoneDescription || '',
      spiritNumber: spirit.spiritNumber || 0,
      statMultipliers: spirit.statMultipliers || {
        hp: (spirit.stats?.hp || 40) / 40,
        atk: (spirit.stats?.atk || 10) / 10,
        def: (spirit.stats?.def || 8) / 8,
      },
      moves: (spirit.moves || []).map(m => ({
        ...m,
        category: (m as any).category || 'phys' as MoveCategoryId,
      })),
      assets: { ...spirit.assets },
    };
    setEditingSpirit(migrated);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editingSpirit) return;
    if (!editingSpirit.name.trim()) { toast.error('Spirit name is required'); return; }
    setSaving(true);
    try {
      await rpgGameSaveEntity('spirit', editingSpirit.id, editingSpirit);
      toast.success(`Spirit "${editingSpirit.name}" saved`);
      setEditingSpirit(null);
      loadData();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
      return;
    }
    try {
      await rpgGameDeleteEntity('spirit', id);
      toast.success('Spirit deleted');
      setConfirmDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const updateField = (field: string, value: any) => {
    if (!editingSpirit) return;
    setEditingSpirit({ ...editingSpirit, [field]: value });
  };

  const updateStatMultiplier = (stat: string, value: number) => {
    if (!editingSpirit) return;
    setEditingSpirit({
      ...editingSpirit,
      statMultipliers: { ...editingSpirit.statMultipliers, [stat]: value },
    });
  };

  const updateMove = (idx: number, field: string, value: any) => {
    if (!editingSpirit) return;
    const moves = [...editingSpirit.moves];
    moves[idx] = { ...moves[idx], [field]: value };
    updateField('moves', moves);
  };

  const addMove = () => {
    if (!editingSpirit) return;
    if (editingSpirit.moves.length >= 4) { toast.error('Max 4 moves per spirit'); return; }
    updateField('moves', [...editingSpirit.moves, {
      name: '', element: editingSpirit.types[0] || 'fire', power: 30, category: 'phys' as MoveCategoryId,
    }]);
  };

  const removeMove = (idx: number) => {
    if (!editingSpirit) return;
    const moves = [...editingSpirit.moves];
    moves.splice(idx, 1);
    updateField('moves', moves);
  };

  const toggleType = (typeId: ElementId) => {
    if (!editingSpirit) return;
    const current = editingSpirit.types || [];
    if (current.includes(typeId)) {
      if (current.length <= 1) return; // must have at least 1
      updateField('types', current.filter(t => t !== typeId));
    } else {
      if (current.length >= 2) {
        // Replace second type
        updateField('types', [current[0], typeId]);
      } else {
        updateField('types', [...current, typeId]);
      }
    }
  };

  const handleAssetChange = (key: string, path: string | null) => {
    if (!editingSpirit) return;
    const newAssets = { ...editingSpirit.assets };
    if (path) newAssets[key as keyof typeof newAssets] = path;
    else delete newAssets[key as keyof typeof newAssets];
    setEditingSpirit({ ...editingSpirit, assets: newAssets });
  };

  const elementInfo = (id: string) => ELEMENTS.find(e => e.id === id) || ELEMENTS[0];
  const rarityInfo = (id: string) => RARITIES.find(r => r.id === id) || RARITIES[0];
  const regionInfo = (id: string) => REGIONS.find(r => r.id === id);

  // Filter spirits
  const filteredSpirits = spirits.filter(s => {
    const spirit = s as any;
    if (filterRegion !== 'all') {
      const regionId = spirit.regionId || '';
      if (regionId !== filterRegion) return false;
    }
    if (filterType !== 'all') {
      const types = spirit.types || (spirit.element ? [spirit.element] : []);
      if (!types.includes(filterType)) return false;
    }
    if (!showFoxy && spirit.isFoxy) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!(spirit.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by region
  const groupedByRegion = REGIONS.reduce((acc, region) => {
    const regionSpirits = filteredSpirits.filter((s: any) => (s.regionId || '') === region.id);
    if (regionSpirits.length > 0) acc.push({ region, spirits: regionSpirits });
    return acc;
  }, [] as { region: typeof REGIONS[number]; spirits: SpiritEntity[] }[]);

  // Ungrouped (old spirits without regionId)
  const ungrouped = filteredSpirits.filter((s: any) => !s.regionId || !REGIONS.find(r => r.id === s.regionId));

  // ── Edit Form ──
  if (editingSpirit) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <Swords className="w-4 h-4" />
            {isNew ? 'New Spirit' : `Edit: ${editingSpirit.name}`}
            {editingSpirit.isFoxy && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-3 h-3 inline mr-0.5" />FOXY STAGE {editingSpirit.foxyStage}
              </span>
            )}
          </h3>
          <button onClick={() => setEditingSpirit(null)} className="p-1.5 hover:bg-gray-700 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Spirit Number + Name */}
        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">#</label>
            <input
              type="number"
              min={0}
              value={editingSpirit.spiritNumber || 0}
              onChange={e => updateField('spiritNumber', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none text-center font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
            <input
              type="text"
              value={editingSpirit.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="e.g. Leafpup"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Dual Type picker */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Types <span className="text-gray-600">(tap to add/remove, max 2)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ELEMENTS.map(el => {
              const isSelected = (editingSpirit.types || []).includes(el.id);
              const idx = (editingSpirit.types || []).indexOf(el.id);
              return (
                <button
                  key={el.id}
                  onClick={() => toggleType(el.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    isSelected
                      ? 'border-current bg-current/15 text-white'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}
                  style={isSelected ? { color: el.color, borderColor: el.color } : undefined}
                >
                  <span>{el.emoji}</span>
                  {el.label}
                  {isSelected && <span className="ml-0.5 text-[9px] opacity-60">({idx === 0 ? '1st' : '2nd'})</span>}
                </button>
              );
            })}
          </div>
          {(editingSpirit.types || []).length === 2 && (
            <p className="text-[10px] text-amber-500/70 mt-1">
              Dual-type: {ELEMENTS.find(e => e.id === editingSpirit.types[0])?.emoji} {editingSpirit.types[0]} / {ELEMENTS.find(e => e.id === editingSpirit.types[1])?.emoji} {editingSpirit.types[1]}
            </p>
          )}
        </div>

        {/* Region + Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Region</label>
            <select
              value={editingSpirit.regionId || ''}
              onChange={e => updateField('regionId', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            >
              {REGIONS.map(r => (
                <option key={r.id} value={r.id}>
                  {r.emoji} R{r.number} {r.label} (Lv {r.levelRange})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Zone/Catch Location</label>
            <input
              type="text"
              value={editingSpirit.zoneDescription || ''}
              onChange={e => updateField('zoneDescription', e.target.value)}
              placeholder="e.g. Meadow Path — tall grass"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Rarity picker */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Rarity</label>
          <div className="flex flex-wrap gap-1.5">
            {RARITIES.map(r => (
              <button
                key={r.id}
                onClick={() => updateField('rarity', r.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  editingSpirit.rarity === r.id
                    ? 'border-current bg-current/15'
                    : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                }`}
                style={editingSpirit.rarity === r.id ? { color: r.color, borderColor: r.color } : undefined}
              >
                {'⭐'.repeat(r.stars)}
                <span className="ml-0.5">{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stat Multipliers */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Stat Multipliers <span className="text-gray-600">(applied to Lumi's base stats)</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {(['hp', 'atk', 'def'] as const).map(stat => (
              <div key={stat} className="bg-gray-900 rounded-lg p-3 text-center">
                <label className="block text-[10px] text-gray-500 mb-1 uppercase font-bold">{stat}</label>
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="number"
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    value={editingSpirit.statMultipliers?.[stat] || 1.0}
                    onChange={e => updateStatMultiplier(stat, parseFloat(e.target.value) || 1.0)}
                    className="w-16 px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:border-amber-500 focus:outline-none text-center font-mono"
                  />
                  <span className="text-gray-500 text-xs">x</span>
                </div>
                <p className={`text-[10px] mt-1 ${
                  (editingSpirit.statMultipliers?.[stat] || 1) > 1 ? 'text-emerald-500' :
                  (editingSpirit.statMultipliers?.[stat] || 1) < 1 ? 'text-red-400' : 'text-gray-600'
                }`}>
                  {(editingSpirit.statMultipliers?.[stat] || 1) > 1 ? '+' : ''}
                  {Math.round(((editingSpirit.statMultipliers?.[stat] || 1) - 1) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Foxy fields */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-400 mb-2">
            <input
              type="checkbox"
              checked={editingSpirit.isFoxy || false}
              onChange={e => updateField('isFoxy', e.target.checked)}
              className="rounded border-gray-600"
            />
            This is a Foxy evolution stage
          </label>
          {editingSpirit.isFoxy && (
            <div className="grid grid-cols-2 gap-3 pl-5">
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Stage (1-4)</label>
                <input
                  type="number" min={1} max={4}
                  value={editingSpirit.foxyStage || 1}
                  onChange={e => updateField('foxyStage', parseInt(e.target.value) || 1)}
                  className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white text-center"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-0.5">Evolves At</label>
                <input
                  type="text"
                  value={editingSpirit.foxyEvolvesAt || ''}
                  onChange={e => updateField('foxyEvolvesAt', e.target.value)}
                  placeholder="e.g. Level 5"
                  className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Moves */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">
            Moves ({editingSpirit.moves.length}/4)
          </label>
          <div className="space-y-2">
            {editingSpirit.moves.map((move, idx) => {
              const mElem = elementInfo(move.element);
              const mCat = MOVE_CATEGORIES.find(c => c.id === move.category) || MOVE_CATEGORIES[0];
              return (
                <div key={idx} className="bg-gray-800/60 rounded-lg p-2.5 border border-gray-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono w-4">{idx + 1}</span>
                    <input
                      type="text"
                      value={move.name}
                      onChange={e => updateMove(idx, 'name', e.target.value)}
                      placeholder="Move name"
                      className="flex-1 px-2 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white focus:outline-none"
                    />
                    <button
                      onClick={() => removeMove(idx)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <select
                      value={move.element}
                      onChange={e => updateMove(idx, 'element', e.target.value)}
                      className="w-28 px-1.5 py-1 text-[11px] bg-gray-900 border border-gray-700 rounded text-white"
                    >
                      {ELEMENTS.map(el => (
                        <option key={el.id} value={el.id}>{el.emoji} {el.label}</option>
                      ))}
                    </select>
                    <select
                      value={move.category || 'phys'}
                      onChange={e => updateMove(idx, 'category', e.target.value)}
                      className="w-24 px-1.5 py-1 text-[11px] bg-gray-900 border border-gray-700 rounded"
                      style={{ color: mCat.color }}
                    >
                      {MOVE_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id} style={{ color: c.color }}>{c.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-500">PWR</span>
                      <input
                        type="number"
                        min={0}
                        value={move.power}
                        onChange={e => updateMove(idx, 'power', parseInt(e.target.value) || 0)}
                        className="w-14 px-1 py-1 text-xs bg-gray-900 border border-gray-700 rounded text-white text-center"
                      />
                    </div>
                    {move.power === 0 && (
                      <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">Status</span>
                    )}
                  </div>
                </div>
              );
            })}
            {editingSpirit.moves.length < 4 && (
              <button
                onClick={addMove}
                className="w-full py-1.5 text-xs text-gray-500 border border-dashed border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-400 transition-colors"
              >
                + Add Move ({editingSpirit.moves.length}/4)
              </button>
            )}
          </div>
        </div>

        {/* Asset slots */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-3">Spirit Assets</label>
          <RPGMultiSlotUploader
            entityType="spirit"
            entityId={editingSpirit.id}
            slots={SPIRIT_ASSET_SLOTS}
            assets={editingSpirit.assets as Record<string, string>}
            signedUrls={signedUrls}
            onAssetChange={handleAssetChange}
          />
        </div>

        {/* Save */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setEditingSpirit(null)}
            className="px-4 py-2.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editingSpirit.name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Spirit'}
          </button>
        </div>
      </div>
    );
  }

  // ── Spirit List ──
  const totalSpirits = spirits.length;
  const foxyCount = spirits.filter((s: any) => s.isFoxy).length;
  const wildCount = totalSpirits - foxyCount;
  const assetComplete = spirits.filter(s => {
    const a = s.assets || {};
    return a.overworld && a.battle && a.hurt && a.icon;
  }).length;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="px-2 py-1 rounded-full bg-gray-800 text-gray-400">
          {totalSpirits} total
        </span>
        <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">
          <Crown className="w-3 h-3 inline mr-0.5" />{foxyCount} Foxy stage{foxyCount !== 1 ? 's' : ''}
        </span>
        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400">
          {wildCount}/35 wild
        </span>
        <span className={`px-2 py-1 rounded-full ${assetComplete === totalSpirits ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {assetComplete}/{totalSpirits} assets complete
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Spirit
        </button>

      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-2 py-1.5 flex-1 min-w-[140px]">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search spirits..."
            className="bg-transparent text-xs text-white outline-none flex-1"
          />
        </div>
        <select
          value={filterRegion}
          onChange={e => setFilterRegion(e.target.value)}
          className="px-2 py-1.5 text-[11px] bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Regions</option>
          {REGIONS.map(r => (
            <option key={r.id} value={r.id}>{r.emoji} R{r.number} {r.label}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="px-2 py-1.5 text-[11px] bg-gray-800 border border-gray-700 rounded-lg text-white"
        >
          <option value="all">All Types</option>
          {ELEMENTS.map(el => (
            <option key={el.id} value={el.id}>{el.emoji} {el.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowFoxy(!showFoxy)}
          className={`px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
            showFoxy ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-500'
          }`}
        >
          <Crown className="w-3 h-3 inline mr-0.5" />Foxy
        </button>
      </div>

      {/* Spirit list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : filteredSpirits.length === 0 ? (
        <div className="text-center py-12">
          <Swords className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            {totalSpirits === 0 ? 'No spirits yet — create one or seed via admin' : 'No spirits match filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Grouped by region */}
          {groupedByRegion.map(({ region, spirits: regionSpirits }) => (
            <div key={region.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                  {region.emoji} R{region.number} {region.label}
                </span>
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-[10px] text-gray-600">Lv {region.levelRange}</span>
                <span className="text-[10px] text-gray-600">{regionSpirits.length} spirit{regionSpirits.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-1.5">
                {regionSpirits.map(spirit => (
                  <SpiritCard
                    key={spirit.id}
                    spirit={spirit}
                    expanded={expandedId === spirit.id}
                    onToggle={() => setExpandedId(expandedId === spirit.id ? null : spirit.id)}
                    onEdit={() => startEdit(spirit)}
                    onDelete={() => handleDelete(spirit.id)}
                    confirmingDelete={confirmDelete === spirit.id}
                    signedUrls={signedUrls}
                    elementInfo={elementInfo}
                    rarityInfo={rarityInfo}
                    regionInfo={regionInfo}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Ungrouped (old format) */}
          {ungrouped.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                  Unassigned Region
                </span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <div className="space-y-1.5">
                {ungrouped.map(spirit => (
                  <SpiritCard
                    key={spirit.id}
                    spirit={spirit}
                    expanded={expandedId === spirit.id}
                    onToggle={() => setExpandedId(expandedId === spirit.id ? null : spirit.id)}
                    onEdit={() => startEdit(spirit)}
                    onDelete={() => handleDelete(spirit.id)}
                    confirmingDelete={confirmDelete === spirit.id}
                    signedUrls={signedUrls}
                    elementInfo={elementInfo}
                    rarityInfo={rarityInfo}
                    regionInfo={regionInfo}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spirit Card Component ──
function SpiritCard({
  spirit, expanded, onToggle, onEdit, onDelete, confirmingDelete,
  signedUrls, elementInfo, rarityInfo, regionInfo,
}: {
  spirit: SpiritEntity;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  signedUrls: Record<string, string>;
  elementInfo: (id: string) => typeof ELEMENTS[number];
  rarityInfo: (id: string) => typeof RARITIES[number];
  regionInfo: (id: string) => typeof REGIONS[number] | undefined;
}) {
  const s = spirit as any;
  const types: ElementId[] = s.types || (s.element ? [s.element] : ['fire']);
  const rarity = rarityInfo(spirit.rarity);
  const assetCount = Object.values(spirit.assets || {}).filter(Boolean).length;
  const isFoxy = s.isFoxy;
  const num = s.spiritNumber || 0;

  return (
    <div className={`bg-gray-800/60 border rounded-xl overflow-hidden ${
      isFoxy ? 'border-amber-500/30' : 'border-gray-700'
    }`}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800 transition-colors"
        onClick={onToggle}
      >
        {/* Icon preview */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border ${
          isFoxy ? 'bg-amber-900/30 border-amber-500/30' : 'bg-gray-900 border-gray-700'
        }`}>
          {spirit.assets?.icon && signedUrls[spirit.assets.icon] ? (
            <img src={signedUrls[spirit.assets.icon]} className="w-full h-full object-contain" alt="" />
          ) : isFoxy ? (
            <Crown className="w-4 h-4 text-amber-400" />
          ) : (
            <span className="text-sm">{elementInfo(types[0]).emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {num > 0 && <span className="text-[9px] font-mono text-gray-600">#{String(num).padStart(3, '0')}</span>}
            {isFoxy && <Crown className="w-3 h-3 text-amber-400" />}
            <p className="text-sm font-bold text-white truncate">{spirit.name || 'Unnamed'}</p>
            {/* Type badges */}
            {types.map((t: ElementId) => {
              const el = elementInfo(t);
              return (
                <span
                  key={t}
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                  style={{ background: `${el.color}20`, color: el.color }}
                >
                  {el.emoji}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: rarity.color }}>
              {'⭐'.repeat(rarity.stars)} {rarity.label}
            </span>
            <span className="text-[10px] text-gray-600">|</span>
            <span className={`text-[10px] ${assetCount === 4 ? 'text-emerald-500' : assetCount > 0 ? 'text-amber-500' : 'text-red-500'}`}>
              {assetCount}/4 art
            </span>
            {isFoxy && s.foxyStage && (
              <>
                <span className="text-[10px] text-gray-600">|</span>
                <span className="text-[10px] text-amber-400">Stage {s.foxyStage}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1.5 hover:bg-gray-700 rounded-lg">
            <Edit2 className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className={`p-1.5 rounded-lg ${confirmingDelete ? 'bg-red-500/20' : 'hover:bg-gray-700'}`}
          >
            {confirmingDelete ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> : <Trash2 className="w-3.5 h-3.5 text-gray-500" />}
          </button>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-3 space-y-3">
          {/* Zone description */}
          {s.zoneDescription && (
            <p className="text-[11px] text-gray-400 italic bg-gray-900/50 px-2 py-1.5 rounded">
              Catch location: {s.zoneDescription}
            </p>
          )}

          {/* Stat multipliers */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(['hp', 'atk', 'def'] as const).map(stat => {
              const val = s.statMultipliers?.[stat] || 1.0;
              return (
                <div key={stat} className="text-center bg-gray-900 rounded-lg py-2">
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{stat}</p>
                  <p className={`text-sm font-bold font-mono ${
                    val > 1 ? 'text-emerald-400' : val < 1 ? 'text-red-400' : 'text-white'
                  }`}>
                    {val.toFixed(2)}x
                  </p>
                </div>
              );
            })}
          </div>

          {/* Moves */}
          {spirit.moves?.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wide">Moves</p>
              <div className="space-y-1">
                {spirit.moves.map((m, i) => {
                  const mElem = elementInfo(m.element);
                  const mCat = MOVE_CATEGORIES.find(c => c.id === (m as any).category);
                  return (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 bg-gray-900 rounded text-[11px]">
                      <span style={{ color: mElem.color }}>{mElem.emoji}</span>
                      <span className="text-white flex-1">{m.name || '???'}</span>
                      {mCat && (
                        <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ background: mCat.bgColor, color: mCat.color }}>
                          {mCat.label}
                        </span>
                      )}
                      <span className="text-amber-400 font-mono text-[10px]">
                        {m.power > 0 ? `Pwr ${m.power}` : 'Status'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Asset thumbnails */}
          <div className="flex flex-wrap gap-2">
            {SPIRIT_ASSET_SLOTS.map(slot => {
              const path = spirit.assets?.[slot.key as keyof typeof spirit.assets];
              const url = path ? signedUrls[path] : null;
              return (
                <div key={slot.key} className="text-center">
                  <div className="w-12 h-12 rounded-lg bg-gray-900 flex items-center justify-center overflow-hidden border border-gray-700">
                    {url ? (
                      <img src={url} className="w-full h-full object-contain p-0.5" alt="" />
                    ) : (
                      <span className="text-gray-700 text-[10px]">-</span>
                    )}
                  </div>
                  <p className={`text-[8px] mt-0.5 ${path ? 'text-emerald-500' : 'text-gray-600'}`}>{slot.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
