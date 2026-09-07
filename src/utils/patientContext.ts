import { Person, DocumentRecord, Medication, Visit, CareTeamMember } from '../types';

// Builds the plain-text patient context block handed to Gemini for both the
// chat assistant (queryAssistant) and AI-drafted pre-visit questions
// (generateVisitQuestions) — one shared builder so both features ground
// themselves in exactly the same facts, phrased exactly the same way.
export function buildPatientContext(
  person: Person,
  records: DocumentRecord[],
  meds: Medication[],
  visits: Visit[],
  careTeam: CareTeamMember[]
): string {
  return `
Patient: ${person.name} (${person.species}, Age ${person.age || 'N/A'})
Active Conditions: ${person.active_conditions.join(', ')}

Care Team:
${careTeam.map((c) => `- ${c.name} (${c.specialty}, Clinic: ${c.clinic || 'N/A'})`).join('\n')}

Active Medications:
${meds
  .filter((m) => m.status === 'active')
  .map((m) => `- ${m.molecule} ${m.strength} (Time: ${m.time_of_day.join('/')}, ${m.food_relation}) prescribed by ${m.prescriber_name} on ${m.prescribed_date}`)
  .join('\n')}

Recent Documents & Facts (a fact tagged [verified] has been double-checked by the family; [unverified] means it's
still just an AI reading of the scan and hasn't been confirmed — say so if you rely on one):
${records
  .map(
    (r) =>
      `Record: ${r.title} (${r.date}, ${r.doctor_name || r.facility}):\n` +
      r.facts
        .map(
          (f) =>
            `  * ${f.name}: ${f.value} ${f.unit || ''} [${f.is_verified ? 'verified' : 'unverified'}] (Provenance: "${f.provenance_snippet}")`
        )
        .join('\n')
  )
  .join('\n\n')}

Upcoming & Past Visits:
${visits.map((v) => `- ${v.doctor_name} (${v.specialty}) on ${v.date_display} at ${v.time}`).join('\n')}
  `;
}
