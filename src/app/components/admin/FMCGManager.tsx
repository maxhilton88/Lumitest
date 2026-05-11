/**
 * FMCGManager.tsx — SuperAdmin FMCG Campaign Manager (Prompt 2, Part B)
 *
 * Full CRUD for FMCG campaigns:
 * - Campaign name, brand info, logo, colour
 * - QR batch size, start/expiry dates
 * - Multi-reward config (gold, diamonds, bag slot, existing/custom items)
 * - Custom item sub-form (FMCG exclusive equipment)
 * - Partner portal email invite
 * - QR batch generation + CSV download
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner@2.0.3';
import {
  Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp,
  Coins, Diamond, Package, QrCode, Calendar, Palette,
  Download, Zap, Eye, EyeOff, Mail, Sparkles,
  Shield, Swords, Crown, Footprints, ArrowRight, Upload, Image,
  FileText, AlertCircle, Hash, Timer,
} from 'lucide-react';
import {
  fetchFMCGCampaigns, createFMCGCampaign, updateFMCGCampaign, deleteFMCGCampaign,
  generateFMCGCodes, fetchFMCGCodes, getFMCGCodesCSVUrl,
  fetchShopItems, uploadFMCGLogo,
  type FMCGCampaign, type FMCGRewardConfig, type FMCGCustomItem, type ShopItemDef,
} from '../../utils/api';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: '#f3f4f6', text: '#6b7280', label: 'Draft' },
  upcoming: { bg: '#dbeafe', text: '#2563eb', label: 'Upcoming' },
  active: { bg: '#dcfce7', text: '#16a34a', label: 'Active' },
  expired: { bg: '#fee2e2', text: '#dc2626', label: 'Expired' },
};

const REWARD_TYPES = [
  { type: 'gold', label: 'Gold', icon: Coins, color: '#d97706' },
  { type: 'diamonds', label: 'Diamonds', icon: Diamond, color: '#8b5cf6' },
  { type: 'bagSlot', label: 'Bag Slot (+1)', icon: Package, color: '#059669' },
  { type: 'existingItem', label: 'Existing Item', icon: Swords, color: '#2563eb' },
  { type: 'customItem', label: 'Custom Item', icon: Crown, color: '#ec4899' },
  { type: 'premiumDays', label: 'Premium Days', icon: Timer, color: '#e8722a' },
] as const;

const EQUIP_SLOTS = [
  { value: 'weapon', label: 'Weapon', emoji: '⚔️' },
  { value: 'armor', label: 'Armor', emoji: '🛡️' },
  { value: 'boots', label: 'Boots', emoji: '👢' },
  { value: 'accessory', label: 'Accessory', emoji: '💍' },
];

const STAT_TYPES = [
  { value: 'attack', label: 'ATK' },
  { value: 'defense', label: 'DEF' },
  { value: 'max_hp', label: 'HP' },
  { value: 'xp_percent', label: 'XP%' },
];

function emptyCampaign(): Partial<FMCGCampaign> & { customItem?: FMCGCustomItem } {
  return {
    name: '',
    brandName: '',
    brandLogoUrl: '',
    brandColour: '#7cc643',
    batchSize: 100,
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    rewardConfig: [],
    partnerEmail: '',
  };
}

export function FMCGManager() {
  const [campaigns, setCampaigns] = useState<FMCGCampaign[]>([]);
  const [shopItems, setShopItems] = useState<ShopItemDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<FMCGCampaign> & { customItem?: FMCGCustomItem }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, itemsRes] = await Promise.all([
        fetchFMCGCampaigns(),
        fetchShopItems(),
      ]);
      setCampaigns(campRes.campaigns || []);
      setShopItems((itemsRes.items || []).filter(i => i.isActive));
    } catch (err: any) {
      console.error('[FMCGManager] Load error:', err);
      toast.error(`Failed to load: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name || !editing.brandName || !editing.batchSize || !editing.startDate || !editing.expiryDate) {
      toast.error('Fill in all required fields');
      return;
    }
    if ((editing.rewardConfig || []).length === 0) {
      toast.error('Add at least one reward');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createFMCGCampaign({
          name: editing.name,
          brandName: editing.brandName!,
          brandLogoUrl: editing.brandLogoUrl,
          brandColour: editing.brandColour,
          batchSize: editing.batchSize!,
          startDate: editing.startDate!,
          expiryDate: editing.expiryDate!,
          rewardConfig: editing.rewardConfig!,
          customItem: editing.customItem,
          partnerEmail: editing.partnerEmail || undefined,
        });
        toast.success(`Campaign "${editing.name}" created`);
      } else {
        await updateFMCGCampaign(editing.id!, editing);
        toast.success(`Campaign "${editing.name}" updated`);
      }
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
    if (!confirm(`Delete campaign "${name}" and all its QR codes? This cannot be undone.`)) return;
    try {
      await deleteFMCGCampaign(id);
      toast.success(`Deleted "${name}"`);
      await load();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const handleGenerate = async (id: string) => {
    if (!confirm('Generate QR codes for this campaign? This will activate the campaign.')) return;
    setGeneratingId(id);
    try {
      const result = await generateFMCGCodes(id);
      toast.success(`Generated ${result.generated} QR codes`);
      await load();
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  // Reward config helpers
  const addReward = (type: string) => {
    if (!editing) return;
    const existing = editing.rewardConfig || [];
    // Don't add duplicate types (except items)
    if (['gold', 'diamonds', 'bagSlot', 'premiumDays'].includes(type) && existing.some(r => r.type === type)) {
      toast.error(`${type} reward already added`);
      return;
    }
    const reward: FMCGRewardConfig = { type: type as any };
    if (type === 'gold') reward.amount = 100;
    if (type === 'diamonds') reward.amount = 1;
    if (type === 'premiumDays') reward.amount = 7;
    setEditing({ ...editing, rewardConfig: [...existing, reward] });
  };

  const updateReward = (idx: number, field: string, value: any) => {
    if (!editing) return;
    const rewards = [...(editing.rewardConfig || [])];
    rewards[idx] = { ...rewards[idx], [field]: value };
    setEditing({ ...editing, rewardConfig: rewards });
  };

  const removeReward = (idx: number) => {
    if (!editing) return;
    const rewards = [...(editing.rewardConfig || [])];
    rewards.splice(idx, 1);
    setEditing({ ...editing, rewardConfig: rewards });
  };

  // ── EDIT FORM ──
  if (editing) {
    const hasCustomItem = (editing.rewardConfig || []).some(r => r.type === 'customItem');
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isNew ? 'New FMCG Campaign' : `Edit: ${editing.name}`}
          </h2>
          <div className="flex gap-2">
            <button onClick={() => { setEditing(null); setIsNew(false); }}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1">
              <X size={14} /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving...' : 'Save Campaign'}
            </button>
          </div>
        </div>

        {/* Campaign Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Name *</label>
            <input type="text" value={editing.name || ''} maxLength={60}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Milo Back-to-School 2026" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Brand Name *</label>
            <input type="text" value={editing.brandName || ''}
              onChange={e => setEditing({ ...editing, brandName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Milo" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <Image size={12} /> Brand Logo
            </label>
            <input type="file" ref={logoRef} accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  toast.loading('Uploading logo...');
                  const result = await uploadFMCGLogo(file);
                  setEditing({ ...editing, brandLogoUrl: result.publicUrl });
                  toast.dismiss();
                  toast.success('Logo uploaded!');
                } catch (err: any) {
                  toast.dismiss();
                  toast.error(`Upload failed: ${err.message}`);
                }
              }} />
            <div className="flex items-center gap-2">
              {editing.brandLogoUrl ? (
                <img src={editing.brandLogoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-contain border border-gray-200 bg-white" />
              ) : (
                <div className="h-10 w-10 rounded-lg border border-dashed border-gray-300 flex items-center justify-center">
                  <Image size={14} className="text-gray-300" />
                </div>
              )}
              <button onClick={() => logoRef.current?.click()}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 text-gray-600">
                <Upload size={12} /> {editing.brandLogoUrl ? 'Change' : 'Upload'}
              </button>
              {editing.brandLogoUrl && (
                <button onClick={() => setEditing({ ...editing, brandLogoUrl: '' })}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                  <X size={12} />
                </button>
              )}
            </div>
            <input type="url" value={editing.brandLogoUrl || ''}
              onChange={e => setEditing({ ...editing, brandLogoUrl: e.target.value })}
              className="w-full mt-1.5 px-3 py-1.5 text-[10px] border border-gray-200 rounded-lg text-gray-400"
              placeholder="Or paste URL directly..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <Palette size={12} /> Brand Colour
            </label>
            <div className="flex items-center gap-2">
              <input type="color" value={editing.brandColour || '#7cc643'}
                onChange={e => setEditing({ ...editing, brandColour: e.target.value })}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer" />
              <input type="text" value={editing.brandColour || '#7cc643'}
                onChange={e => setEditing({ ...editing, brandColour: e.target.value })}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono" />
              <div className="w-16 h-10 rounded-lg" style={{ background: editing.brandColour || '#7cc643' }} />
            </div>
          </div>

          {/* Dates */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <Calendar size={12} /> Start Date *
            </label>
            <input type="date" value={editing.startDate?.slice(0, 10) || ''}
              onChange={e => setEditing({ ...editing, startDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <Calendar size={12} /> Expiry Date *
            </label>
            <input type="date" value={editing.expiryDate?.slice(0, 10) || ''}
              onChange={e => setEditing({ ...editing, expiryDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>

          {/* Batch Size */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <QrCode size={12} /> QR Batch Size *
            </label>
            {(() => {
              const totalFromQty = (editing.rewardConfig || []).reduce((s, r) => s + (r.quantity || 0), 0);
              const isAutoComputed = totalFromQty > 0;
              return (
                <>
                  <input type="number" value={editing.batchSize ?? 100} min={1} max={500000}
                    onChange={e => setEditing({ ...editing, batchSize: Number(e.target.value) })}
                    disabled={isAutoComputed}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg ${isAutoComputed ? 'bg-gray-50 text-gray-500' : ''}`} />
                  {isAutoComputed ? (
                    <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle size={9} /> Auto-computed from loot quantities: {totalFromQty.toLocaleString()} codes total
                      {totalFromQty > 10000 && <span className="text-amber-600 ml-1">(KV tracks first 10K, full CSV on R2)</span>}
                    </p>
                  ) : (
                    <p className="text-[10px] text-gray-400 mt-0.5">Set quantities per reward below, or enter manually. Max 500K with loot table.</p>
                  )}
                </>
              );
            })()}
          </div>

          {/* Partner Email */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <Mail size={12} /> Partner Portal Email
            </label>
            <input type="email" value={editing.partnerEmail || ''}
              onChange={e => setEditing({ ...editing, partnerEmail: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="brand.manager@milo.com" />
            <p className="text-[10px] text-gray-400 mt-0.5">Grants read-only portal access to this email.</p>
          </div>
        </div>

        {/* ── Reward Config ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-gray-500">Reward Config (what the user gets when they scan) *</label>
          </div>

          {/* Add reward buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {REWARD_TYPES.map(rt => {
              const Icon = rt.icon;
              return (
                <button key={rt.type} onClick={() => addReward(rt.type)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ color: rt.color }}>
                  <Icon size={13} /> + {rt.label}
                </button>
              );
            })}
          </div>

          {/* Reward entries */}
          {(editing.rewardConfig || []).length === 0 ? (
            <p className="text-xs text-gray-400 italic py-3">No rewards configured. Add at least one above.</p>
          ) : (
            <div className="space-y-2">
              {(editing.rewardConfig || []).map((reward, i) => {
                const rt = REWARD_TYPES.find(r => r.type === reward.type);
                const Icon = rt?.icon || Sparkles;
                return (
                  <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Icon size={16} style={{ color: rt?.color }} />
                    <span className="text-sm font-medium" style={{ color: rt?.color }}>{rt?.label}</span>

                    {(reward.type === 'gold' || reward.type === 'diamonds') && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-xs text-gray-400">Amount:</span>
                        <input type="number" value={reward.amount ?? (reward.type === 'gold' ? 100 : 1)}
                          onChange={e => updateReward(i, 'amount', Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md"
                          min={reward.type === 'gold' ? 50 : 1}
                          max={reward.type === 'gold' ? 500 : 3} />
                      </div>
                    )}

                    {reward.type === 'existingItem' && (
                      <select value={reward.itemId || ''}
                        onChange={e => updateReward(i, 'itemId', e.target.value)}
                        className="ml-2 flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md">
                        <option value="">-- Select item --</option>
                        {shopItems.map(item => (
                          <option key={item.id} value={item.id}>{item.name} ({item.rarity})</option>
                        ))}
                      </select>
                    )}

                    {reward.type === 'bagSlot' && (
                      <span className="text-xs text-gray-400 ml-2">+1 slot (fallback 100g if at max 20)</span>
                    )}

                    {reward.type === 'premiumDays' && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <span className="text-xs text-gray-400">Days:</span>
                        <input type="number" value={reward.amount ?? 7}
                          onChange={e => updateReward(i, 'amount', Number(e.target.value))}
                          className="w-20 px-2 py-1 text-xs border border-gray-200 rounded-md"
                          min={1}
                          max={365} />
                        <span className="text-[10px] text-orange-400">Stacks on existing premium time</span>
                      </div>
                    )}

                    {/* Quantity — how many codes get this reward */}
                    <div className="flex items-center gap-1.5 ml-auto mr-1">
                      <Hash size={10} className="text-gray-300" />
                      <span className="text-[10px] text-gray-400">Qty:</span>
                      <input type="number" value={reward.quantity ?? ''}
                        onChange={e => {
                          const val = e.target.value === '' ? undefined : Number(e.target.value);
                          updateReward(i, 'quantity', val);
                          // Auto-compute batchSize from sum of quantities
                          const rewards = [...(editing.rewardConfig || [])];
                          rewards[i] = { ...rewards[i], quantity: val };
                          const total = rewards.reduce((s, r) => s + (r.quantity || 0), 0);
                          if (total > 0) {
                            setEditing(prev => ({ ...prev!, rewardConfig: rewards, batchSize: total }));
                            return;
                          }
                        }}
                        className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-md text-right"
                        min={0} max={500000}
                        placeholder="auto" />
                    </div>
                    <button onClick={() => removeReward(i)}
                      className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Custom Item Sub-form ── */}
        {hasCustomItem && (
          <div className="border border-pink-200 bg-pink-50/30 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-pink-700 flex items-center gap-1.5">
              <Crown size={14} /> FMCG Exclusive Custom Item
            </h3>
            <p className="text-[10px] text-pink-400">This item will be auto-created with rarity "FMCG Exclusive". It cannot be purchased in the shop.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Item Name</label>
                <input type="text" value={editing.customItem?.name || ''}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, name: e.target.value } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
                  placeholder="Milo Energy Shield" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Emoji / Icon</label>
                <input type="text" value={editing.customItem?.emoji || '🎁'}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, emoji: e.target.value } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
                  placeholder="🛡️" maxLength={4} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Equipment Slot</label>
                <select value={editing.customItem?.equipSlot || 'weapon'}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, equipSlot: e.target.value } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md">
                  {EQUIP_SLOTS.map(s => (
                    <option key={s.value} value={s.value}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Stat Type</label>
                <select value={editing.customItem?.statType || 'attack'}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, statType: e.target.value } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md">
                  {STAT_TYPES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Stat Value</label>
                <input type="number" value={editing.customItem?.statValue ?? 10}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, statValue: Number(e.target.value) } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
                  min={1} max={50} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Flavour Text</label>
                <input type="text" value={editing.customItem?.flavourText || ''}
                  onChange={e => setEditing({ ...editing, customItem: { ...editing.customItem!, flavourText: e.target.value } })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md"
                  placeholder="Only from Milo Raya 2026. Never sold in shop." />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">FMCG Campaigns</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} configured.
            FMCG QR codes are printed on product packaging.
          </p>
        </div>
        <button onClick={() => { setEditing(emptyCampaign()); setIsNew(true); }}
          className="px-3 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center gap-1.5">
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <QrCode size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No FMCG campaigns yet. Create your first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(camp => {
            const isExpanded = expandedId === camp.id;
            const status = camp.liveStatus || camp.status;
            const sc = STATUS_COLORS[status] || STATUS_COLORS.draft;
            const redemptionPct = camp.totalCodes && camp.totalCodes > 0
              ? ((camp.claimedCount || 0) / camp.totalCodes * 100).toFixed(1)
              : '0.0';

            return (
              <div key={camp.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50/50"
                  onClick={() => setExpandedId(isExpanded ? null : camp.id)}>
                  {/* Brand colour swatch */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: camp.brandColour || '#7cc643' }}>
                    {camp.brandName?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{camp.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: sc.bg, color: sc.text }}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                      <span>{camp.brandName}</span>
                      <span className="flex items-center gap-0.5"><QrCode size={10} /> {camp.totalCodes || 0} codes</span>
                      <span>{camp.claimedCount || 0} claimed ({redemptionPct}%)</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <button onClick={(e) => { e.stopPropagation(); setEditing(camp); setIsNew(false); }}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                    <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(camp.id, camp.name); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                  {isExpanded ? <ChevronUp size={14} className="text-gray-300" /> : <ChevronDown size={14} className="text-gray-300" />}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-3">
                    {/* Info row */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {camp.startDate?.slice(0, 10)} — {camp.expiryDate?.slice(0, 10)}</span>
                      <span>Batch: {camp.batchSize}</span>
                      {camp.partnerEmail && <span className="flex items-center gap-1"><Mail size={11} /> {camp.partnerEmail}</span>}
                    </div>

                    {/* Rewards / Loot Table summary */}
                    <div className="flex flex-wrap gap-1.5">
                      {(camp.rewardConfig || []).map((r, i) => {
                        const rt = REWARD_TYPES.find(t => t.type === r.type);
                        const Icon = rt?.icon || Sparkles;
                        return (
                          <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border"
                            style={{ borderColor: `${rt?.color}30`, color: rt?.color, background: `${rt?.color}08` }}>
                            <Icon size={11} />
                            {r.type === 'gold' && `${r.amount}g`}
                            {r.type === 'diamonds' && `${r.amount}💎`}
                            {r.type === 'bagSlot' && '+1 Slot'}
                            {r.type === 'existingItem' && (r.itemId || 'Item')}
                            {r.type === 'customItem' && 'Custom Item'}
                            {r.type === 'premiumDays' && `${r.amount || 7}d Premium`}
                            {r.quantity ? <span className="text-[9px] opacity-70 ml-0.5">x{r.quantity.toLocaleString()}</span> : null}
                          </span>
                        );
                      })}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(!camp.totalCodes || camp.totalCodes === 0) && (
                        <button onClick={() => handleGenerate(camp.id)}
                          disabled={generatingId === camp.id}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50">
                          <QrCode size={12} />
                          {generatingId === camp.id ? 'Generating...' : `Generate ${camp.batchSize?.toLocaleString()} Codes`}
                        </button>
                      )}
                      {/* Primary: R2 CSV for VDP (full set) */}
                      {camp.csvUrl && (
                        <a href={camp.csvUrl} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800 flex items-center gap-1.5">
                          <FileText size={12} /> VDP CSV ({(camp.generatedTotal || camp.batchSize)?.toLocaleString()} codes)
                        </a>
                      )}
                      {/* Secondary: Live status CSV from KV */}
                      {camp.totalCodes && camp.totalCodes > 0 && (
                        <a href={getFMCGCodesCSVUrl(camp.id)} target="_blank" rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
                          <Download size={12} /> Live Status CSV
                        </a>
                      )}
                    </div>

                    {/* Generation stats */}
                    {camp.generatedTotal && (
                      <div className="flex items-center gap-3 text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5">
                        <span>Generated: {camp.generatedTotal.toLocaleString()} total</span>
                        <span>KV tracked: {(camp.kvTracked || Math.min(camp.generatedTotal, 10000)).toLocaleString()}</span>
                        {camp.generatedTotal > 10000 && (
                          <span className="text-amber-600">CSV-only: {(camp.generatedTotal - (camp.kvTracked || 10000)).toLocaleString()}</span>
                        )}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[10px] text-gray-300">
                      <span>ID: {camp.id.slice(0, 8)}...</span>
                      <span>Created: {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString() : 'N/A'}</span>
                      {camp.customItemId && <span>Custom Item: {camp.customItemId}</span>}
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