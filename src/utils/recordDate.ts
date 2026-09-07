// The record's own document date, not "today" (when it happened to be
// scanned) — a July report scanned in August must still group under July.
export function monthYearFromDate(dateIso: string): string {
  return new Date(dateIso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Same, but null instead of "Invalid Date" when the input isn't a clean
// YYYY-MM-DD — for re-deriving a display grouping from data that might
// predate validation, where the caller wants to fall back to something else.
export function safeMonthYearFromDate(dateIso: string | undefined): string | null {
  if (!dateIso) return null;
  const d = new Date(dateIso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
