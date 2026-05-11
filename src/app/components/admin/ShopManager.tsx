/**
 * ShopManager.tsx — Admin panel for managing shop items
 *
 * Full CRUD for shop items with:
 * - Name, description, price, currency (gold/diamond)
 * - Image slug (links to RPG Asset Manager uploads)
 * - Rarity tier (common/rare/epic/legendary)
 * - Category (consumable/battle/treasure)
 * - Effects system: add XP, energy, HP, or level by value or percent
 * - Sort order and active toggle
 */
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp,
  Coins, Diamond, Sparkles, Package, Swords, Crown,
  Zap, Heart, Star, TrendingUp, GripVertical, Eye, EyeOff,
  Shield, Clock, Crosshair, ShieldHalf, Wind, HeartPulse,
  Egg, RefreshCw, MapPin,
} from 'lucide-react';
import {
  fetchShopItems, saveShopItem, deleteShopItem,
  fetchRPGAssets, uploadRPGAsset, invalidateRPGAssetsCache,
  fetchRealmStoreAvailability, saveRealmStoreAvailability,
  type ShopItemDef, type ShopItemEffect, type RPGAsset, type EquipSlot,
} from '../../utils/api';


const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
const CATEGORIES = ['consumable', 'battle', 'treasure'] as const;
const CURRENCIES = ['gold', 'diamond'] as const;
const EFFECT_TYPES = ['xp', 'energy', 'hp', 'level', 'shield', 'time_extend', 'attack', 'defense', 'speed', 'max_hp', 'xp_percent', 'gold', 'hatch_accelerator', 'daily_refresh', 'treasure_map'] as const;
const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'boots', 'accessory'];

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

const CATEGORY_LABELS: Record<string, { label: string; icon: any }> = {
  consumable: { label: 'Consumable', icon: Package },
  battle: { label: 'Battle Item', icon: Swords },
  treasure: { label: 'Equipment', icon: Crown },
};

const EFFECT_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  xp: { label: 'Experience (XP)', icon: Star, color: '#22c55e' },
  energy: { label: 'Energy', icon: Zap, color: '#facc15' },
  hp: { label: 'Health (HP)', icon: Heart, color: '#ef4444' },
  level: { label: 'Level', icon: TrendingUp, color: '#a855f7' },
  shield: { label: 'Shield (% DMG reduction)', icon: Shield, color: '#3b82f6' },
  time_extend: { label: 'Time Extend (seconds)', icon: Clock, color: '#f97316' },
  attack: { label: 'Attack (ATK)', icon: Crosshair, color: '#f43f5e' },
  defense: { label: 'Defense (DEF)', icon: ShieldHalf, color: '#06b6d4' },
  speed: { label: 'Speed (SPD)', icon: Wind, color: '#84cc16' },
  max_hp: { label: 'Max HP', icon: HeartPulse, color: '#ec4899' },
  xp_percent: { label: 'XP% Multiplier', icon: Star, color: '#10b981' },
  gold: { label: 'Gold', icon: Coins, color: '#ffd700' },
  hatch_accelerator: { label: 'Hatch Accelerator (-12hr)', icon: Egg, color: '#f59e0b' },
  daily_refresh: { label: 'Daily Quest Reset', icon: RefreshCw, color: '#06b6d4' },
  treasure_map: { label: 'Treasure Map (3× Gold)', icon: MapPin, color: '#fbbf24' },
};

const EQUIP_SLOT_LABELS: Record<EquipSlot, { label: string; emoji: string }> = {
  weapon: { label: 'Weapon', emoji: '⚔️' },
  armor: { label: 'Armor', emoji: '🛡️' },
  boots: { label: 'Boots', emoji: '👢' },
  accessory: { label: 'Accessory', emoji: '💍' },
};

function emptyItem(): Partial<ShopItemDef> {
  return {
    id: '',
    name: '',
    description: '',
    imageSlug: '',
    price: 10,
    currency: 'gold',
    rarity: 'common',
    category: 'consumable',
    effects: [],
    battleLimit: undefined,
    sortOrder: 999,
    isActive: true,
  };
}

