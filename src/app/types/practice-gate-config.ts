/**
 * practice-gate-config.ts — Type definitions for Practice Gate Settings.
 *
 * Super admin configures rules per age-range + subject:
 *   - timeLimitSeconds: session countdown; unanswered questions = wrong when timer hits 0
 *   - minQuestions: minimum questions the child must answer before the session can end
 *   - passingScore: minimum % to "pass" (for star/grade display)
 *
 * KV key: practice_gate_config (single global object)
 */

export interface PracticeGateRule {
  id: string;
  /** Lower bound of age range (inclusive) */
  ageMin: number;
  /** Upper bound of age range (inclusive) */
  ageMax: number;
  /** Subject key — 'all' means any subject not covered by a more specific rule */
  subject: string;
  /** Session time limit in seconds (e.g. 300 = 5 minutes) */
  timeLimitSeconds: number;
  /** Minimum number of questions the child must answer */
  minQuestions: number;
  /** Passing score percentage (0–100). Default 60. */
  passingScore: number;
  /** Whether this rule is active */
  isActive: boolean;
}

export interface PracticeGateConfig {
  version: number;
  updatedAt: string;
  rules: PracticeGateRule[];
}

export const PRACTICE_SUBJECTS = [
  { id: 'all', label: 'All Subjects' },
  { id: 'english', label: 'English' },
  { id: 'numbers', label: 'Numbers / Math' },
  { id: 'bahasa', label: 'Bahasa Melayu' },
  { id: 'mandarin', label: 'Mandarin' },
  { id: 'science', label: 'Science' },
  { id: 'sejarah', label: 'Sejarah' },
  { id: 'geography', label: 'Geography' },
] as const;

export const DEFAULT_PRACTICE_GATE_CONFIG: PracticeGateConfig = {
  version: 1,
  updatedAt: new Date().toISOString(),
  rules: [
    // Default: age 4-6, all subjects, 3 min, 5 questions, 60% pass
    {
      id: 'default-4-6',
      ageMin: 4, ageMax: 6,
      subject: 'all',
      timeLimitSeconds: 180,
      minQuestions: 5,
      passingScore: 60,
      isActive: true,
    },
    // Default: age 7-9, all subjects, 5 min, 10 questions, 60% pass
    {
      id: 'default-7-9',
      ageMin: 7, ageMax: 9,
      subject: 'all',
      timeLimitSeconds: 300,
      minQuestions: 10,
      passingScore: 60,
      isActive: true,
    },
    // Default: age 10-12, all subjects, 7 min, 15 questions, 60% pass
    {
      id: 'default-10-12',
      ageMin: 10, ageMax: 12,
      subject: 'all',
      timeLimitSeconds: 420,
      minQuestions: 15,
      passingScore: 60,
      isActive: true,
    },
  ],
};
