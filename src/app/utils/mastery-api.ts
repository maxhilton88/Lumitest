/**
 * mastery-api.ts — Frontend utility for writing to / reading from the mastery_log backend.
 *
 * Used by all Realm modes (quest, practice, battle, test) and the legacy ChildFlow
 * to record answer-level mastery data to the cumulative KV store.
 *
 * IMPORTANT: Uses getFreshParentToken() for auto-refresh of expired tokens.
 * Falls back to raw localStorage token if the Supabase client refresh fails.
 *
 * Usage:
 *   import { recordMasteryAnswers, fetchMasteryProfile } from './mastery-api';
 *
 *   // After evaluating answers in any mode:
 *   await recordMasteryAnswers([
 *     { subjectId: 'english', skillCode: 'ENG-R-1.1', topicName: 'Reading', isCorrect: true, mode: 'quest' },
 *     { subjectId: 'english', skillCode: 'ENG-R-1.2', topicName: 'Reading', isCorrect: false, mode: 'quest' },
 *   ]);
 */

import { projectId, publicAnonKey } from './supabase/info';
import { getFreshParentToken, isJwtExpired } from './supabase-client';
import { normalizeSubjectId } from './subject-aliases';

// Re-export normalizeSubjectId so existing consumers don't break
export { normalizeSubjectId } from './subject-aliases';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

export interface MasteryAnswer {
  subjectId: string;
  skillCode: string;
  topicName: string;
  isCorrect: boolean;
  mode: 'quest' | 'practice' | 'battle' | 'test';
  ladderLevel?: number;
  /** KSSR level (e.g. 'Tahun 1', 'Prasekolah') */
  level?: string;
  /** Skill description / kemahiran */
  skillName?: string;
}

export interface MasterySubject {
  subjectId: string;
  totalAttempts: number;
  totalCorrect: number;
  percentage: number;
  byMode: Record<string, { attempts: number; correct: number }>;
  topics: {
    topicName: string;
    skillCodes: string[];
    totalAttempts: number;
    totalCorrect: number;
    percentage: number;
  }[];
  skills?: {
    skillCode: string;
    skillName: string;
    topicName: string;
    level: string;
    totalAttempts: number;
    totalCorrect: number;
    percentage: number;
  }[];
}

export interface MasteryProfile {
  subjects: MasterySubject[];
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | null;
}

export interface MasteryTrendSnapshot {
  date: string; // YYYY-MM-DD
  subjects: Record<string, { attempts: number; correct: number; percentage: number }>;
  updatedAt?: string;
}

export interface MasteryTrendResponse {
  snapshots: MasteryTrendSnapshot[];
}

/**
 * Get a valid user token — tries Supabase client refresh first,
 * then falls back to raw localStorage (rejecting expired tokens).
 */
async function getValidToken(): Promise<string | null> {
  // 1. Try the Supabase client's auto-refresh (most reliable)
  try {
    const freshToken = await getFreshParentToken();
    if (freshToken) return freshToken;
  } catch (err) {
    console.warn('[MASTERY-API] getFreshParentToken failed:', err);
  }

  // 2. Fallback to raw localStorage
  const token = localStorage.getItem('parent_access_token');
  if (!token) return null;

  // Reject expired tokens
  if (isJwtExpired(token)) {
    console.warn('[MASTERY-API] localStorage token is expired — mastery API calls will fail');
    return null;
  }

  return token;
}

/**
 * Record mastery answers to the backend.
 * Fire-and-forget safe — errors are logged but don't throw by default.
 */
export async function recordMasteryAnswers(
  answers: MasteryAnswer[],
  options?: { throwOnError?: boolean }
): Promise<{ success: boolean; recorded?: number; skills?: number; error?: string }> {
  if (!answers || answers.length === 0) {
    return { success: true, recorded: 0, skills: 0 };
  }

  const token = await getValidToken();
  if (!token) {
    console.warn('[MASTERY-API] No valid auth token — skipping mastery log write');
    return { success: false, error: 'No valid auth token' };
  }

  try {
    // Normalize subject IDs before sending (defense-in-depth — server also normalizes)
    const normalizedAnswers = answers.map(a => ({
      ...a,
      subjectId: normalizeSubjectId(a.subjectId),
    }));
    console.log(`[MASTERY-API] Sending ${normalizedAnswers.length} answers, subjects: ${[...new Set(normalizedAnswers.map(a => a.subjectId))].join(', ')}`);

    const res = await fetch(`${API_BASE}/parent/mastery-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${token}`,
      },
      body: JSON.stringify({ answers: normalizedAnswers }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[MASTERY-API] Write failed:', data.error);
      if (options?.throwOnError) throw new Error(data.error || 'Mastery log write failed');
      return { success: false, error: data.error };
    }

    console.log(`[MASTERY-API] Recorded ${data.recorded} answers across ${data.skills} skills`);
    return { success: true, recorded: data.recorded, skills: data.skills };
  } catch (err: any) {
    console.error('[MASTERY-API] Network error:', err);
    if (options?.throwOnError) throw err;
    return { success: false, error: err.message };
  }
}

/**
 * Fetch the aggregated mastery profile for the current user.
 */
export async function fetchMasteryProfile(): Promise<MasteryProfile | null> {
  const token = await getValidToken();
  if (!token) {
    console.warn('[MASTERY-API] No valid auth token — cannot fetch mastery profile');
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/parent/mastery-profile`, {
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown' }));
      console.error('[MASTERY-API] Profile fetch failed:', data.error);
      return null;
    }

    return await res.json();
  } catch (err: any) {
    console.error('[MASTERY-API] Network error:', err);
    return null;
  }
}

/**
 * Fetch daily mastery trend snapshots for charting skill improvement over time.
 */
export async function fetchMasteryTrend(days = 30): Promise<MasteryTrendSnapshot[]> {
  const token = await getValidToken();
  if (!token) {
    console.warn('[MASTERY-API] No valid auth token — cannot fetch mastery trend');
    return [];
  }

  try {
    const res = await fetch(`${API_BASE}/parent/mastery-trend?days=${days}`, {
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'X-User-Token': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Unknown' }));
      console.error('[MASTERY-API] Trend fetch failed:', data.error);
      return [];
    }

    const data: MasteryTrendResponse = await res.json();
    return data.snapshots || [];
  } catch (err: any) {
    console.error('[MASTERY-API] Trend network error:', err);
    return [];
  }
}