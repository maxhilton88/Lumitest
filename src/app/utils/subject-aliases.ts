/**
 * subject-aliases.ts — Single source of truth for subject alias maps.
 *
 * Used by PracticeScreen, RealmPracticePage, and any future quest/subject matching.
 * Maps canonical arena IDs to all known subject strings admins might use in Quest Manager.
 * Matching is case-insensitive. Order matters — first match wins.
 */

export const ARENA_SUBJECT_ALIASES: Record<string, string[]> = {
  english:    ['english', 'eng', 'inggeris', 'language', 'literacy'],
  numbers:    ['numbers', 'number', 'math', 'maths', 'mathematics', 'matematik', 'nombor', 'numeracy'],
  bahasa:     ['bahasa', 'bm', 'malay', 'melayu'],
  mandarin:   ['mandarin', 'chinese', 'mandarine', 'cina', '\u534e\u8bed', '\u534e\u6587', '\u4e2d\u6587', 'zhongwen'],
  science:    ['science', 'sains', 'discovery', 'stem'],
  sejarah:    ['sejarah', 'history', 'sejarah malaysia'],
  geography:  ['geography', 'geografi', 'geo'],
};

/**
 * Canonical subject ID normalization map.
 * Maps all known aliases (from CSV bank, quest system, etc.) to the 7 canonical
 * IDs used by RealmMasteryPage: english, numbers, bahasa, mandarin, science, sejarah, geography.
 */
export const SUBJECT_ALIAS_MAP: Record<string, string> = {
  english: 'english', eng: 'english', inggeris: 'english', 'bahasa inggeris': 'english',
  numbers: 'numbers', number: 'numbers', math: 'numbers', maths: 'numbers',
  mathematics: 'numbers', matematik: 'numbers', nombor: 'numbers', numeracy: 'numbers',
  bahasa: 'bahasa', bm: 'bahasa', malay: 'bahasa', melayu: 'bahasa',
  'bahasa melayu': 'bahasa', 'bahasa malaysia': 'bahasa',
  mandarin: 'mandarin', chinese: 'mandarin', cina: 'mandarin',
  'bahasa cina': 'mandarin', zh: 'mandarin',
  science: 'science', sains: 'science', stem: 'science', discovery: 'science',
  sejarah: 'sejarah', history: 'sejarah',
  geography: 'geography', geografi: 'geography', geo: 'geography',
};

export function normalizeSubjectId(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return SUBJECT_ALIAS_MAP[lower] || lower;
}
