/**
 * reward-events.ts — Lightweight event bus for reward notifications
 *
 * Used by RealmContext (addGold, addXP, addDiamond) to emit events,
 * and by RewardToastOverlay + RealmHUD to consume and animate them.
 *
 * Events:
 *   'reward'  → { type: 'gold'|'diamond'|'xp', amount: number }
 *   'levelup' → { newLevel: number, levelsGained: number }
 */

export type RewardType = 'gold' | 'diamond' | 'xp';

export interface RewardEvent {
  type: RewardType;
  amount: number;
  id: string; // unique for keying animations
}

export interface LevelUpEvent {
  newLevel: number;
  levelsGained: number;
}

type Listener<T> = (data: T) => void;

const rewardListeners: Listener<RewardEvent>[] = [];
const levelUpListeners: Listener<LevelUpEvent>[] = [];

/** Emit a reward notification (call from addGold, addXP, etc.) */
export function emitReward(type: RewardType, amount: number) {
  if (amount <= 0) return;
  const event: RewardEvent = {
    type,
    amount,
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  rewardListeners.forEach(fn => fn(event));
}

/** Emit a level-up event */
export function emitLevelUp(newLevel: number, levelsGained: number) {
  if (levelsGained <= 0) return;
  levelUpListeners.forEach(fn => fn({ newLevel, levelsGained }));
}

/** Subscribe to reward events */
export function onReward(fn: Listener<RewardEvent>): () => void {
  rewardListeners.push(fn);
  return () => {
    const idx = rewardListeners.indexOf(fn);
    if (idx >= 0) rewardListeners.splice(idx, 1);
  };
}

/** Subscribe to level-up events */
export function onLevelUp(fn: Listener<LevelUpEvent>): () => void {
  levelUpListeners.push(fn);
  return () => {
    const idx = levelUpListeners.indexOf(fn);
    if (idx >= 0) levelUpListeners.splice(idx, 1);
  };
}
