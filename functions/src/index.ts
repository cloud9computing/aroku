import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();
const db = getFirestore();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-3.6-flash';

async function assertFamilyMember(uid: string, familyId: string): Promise<void> {
  if (!familyId) throw new HttpsError('invalid-argument', 'familyId is required.');
  const snap = await db.collection('families').doc(familyId).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Family not found.');
  const memberUids: string[] = snap.data()?.memberUids || [];
  if (!memberUids.includes(uid)) {
    throw new HttpsError('permission-denied', 'You are not a member of this family.');
  }
}

// Storage Security Rules can't reliably call across to Firestore to check family
// membership (a real cross-service failure we hit in production), so instead the
// user's familyId is baked into their Auth ID token as a custom claim — Storage
// rules then check request.auth.token.familyId directly, no cross-service lookup
// needed. This callable keeps that claim in sync with users/{uid}.familyId,
// re-run on every app load so it also self-heals any account whose claim predates
// this change or drifted (e.g. after joining/leaving a family).
export const syncFamilyClaim = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;

  const userSnap = await db.collection('users').doc(uid).get();
  const familyId: string | null = userSnap.data()?.familyId || null;
  const currentClaim = (request.auth.token as { familyId?: string }).familyId || null;

  if (currentClaim !== familyId) {
    await getAuth().setCustomUserClaims(uid, { familyId });
  }

  return { familyId };
});

async function callGemini(apiKey: string, parts: unknown[]): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new HttpsError('unavailable', `Gemini request failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as any;
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) throw new HttpsError('internal', 'Gemini returned an empty response.');
  return rawJson;
}

export const extractFacts = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { familyId, text, mimeType, recordId } = request.data as {
      familyId: string;
      text?: string;
      base64Image?: string;
      mimeType?: string;
      recordId?: string;
    };
    let base64Image = (request.data as { base64Image?: string }).base64Image;
    await assertFamilyMember(request.auth.uid, familyId);

    // Re-checking an already-saved scan: pull it straight from Storage via
    // Admin SDK instead of asking the browser to fetch it — a plain client-side
    // fetch() of a Storage download URL hits real CORS restrictions, while
    // server-to-server access here has none.
    let effectiveMimeType = mimeType;
    if (!base64Image && recordId) {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: `families/${familyId}/records/${recordId}/` });
      if (files.length === 0) throw new HttpsError('not-found', 'No saved scan found for this record.');
      const [buffer] = await files[0].download();
      base64Image = buffer.toString('base64');
      effectiveMimeType = files[0].metadata.contentType || 'image/jpeg';
    }

    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are an expert clinical medical record extraction engine for a caregiver health application.
Today's date is ${today}.
Carefully analyze this photographed or scanned medical document (lab report, prescription pad, imaging scan, or discharge summary).
Extract all typed clinical facts, tests, medications, diagnoses, and measurements.

Rules:
1. Be precise and faithful. Extract exact values, units, and dates.
2. For "provenance_snippet", provide the EXACT short quotation from the document text showing where this value was read.
3. For "confidence", rate from 0.50 to 1.00 based on legibility/handwriting certainty.
4. If you cannot confidently read the document at all, return an empty facts array rather than guessing.
5. Additionally, if this document prescribes or lists medications the patient should take (a prescription, or take-home
   medications on a discharge summary), ALSO list each one in "medications" with structured dosing — this is separate
   from and in addition to listing them in "facts". For each: identify the generic molecule name if you recognize the
   brand used (put the brand in "brand_name", generic in "molecule"; if unsure, put what's written in "molecule" and
   leave "brand_name" unset). "start_date" is the date this document is dated (use the document's own date, not
   today's, unless the document explicitly says to start on a different date). Only set "end_date" if the document
   explicitly states a course length (e.g. "for 5 days") or an explicit stop date — compute it from start_date plus
   that duration; leave it unset for an ongoing/chronic medication with no stated end. Never invent a dose, timing,
   or duration that isn't stated or clearly implied.
6. For each fact's "name", use the short, standard, commonly-recognized name for that clinical parameter — the same
   name every time you see the same test, regardless of how this particular report happens to print it. This matters
   because facts get compared across separate reports over time to show trends, and that only works if the same test
   is always named identically. Concretely: strip lab-specific qualifiers, methodology notes, and units out of the
   name itself (e.g. "HbA1c" not "Glycated Hemoglobin (HbA1c), NGSP" or "HbA1c %"; "Serum Creatinine" not "Creatinine
   (Enzymatic, Serum)"; "eGFR" not "Estimated Glomerular Filtration Rate (CKD-EPI)"; "Total Cholesterol" not
   "Cholesterol, Total, Serum"). Keep the report's exact original wording in "provenance_snippet" instead, never in
   "name". If it's a veterinary report, apply the same principle using the standard name a vet would use.

Return ONLY valid JSON matching this exact structure:
{
  "doc_type": "lab" | "imaging" | "prescription" | "consultation_note" | "discharge" | "bill",
  "title": "Clear concise title",
  "doctor_name": "Doctor name or null",
  "specialty": "Medical specialty or null",
  "facility": "Hospital / Diagnostic center name or null",
  "date": "YYYY-MM-DD",
  "condition_tags": ["Condition1", "Condition2"],
  "facts": [
    {
      "name": "Standard short name for this clinical parameter (see rule 6) — consistent across reports",
      "value": "Exact clinical value or finding",
      "unit": "Unit like %, mg/dL, mL/min, or null",
      "confidence": 0.95,
      "provenance_snippet": "Exact quote snippet from image text",
      "condition_tag": "Relevant condition",
      "flag": "normal" | "abnormal" | "critical" | "info"
    }
  ],
  "medications": [
    {
      "molecule": "Generic name",
      "brand_name": "Brand name or null",
      "strength": "e.g. 75mg",
      "time_of_day": ["morning" | "afternoon" | "evening" | "night"],
      "food_relation": "before_food" | "after_food" | "with_food" | "either",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD or null",
      "notes": "Any other stated detail (e.g. indication), or null"
    }
  ]
}`;

    const parts: unknown[] = [{ text: prompt }];
    if (base64Image) parts.push({ inlineData: { data: base64Image, mimeType: effectiveMimeType || 'image/jpeg' } });
    if (text) parts.push({ text: `Context/OCR text:\n${text}` });

    const rawJson = await callGemini(GEMINI_API_KEY.value(), parts);
    return JSON.parse(rawJson);
  }
);

