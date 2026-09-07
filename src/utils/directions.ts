// The "Directions" field is meant to hold a Google Maps link a caregiver pasted
// in directly (e.g. shared from the Maps app) — open it as-is rather than
// re-wrapping it in a search query, which would mangle a real link. Plain
// address text (typed instead of pasted) still falls back to a search query.
export function buildDirectionsUrl(addressOrLink: string): string {
  const trimmed = addressOrLink.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://maps.google.com/?q=${encodeURIComponent(trimmed)}`;
}
