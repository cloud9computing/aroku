import { Visit, DocumentRecord, AppNotification } from '../types';
import { daysUntil } from './dueDates';

// How many days ahead to nudge someone before an upcoming visit or scheduled
// test — checked against calendar-day distance, not a running countdown, so
// each fires at most once (per id) the first time the app is opened on or
// after that day. There's no server-side scheduler behind this yet, so a
// reminder is only ever surfaced when someone actually opens the app on the
// matching day — a real push notification is a separate, bigger piece of work.
const HEADS_UP_DAYS = [7, 3, 1];

export function computeDueNotifications(
  personId: string,
  visits: Visit[],
  records: DocumentRecord[],
  existingIds: ReadonlySet<string>
): AppNotification[] {
  const due: AppNotification[] = [];
  const today = new Date().toISOString().split('T')[0];

  visits
    .filter((v) => v.is_upcoming)
    .forEach((v) => {
      const days = daysUntil(v.date);
      HEADS_UP_DAYS.forEach((threshold) => {
        if (days !== threshold) return;
        const id = `notif-visit-${v.id}-${threshold}d`;
        if (existingIds.has(id)) return;
        due.push({
          id,
          person_id: personId,
          title: `Upcoming visit in ${threshold} ${threshold === 1 ? 'day' : 'days'}`,
          message: `${v.doctor_name} · ${v.specialty} — ${v.date_display}`,
          date: today,
          read: false,
          type: 'upcoming_visit',
        });
      });
    });

  records
    .filter((r) => r.status === 'scheduled')
    .forEach((r) => {
      const days = daysUntil(r.date);
      HEADS_UP_DAYS.forEach((threshold) => {
        if (days !== threshold) return;
        const id = `notif-test-${r.id}-${threshold}d`;
        if (existingIds.has(id)) return;
        due.push({
          id,
          person_id: personId,
          title: `Upcoming test in ${threshold} ${threshold === 1 ? 'day' : 'days'}`,
          message: `${r.title} — scheduled for ${new Date(r.date).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
          })}`,
          date: today,
          read: false,
          type: 'upcoming_test',
        });
      });
    });

  return due;
}
