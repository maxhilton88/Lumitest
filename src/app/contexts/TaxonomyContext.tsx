/**
 * TaxonomyContext — Frontend context for KSSR skill taxonomy.
 *
 * Loads the live taxonomy from KV (server), falls back to
 * the hardcoded SKILL_TAXONOMY in /data/kssr-taxonomy.ts.
 *
 * All components should use useTaxonomy() instead of importing
 * SKILL_TAXONOMY directly, so the admin-uploaded v4 taxonomy
 * is used when available.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  SKILL_TAXONOMY,
  SKILL_BY_CODE,
  ageFromSkillCode,
  resolveSkillAge,
  type SkillEntry,
  type SubjectCode,
} from '../data/kssr-taxonomy';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-221a61bc`;

interface TaxonomyState {
  /** The active taxonomy skills list */
  skills: SkillEntry[];
  /** O(1) lookup: skillCode → SkillEntry */
  byCode: Record<string, SkillEntry>;
  /** Nested: age → subject → topic → SkillEntry[] */
  tree: Record<number, Record<string, Record<string, SkillEntry[]>>>;
  /** Whether the live taxonomy was loaded (vs fallback) */
  isLive: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message if load failed */
  error: string | null;
  /** Force reload from server */
  reload: () => Promise<void>;
}

const TaxonomyContext = createContext<TaxonomyState | null>(null);

function buildTree(skills: SkillEntry[]): Record<number, Record<string, Record<string, SkillEntry[]>>> {
  const tree: Record<number, Record<string, Record<string, SkillEntry[]>>> = {};
  for (const s of skills) {
    const age = resolveSkillAge(s);
    if (!tree[age]) tree[age] = {};
    if (!tree[age][s.subject]) tree[age][s.subject] = {};
    if (!tree[age][s.subject][s.topic]) tree[age][s.subject][s.topic] = [];
    tree[age][s.subject][s.topic].push(s);
  }
  return tree;
}

function buildByCode(skills: SkillEntry[]): Record<string, SkillEntry> {
  return Object.fromEntries(skills.map(s => [s.skillCode, s]));
}

export function TaxonomyProvider({ children }: { children: React.ReactNode }) {
  const [skills, setSkills] = useState<SkillEntry[]>(SKILL_TAXONOMY);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/taxonomy`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
        setSkills(data.skills);
        setIsLive(true);
        console.log(`[TAXONOMY] Loaded ${data.skills.length} live skills from server`);
      } else if (data.source === 'empty') {
        // Server explicitly has no taxonomy (e.g. after Remove All) — respect that
        setSkills([]);
        setIsLive(true);
        console.log('[TAXONOMY] Server taxonomy is empty (cleared)');
      } else if (!loadedRef.current) {
        // First load and server returned something unexpected — use hardcoded fallback
        console.log('[TAXONOMY] Server returned empty taxonomy on initial load, using hardcoded fallback');
      } else {
        // Subsequent reload returned empty — respect server state
        setSkills([]);
        setIsLive(true);
        console.log('[TAXONOMY] Server taxonomy is empty');
      }
    } catch (err: any) {
      console.warn('[TAXONOMY] Failed to load from server, using fallback:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      reload();
    }
  }, [reload]);

  const byCode = React.useMemo(() => buildByCode(skills), [skills]);
  const tree = React.useMemo(() => buildTree(skills), [skills]);

  return (
    <TaxonomyContext.Provider value={{ skills, byCode, tree, isLive, loading, error, reload }}>
      {children}
    </TaxonomyContext.Provider>
  );
}

export function useTaxonomy(): TaxonomyState {
  const ctx = useContext(TaxonomyContext);
  if (!ctx) {
    // Fallback for components outside the provider
    return {
      skills: SKILL_TAXONOMY,
      byCode: SKILL_BY_CODE,
      tree: buildTree(SKILL_TAXONOMY),
      isLive: false,
      loading: false,
      error: null,
      reload: async () => {},
    };
  }
  return ctx;
}