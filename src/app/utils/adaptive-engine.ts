/**
 * adaptive-engine.ts — Adaptive Question Ladder
 *
 * Core logic for serving questions based on the child's performance:
 *
 *   1. Start at derived age (from birthdate)
 *   2. On 2 consecutive correct → age UP (max 12)
 *   3. On wrong → age DOWN (min 4)
 *   4. Questions are filtered by subject + current age
 *   5. Never repeat a question within the same session
 *
 * The engine is stateless — call getNextQuestion() with current state
 * and it returns the next question + updated state.
 */

import { VALID_AGES, displayLabelFromAge, type SubjectCode } from '../data/kssr-taxonomy';
import {
  ALL_SAMPLE_QUESTIONS,
  getQuestionsByAgeAndSubject,
  getQuestionsByAge,
  toQuestionScreenFormat,
  type TaxonomyQuestion,
} from '../data/sample-questions';
import { deriveLevelFromAge, type DerivedLevel } from './level-utils';

// ── Session state ──────────────────────────────────────────────────────────────

export interface AdaptiveState {
  /** Current difficulty age (4-12) */
  currentAge: number;
  /** Streak of consecutive correct answers at current or higher age */
  correctStreak: number;
  /** IDs of questions already served (no repeats) */
  seenQuestionIds: Set<string>;
  /** Total questions answered */
  totalAnswered: number;
  /** Total correct */
  totalCorrect: number;
  /** History of age changes for visualization */
  levelHistory: Array<{ level: string; age: number; questionId: string; correct: boolean }>;
}

export interface AdaptiveResult {
  question: TaxonomyQuestion | null;
  state: AdaptiveState;
  /** True if no more questions available at any age */
  exhausted: boolean;
}

// ── Age helpers ────────────────────────────────────────────────────────────────

function ageUp(age: number): number {
  return Math.min(12, age + 1);
}

function ageDown(age: number): number {
  return Math.max(4, age - 1);
}

// ── Create initial state ───────────────────────────────────────────────────────

export function createAdaptiveState(startAge: number): AdaptiveState {
  return {
    currentAge: Math.max(4, Math.min(12, startAge)),
    correctStreak: 0,
    seenQuestionIds: new Set(),
    totalAnswered: 0,
    totalCorrect: 0,
    levelHistory: [],
  };
}

export function createAdaptiveStateFromAge(age: number): AdaptiveState {
  return createAdaptiveState(age);
}

// Backward compat — accepts a level string
/** @deprecated Use createAdaptiveState(age) directly */
export function createAdaptiveStateFromLevel(level: string): AdaptiveState {
  // Map display label back to age
  const age = VALID_AGES.find(a => displayLabelFromAge(a) === level) || 4;
  return createAdaptiveState(age);
}

// ── Get next question ──────────────────────────────────────────────────────────

/**
 * Get the next question for the session.
 *
 * @param state   Current adaptive state
 * @param subject Optional subject filter (null = any subject)
 * @returns       The next question + updated state, or null if exhausted
 */
export function getNextQuestion(
  state: AdaptiveState,
  subject?: SubjectCode | null,
): AdaptiveResult {
  // Try to find an unseen question at the current age
  let candidates = subject
    ? getQuestionsByAgeAndSubject(state.currentAge, subject)
    : getQuestionsByAge(state.currentAge);

  candidates = candidates.filter(q => !state.seenQuestionIds.has(q.id));

  if (candidates.length > 0) {
    // Pick a random question from candidates
    const question = candidates[Math.floor(Math.random() * candidates.length)];
    return { question, state, exhausted: false };
  }

  // No questions at current age — try adjacent ages (prefer down, then up)
  const tryAges = [
    ageDown(state.currentAge),
    ageUp(state.currentAge),
  ].filter(a => a !== state.currentAge);

  for (const tryAge of tryAges) {
    let fallback = subject
      ? getQuestionsByAgeAndSubject(tryAge, subject)
      : getQuestionsByAge(tryAge);
    fallback = fallback.filter(q => !state.seenQuestionIds.has(q.id));
    if (fallback.length > 0) {
      const question = fallback[Math.floor(Math.random() * fallback.length)];
      return { question, state: { ...state, currentAge: tryAge }, exhausted: false };
    }
  }

  // Truly exhausted — no questions left at any age
  return { question: null, state, exhausted: true };
}

// ── Record answer ──────────────────────────────────────────────────────────────

/**
 * Record an answer and update the adaptive state.
 *
 * Ladder rules:
 *   - 2 consecutive correct at current age → age UP
 *   - 1 wrong → age DOWN, reset streak
 */
