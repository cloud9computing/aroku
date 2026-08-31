// Gemini AI access, proxied through Firebase Cloud Functions so the API key
// never reaches the browser and is shared by every signed-in family member.
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

export interface ExtractedMedication {
  molecule: string;
  brand_name?: string;
  strength: string;
  time_of_day: ('morning' | 'afternoon' | 'evening' | 'night')[];
  food_relation: 'before_food' | 'after_food' | 'with_food' | 'either';
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface ExtractionResult {
  doc_type: 'lab' | 'imaging' | 'prescription' | 'consultation_note' | 'discharge' | 'bill';
  title: string;
  doctor_name?: string;
  specialty?: string;
  facility?: string;
  date: string;
  condition_tags: string[];
  facts: Array<{
    name: string;
    value: string;
    unit?: string;
    confidence: number;
    provenance_snippet: string;
    condition_tag?: string;
    flag?: 'normal' | 'abnormal' | 'critical' | 'info';
  }>;
  medications: ExtractedMedication[];
}

const extractFactsFn = httpsCallable(functions, 'extractFacts');
const extractConsultationFactsFn = httpsCallable(functions, 'extractConsultationFacts');
const queryAssistantFn = httpsCallable(functions, 'queryAssistant');

export async function extractFactsFromImageOrText(
  familyId: string,
  input: { text?: string; base64Image?: string; mimeType?: string; recordId?: string }
): Promise<ExtractionResult> {
  const { data } = await extractFactsFn({ familyId, ...input });
  const parsed = data as Partial<ExtractionResult>;
  return {
    doc_type: parsed.doc_type || 'lab',
    title: parsed.title || 'Extracted Clinical Report',
    doctor_name: parsed.doctor_name || undefined,
    specialty: parsed.specialty || undefined,
    facility: parsed.facility || undefined,
    date: parsed.date || new Date().toISOString().split('T')[0],
    condition_tags: Array.isArray(parsed.condition_tags) ? parsed.condition_tags : ['General'],
    facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
  };
}

export async function extractConsultationFactsFromTranscript(
  familyId: string,
  transcript: string,
  doctorName: string,
  specialty: string
): Promise<{ what_happened: string; decisions: string[]; answers_captured: string[] }> {
  const { data } = await extractConsultationFactsFn({ familyId, transcript, doctorName, specialty });
  return data as { what_happened: string; decisions: string[]; answers_captured: string[] };
}

export interface ProposedMedicationPayload {
  molecule: string;
  brand_name?: string;
  strength: string;
  time_of_day: ('morning' | 'afternoon' | 'evening' | 'night')[];
  food_relation: 'before_food' | 'after_food' | 'with_food' | 'either';
  prescriber_name?: string;
  prescriber_specialty?: string;
  start_date_iso: string;
  notes?: string;
}

export interface ProposedMedicationUpdate {
  molecule: string;
  current_strength?: string;
  new_strength?: string;
  new_time_of_day?: ('morning' | 'afternoon' | 'evening' | 'night')[];
  new_food_relation?: 'before_food' | 'after_food' | 'with_food' | 'either';
}

export interface AssistantQueryResult {
  type: 'visit_draft' | 'qa_answer' | 'note_draft' | 'medication_draft' | 'medication_list_draft' | 'medication_update_draft' | 'general';
  message: string;
  proposedVisit?: {
    doctor_name: string;
    specialty: string;
    date_display: string;
    date_iso: string;
    time: string;
    reason: string;
    location: string;
  };
  proposedNote?: {
    note_text: string;
    target_doctor?: string;
    target_condition?: string;
  };
  proposedMedication?: ProposedMedicationPayload;
  medicationUpdate?: ProposedMedicationUpdate;
  proposedMedications?: ProposedMedicationPayload[];
  trend_fact_name?: string;
  factCitations?: Array<{ title: string; fact_name: string; value: string; date: string }>;
}

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

export async function queryGeminiAssistant(
  familyId: string,
  userQuery: string,
  patientContext: string,
  history: ChatHistoryEntry[] = []
): Promise<AssistantQueryResult> {
  const { data } = await queryAssistantFn({ familyId, userQuery, patientContext, history });
  return data as AssistantQueryResult;
}
