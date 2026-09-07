import { DocumentRecord } from '../types';
import { factNameCandidates } from './factName';

// Two names that are identical except for case, whitespace, or trailing
// punctuation carry zero ambiguity — "HbA1c" / "hba1c" / "HbA1c." are the same
// string, just formatted differently, unlike a true wording difference
// ("HbA1c" vs "Glycated Hemoglobin") which needs a human to judge. Only this
// stricter key is used for automatic, no-confirmation merging.
function formatOnlyKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.:;]+$/, '');
}

export interface FactNameVariant {
  name: string;
  count: number;
}

export interface FactNameCluster {
  key: string;
  variants: FactNameVariant[];
  totalCount: number;
  suggestedName: string;
}

// Groups fact names across a person's records into merge candidates, then
// keeps only the groups where more than one distinct raw name was actually
// used AND that difference is more than formatting — pure case/whitespace
// variants are auto-merged elsewhere (see computeFormatOnlyMerges) and never
// need a human decision.
//
// Two names land in the same group if they share ANY candidate reading from
// factNameCandidates — not just the single normalizeFactName key used for
// actual trend-matching — via union-find, so e.g. "Glycosylated Hb (HbA1C)"
// and "HBA1C, Glycated Hemoglobin" connect through the shared "hba1c"
// candidate even though neither name's *primary* normalized form matches the
// other's. This only ever produces a suggestion for a human to confirm — it
// doesn't change what normalizeFactName groups into one trend on its own.
export function computeFactNameClusters(records: DocumentRecord[]): FactNameCluster[] {
  const nameCounts = new Map<string, number>();
  for (const record of records) {
    for (const fact of record.facts) {
      nameCounts.set(fact.name, (nameCounts.get(fact.name) || 0) + 1);
    }
  }
  const names = Array.from(nameCounts.keys());

  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const namesByCandidate = new Map<string, string[]>();
  for (const name of names) {
    find(name);
    for (const candidate of factNameCandidates(name)) {
      if (!namesByCandidate.has(candidate)) namesByCandidate.set(candidate, []);
      namesByCandidate.get(candidate)!.push(name);
    }
  }
  for (const group of namesByCandidate.values()) {
    for (let i = 1; i < group.length; i++) union(group[0], group[i]);
  }

  const namesByRoot = new Map<string, string[]>();
  for (const name of names) {
    const root = find(name);
    if (!namesByRoot.has(root)) namesByRoot.set(root, []);
    namesByRoot.get(root)!.push(name);
  }

  const clusters: FactNameCluster[] = [];
  for (const groupNames of namesByRoot.values()) {
    // Collapse variants that only differ by formatting before deciding
    // whether this cluster needs a human at all.
    const formatGroups = new Set(groupNames.map(formatOnlyKey));
    if (formatGroups.size < 2) continue;

    const variants = groupNames
      .map((name) => ({ name, count: nameCounts.get(name) || 0 }))
      .sort((a, b) => b.count - a.count);
    clusters.push({
      key: groupNames.slice().sort().join(' | '),
      variants,
      totalCount: variants.reduce((sum, v) => sum + v.count, 0),
      suggestedName: variants[0].name,
    });
  }

  return clusters.sort((a, b) => b.totalCount - a.totalCount);
}

// Renames every fact in `records` whose name is in `variantNames` to
// `canonicalName`. Only the name field changes — value, verification status,
// confidence, and provenance are untouched. Returns the records that actually
// changed, for the caller to persist.
export function applyFactNameRename(
  records: DocumentRecord[],
  variantNames: string[],
  canonicalName: string
): DocumentRecord[] {
  const nameSet = new Set(variantNames);
  const updated: DocumentRecord[] = [];
  for (const record of records) {
    let changed = false;
    const facts = record.facts.map((f) => {
      if (nameSet.has(f.name) && f.name !== canonicalName) {
        changed = true;
        return { ...f, name: canonicalName };
      }
      return f;
    });
    if (changed) updated.push({ ...record, facts });
  }
  return updated;
}

export interface FormatOnlyMerge {
  key: string;
  canonicalName: string;
}

// Finds fact names that differ only by case/whitespace/trailing punctuation —
// safe to merge with no human review at all.
export function computeFormatOnlyMerges(records: DocumentRecord[]): FormatOnlyMerge[] {
  const byKey = new Map<string, Map<string, number>>();
  for (const record of records) {
    for (const fact of record.facts) {
      const key = formatOnlyKey(fact.name);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, new Map());
      const variants = byKey.get(key)!;
      variants.set(fact.name, (variants.get(fact.name) || 0) + 1);
    }
  }

  const merges: FormatOnlyMerge[] = [];
  for (const [key, variantCounts] of byKey.entries()) {
    if (variantCounts.size < 2) continue;
    const sorted = Array.from(variantCounts.entries()).sort((a, b) => b[1] - a[1]);
    merges.push({ key, canonicalName: sorted[0][0] });
  }
  return merges;
}

// Applies format-only merges in one pass. Same guarantee as applyFactNameRename:
// only the name field changes.
export function applyFormatOnlyMerges(records: DocumentRecord[], merges: FormatOnlyMerge[]): DocumentRecord[] {
  const keyToCanonical = new Map(merges.map((m) => [m.key, m.canonicalName]));
  const updated: DocumentRecord[] = [];
  for (const record of records) {
    let changed = false;
    const facts = record.facts.map((f) => {
      const canonical = keyToCanonical.get(formatOnlyKey(f.name));
      if (canonical && f.name !== canonical) {
        changed = true;
        return { ...f, name: canonical };
      }
      return f;
    });
    if (changed) updated.push({ ...record, facts });
  }
  return updated;
}
