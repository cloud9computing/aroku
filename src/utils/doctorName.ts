// Shared doctor-name normalizer — strips a leading "Dr."/"Dr " prefix and
// case/whitespace differences so a name typed one way (e.g. by the assistant,
// or entered on a document) can be matched against the same doctor entered
// slightly differently elsewhere (e.g. on a visit or in the care team).
export function normalizeDoctorName(name: string): string {
  return name.trim().toLowerCase().replace(/^dr\.?\s*/, '');
}
