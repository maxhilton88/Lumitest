/**
 * realm_reward_config — Gold Economy configuration types
 *
 * KV key: realm_reward_config (single global object)
 * Managed by SuperAdmin panel, consumed by Realm reward calculations.
 *
 * Bible v5 — Session-based rewards:
 *   Test & Practice: flat sessionXp on completion + gold-only accuracy bonuses (≥80%)
 *   Flashcard: flat gold+xp, age-gated 4-6 only
 *   Video & Music: 0g / 0xp (pure content, no rewards)
 *   Battle: separate formula (stake × 2 for winner, level-scaled XP)
 */

// ── Part A: Activity Reward Table ──
export interface ActivityReward {
  gold: number;
  xp: number;
  dailyLimit: boolean; // true = one gold payout per day per activity type
  freeMaxPerDay: number;    // max sessions/day for free users (-1 = unlimited)
  premiumMaxPerDay: number; // max sessions/day for premium users (-1 = unlimited)
  ageMin?: number;  // minimum age for rewards (undefined = no limit)
  ageMax?: number;  // maximum age for rewards (undefined = no limit)
}

export type ActivityType =
  | 'test'
  | 'practice'
  | 'flashcard'
  | 'video'
  | 'music'
  | 'battle';

// ── Part B: Score Bonus Table (Test & Practice only) ──
// Bible v5: accuracy bonuses are GOLD-ONLY. XP fields kept for admin flexibility but default 0.
export interface ScoreTierBonus {
  gold: number;
  xp: number;
}

export interface AgeBonusEntry {
  age: number;
  sessionXp: number; // flat XP awarded on session completion (always, regardless of accuracy)
  above80: ScoreTierBonus;  // >80% accuracy
  above90: ScoreTierBonus;  // >90% accuracy
  perfect: ScoreTierBonus;  // 100% accuracy
}

// ── Full Config Shape ──
export interface RealmRewardConfig {
  version: number;
  updatedAt: string;

  // Part A
  activities: Record<ActivityType, ActivityReward>;

  // Part B — array of 9 entries (age 4–12)
  ageBonuses: AgeBonusEntry[];
}

// ── Sensible Defaults (Bible v5) ──
// Test & Practice: rewards come entirely from Part B (session-based)
// Flashcard: 5g + 5xp, age-gated 4-6 only
// Video & Music: 0g + 0xp (pure content consumption)
// Battle: 0 here — battle has its own stake/XP formula

function generateAgeBonuses(): AgeBonusEntry[] {
  const ages = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  return ages.map(age => {
    // Scaling factor: age 4 = 1x, age 12 = 4x
    const scale = 1 + (age - 4) * 0.375;
    return {
      age,
      // Session XP: flat on completion, always awarded
      sessionXp: Math.round(20 * scale),
      // Accuracy bonuses: GOLD-ONLY (XP = 0), mutually exclusive (highest tier wins)
      above80: {
        gold: Math.round(10 * scale),
        xp: 0,
      },
      above90: {
        gold: Math.round(25 * scale),
        xp: 0,
      },
      perfect: {
        gold: Math.round(60 * scale),
        xp: 0,
      },
    };
  });
}

export const DEFAULT_REWARD_CONFIG: RealmRewardConfig = {
  version: 2,
  updatedAt: new Date().toISOString(),

  activities: {
    test:      { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    practice:  { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    flashcard: { gold: 5,  xp: 5,  dailyLimit: true,  freeMaxPerDay: 3,  premiumMaxPerDay: -1, ageMin: 4, ageMax: 6 },
    video:     { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: 2,  premiumMaxPerDay: -1 },
    music:     { gold: 0,  xp: 0,  dailyLimit: false, freeMaxPerDay: -1, premiumMaxPerDay: -1 },
    battle:    { gold: 0,  xp: 0,  dailyLimit: true,  freeMaxPerDay: 1,  premiumMaxPerDay: -1 },
  },

  ageBonuses: generateAgeBonuses(),
};

/**
 * Calculate total rewards for a Test or Practice session (Bible v5 — session-based)
 *
 * Rules:
 *   - XP: always awarded on session completion = ageEntry.sessionXp
 *   - Gold: 0 if accuracy < 80%. Otherwise highest matching tier (100% > 90% > 80%)
 *   - Accuracy bonuses are mutually exclusive (only highest tier applies)
 *   - No per-question tracking
 */
export function calculateConfigRewards(
  config: RealmRewardConfig,
  activityType: 'test' | 'practice',
  selectedAge: number,
  correct: number,
  total: number,
): {
  baseGold: number;
  baseXp: number;
  bonusGold: number;
  bonusXp: number;
  totalGold: number;
  totalXp: number;
  stars: number;
  accuracy: number;
} {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const stars = accuracy >= 80 ? 3 : accuracy >= 60 ? 2 : accuracy >= 30 ? 1 : 0;

  // Find age entry for session XP + accuracy gold
  const ageEntry = config.ageBonuses.find(e => e.age === selectedAge);
  
  // Session XP: always awarded on completion (this IS the base XP)
  const sessionXp = ageEntry?.sessionXp ?? 20;
  
  // Accuracy gold: only if >= 80%, mutually exclusive tiers
  let accuracyGold = 0;
  let bonusXp = 0; // tier XP bonus (default 0 per bible, but admin-tunable)

  if (ageEntry) {
    if (accuracy === 100) {
      accuracyGold = ageEntry.perfect.gold;
      bonusXp = ageEntry.perfect.xp;
    } else if (accuracy >= 90) {
      accuracyGold = ageEntry.above90.gold;
      bonusXp = ageEntry.above90.xp;
    } else if (accuracy >= 80) {
      accuracyGold = ageEntry.above80.gold;
      bonusXp = ageEntry.above80.xp;
    }
  }

  return {
    baseGold: 0,          // no per-question gold
    baseXp: sessionXp,    // session completion XP
    bonusGold: accuracyGold,
    bonusXp,              // 0 by default (admin can tune)
    totalGold: accuracyGold,
    totalXp: sessionXp + bonusXp,
    stars,
    accuracy,
  };
}

/**
 * Get potential loot preview for a given age level (best-case scenario)
 * Shows what a kid could earn with 100% accuracy.
 */
export function getLootPreview(
  config: RealmRewardConfig,
  selectedAge: number,
  _questionCount: number = 10, // kept for API compat but unused in session model
): { maxGold: number; maxXp: number } {
  const ageEntry = config.ageBonuses.find(e => e.age === selectedAge);
  
  // Best case: 100% accuracy
  const sessionXp = ageEntry?.sessionXp ?? 20;
  const perfectGold = ageEntry?.perfect.gold ?? 60;
  const perfectXp = ageEntry?.perfect.xp ?? 0;

  return {
    maxGold: perfectGold,
    maxXp: sessionXp + perfectXp,
  };
}

/**
 * Check if an activity's rewards are age-gated and whether the given age qualifies.
 */
export function isAgeEligibleForReward(
  config: RealmRewardConfig,
  activityType: ActivityType,
  childAge: number,
): boolean {
  const act = config.activities[activityType];
  if (!act) return false;
  if (act.ageMin !== undefined && childAge < act.ageMin) return false;
  if (act.ageMax !== undefined && childAge > act.ageMax) return false;
  return true;
}