export function ShopManager() {
  const [items, setItems] = useState<ShopItemDef[]>([]);
  const [rpgAssets, setRpgAssets] = useState<RPGAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ShopItemDef> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [realmAvailability, setRealmAvailability] = useState<Record<string, boolean>>({});
  const [savingAvailability, setSavingAvailability] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /** Direct upload image to R2 as RPG asset, then auto-select slug */
  const handleDirectUpload = async (file: File) => {
    if (!editing) return;
    // Generate slug from filename
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const slug = `item-${baseName}-${Date.now().toString(36)}`;
    setUploading(true);
    try {
      const result = await uploadRPGAsset(file, slug, 'item');
      invalidateRPGAssetsCache();
      // Refresh assets list and auto-select the new slug
      const allAssets = await fetchRPGAssets();
      setRpgAssets(allAssets.assets || []);
      setEditing(prev => prev ? { ...prev, imageSlug: slug } : prev);
      toast.success(`Image uploaded as "${slug}"`);
    } catch (err: any) {
      console.error('[ShopManager] Upload error:', err);
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shopRes, assetRes, availRes] = await Promise.all([
        fetchShopItems(),
        fetchRPGAssets('item'),
        fetchRealmStoreAvailability(),
      ]);
      setItems(shopRes.items || []);
      setRealmAvailability(availRes || {});
      // Get ALL assets so admin can pick any image
      const allAssets = await fetchRPGAssets();
      setRpgAssets(allAssets.assets || []);
    } catch (err: any) {
      console.error('[ShopManager] Load error:', err);
      toast.error(`Failed to load shop items: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.id || !editing.name || editing.price === undefined || !editing.currency) {
      toast.error('Please fill in ID, Name, Price, and Currency');
      return;
    }
    setSaving(true);
    try {
      await saveShopItem(editing);
      toast.success(`Item "${editing.name}" saved`);
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
      await deleteShopItem(id);
      toast.success(`Deleted "${name}"`);
      await load();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const addEffect = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      effects: [...(editing.effects || []), { type: 'xp', value: 10, isPercent: false }],
    });
  };

  const updateEffect = (index: number, field: string, value: any) => {
    if (!editing) return;
    const effects = [...(editing.effects || [])];
    effects[index] = { ...effects[index], [field]: value };
    setEditing({ ...editing, effects });
  };

  const removeEffect = (index: number) => {
    if (!editing) return;
    const effects = [...(editing.effects || [])];
    effects.splice(index, 1);
    setEditing({ ...editing, effects });
  };

  const getAssetUrl = (slug: string) => {
    if (!slug) return null;
    const asset = rpgAssets.find(a => a.slug === slug);
    return asset?.publicUrl || null;
  };

  // ── EDIT FORM ──
  if (editing) {
    const imageUrl = getAssetUrl(editing.imageSlug || '');
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New Shop Item' : `Edit: ${editing.name}`}
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Item ID (unique slug)</label>
            <input
              type="text"
              value={editing.id || ''}
              onChange={e => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
              disabled={!isNew}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="e.g. health_potion"
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
            <input
              type="text"
              value={editing.name || ''}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Health Potion"
            />
          </div>

          {/* Description */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              value={editing.description || ''}
              onChange={e => setEditing({ ...editing, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20 resize-none"
              rows={2}
              placeholder="A magical potion that restores health..."
            />
          </div>

          {/* Image Slug — dropdown from RPG assets */}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Item Image
            </label>
            <div className="flex items-center gap-3">
              <select
                value={editing.imageSlug || ''}
                onChange={e => setEditing({ ...editing, imageSlug: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              >
                <option value="">-- No image --</option>
                {rpgAssets.map(a => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug} ({a.category})
                  </option>
                ))}
              </select>
              {imageUrl ? (
                <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-contain bg-gray-100 border" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center">
                  <Package size={16} className="text-gray-300" />
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
                    Upload New Image
                  </>
                )}
              </button>
              <span className="text-[10px] text-gray-400">
                Or select an existing asset from the dropdown above
              </span>
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
            <input
              type="number"
              value={editing.price ?? 10}
              onChange={e => setEditing({ ...editing, price: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              min={0}
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Currency</label>
            <div className="flex gap-2">
              {CURRENCIES.map(c => (
                <button
                  key={c}
                  onClick={() => setEditing({ ...editing, currency: c })}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    editing.currency === c
                      ? c === 'gold'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-purple-50 border-purple-300 text-purple-700'
                      : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  {c === 'gold' ? <Coins size={14} /> : <Diamond size={14} />}
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rarity</label>
            <div className="flex gap-1.5">
              {RARITIES.map(r => (
                <button
                  key={r}
                  onClick={() => setEditing({ ...editing, rarity: r })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    editing.rarity === r
                      ? 'text-white border-transparent'
                      : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                  style={editing.rarity === r ? { background: RARITY_COLORS[r], borderColor: RARITY_COLORS[r] } : {}}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <div className="flex gap-1.5">
              {CATEGORIES.map(cat => {
                const cfg = CATEGORY_LABELS[cat];
                const Icon = cfg.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => setEditing({ ...editing, category: cat })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      editing.category === cat
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={12} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Battle Limit (only for battle category) */}
          {editing.category === 'battle' && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Swords size={12} className="text-gray-400" />
                  Battle Limit (max usable per single battle)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={editing.battleLimit ?? ''}
                  onChange={e => setEditing({ ...editing, battleLimit: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  min={1}
                  max={99}
                  placeholder="No limit"
                />
                <span className="text-xs text-gray-400">
                  {editing.battleLimit
                    ? `Max ${editing.battleLimit} per battle`
                    : 'Unlimited uses per battle (not recommended)'}
                </span>
              </div>
            </div>
          )}

          {/* Equipment Slot (only for treasure/equipment category) */}
          {editing.category === 'treasure' && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                <span className="flex items-center gap-1.5">
                  <Crown size={12} className="text-gray-400" />
                  Equipment Slot (where the player equips this gear)
                </span>
              </label>
              <div className="flex gap-2">
                {EQUIP_SLOTS.map(slot => {
                  const sl = EQUIP_SLOT_LABELS[slot];
                  return (
                    <button
                      key={slot}
                      onClick={() => setEditing({ ...editing, equipSlot: slot })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        editing.equipSlot === slot
                          ? 'bg-amber-50 border-amber-300 text-amber-700'
                          : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span>{sl.emoji}</span>
                      {sl.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">
                Players can equip one item per slot. Equipment stat bonuses (ATK, DEF, SPD, Max HP) apply permanently while equipped and carry into battles.
              </p>
            </div>
          )}

          {/* Sort Order + Active */}
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
          <div className="flex items-end pb-1">
            <button
              onClick={() => setEditing({ ...editing, isActive: !editing.isActive })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                editing.isActive
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-600'
              }`}
            >
              {editing.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
              {editing.isActive ? 'Active (Visible in shop)' : 'Inactive (Hidden)'}
            </button>
          </div>
        </div>

        {/* ── Effects ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500">Effects (what happens when used)</label>
            <button
              onClick={addEffect}
              className="px-2 py-1 text-xs bg-gray-100 rounded-md hover:bg-gray-200 flex items-center gap-1"
            >
              <Plus size={12} /> Add Effect
            </button>
          </div>
          {(editing.effects || []).length === 0 ? (
            <p className="text-xs text-gray-400 italic py-3">No effects. This item is cosmetic/collectible only.</p>
          ) : (
            <div className="space-y-2">
              {(editing.effects || []).map((eff, i) => {
                const effCfg = EFFECT_LABELS[eff.type];
                const EffIcon = effCfg?.icon || Sparkles;
                return (
                  <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <select
                      value={eff.type}
                      onChange={e => updateEffect(i, 'type', e.target.value)}
                      className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
                    >
                      {EFFECT_TYPES.map(t => (
                        <option key={t} value={t}>{EFFECT_LABELS[t].label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-400">+</span>
                    <input
                      type="number"
                      value={eff.value}
                      onChange={e => updateEffect(i, 'value', Number(e.target.value))}
                      className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
                      min={0}
                    />
                    <button
                      onClick={() => updateEffect(i, 'isPercent', !eff.isPercent)}
                      className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                        eff.isPercent
                          ? 'bg-blue-50 border-blue-200 text-blue-600'
                          : 'bg-white border-gray-200 text-gray-400'
                      }`}
                    >
                      {eff.isPercent ? '%' : 'pts'}
                    </button>
                    <span className="flex-1 text-xs text-gray-400 flex items-center gap-1">
                      <EffIcon size={12} style={{ color: effCfg?.color }} />
                      +{eff.value}{eff.isPercent ? '%' : ''} {EFFECT_LABELS[eff.type]?.label}
                    </span>
                    <button
                      onClick={() => removeEffect(i)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Shop Items</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''} configured. Upload item images in RPG Asset Manager first.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(emptyItem()); setIsNew(true); }}
            className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5"
          >
            <Plus size={14} /> New Item
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No shop items yet. Create your first item!</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const imageUrl = getAssetUrl(item.imageSlug);
            const isExpanded = expandedId === item.id;
            const catCfg = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.consumable;
            const CatIcon = catCfg.icon;

            return (
              <div
                key={item.id}
                className={`border rounded-xl overflow-hidden transition-colors ${
                  item.isActive ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                }`}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Image */}
                  {imageUrl ? (
                    <img src={imageUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center border border-dashed border-gray-200">
                      <Package size={14} className="text-gray-300" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{item.name}</span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: `${RARITY_COLORS[item.rarity]}20`, color: RARITY_COLORS[item.rarity] }}
                      >
                        {item.rarity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-0.5">
                        <CatIcon size={10} /> {catCfg.label}
                      </span>
                      <span className="text-xs flex items-center gap-0.5" style={{ color: item.currency === 'gold' ? '#d97706' : '#8b5cf6' }}>
                        {item.currency === 'gold' ? <Coins size={10} /> : <Diamond size={10} />}
                        {item.price}
                      </span>
                      {item.effects.length > 0 && (
                        <span className="text-xs text-gray-400">
                          {item.effects.length} effect{item.effects.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(item); setIsNew(false); }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.name); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mt-2 mb-2">{item.description || 'No description'}</p>
                    {item.equipSlot && (
                      <div className="mb-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-amber-50 text-amber-600 border border-amber-100">
                          {EQUIP_SLOT_LABELS[item.equipSlot as EquipSlot]?.emoji} {EQUIP_SLOT_LABELS[item.equipSlot as EquipSlot]?.label} slot
                        </span>
                      </div>
                    )}
                    {item.effects.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.effects.map((eff, i) => {
                          const effCfg = EFFECT_LABELS[eff.type];
                          const EffIcon = effCfg?.icon || Sparkles;
                          return (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                              style={{ background: `${effCfg?.color}15`, color: effCfg?.color }}
                            >
                              <EffIcon size={11} />
                              +{eff.value}{eff.isPercent ? '%' : ''} {effCfg?.label}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {item.category === 'battle' && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-orange-50 text-orange-600 border border-orange-100">
                          <Swords size={11} />
                          Battle limit: {item.battleLimit ?? '\u221E'} per battle
                        </span>
                      </div>
                    )}
                    {/* Realm Store Availability toggle */}
                    <div className="mt-3 pt-2 border-t border-gray-100">
                      <label className="flex items-center gap-2.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={realmAvailability[item.id] !== false}
                          onChange={(e) => {
                            e.stopPropagation();
                            const next = { ...realmAvailability, [item.id]: e.target.checked };
                            setRealmAvailability(next);
                            setSavingAvailability(true);
                            saveRealmStoreAvailability(next)
                              .then(() => toast.success(`"${item.name}" ${e.target.checked ? 'available' : 'restricted'} in Realm Hub Store`))
                              .catch((err: any) => toast.error(`Failed to save: ${err.message}`))
                              .finally(() => setSavingAvailability(false));
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-medium text-gray-600 group-hover:text-gray-900">
                            Available in Realm Hub Store
                          </span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {realmAvailability[item.id] !== false
                              ? 'Buyable from /realm/bag store'
                              : 'Dimmed — player must visit in-map shop in Thornhaven to buy'}
                          </p>
                        </div>
                        {realmAvailability[item.id] === false && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-500 border border-orange-100">
                            Quest-only
                          </span>
                        )}
                      </label>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-300">
                      <span>ID: {item.id}</span>
                      <span>Slug: {item.imageSlug || 'none'}</span>
                      <span>Order: {item.sortOrder}</span>
                      {item.updatedAt && <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>}
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