import { ClinicalFact, DocumentRecord } from '../types';
import { normalizeFactName } from './factName';

export interface FactTrendPoint {
  date: string;
  value: string;
}

export interface FactTrend {
  key: string;
  name: string;
  unit?: string;
  points: FactTrendPoint[];
  direction: '↑' | '↓' | '→' | null;
  flag?: ClinicalFact['flag'];
  latestDate: string;
}

// Real trends from verified fact history — only a value that's actually
// appeared 2+ times under the same (normalized) name counts as a "trend". No
// clinical interpretation ("Improved"/"Monitor") is added: whether a number
// moving up or down is good depends on which test it is, which isn't
// something to guess at either in a visit brief or an assistant answer.
export function computeFactTrends(records: DocumentRecord[]): FactTrend[] {
  const byName = new Map<string, ClinicalFact[]>();
  for (const record of records) {
    for (const fact of record.facts) {
      if (!fact.is_verified) continue;
      const key = normalizeFactName(fact.name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(fact);
    }
  }

  return Array.from(byName.entries())
    .filter(([, facts]) => facts.length >= 2)
    .map(([key, facts]) => {
      const sorted = [...facts].sort((a, b) => (a.date < b.date ? -1 : 1));
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const latestNum = parseFloat(latest.value);
      const prevNum = parseFloat(prev.value);
      const direction: FactTrend['direction'] =
        !isNaN(latestNum) && !isNaN(prevNum)
          ? latestNum === prevNum
            ? '→'
            : latestNum > prevNum
            ? '↑'
            : '↓'
          : null;
      return {
        key,
        name: latest.name,
        unit: latest.unit,
        points: sorted.map((f) => ({ date: f.date, value: f.value })),
        direction,
        flag: latest.flag,
        latestDate: latest.date,
      };
    })
    .sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1));
}

export function findFactTrend(trends: FactTrend[], factName: string): FactTrend | undefined {
  const key = normalizeFactName(factName);
  return trends.find((t) => t.key === key);
}
