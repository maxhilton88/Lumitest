/**
 * level-utils.ts — Birthdate → Age derivation
 *
 * Uses Malaysian school-year logic:
 *   - School year = calendar year (Jan–Dec)
 *   - A child enters Tahun 1 in the year they turn 7
 *   - schoolAge = currentYear - birthYear
 *
 * Age mapping:
 *   schoolAge ≤ 6  → Prasekolah (age 4-6)
 *   schoolAge  7   → Tahun 1 (age 7)
 *   schoolAge  8   → Tahun 2 (age 8)
 *   ...
 *   schoolAge ≥ 12 → Tahun 6 (age 12)
 */

import { AGE_INFO, displayLabelFromAge } from '../data/kssr-taxonomy';

export interface DerivedLevel {
  level: string;       // display label e.g. "Tahun 1", "Prasekolah Thn 1"
  age: number;         // age this calendar year (schoolAge)
  tierLabel: string;
  tierColor: string;
  tierGlow: string;
}

/**
 * Derive the display level from a child's birthdate string (ISO: YYYY-MM-DD).
 * Uses school-year logic — the level is based on the age the child turns
 * in the current calendar year, NOT their current exact age.
 */
export function deriveLevelFromBirthdate(birthdate: string): DerivedLevel {
  const birthYear = new Date(birthdate).getFullYear();
  const currentYear = new Date().getFullYear();
  const schoolAge = currentYear - birthYear;

  return deriveLevelFromAge(schoolAge);
}

/**
 * Derive the display level from a numeric age (school-year age).
 * Clamps to [4, 12].
 */
export function deriveLevelFromAge(age: number): DerivedLevel {
  const clampedAge = Math.max(4, Math.min(12, age));

  const info = AGE_INFO[clampedAge];
  return {
    level: info?.displayLabel || displayLabelFromAge(clampedAge),
    age: clampedAge,
    tierLabel: info?.tierLabel || 'Seedling',
    tierColor: info?.tierColor || '#7cc643',
    tierGlow: info?.tierGlow || 'rgba(124,198,67,0.3)',
  };
}

/**
 * Given a birthdate string, return the child's age this calendar year.
 */
export function getSchoolAge(birthdate: string): number {
  const birthYear = new Date(birthdate).getFullYear();
  return new Date().getFullYear() - birthYear;
}

/**
 * Format a birthdate for display.
 * Returns "DD MMM YYYY" (e.g. "15 Jun 2019").
 */
export function formatBirthdate(birthdate: string): string {
  const d = new Date(birthdate);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Validate that a birthdate falls in the supported age range (4–12).
 */
export function isBirthdateInRange(birthdate: string): boolean {
  const age = getSchoolAge(birthdate);
  return age >= 4 && age <= 12;
}

/**
 * Get min and max birthdates for the supported age range.
 */
export function getBirthdateBounds(): { min: string; max: string } {
  const year = new Date().getFullYear();
  // Child turning 12 this year was born in (year - 12)
  // Child turning 4 this year was born in (year - 4)
  return {
    min: `${year - 12}-01-01`,
    max: `${year - 4}-12-31`,
  };
}
