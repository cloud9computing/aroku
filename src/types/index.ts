export type Species = 'human' | 'dog' | 'cat' | 'other';

export interface Person {
  id: string;
  name: string;
  relationship: string;
  species: Species;
  sex?: 'M' | 'F' | 'Other';
  age?: number;
  dob?: string;
  avatar_initial: string;
  avatar_bg: string;
  avatar_color: string;
  active_conditions: string[];
}

export type ConsentState = 'ok' | 'declined' | 'not_asked';

export interface CareTeamMember {
  id: string;
  name: string;
  specialty: string;
  clinic?: string;
  address?: string;
  phone?: string;
  notes?: string;
  consent_state: ConsentState;
  last_seen?: string;
}

export type DocumentType = 'lab' | 'imaging' | 'prescription' | 'consultation_note' | 'discharge' | 'bill';

export interface ClinicalFact {
  id: string;
  document_id: string;
  person_id: string;
  name: string;
  value: string;
  unit?: string;
  date: string;
  is_verified: boolean;
  confidence: number; // 0.0 - 1.0
  provenance_snippet: string;
  condition_tag?: string;
  flag?: 'normal' | 'abnormal' | 'critical' | 'info';
}

export interface DocumentRecord {
  id: string;
  person_id: string;
  doc_type: DocumentType;
  title: string;
  date: string; // ISO or formatted
  month_year: string; // e.g. "July 2026"
  subtitle: string;
  doctor_name?: string;
  specialty?: string;
  facility?: string;
  unverified_count: number;
  facts: ClinicalFact[];
  condition_tags: string[];
  image_url?: string;
  raw_text?: string;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type FoodRelation = 'before_food' | 'after_food' | 'with_food' | 'either';

export interface Medication {
  id: string;
  person_id: string;
  molecule: string;
  brand_name?: string;
  strength: string;
  time_of_day: TimeOfDay[];
  food_relation: FoodRelation;
  prescriber_name: string;
  prescriber_specialty: string;
  prescribed_date: string;
  end_date?: string; // only set when the source explicitly states a course length
  status: 'active' | 'stopped';
  stop_reason?: string;
  notes?: string;
}

export interface Question {
  id: string;
  visit_id: string;
  text: string;
  status: 'kept' | 'dropped' | 'edited';
  rationale?: string;
  fact_citations?: string[];
}

export interface Visit {
  id: string;
  person_id: string;
  doctor_name: string;
  specialty: string;
  date: string; // e.g. "2026-08-07"
  date_display: string; // e.g. "Tomorrow, 7 Aug" or "12 Jun"
  time: string; // e.g. "4:30 PM"
  location: string;
  is_upcoming: boolean;
  reason?: string;
  consent_state: ConsentState;
  brief_status?: string; // e.g. "Brief ready · 3 questions kept" or "Not prepped yet"
  questions: Question[];
  since_last_visit?: string[];
  past_recap?: {
    what_happened: string;
    answers_captured: string[];
    decisions: string[];
    audio_url?: string;
    full_transcript?: string;
  };
}

export interface AppNotification {
  id: string;
  person_id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'verify' | 'upcoming_visit' | 'med_review';
}
