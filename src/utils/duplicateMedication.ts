import { Medication } from '../types';

export function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

export function sameMoleculeAndStrength(
  a: { molecule: string; strength: string },
  b: { molecule: string; strength: string }
): boolean {
  return normalize(a.molecule) === normalize(b.molecule) && normalize(a.strength) === normalize(b.strength);
}

// A repeated "Check for medicines" click (or scanning the same prescription
// twice) shouldn't silently create a second entry for a medicine someone is
// already actively taking — same molecule + strength, still active, is treated
// as the same medication regardless of which document it came from or when.
export function findExistingActiveMedication(
  existing: Medication[],
  candidate: { molecule: string; strength: string }
): Medication | undefined {
  return existing.find((m) => m.status === 'active' && sameMoleculeAndStrength(m, candidate));
}

// Used to resolve "update X's dose" against the real medicine list, rather
// than the assistant guessing an id it can't actually know. Molecule-only
// (not strength) since the whole point is the strength may be changing.
export function findActiveMedicationsByMolecule(existing: Medication[], molecule: string): Medication[] {
  const norm = normalize(molecule);
  return existing.filter((m) => m.status === 'active' && normalize(m.molecule) === norm);
}

// Looser than findActiveMedicationsByMolecule — matches a brand name too, and
// a partial/substring match either direction, so "stop glucophage" can still
// find an entry logged as molecule "Metformin" with brand_name "Glucophage",
// and "stop the metformin" still finds "Metformin HCl". Used for stopping a
// medicine, where the caregiver's wording is less likely to exactly match
// what's on file than a molecule name they're actively adjusting the dose of —
// every match is shown to the caregiver to confirm, never acted on silently.
export function findActiveMedicationsFuzzy(existing: Medication[], query: string): Medication[] {
  const norm = normalize(query);
  if (!norm) return [];
  return existing.filter((m) => {
    if (m.status !== 'active') return false;
    const molNorm = normalize(m.molecule);
    const brandNorm = m.brand_name ? normalize(m.brand_name) : '';
    return (
      molNorm === norm ||
      brandNorm === norm ||
      molNorm.includes(norm) ||
      norm.includes(molNorm) ||
      (brandNorm !== '' && (brandNorm.includes(norm) || norm.includes(brandNorm)))
    );
  });
}
