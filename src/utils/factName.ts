// Groups facts extracted from separate reports as "the same test" even when
// wording drifts slightly (methodology notes, sample type, units in the name).
// Deliberately conservative — strips only parenthetical qualifiers and trailing
// comma-separated qualifiers, rather than fuzzy-matching, since over-matching
// would wrongly merge genuinely different tests (e.g. "Cholesterol" vs "HDL
// Cholesterol").

// A side/laterality qualifier — "(Left Eye)" vs "(Right Eye)", "OD" vs "OS" —
// is not incidental noise like a methodology note; it's the whole reason two
// otherwise-identical fact names are actually different measurements (e.g.
// intraocular pressure in each eye is its own trend and must never be
// averaged/merged together). Checked against the raw name before any
// stripping, since it can appear inside parens or after a comma either way.
const LATERALITY_TERMS: Record<string, string> = {
  left: 'left',
  right: 'right',
  bilateral: 'both',
  os: 'left', // oculus sinister
  od: 'right', // oculus dexter
  ou: 'both', // oculus uterque
};
const LATERALITY_PATTERN = /\b(left|right|bilateral|od|os|ou)\b/i;

function extractLaterality(name: string): string | undefined {
  const match = name.match(LATERALITY_PATTERN);
  return match ? LATERALITY_TERMS[match[1].toLowerCase()] : undefined;
}

export function normalizeFactName(name: string): string {
  const laterality = extractLaterality(name);

  const base = name
    .replace(/\([^)]*\)/g, '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  return laterality ? `${base} — ${laterality}` : base;
}

function normalizeSegment(segment: string, laterality?: string): string {
  const base = segment.trim().toLowerCase().replace(/\s+/g, ' ');
  return laterality ? `${base} — ${laterality}` : base;
}

// Every plausible "core" reading of a fact name — not just the one
// normalizeFactName settles on — for detecting merge *candidates* (never for
// auto-merging; a human still confirms every merge in the Standardize Names
// tool). normalizeFactName has to pick a single side deterministically
// ("Creatinine (Enzymatic, Serum)" → the outside text is canonical, the
// parenthetical is methodology noise to drop), but that same rule is wrong
// half the time in practice — a report just as often writes the canonical
// short form *inside* the parens ("Glycosylated Hb (HbA1C)") with the outside
// text being the verbose alias. Since there's no way to know which case a
// given name is without understanding it, both sides are offered as
// candidates, plus every comma-separated segment, so two names sharing any
// one of these still connect for a merge suggestion.
export function factNameCandidates(name: string): string[] {
  const laterality = extractLaterality(name);
  const candidates = new Set<string>();

  const withoutParens = name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  withoutParens
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((segment) => candidates.add(normalizeSegment(segment, laterality)));

  const parenMatch = name.match(/\(([^)]*)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    // Only trust the parenthetical as a standalone name when it's a single
    // short label ("HbA1c", "eGFR") — a longer, comma-heavy aside ("Enzymatic,
    // Serum") reads as a methodology note, not another name for the test.
    if (inner.length === 1 && inner[0].length > 0 && inner[0].length <= 20) {
      candidates.add(normalizeSegment(inner[0], laterality));
    }
  }

  return Array.from(candidates).filter(Boolean);
}
