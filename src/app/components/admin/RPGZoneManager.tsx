/**
 * RPGZoneManager.tsx — Admin CRUD for game zones.
 * Each zone has: name, subjects, difficulty, tileset, map JSON, preview image.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, Save, X, Loader2, MapPin, ChevronDown, ChevronUp,
  AlertCircle, Edit2, Layers,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  rpgGameListEntities, rpgGameSaveEntity, rpgGameDeleteEntity,
  rpgGameSignedUrls,
} from '../../utils/api';
import { RPGMultiSlotUploader } from './RPGAssetUploader';
import {
  ZONE_SUBJECTS, ZONE_ASSET_SLOTS,
  type ZoneEntity,
} from './rpg-types';

const GOLD = '#d4a44a';

function newZoneDefaults(): Omit<ZoneEntity, 'createdAt' | 'updatedAt'> {
  return {
    id: '',
    type: 'zone',
    name: '',
    description: '',
    subjects: [],
    difficulty: 1,
    order: 0,
    unlockLevel: 1,
    assets: {},
  };
}

export function RPGZoneManager() {
  const [zones, setZones] = useState<ZoneEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [editingZone, setEditingZone] = useState<ZoneEntity | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    setLoading(true);
    try {
      const entities = await rpgGameListEntities('zone');
      const zoneList = entities as unknown as ZoneEntity[];
      setZones(zoneList.sort((a, b) => (a.order || 0) - (b.order || 0)));

      // Fetch signed URLs for all assets
      const allPaths: string[] = [];
      for (const z of zoneList) {
        if (z.assets) {
          Object.values(z.assets).forEach(p => { if (p) allPaths.push(p); });
        }
      }
      if (allPaths.length > 0) {
        const urls = await rpgGameSignedUrls(allPaths);
        setSignedUrls(urls);
      }
    } catch (err: any) {
      toast.error(`Failed to load zones: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadZones(); }, [loadZones]);

  const startNew = () => {
    const defaults = newZoneDefaults();
    defaults.id = `zone-${Date.now().toString(36)}`;
    defaults.order = zones.length + 1;
    setEditingZone(defaults as ZoneEntity);
    setIsNew(true);
  };

  const startEdit = (zone: ZoneEntity) => {
    setEditingZone({ ...zone, assets: { ...zone.assets } });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editingZone) return;
    if (!editingZone.name.trim()) {
      toast.error('Zone name is required');
      return;
    }
    setSaving(true);
    try {
      await rpgGameSaveEntity('zone', editingZone.id, editingZone);
      toast.success(`Zone "${editingZone.name}" saved`);
      setEditingZone(null);
      loadZones();
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
      await rpgGameDeleteEntity('zone', id);
      toast.success('Zone deleted');
      setConfirmDelete(null);
      loadZones();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const updateField = (field: string, value: any) => {
    if (!editingZone) return;
    setEditingZone({ ...editingZone, [field]: value });
  };

  const toggleSubject = (subjectId: string) => {
    if (!editingZone) return;
    const subs = [...(editingZone.subjects || [])];
    const idx = subs.indexOf(subjectId);
    if (idx >= 0) subs.splice(idx, 1);
    else subs.push(subjectId);
    updateField('subjects', subs);
  };

  const handleAssetChange = (key: string, path: string | null) => {
    if (!editingZone) return;
    const newAssets = { ...editingZone.assets };
    if (path) newAssets[key as keyof typeof newAssets] = path;
    else delete newAssets[key as keyof typeof newAssets];
    setEditingZone({ ...editingZone, assets: newAssets });
  };

  // ── Edit Form ──
  if (editingZone) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            {isNew ? 'New Zone' : `Edit: ${editingZone.name}`}
          </h3>
          <button
            onClick={() => setEditingZone(null)}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Name + Description */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Zone Name *</label>
            <input
              type="text"
              value={editingZone.name}
              onChange={e => updateField('name', e.target.value)}
              placeholder="e.g. Enchanted Forest"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <input
              type="text"
              value={editingZone.description}
              onChange={e => updateField('description', e.target.value)}
              placeholder="A mystical forest full of spirits..."
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Difficulty / Order / Unlock Level */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Difficulty (1-10)</label>
            <input
              type="number"
              min={1} max={10}
              value={editingZone.difficulty}
              onChange={e => updateField('difficulty', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Display Order</label>
            <input
              type="number"
              min={0}
              value={editingZone.order}
              onChange={e => updateField('order', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Unlock Level</label>
            <input
              type="number"
              min={1}
              value={editingZone.unlockLevel}
              onChange={e => updateField('unlockLevel', parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Subject mapping */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Subjects in this Zone</label>
          <div className="flex flex-wrap gap-2">
            {ZONE_SUBJECTS.map(s => {
              const active = editingZone.subjects?.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSubject(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                    active
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <span>{s.emoji}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Asset slots */}
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-3">Zone Assets</label>
          <RPGMultiSlotUploader
            entityType="zone"
            entityId={editingZone.id}
            slots={ZONE_ASSET_SLOTS}
            assets={editingZone.assets as Record<string, string>}
            signedUrls={signedUrls}
            onAssetChange={handleAssetChange}
          />
        </div>

        {/* Save */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => setEditingZone(null)}
            className="px-4 py-2.5 text-sm bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editingZone.name.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-40"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Zone'}
          </button>
        </div>
      </div>
    );
  }

  // ── Zone List ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {zones.length} zone{zones.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all"
          style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Zone
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : zones.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="w-10 h-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No zones yet</p>
          <p className="text-gray-600 text-xs mt-1">Create your first zone to define the game world</p>
        </div>
      ) : (
        <div className="space-y-2">
          {zones.map(zone => {
            const expanded = expandedId === zone.id;
            const assetCount = Object.values(zone.assets || {}).filter(Boolean).length;
            const totalSlots = ZONE_ASSET_SLOTS.length;

            return (
              <div
                key={zone.id}
                className="bg-gray-800/60 border border-gray-700 rounded-xl overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : zone.id)}
                >
                  {/* Preview thumbnail */}
                  <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden">
                    {zone.assets?.preview && signedUrls[zone.assets.preview] ? (
                      <img src={signedUrls[zone.assets.preview]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <MapPin className="w-4 h-4 text-gray-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{zone.name || 'Unnamed Zone'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">Lv{zone.difficulty}</span>
                      <span className="text-[10px] text-gray-600">|</span>
                      <span className="text-[10px] text-gray-500">
                        {(zone.subjects || []).map(s => ZONE_SUBJECTS.find(zs => zs.id === s)?.emoji || '').join(' ') || 'No subjects'}
                      </span>
                      <span className="text-[10px] text-gray-600">|</span>
                      <span className={`text-[10px] ${assetCount === totalSlots ? 'text-emerald-500' : assetCount > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {assetCount}/{totalSlots} assets
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(zone); }}
                      className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(zone.id); }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        confirmDelete === zone.id ? 'bg-red-500/20 hover:bg-red-500/30' : 'hover:bg-gray-700'
                      }`}
                    >
                      {confirmDelete === zone.id ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="px-4 pb-4 border-t border-gray-700 pt-3">
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">ID:</span>
                        <span className="text-gray-300 ml-1 font-mono text-[10px]">{zone.id}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Unlock Level:</span>
                        <span className="text-gray-300 ml-1">{zone.unlockLevel}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Description:</span>
                        <span className="text-gray-300 ml-1">{zone.description || '-'}</span>
                      </div>
                    </div>

                    {/* Asset previews */}
                    <div className="flex flex-wrap gap-2">
                      {ZONE_ASSET_SLOTS.map(slot => {
                        const path = zone.assets?.[slot.key as keyof typeof zone.assets];
                        const url = path ? signedUrls[path] : null;
                        return (
                          <div key={slot.key} className="text-center">
                            <div className="w-16 h-16 rounded-lg bg-gray-900 flex items-center justify-center overflow-hidden border border-gray-700">
                              {url && slot.accept?.includes('image') ? (
                                <img src={url} className="w-full h-full object-contain p-0.5" alt="" />
                              ) : path ? (
                                <Layers className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <span className="text-gray-700 text-[10px]">-</span>
                              )}
                            </div>
                            <p className={`text-[9px] mt-0.5 ${path ? 'text-emerald-500' : 'text-gray-600'}`}>
                              {slot.label}
                            </p>
                          </div>
                        );
                      })}
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
