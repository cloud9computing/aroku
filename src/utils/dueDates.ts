// Calendar-day math for anything with a target date in the future — a
// scheduled test, an upcoming visit. Deliberately ignores time-of-day: two
// dates on the same calendar day are "0 days away" regardless of clock time.
export function daysUntil(dateIso: string): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function isOverdue(dateIso: string): boolean {
  return daysUntil(dateIso) < 0;
}

export function formatDaysUntilLabel(days: number): string {
  if (days < 0) return `Overdue by ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}
