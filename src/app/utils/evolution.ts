/**
 * evolution.ts — Bible v5 Evolution Path logic
 *
 * Stages and triggers:
 *   Egg     → Default (signup)
 *   Baby    → 48hr timer + Level 5   → Reward: +50 gold
 *   Young   → Level 20               → Reward: Rare weapon (admin-configured in ShopManager)
 *   Warrior → Level 30 + 25 wins     → Reward: Epic item (admin-configured in ShopManager)
 *
 * IMPORTANT: Evolution reward items (Foxfire Blade, Guardian Plate, Focus Necklace)
 * are now fully admin-editable via ShopManager. This file only stores their IDs
 * for the evolution grant logic. Stats, names, and images are managed in KV.
 */

export type EvolutionStage = 'egg' | 'baby' | 'young' | 'warrior';

export interface EvolutionDef {
  stage: EvolutionStage;
  levelRequired: number;
  battleWinsRequired: number;
  reward: { gold: number; description: { en: string; ms: string; zh: string } };
}

/** Ordered evolution definitions per Bible v5 */
export const EVOLUTION_DEFS: EvolutionDef[] = [
  {
    stage: 'baby',
    levelRequired: 5,
    battleWinsRequired: 0,
    reward: {
      gold: 50,
      description: {
        en: '+50 Gold! Your egg has hatched!',
        ms: '+50 Emas! Telur anda telah menetas!',
        zh: '+50金币！你的蛋已经孵化了！',
      },
    },
  },
  {
    stage: 'young',
    levelRequired: 20,
    battleWinsRequired: 0,
    reward: {
      gold: 200,
      description: {
        en: '+200 Gold & a Rare Weapon! Foxy has grown!',
        ms: '+200 Emas & Senjata Jarang! Foxy telah membesar!',
        zh: '+200金币和稀有武器！Foxy长大了！',
      },
    },
  },
  {
    stage: 'warrior',
    levelRequired: 30,
    battleWinsRequired: 25,
    reward: {
      gold: 500,
      description: {
        en: '+500 Gold & an Epic Item! Foxy is now a Warrior!',
        ms: '+500 Emas & Item Epik! Foxy kini seorang Pejuang!',
        zh: '+500金币和史诗物品！Foxy成为了战士！',
      },
    },
  },
];

const STAGE_ORDER: EvolutionStage[] = ['egg', 'baby', 'young', 'warrior'];

/**
 * Check if the fox should evolve based on current stats.
 * Returns the next stage if evolution conditions are met, or null.
 *
 * NOTE: egg → baby also requires the 48hr timer (checked externally in RealmContext).
 * This function handles the LEVEL + WINS gates only.
 */
export function checkEvolution(
  currentStage: EvolutionStage,
  level: number,
  battleWins: number,
  /** For egg → baby, the external hatch timer must also be complete */
  eggHatched: boolean,
): EvolutionStage | null {
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  if (currentIdx >= STAGE_ORDER.length - 1) return null; // already max stage

  const nextStage = STAGE_ORDER[currentIdx + 1];
  const def = EVOLUTION_DEFS.find(d => d.stage === nextStage);
  if (!def) return null;

  // Egg → Baby requires both timer AND level
  if (currentStage === 'egg') {
    if (!eggHatched) return null;
    if (level < def.levelRequired) return null;
    return nextStage;
  }

  // All other transitions: level + battle wins
  if (level < def.levelRequired) return null;
  if (battleWins < def.battleWinsRequired) return null;
  return nextStage;
}

/** Get the evolution definition for a given stage */
export function getEvolutionDef(stage: EvolutionStage): EvolutionDef | undefined {
  return EVOLUTION_DEFS.find(d => d.stage === stage);
}

/** Get display info for a stage */
export function getStageEmoji(stage: EvolutionStage): string {
  switch (stage) {
    case 'egg': return '\u{1F95A}';
    case 'baby': return '\u{1F98A}';
    case 'young': return '\u{1F525}';
    case 'warrior': return '\u2694\uFE0F';
    default: return '\u{1F98A}';
  }
}

