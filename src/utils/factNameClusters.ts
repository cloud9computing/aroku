import { DocumentRecord } from '../types';
import { normalizeFactName } from './factName';

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

// Groups every fact name across a person's records by the same conservative
// normalization used for trend-matching, then keeps only the clusters where
// more than one distinct raw name was actually used AND that difference is
// more than formatting — pure case/whitespace variants are auto-merged
// elsewhere (see computeFormatOnlyMerges) and never need a human decision.
export function computeFactNameClusters(records: DocumentRecord[]): FactNameCluster[] {
  const byKey = new Map<string, Map<string, number>>();

  for (const record of records) {
    for (const fact of record.facts) {
      const key = normalizeFactName(fact.name);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, new Map());
      const variants = byKey.get(key)!;
      variants.set(fact.name, (variants.get(fact.name) || 0) + 1);
    }
  }

  const clusters: FactNameCluster[] = [];
  for (const [key, variantCounts] of byKey.entries()) {
    // Collapse variants that only differ by formatting before deciding
    // whether this cluster needs a human at all.
    const formatGroups = new Set(Array.from(variantCounts.keys()).map(formatOnlyKey));
    if (formatGroups.size < 2) continue;

    const variants = Array.from(variantCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    clusters.push({
      key,
      variants,
      totalCount: variants.reduce((sum, v) => sum + v.count, 0),
      suggestedName: variants[0].name,
    });
  }

  return clusters.sort((a, b) => b.totalCount - a.totalCount);
}

// Renames every fact in `records` whose normalized name matches `clusterKey`
// to `canonicalName`. Only the name field changes — value, verification
// status, confidence, and provenance are untouched. Returns the records that
// actually changed, for the caller to persist.
export function applyFactNameRename(
  records: DocumentRecord[],
  clusterKey: string,
  canonicalName: string
): DocumentRecord[] {
  const updated: DocumentRecord[] = [];
  for (const record of records) {
    let changed = false;
    const facts = record.facts.map((f) => {
      if (normalizeFactName(f.name) === clusterKey && f.name !== canonicalName) {
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
