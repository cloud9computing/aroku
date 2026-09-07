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
const generateVisitQuestionsFn = httpsCallable(functions, 'generateVisitQuestions');

export async function extractFactsFromImageOrText(
  familyId: string,
  input: { text?: string; base64Image?: string; base64Images?: string[]; mimeType?: string; recordId?: string }
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

export interface ConsultationAudioExtraction {
  what_happened: string;
  decisions: string[];
  answers_captured: string[];
  full_transcript?: string;
  detected_language?: string;
  translated_transcript?: string;
}

export async function extractConsultationFactsFromAudio(
  familyId: string,
  base64Audio: string,
  mimeType: string,
  doctorName: string,
  specialty: string
): Promise<ConsultationAudioExtraction> {
  const { data } = await extractConsultationFactsFn({ familyId, base64Audio, mimeType, doctorName, specialty });
  const parsed = data as Partial<ConsultationAudioExtraction>;
  return {
    what_happened: parsed.what_happened || 'Recording processed, but no summary could be generated.',
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    answers_captured: Array.isArray(parsed.answers_captured) ? parsed.answers_captured : [],
    full_transcript: parsed.full_transcript || undefined,
    detected_language: parsed.detected_language || undefined,
    translated_transcript: parsed.translated_transcript || undefined,
  };
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

export interface ProposedScheduledTest {
  test_name: string;
  test_kind: 'lab' | 'imaging';
  date_iso?: string;
  notes?: string;
}

export interface AssistantQueryResult {
  type:
    | 'visit_draft'
    | 'qa_answer'
    | 'note_draft'
    | 'medication_draft'
    | 'medication_list_draft'
    | 'medication_update_draft'
    | 'schedule_test_draft'
    | 'general';
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
  proposedScheduledTest?: ProposedScheduledTest;
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

export interface GeneratedVisitQuestion {
  text: string;
  rationale?: string;
  fact_citations?: string[];
}

export async function generateVisitQuestions(
  familyId: string,
  patientContext: string,
  doctorName: string,
  specialty: string,
  reason: string
): Promise<{ questions: GeneratedVisitQuestion[] }> {
  const { data } = await generateVisitQuestionsFn({ familyId, patientContext, doctorName, specialty, reason });
  const parsed = data as { questions?: GeneratedVisitQuestion[] };
  return { questions: Array.isArray(parsed.questions) ? parsed.questions : [] };
}
