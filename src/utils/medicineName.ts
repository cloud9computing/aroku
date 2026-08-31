// Family members typically recall a medicine by its commercial/brand name
// ("Ecosprin") much more readily than the generic molecule name ("Aspirin"),
// so the brand — when known — is what's shown as the primary label, with the
// molecule name kept alongside as a secondary reference rather than dropped.
export function medicineDisplayName(m: { molecule: string; brand_name?: string }): {
  primary: string;
  secondary?: string;
} {
  if (m.brand_name && m.brand_name.trim()) {
    return { primary: m.brand_name, secondary: m.molecule };
  }
  return { primary: m.molecule };
}
