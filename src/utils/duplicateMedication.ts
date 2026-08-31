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
