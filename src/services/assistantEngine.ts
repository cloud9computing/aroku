import { Person, DocumentRecord, Medication, Visit, CareTeamMember, TimeOfDay, FoodRelation } from '../types';
import { queryGeminiAssistant, ChatHistoryEntry } from './gemini';

export interface ProposedVisit {
  doctor_name: string;
  specialty: string;
  date_display: string;
  date_iso: string;
  time: string;
  reason: string;
  location: string;
}

export interface ProposedNote {
  note_text: string;
  target_doctor?: string;
  target_condition?: string;
}

export interface ProposedMedication {
  molecule: string;
  brand_name?: string;
  strength: string;
  time_of_day: TimeOfDay[];
  food_relation: FoodRelation;
  prescriber_name?: string;
  prescriber_specialty?: string;
  start_date_iso: string;
  notes?: string;
}

export interface ProposedMedicationUpdate {
  molecule: string;
  current_strength?: string;
  new_strength?: string;
  new_time_of_day?: TimeOfDay[];
  new_food_relation?: FoodRelation;
}

export interface AssistantResponse {
  type: 'visit_draft' | 'qa_answer' | 'note_draft' | 'medication_draft' | 'medication_list_draft' | 'medication_update_draft' | 'general';
  message: string;
  proposedVisit?: ProposedVisit;
  proposedNote?: ProposedNote;
  proposedMedication?: ProposedMedication;
  proposedMedications?: ProposedMedication[];
  medicationUpdate?: ProposedMedicationUpdate;
  trend_fact_name?: string;
  factCitations?: Array<{ title: string; fact_name: string; value: string; date: string }>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AssistantResponse;
}

export async function processAssistantQuery(
  familyId: string,
  input: string,
  person: Person,
  records: DocumentRecord[],
  meds: Medication[],
  visits: Visit[],
  careTeam: CareTeamMember[],
  history: ChatHistoryEntry[] = []
): Promise<AssistantResponse> {
  const patientContext = `
Patient: ${person.name} (${person.species}, Age ${person.age || 'N/A'})
Active Conditions: ${person.active_conditions.join(', ')}

Care Team:
${careTeam.map((c) => `- ${c.name} (${c.specialty}, Clinic: ${c.clinic || 'N/A'})`).join('\n')}

Active Medications:
${meds
  .filter((m) => m.status === 'active')
  .map((m) => `- ${m.molecule} ${m.strength} (Time: ${m.time_of_day.join('/')}, ${m.food_relation}) prescribed by ${m.prescriber_name} on ${m.prescribed_date}`)
  .join('\n')}

Recent Documents & Verified Facts:
${records
  .map(
    (r) =>
      `Record: ${r.title} (${r.date}, ${r.doctor_name || r.facility}):\n` +
      r.facts.map((f) => `  * ${f.name}: ${f.value} ${f.unit || ''} (Provenance: "${f.provenance_snippet}")`).join('\n')
  )
  .join('\n\n')}

Upcoming & Past Visits:
${visits.map((v) => `- ${v.doctor_name} (${v.specialty}) on ${v.date_display} at ${v.time}`).join('\n')}
  `;

  try {
    return await queryGeminiAssistant(familyId, input, patientContext, history);
  } catch (e) {
    console.warn('Assistant query failed, falling back to local parsing:', e);
    return parseAssistantInputLocal(input, careTeam);
  }
}