export const extractConsultationFacts = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { familyId, transcript, doctorName, specialty } = request.data as {
      familyId: string;
      transcript: string;
      doctorName: string;
      specialty: string;
    };
    await assertFamilyMember(request.auth.uid, familyId);

    const prompt = `You are a clinical assistant summarizing a consultation recording for a family caregiver.
Doctor: ${doctorName} (${specialty})
Transcript of consultation:
"${transcript}"

Extract:
1. A concise 2-sentence summary of what happened and doctor reasoning ("what_happened").
2. Key clinical decisions/medication changes made ("decisions").
3. Specific instructions/advice given to the family ("answers_captured").

If the transcript is too short or unclear to summarize responsibly, say so plainly in "what_happened" and return empty arrays — do not invent details.

Return ONLY valid JSON:
{
  "what_happened": "summary string",
  "decisions": ["decision 1", "decision 2"],
  "answers_captured": ["instruction 1", "instruction 2"]
}`;

    const rawJson = await callGemini(GEMINI_API_KEY.value(), [{ text: prompt }]);
    return JSON.parse(rawJson);
  }
);

export const queryAssistant = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { familyId, userQuery, patientContext, history } = request.data as {
      familyId: string;
      userQuery: string;
      patientContext: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };
    await assertFamilyMember(request.auth.uid, familyId);

    const today = new Date().toISOString().split('T')[0];

    const historyBlock =
      history && history.length > 0
        ? `Conversation so far (oldest first, for context — the caregiver may be following up on something said earlier):
${history.map((m) => `${m.role === 'user' ? 'Caregiver' : 'You'}: ${m.text}`).join('\n')}

`
        : '';

    const prompt = `You are the intelligent clinical assistant in a family health-coordination app for a family caregiver.
Today's date is ${today}.
You have access to the patient's verified clinical fact store below:

${patientContext}

${historyBlock}The caregiver now asks or states: "${userQuery}"

Determine the user intent and provide the exact response:
1. If the user wants to schedule an appointment / visit (e.g. "Appointment with Dr Nair next Thursday around 4:30"):
   Set "type": "visit_draft", match the doctor against the care team, resolve relative dates to YYYY-MM-DD, and provide proposedVisit object.
2. If the user asks a clinical fact query (e.g. "what was his creatinine in March?", "who prescribed clopidogrel?"):
   Set "type": "qa_answer". Answer ONLY from facts present in the fact store above, with factCitations. If the fact store has no relevant information, say so plainly instead of guessing.
   If the question is about how a specific measurable parameter has changed over time (e.g. "what's his HbA1c trend", "how has creatinine been"), also set "trend_fact_name" to that parameter's name exactly as it appears in the fact store above, so the app can render the real recorded history — otherwise leave it unset.
3. If the user asks to save a note / reminder for a doctor:
   Set "type": "note_draft" with proposedNote.
4. If the user says they are starting, taking, or were prescribed exactly ONE medicine that is NOT already in the Active
   Medications list above (e.g. "Starting clopilet 75mg from tonight", "began taking metformin 500mg twice a day after food"):
   Set "type": "medication_draft" with proposedMedication. Identify the generic molecule name if the input uses a brand name you recognize (put the brand in "brand_name" and the generic in "molecule"); if unsure, put what the user said in "molecule" and leave "brand_name" unset. Resolve "tonight"/"tomorrow"/day names to YYYY-MM-DD for "start_date_iso" using today's date above. Only fill "prescriber_name"/"prescriber_specialty" if the user actually named a doctor — never invent one. Never invent a dose, frequency, or timing the user didn't state or clearly imply.
5. If the user pastes or lists MULTIPLE medicines at once that are NOT already in Active Medications (e.g. a note listing
   several current medications, one per line or comma-separated):
   Set "type": "medication_list_draft" with "proposedMedications" — an array using the exact same per-item shape as proposedMedication above, one entry per medicine mentioned. If no start date is stated for an item (very likely, since this is usually a list of medicines someone is already taking), set its "start_date_iso" to today's date — that records when this was logged, not a claim about when they actually started it. Same rule on never inventing details: only include what's stated or clearly implied for each one.
6. If the user wants to CHANGE something about a medicine ALREADY in the Active Medications list above — a different dose,
   a different frequency/timing, or a different food relation (e.g. "increase metformin to 1000mg", "change the metoprolol
   dose from 20mg to 40mg", "make the aspirin twice a day now"):
   Set "type": "medication_update_draft" with "medicationUpdate". This is an UPDATE to an existing entry, never a new one
   — do not also emit proposedMedication/proposedMedications for the same medicine. Set "molecule" to match it against
   Active Medications (use the name as listed there), "current_strength" to its currently listed strength if you can
   tell which one they mean, and only the "new_*" fields that the caregiver actually asked to change (leave the others
   unset) — never invent a value for something they didn't mention changing.
7. Otherwise set "type": "general".

Return ONLY valid JSON matching this schema:
{
  "type": "visit_draft" | "qa_answer" | "note_draft" | "medication_draft" | "medication_list_draft" | "medication_update_draft" | "general",
  "message": "Direct, empathetic response text",
  "proposedVisit": {
    "doctor_name": "Doctor name",
    "specialty": "Specialty",
    "date_display": "e.g. Thu, 3 Sep · 4:30 PM",
    "date_iso": "YYYY-MM-DD",
    "time": "4:30 PM",
    "reason": "Reason for appointment",
    "location": "Clinic location"
  },
  "proposedNote": {
    "note_text": "Note text",
    "target_doctor": "Doctor name or null",
    "target_condition": "Condition or null"
  },
  "proposedMedication": {
    "molecule": "Generic name",
    "brand_name": "Brand name or null",
    "strength": "e.g. 75mg",
    "time_of_day": ["morning" | "afternoon" | "evening" | "night"],
    "food_relation": "before_food" | "after_food" | "with_food" | "either",
    "prescriber_name": "Doctor name or null",
    "prescriber_specialty": "Specialty or null",
    "start_date_iso": "YYYY-MM-DD",
    "notes": "Any other detail the user mentioned, or null"
  },
  "proposedMedications": [
    { "molecule": "...", "brand_name": "...", "strength": "...", "time_of_day": ["morning"], "food_relation": "after_food", "prescriber_name": null, "prescriber_specialty": null, "start_date_iso": "YYYY-MM-DD", "notes": null }
  ],
  "medicationUpdate": {
    "molecule": "Name matching an entry in Active Medications",
    "current_strength": "Its currently listed strength, or null if unclear which one",
    "new_strength": "New strength, or null if unchanged",
    "new_time_of_day": ["morning"] or null,
    "new_food_relation": "before_food" | "after_food" | "with_food" | "either" | null
  },
  "trend_fact_name": "Parameter name from the fact store, or null",
  "factCitations": [
    { "title": "Document Title", "fact_name": "Parameter Name", "value": "Value", "date": "Date" }
  ]
}`;

    const rawJson = await callGemini(GEMINI_API_KEY.value(), [{ text: prompt }]);
    return JSON.parse(rawJson);
  }
);
