// Groups facts extracted from separate reports as "the same test" even when
// wording drifts slightly (methodology notes, sample type, units in the name).
// Deliberately conservative — strips only parenthetical qualifiers and trailing
// comma-separated qualifiers, rather than fuzzy-matching, since over-matching
// would wrongly merge genuinely different tests (e.g. "Cholesterol" vs "HDL
// Cholesterol").
export function normalizeFactName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}
