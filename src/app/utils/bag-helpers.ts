/**
 * bag-helpers.ts — Bag slot system utilities (Prompt 1)
 *
 * Pokémon-style bag with:
 * - 5 free slots (default), max 20 (hard cap)
 * - Items stack to 99 per slot; overflow to new slot
 * - Equipment (treasure category) does NOT consume bag slots
 * - Slot expansion purchasable with Gold then Diamonds
 *
 * Used by BagPage, BattleScreen, and future FMCG QR reward system.
 */

import type { ShopItemDef } from './api';

// ── Constants ──
export const BAG_DEFAULT_SLOTS = 5;
export const BAG_MAX_SLOTS = 20;
export const STACK_LIMIT = 99;

// ── Slot expansion pricing table ──
// Maps slot number (6-20) to { cost, currency }
export interface SlotCost {
  cost: number;
  currency: 'gold' | 'diamond';
}

const SLOT_PRICING: Record<number, SlotCost> = {
  6:  { cost: 200, currency: 'gold' },
  7:  { cost: 400, currency: 'gold' },
  8:  { cost: 600, currency: 'gold' },
  9:  { cost: 1,   currency: 'diamond' },
  10: { cost: 1,   currency: 'diamond' },
  11: { cost: 2,   currency: 'diamond' },
  12: { cost: 2,   currency: 'diamond' },
  13: { cost: 2,   currency: 'diamond' },
  14: { cost: 2,   currency: 'diamond' },
  15: { cost: 2,   currency: 'diamond' },
  16: { cost: 3,   currency: 'diamond' },
  17: { cost: 3,   currency: 'diamond' },
  18: { cost: 3,   currency: 'diamond' },
  19: { cost: 3,   currency: 'diamond' },
  20: { cost: 3,   currency: 'diamond' },
};

/**
 * Get the cost to unlock the next bag slot.
 * Returns null if already at max (20).
 */
export function getNextSlotCost(currentSlots: number): SlotCost | null {
  const nextSlot = currentSlots + 1;
  if (nextSlot > BAG_MAX_SLOTS) return null;
  return SLOT_PRICING[nextSlot] || null;
}

/**
 * Count how many bag slots are currently used.
 * Each unique non-equipment item in inventory = 1 slot.
 * Stacks over 99 consume additional slots (Math.ceil(qty / 99)).
 * Equipment items (category = 'treasure') are excluded from counting.
 */
export function getBagSlotsUsed(
  inventory: Record<string, number>,
  shopItems: ShopItemDef[],
): number {
  const equipmentIds = new Set(
    shopItems
      .filter(i => i.category === 'treasure' && !!i.equipSlot)
      .map(i => i.id)
  );

  let slotsUsed = 0;
  for (const [itemId, qty] of Object.entries(inventory)) {
    if (qty <= 0) continue;
    if (equipmentIds.has(itemId)) continue; // equipment doesn't count
    // Each stack of up to 99 = 1 slot
    slotsUsed += Math.ceil(qty / STACK_LIMIT);
  }
  return slotsUsed;
}

/**
 * Check if an item can be added to the bag.
 * Returns { canAdd: true } or { canAdd: false, reason: string }.
 */
export function canAddToBag(
  inventory: Record<string, number>,
  itemId: string,
  addQty: number,
  bagSlots: number,
  shopItems: ShopItemDef[],
): { canAdd: true } | { canAdd: false; reason: string } {
  // Equipment bypasses bag slots
  const itemDef = shopItems.find(i => i.id === itemId);
  if (itemDef?.category === 'treasure' && itemDef.equipSlot) {
    return { canAdd: true };
  }

  const currentQty = inventory[itemId] || 0;
  const newQty = currentQty + addQty;

  // Calculate current slots used (excluding this item's current contribution)
  const currentSlotsForItem = currentQty > 0 ? Math.ceil(currentQty / STACK_LIMIT) : 0;
  const newSlotsForItem = Math.ceil(newQty / STACK_LIMIT);
  const additionalSlotsNeeded = newSlotsForItem - currentSlotsForItem;

  if (additionalSlotsNeeded <= 0) {
    // Fits in existing stack(s)
    return { canAdd: true };
  }

  // Check if we have room
  const slotsUsed = getBagSlotsUsed(inventory, shopItems);
  if (slotsUsed + additionalSlotsNeeded > bagSlots) {
    return { canAdd: false, reason: 'Bag is full! Upgrade your bag to add more items.' };
  }

  return { canAdd: true };
}

/**
 * Grant a bag slot to a user. If at max, returns gold fallback amount.
 * Used by FMCG QR reward system (Prompt 2).
 */
export function grantBagSlot(currentSlots: number): { newSlots: number; goldFallback: number } {
  if (currentSlots >= BAG_MAX_SLOTS) {
    return { newSlots: currentSlots, goldFallback: 100 };
  }
  return { newSlots: currentSlots + 1, goldFallback: 0 };
}