// Deterministic, offline fallback used only when the AI assistant is unreachable.
// It only ever parses the caregiver's own words back into a draft — it never
// invents clinical values, since a wrong guess here could be dangerous.
export function parseAssistantInputLocal(input: string, careTeam: CareTeamMember[]): AssistantResponse {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  const isMedicationIntent =
    lower.includes('starting') ||
    lower.includes('start taking') ||
    lower.includes('began taking') ||
    lower.includes('prescribed me') ||
    lower.includes('new medicine') ||
    lower.includes('new medication') ||
    (/\d+\s*mg/.test(lower) && (lower.includes('taking') || lower.includes('start')));

  if (isMedicationIntent) {
    const doseMatch = trimmed.match(/([A-Za-z][A-Za-z\s-]*?)\s+(\d+(?:\.\d+)?\s*mg)\b/i);
    const molecule = doseMatch ? doseMatch[1].trim().replace(/^(starting|start taking|began taking|new medicine|new medication)\s+/i, '') : trimmed;
    const strength = doseMatch ? doseMatch[2].replace(/\s+/g, '') : '';

    const time_of_day: TimeOfDay[] = [];
    if (lower.includes('tonight') || lower.includes('night')) time_of_day.push('night');
    if (lower.includes('morning')) time_of_day.push('morning');
    if (lower.includes('afternoon')) time_of_day.push('afternoon');
    if (lower.includes('evening')) time_of_day.push('evening');
    if (time_of_day.length === 0) time_of_day.push('morning');

    let food_relation: FoodRelation = 'either';
    if (lower.includes('after food') || lower.includes('after meal')) food_relation = 'after_food';
    else if (lower.includes('before food') || lower.includes('before meal')) food_relation = 'before_food';
    else if (lower.includes('with food') || lower.includes('with meal')) food_relation = 'with_food';

    const startDate = new Date();
    if (lower.includes('tomorrow')) startDate.setDate(startDate.getDate() + 1);

    return {
      type: 'medication_draft',
      message: "I'm offline right now, so I've drafted this from what you typed — check the details before saving.",
      proposedMedication: {
        molecule: molecule || 'New medicine',
        strength: strength || 'Set dose',
        time_of_day,
        food_relation,
        start_date_iso: startDate.toISOString().split('T')[0],
      },
    };
  }

  const isSchedulingIntent =
    lower.includes('appointment') ||
    lower.includes('visit dr') ||
    lower.includes('see dr') ||
    lower.includes('consultation with') ||
    lower.includes('meeting dr') ||
    lower.includes('scheduled with');

  if (isSchedulingIntent) {
    let matchedDoctor = careTeam[0]?.name || 'the doctor';
    let matchedSpecialty = careTeam[0]?.specialty || 'General';
    let matchedLocation = careTeam[0]?.clinic || 'Clinic';

    for (const member of careTeam) {
      const surname = member.name.toLowerCase().replace('dr.', '').replace('dr', '').trim();
      const lastName = surname.split(' ').pop() || '';
      if (lastName.length > 2 && lower.includes(lastName)) {
        matchedDoctor = member.name;
        matchedSpecialty = member.specialty;
        matchedLocation = member.clinic || 'Clinic';
        break;
      }
    }

    let dateDisplay = 'Choose a date';
    let dateIso = new Date().toISOString().split('T')[0];
    if (lower.includes('tomorrow')) {
      const tom = new Date();
      tom.setDate(tom.getDate() + 1);
      dateDisplay = `Tomorrow, ${tom.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
      dateIso = tom.toISOString().split('T')[0];
    }

    const timeMatch = lower.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/);
    const timeDisplay = timeMatch
      ? `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3] ? timeMatch[3].toUpperCase() : ''}`.trim()
      : 'Set a time';

    let reason = 'Follow-up consultation';
    const reasonMatch = trimmed.match(/for (.+)$/i) || trimmed.match(/reason:\s*(.+)$/i);
    if (reasonMatch) reason = reasonMatch[1].trim();

    return {
      type: 'visit_draft',
      message: "I'm offline right now, so I've drafted this from what you typed — double-check it before saving.",
      proposedVisit: {
        doctor_name: matchedDoctor,
        specialty: matchedSpecialty,
        date_display: `${dateDisplay} · ${timeDisplay}`,
        date_iso: dateIso,
        time: timeDisplay,
        reason,
        location: matchedLocation,
      },
    };
  }

  const isNoteIntent =
    lower.startsWith('note:') || lower.startsWith('ask dr') || lower.startsWith('tell dr') || lower.startsWith('remember');

  if (isNoteIntent) {
    const targetDoctor = careTeam.find((c) => {
      const lastName = c.name.toLowerCase().replace('dr.', '').replace('dr', '').trim().split(' ').pop() || '';
      return lastName.length > 2 && lower.includes(lastName);
    })?.name;

    return {
      type: 'note_draft',
      message: "I'm offline right now, so I've saved this as a plain note — it'll attach to the right visit once you're back online.",
      proposedNote: { note_text: trimmed, target_doctor: targetDoctor },
    };
  }

  return {
    type: 'general',
    message:
      "I can't reach the AI assistant right now, so I can't answer clinical questions from memory — that risks giving you a wrong value. Check the Records tab directly, or try again once you're back online. I can still draft an appointment or a note from what you type.",
  };
}
