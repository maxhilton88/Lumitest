# Prompt 1 — Bag & Inventory System

## Context
You are building the inventory/bag system for Lumi, a Malaysian kids edtech app with a Pokémon-style game economy. The app already has a working shop, item catalogue, and equipment system. This prompt covers the bag rules only — do not touch the shop, equipment slots, or reward logic.

---

## What to build

### 1. Bag slot structure

- Every user starts with **5 free bag slots**
- Maximum bag slots ever = **20** (hard cap, cannot exceed)
- Equipment (weapon, armor, boots, accessory) lives in a **separate `equipped` section** — does NOT consume bag slots
- Bag slots hold consumables and battle items only

### 2. Stacking rules

- Items of the **same type stack into 1 slot** (e.g. 10 Small Potions = 1 slot)
- Maximum stack per slot = **99** (Pokémon standard)
- If a stack hits 99 and the user tries to add more of the same item, a new slot is consumed for the overflow
- If no free slot is available when trying to add an item → show "Bag is full" error. Block the purchase/claim.

### 3. Slot expansion — purchasable from shop

Add a new "Bag Upgrade" category in the shop. Purchasing unlocks the next slot permanently on the user's account.

| Slot | Cost | Currency |
|------|------|----------|
| 6th  | 200  | 🪙 Gold |
| 7th  | 400  | 🪙 Gold |
| 8th  | 600  | 🪙 Gold |
| 9th  | 1    | 💎 Diamond |
| 10th | 1    | 💎 Diamond |
| 11th–15th | 2 each | 💎 Diamond |
| 16th–20th | 3 each | 💎 Diamond |

- Slots must be purchased **in order** — cannot buy 8th slot without owning 7th
- Store `bagSlots: number` on the user profile (default: 5)
- On purchase: deduct currency → increment `bagSlots` → persist

### 4. Slot granted from FMCG QR reward (future integration point)

When a FMCG QR reward grants `+1 bag slot`:
- Call the same slot increment logic used by shop purchase
- If user is already at max 20 → convert the bag slot reward to **100g** instead (fallback)
- Show appropriate message in the reward popup

### 5. Bag full validation

Check bag capacity at these points:
- **Shop purchase** — before deducting gold/diamonds, verify slot is available
- **Battle item equip** — before battle starts
- **FMCG QR reward claim** — if reward is an item and bag is full, prompt user to make space or auto-convert to gold (100g fallback)
- **Welcome pack / signup reward** — starter weapon goes to equipment slot (not bag), so this should never fail

### 6. UI behaviour

- Show slot count in bag UI: e.g. `🎒 3 / 5 slots used`
- When bag is full, show a lock icon on empty slots with "Unlock for Xg / X💎"
- Tapping a locked slot opens the bag upgrade shop panel directly
- Show stack count badge on item icons (e.g. `x7`)
- Do NOT show empty slots as blank — show them as locked upgrade prompts

### 7. Data model

```typescript
// On user profile
bagSlots: number          // default: 5, max: 20

// Bag item entry
{
  itemId: string          // references item catalogue
  quantity: number        // 1–99
  type: 'consumable' | 'battle_item'
}

// Bag array max length = bagSlots
// Each unique itemId occupies exactly 1 entry (slot)
```

---

## What NOT to change
- Equipment slots (weapon/armor/boots/accessory) — these are separate and unaffected
- Shop item catalogue — items and prices remain the same
- Reward logic for test/practice/battle — not in scope for this prompt
