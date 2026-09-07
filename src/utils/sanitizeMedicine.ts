import { FoodRelation, MedicineCandidate, TimeOfDay } from '../types';

const VALID_TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
const VALID_FOOD_RELATIONS: FoodRelation[] = ['before_food', 'after_food', 'with_food', 'either'];

// Gemini's JSON mode guarantees valid JSON syntax, not schema conformance — a
// field the prompt describes as an array or enum can still come back null,
// a bare string, or missing entirely (seen in practice on a poorly-legible
// scan). Rendering that raw crashes the whole record detail view every time
// it's opened, so every candidate is normalized to a safe shape before it's
// ever persisted or displayed.
export function sanitizeMedicineCandidate(raw: Partial<MedicineCandidate> | null | undefined): MedicineCandidate {
  const r = raw || {};
  const rawTimeOfDay = (r as { time_of_day?: unknown }).time_of_day;
  const timeOfDayArray = Array.isArray(rawTimeOfDay) ? rawTimeOfDay : rawTimeOfDay ? [rawTimeOfDay] : [];

  return {
    molecule: typeof r.molecule === 'string' && r.molecule.trim() ? r.molecule : 'Unspecified medicine',
    brand_name: typeof r.brand_name === 'string' && r.brand_name.trim() ? r.brand_name : undefined,
    strength: typeof r.strength === 'string' ? r.strength : '',
    time_of_day: timeOfDayArray.filter((t): t is TimeOfDay => VALID_TIMES.includes(t as TimeOfDay)),
    food_relation: VALID_FOOD_RELATIONS.includes(r.food_relation as FoodRelation) ? (r.food_relation as FoodRelation) : 'either',
    start_date: typeof r.start_date === 'string' && r.start_date ? r.start_date : new Date().toISOString().split('T')[0],
    end_date: typeof r.end_date === 'string' && r.end_date ? r.end_date : undefined,
    notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes : undefined,
  };
}
