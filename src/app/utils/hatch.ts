/**
 * hatch.ts — Shared egg-hatch timing logic
 *
 * The egg starts a 48-hour countdown on first visit.
 * After 48 hours the egg is "hatched" and Foxy replaces the egg everywhere.
 *
 * SOURCE OF TRUTH: `stats.hatchStartMs` in RealmContext (persisted to KV).
 * FALLBACK: localStorage key `foxy_egg_hatch_start` (legacy, not user-scoped).
 *
 * Callers should prefer the stats-aware variants (getHatchStartFromStats,
 * isEggHatchedFromStats) which check the KV-persisted value first.
 * The old global functions are retained for backward compat but now also
 * seed `stats.hatchStartMs` on first call via the callback.
 */

const HATCH_KEY = 'foxy_egg_hatch_start';
const HATCH_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Evolution stages ordered by progression.
 * If evolutionStage is anything past 'egg', the hatch is PERMANENT —
 * the fox must never revert to an egg regardless of timer state.
 */
const HATCHED_STAGES = new Set(['baby', 'young', 'warrior']);

// ── Stats-aware API (preferred) ──

/**
 * Get the hatch start epoch from stats.hatchStartMs (KV-persisted),
 * falling back to localStorage, and initialising if neither exists.
 *
 * @param statsHatchMs  The `stats.hatchStartMs` value from RealmContext.
 * @param onInit        Optional callback to persist a newly-generated start
 *                      back into stats (so it reaches KV on next debounce).
 */
export function getHatchStartFromStats(
  statsHatchMs: number | undefined,
  onInit?: (ms: number) => void,
): number {
  // 1) Stats has it (KV-persisted) — authoritative
  if (statsHatchMs && statsHatchMs > 0) {
    // Also write to localStorage so the legacy code path stays in sync
    try { localStorage.setItem(HATCH_KEY, String(statsHatchMs)); } catch {}
    return statsHatchMs;
  }

  // 2) Fallback: localStorage (legacy global key)
  try {
    const stored = localStorage.getItem(HATCH_KEY);
    if (stored) {
      const ms = parseInt(stored, 10);
      if (ms > 0) {
        // Push it back into stats so it persists to KV
        onInit?.(ms);
        return ms;
      }
    }
  } catch {}

  // 3) First visit ever — initialise
  const now = Date.now();
  try { localStorage.setItem(HATCH_KEY, String(now)); } catch {}
  onInit?.(now);
  return now;
}

/** Has the 48-hour incubation period elapsed? (stats-aware) */
export function isEggHatchedFromStats(
  statsHatchMs: number | undefined,
  onInit?: (ms: number) => void,
  /** Pass stats.evolutionStage — if already past 'egg', returns true immediately (permanent guard) */
  evolutionStage?: string,
): boolean {
  // PERMANENT GUARD: once promoted past 'egg', hatch is irreversible
  if (evolutionStage && HATCHED_STAGES.has(evolutionStage)) {
    return true;
  }
  const start = getHatchStartFromStats(statsHatchMs, onInit);
  return (Date.now() - start) >= HATCH_DURATION_MS;
}

/** Milliseconds remaining until hatch (stats-aware) */
export function hatchRemainingFromStats(
  statsHatchMs: number | undefined,
  onInit?: (ms: number) => void,
  /** Pass stats.evolutionStage — if already past 'egg', returns 0 immediately */
  evolutionStage?: string,
): number {
  // PERMANENT GUARD: already hatched, no time remaining
  if (evolutionStage && HATCHED_STAGES.has(evolutionStage)) {
    return 0;
  }
  const start = getHatchStartFromStats(statsHatchMs, onInit);
  return Math.max(0, HATCH_DURATION_MS - (Date.now() - start));
}

// ── Legacy API (global localStorage only — backward compat) ──

/** Initialise the hatch timer if it doesn't exist yet; return the start epoch. */
export function getOrSetHatchStart(): number {
  const stored = localStorage.getItem(HATCH_KEY);
  if (stored) return parseInt(stored, 10);
  const now = Date.now();
  localStorage.setItem(HATCH_KEY, String(now));
  return now;
}

/** Has the 48-hour incubation period elapsed? */
export function isEggHatched(): boolean {
  const start = getOrSetHatchStart();
  return (Date.now() - start) >= HATCH_DURATION_MS;
}

/** Milliseconds remaining until hatch (0 if already hatched). */
export function hatchRemaining(): number {
  const start = getOrSetHatchStart();
  return Math.max(0, HATCH_DURATION_MS - (Date.now() - start));
}

export { HATCH_KEY, HATCH_DURATION_MS };