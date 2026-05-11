/**
 * RPGCharacterManager.tsx — Admin manager for player characters (Boy/Girl) + Fox companion.
 * Pre-defined 3 entities: boy, girl, companion. Admin uploads sprites for each.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Loader2, User, Heart, RefreshCw, Check, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  rpgGameListEntities, rpgGameSaveEntity, rpgGameSignedUrls,
} from '../../utils/api';
import { RPGMultiSlotUploader } from './RPGAssetUploader';
import { CHARACTER_ASSET_SLOTS, type CharacterEntity } from './rpg-types';

const GOLD = '#d4a44a';

// Pre-defined characters — these always exist (admin just uploads sprites)
const PREDEFINED_CHARACTERS: { id: string; characterType: 'boy' | 'girl' | 'companion'; name: string; description: string; icon: string }[] = [
  { id: 'player-boy', characterType: 'boy', name: 'Boy Character', description: 'Human boy avatar for the overworld & battle HUD', icon: '👦' },
  { id: 'player-girl', characterType: 'girl', name: 'Girl Character', description: 'Human girl avatar for the overworld & battle HUD', icon: '👧' },
  { id: 'companion-fox', characterType: 'companion', name: 'Fox Companion', description: 'The fox that follows the player and fights in battles', icon: '🦊' },
];

export function RPGCharacterManager() {
  const [characters, setCharacters] = useState<Record<string, CharacterEntity>>({});
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const entities = await rpgGameListEntities('character');
      const charMap: Record<string, CharacterEntity> = {};
      for (const e of entities as unknown as CharacterEntity[]) {
        charMap[e.id] = e;
      }

      // Ensure all predefined characters exist in local state
      for (const pre of PREDEFINED_CHARACTERS) {
        if (!charMap[pre.id]) {
          charMap[pre.id] = {
            id: pre.id,
            type: 'character',
            characterType: pre.characterType,
            name: pre.name,
            assets: {},
          };
        }
      }

      setCharacters(charMap);

      // Fetch signed URLs
      const allPaths: string[] = [];
      Object.values(charMap).forEach(c => {
        if (c.assets) Object.values(c.assets).forEach(p => { if (p) allPaths.push(p); });
      });
      if (allPaths.length > 0) {
        const urls = await rpgGameSignedUrls(allPaths);
        setSignedUrls(urls);
      }
    } catch (err: any) {
      toast.error(`Failed to load characters: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCharacters(); }, [loadCharacters]);

  const handleAssetChange = (charId: string, key: string, path: string | null) => {
    setCharacters(prev => {
      const c = { ...prev[charId], assets: { ...prev[charId]?.assets } };
      if (path) {
        c.assets[key as keyof typeof c.assets] = path;
      } else {
        delete c.assets[key as keyof typeof c.assets];
      }
      return { ...prev, [charId]: c };
    });
    setDirty(prev => new Set(prev).add(charId));
  };

  const handleSave = async (charId: string) => {
    const char = characters[charId];
    if (!char) return;
    setSaving(charId);
    try {
      await rpgGameSaveEntity('character', charId, char);
      toast.success(`${char.name} saved`);
      setDirty(prev => {
        const next = new Set(prev);
        next.delete(charId);
        return next;
      });
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    const dirtyIds = Array.from(dirty);
    if (dirtyIds.length === 0) {
      toast.info('Nothing to save');
      return;
    }
    setSaving('all');
    try {
      for (const id of dirtyIds) {
        const char = characters[id];
        if (char) await rpgGameSaveEntity('character', id, char);
      }
      toast.success(`Saved ${dirtyIds.length} character(s)`);
      setDirty(new Set());
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Upload sprites for the 3 game characters. Each needs a spritesheet (walk animation) + battle + portrait.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCharacters}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
          {dirty.size > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={saving === 'all'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' }}
            >
              {saving === 'all' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save All ({dirty.size})
            </button>
          )}
        </div>
      </div>

      {/* Character cards */}
      {PREDEFINED_CHARACTERS.map(pre => {
        const char = characters[pre.id];
        if (!char) return null;

        const assetCount = Object.values(char.assets || {}).filter(Boolean).length;
        const totalSlots = CHARACTER_ASSET_SLOTS.length;
        const isComplete = assetCount === totalSlots;
        const isDirty = dirty.has(pre.id);
        const isSaving = saving === pre.id || saving === 'all';

        return (
          <div
            key={pre.id}
            className={`bg-gray-800/60 border rounded-xl overflow-hidden ${
              isDirty ? 'border-amber-500/40' : 'border-gray-700'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-800/40">
              <span className="text-2xl">{pre.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{pre.name}</p>
                  {isComplete ? (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400">
                      <Check className="w-2.5 h-2.5" /> Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                      <AlertTriangle className="w-2.5 h-2.5" /> {assetCount}/{totalSlots}
                    </span>
                  )}
                  {isDirty && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                      Unsaved
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{pre.description}</p>
              </div>

              <button
                onClick={() => handleSave(pre.id)}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-30 transition-all"
                style={isDirty ? { background: `linear-gradient(135deg, ${GOLD}, #f0d078)`, color: '#2a1f0e' } : { background: 'transparent', color: '#6b7280' }}
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </button>
            </div>

            {/* Asset upload grid */}
            <div className="p-4">
              <RPGMultiSlotUploader
                entityType="character"
                entityId={pre.id}
                slots={CHARACTER_ASSET_SLOTS}
                assets={(char.assets || {}) as Record<string, string>}
                signedUrls={signedUrls}
                onAssetChange={(key, path) => handleAssetChange(pre.id, key, path)}
                compact
              />
            </div>
          </div>
        );
      })}

      {/* Info box */}
      <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4">
        <h4 className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5" />
          Spritesheet format
        </h4>
        <ul className="space-y-1 text-[11px] text-gray-400 leading-relaxed">
          <li>
            <strong className="text-gray-300">Spritesheet layout:</strong> A single PNG with a <strong className="text-white">3×4 grid</strong> (3 columns × 4 rows). Each cell is the same size (32×32 or 64×64px). Total image size: 96×128 or 192×256.
          </li>
          <li>
            <strong className="text-gray-300">Columns (walk cycle):</strong> Left-step, Standing, Right-step — the engine cycles 0→1→2→1 while walking.
          </li>
          <li>
            <strong className="text-gray-300">Rows (directions):</strong> Row 0 = Down (front), Row 1 = Left, Row 2 = Right, Row 3 = Up (back).
          </li>
          <li>
            <strong className="text-gray-300">Battle sprite:</strong> Large illustrated version shown in the battle screen (256×256+ recommended).
          </li>
          <li>
            <strong className="text-gray-300">Portrait:</strong> Shown in dialogue boxes and HUD.
          </li>
          <li>
            <strong className="text-gray-300">Fallback:</strong> If no spritesheet is uploaded, the engine draws procedural chibi sprites.
          </li>
        </ul>
        {/* Visual reference grid */}
        <div className="mt-3 p-3 bg-gray-900/60 rounded-lg border border-gray-700/50">
          <p className="text-[10px] text-gray-500 mb-2 font-mono">Spritesheet grid layout:</p>
          <div className="grid grid-cols-3 gap-px text-[9px] text-center font-mono" style={{ width: 'fit-content' }}>
            {['Down', 'Left', 'Right', 'Up'].map(dir => (
              ['L-step', 'Stand', 'R-step'].map((frame, fi) => (
                <div key={`${dir}-${fi}`} className="w-14 h-14 flex flex-col items-center justify-center bg-gray-800 rounded" style={{ border: '1px solid rgba(212,164,74,0.15)' }}>
                  <span className="text-gray-500">{dir}</span>
                  <span className="text-amber-500/60">{frame}</span>
                </div>
              ))
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}