export function getStageName(stage: EvolutionStage, lang: string): string {
  const names: Record<EvolutionStage, { en: string; ms: string; zh: string }> = {
    egg: { en: 'Egg', ms: 'Telur', zh: '\u86CB' },
    baby: { en: 'Baby Foxy', ms: 'Foxy Bayi', zh: '\u5C0F\u72D0\u72F8' },
    young: { en: 'Young Foxy', ms: 'Foxy Muda', zh: '\u5E74\u8F7B\u72D0\u72F8' },
    warrior: { en: 'Warrior Foxy', ms: 'Foxy Pejuang', zh: '\u6218\u58EB\u72D0\u72F8' },
  };
  const entry = names[stage];
  return lang === 'ms' ? entry.ms : lang === 'zh' ? entry.zh : entry.en;
}

// ═══════════════════════════════════════════════════════════════
// Evolution Reward Item IDs — Bible v5
// Young → "evo_young_foxfire_blade", Warrior → "evo_warrior_guardian_plate"
// Item stats/names/images are admin-managed in ShopManager (KV).
// This file only maps stage → itemId for the grant logic.
// ═══════════════════════════════════════════════════════════════

/** Canonical item IDs for evolution rewards — must match ShopManager KV entries */
export const EVO_YOUNG_WEAPON_ID = 'evo_young_foxfire_blade';
export const EVO_WARRIOR_ARMOR_ID = 'evo_warrior_guardian_plate';
export const FOCUS_NECKLACE_ID = 'focus_necklace';

/** Map evolution stage → reward item ID (if any). Returns null for stages with no item reward. */
export function getEvolutionRewardItemId(stage: EvolutionStage): string | null {
  if (stage === 'young') return EVO_YOUNG_WEAPON_ID;
  if (stage === 'warrior') return EVO_WARRIOR_ARMOR_ID;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Seed Defaults — used ONCE by ShopManager's "Seed Evo Items" button.
// After seeding, admin can freely edit stats/names/images in the UI.
// These are NOT used at runtime by evolution grants.
// ═══════════════════════════════════════════════════════════════

export const SEED_EVO_YOUNG_WEAPON = {
  id: EVO_YOUNG_WEAPON_ID,
  name: 'Foxfire Blade',
  description: 'A blade forged from Foxy\'s first flame. Earned by reaching Young stage.',
  imageSlug: '',
  price: 0,
  currency: 'gold' as const,
  rarity: 'rare' as const,
  category: 'treasure' as const,
  effects: [
    { type: 'attack', value: 8, isPercent: false },
    { type: 'xp_percent', value: 5, isPercent: true },
  ],
  equipSlot: 'weapon' as const,
  sortOrder: 9000,
  isActive: true,
};

export const SEED_EVO_WARRIOR_ARMOR = {
  id: EVO_WARRIOR_ARMOR_ID,
  name: 'Guardian Plate',
  description: 'Legendary armor worn by Foxy Warriors. Earned by reaching Warrior stage.',
  imageSlug: '',
  price: 0,
  currency: 'gold' as const,
  rarity: 'epic' as const,
  category: 'treasure' as const,
  effects: [
    { type: 'defense', value: 12, isPercent: false },
    { type: 'max_hp', value: 25, isPercent: false },
  ],
  equipSlot: 'armor' as const,
  sortOrder: 9001,
  isActive: true,
};

export const SEED_FOCUS_NECKLACE = {
  id: FOCUS_NECKLACE_ID,
  name: 'Focus Necklace',
  description: 'A mystical necklace that sharpens the mind. +10% XP from all activities.',
  imageSlug: '',
  price: 300,
  currency: 'gold' as const,
  rarity: 'rare' as const,
  category: 'treasure' as const,
  effects: [
    { type: 'xp_percent', value: 10, isPercent: true },
  ],
  equipSlot: 'accessory' as const,
  sortOrder: 100,
  isActive: true,
};

/** Get the next evolution target info for progress display */
export function getNextEvolutionTarget(
  currentStage: EvolutionStage,
): { nextStage: EvolutionStage; levelRequired: number; winsRequired: number; rewardItemId: string | null } | null {
  const idx = STAGE_ORDER.indexOf(currentStage);
  if (idx >= STAGE_ORDER.length - 1) return null;
  const nextStage = STAGE_ORDER[idx + 1];
  const def = EVOLUTION_DEFS.find(d => d.stage === nextStage);
  if (!def) return null;
  return {
    nextStage,
    levelRequired: def.levelRequired,
    winsRequired: def.battleWinsRequired,
    rewardItemId: getEvolutionRewardItemId(nextStage),
  };
}