export function recordAnswer(
  state: AdaptiveState,
  questionId: string,
  isCorrect: boolean,
): AdaptiveState {
  const newSeen = new Set(state.seenQuestionIds);
  newSeen.add(questionId);

  const newHistory = [...state.levelHistory, {
    level: displayLabelFromAge(state.currentAge),
    age: state.currentAge,
    questionId,
    correct: isCorrect,
  }];

  if (isCorrect) {
    const newStreak = state.correctStreak + 1;
    if (newStreak >= 2) {
      // Age up!
      return {
        currentAge: ageUp(state.currentAge),
        correctStreak: 0,
        seenQuestionIds: newSeen,
        totalAnswered: state.totalAnswered + 1,
        totalCorrect: state.totalCorrect + 1,
        levelHistory: newHistory,
      };
    }
    return {
      ...state,
      correctStreak: newStreak,
      seenQuestionIds: newSeen,
      totalAnswered: state.totalAnswered + 1,
      totalCorrect: state.totalCorrect + 1,
      levelHistory: newHistory,
    };
  } else {
    // Wrong → age down, reset streak
    return {
      currentAge: ageDown(state.currentAge),
      correctStreak: 0,
      seenQuestionIds: newSeen,
      totalAnswered: state.totalAnswered + 1,
      totalCorrect: state.totalCorrect,
      levelHistory: newHistory,
    };
  }
}

// ── Mastery calculation from session ───────────────────────────────────────────

export interface SubjectMastery {
  subject: SubjectCode;
  topicMastery: Array<{
    topic: string;
    correct: number;
    total: number;
    pct: number;
    skillCodes: string[];
  }>;
  overallCorrect: number;
  overallTotal: number;
  overallPct: number;
  /** Highest age where the child got ≥50% correct */
  functionalAge: number;
  /** @deprecated Use functionalAge. Display label kept for backward compat */
  functionalLevel: string;
}

/**
 * Calculate mastery from session history.
 * Groups answers by subject → topic → skill code.
 */
export function calculateSessionMastery(
  levelHistory: AdaptiveState['levelHistory'],
  questions: TaxonomyQuestion[],
): SubjectMastery[] {
  // Build a quick lookup: questionId → question
  const qMap = new Map<string, TaxonomyQuestion>();
  for (const q of questions) qMap.set(q.id, q);

  // Group by subject
  const bySubject = new Map<SubjectCode, Map<string, { correct: number; total: number; skillCodes: Set<string> }>>();

  for (const entry of levelHistory) {
    const q = qMap.get(entry.questionId);
    if (!q) continue;

    if (!bySubject.has(q.subject)) bySubject.set(q.subject, new Map());
    const topicMap = bySubject.get(q.subject)!;

    if (!topicMap.has(q.topic)) topicMap.set(q.topic, { correct: 0, total: 0, skillCodes: new Set() });
    const topicEntry = topicMap.get(q.topic)!;

    topicEntry.total++;
    if (entry.correct) topicEntry.correct++;
    topicEntry.skillCodes.add(q.skillCode);
  }

  // Convert to output format
  const result: SubjectMastery[] = [];
  for (const [subject, topicMap] of bySubject) {
    const topics = Array.from(topicMap.entries()).map(([topic, data]) => ({
      topic,
      correct: data.correct,
      total: data.total,
      pct: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      skillCodes: Array.from(data.skillCodes),
    }));

    const overallCorrect = topics.reduce((sum, t) => sum + t.correct, 0);
    const overallTotal = topics.reduce((sum, t) => sum + t.total, 0);

    // Calculate functional age — highest age with ≥50% accuracy
    const ageScores = new Map<number, { correct: number; total: number }>();
    for (const entry of levelHistory) {
      const q = qMap.get(entry.questionId);
      if (!q || q.subject !== subject) continue;
      const entryAge = entry.age || 4;
      if (!ageScores.has(entryAge)) ageScores.set(entryAge, { correct: 0, total: 0 });
      const as = ageScores.get(entryAge)!;
      as.total++;
      if (entry.correct) as.correct++;
    }

    let functionalAge = 4;
    for (const age of VALID_AGES) {
      const as = ageScores.get(age);
      if (as && as.total > 0 && (as.correct / as.total) >= 0.5) {
        functionalAge = age;
      }
    }

    result.push({
      subject,
      topicMastery: topics,
      overallCorrect,
      overallTotal,
      overallPct: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0,
      functionalAge,
      functionalLevel: displayLabelFromAge(functionalAge),
    });
  }

  return result;
}

// ── Convert to QuestionScreen format ───────────────────────────────────────────

export { toQuestionScreenFormat };
