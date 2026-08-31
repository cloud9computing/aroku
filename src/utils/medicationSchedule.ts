import { Medication } from '../types';

// An "active" medication whose stated course has already passed is no longer
// actually due — it shouldn't appear in today's dose schedule, and it's worth
// flagging so the record can be marked complete instead of sitting stale.
export function isCourseEnded(med: Medication, today: string = new Date().toISOString().split('T')[0]): boolean {
  return med.status === 'active' && !!med.end_date && med.end_date < today;
}
