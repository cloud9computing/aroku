import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { randomInt } from 'crypto';
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
// needed. This callable keeps that claim in sync, re-run on every app load so it
// also self-heals any account whose claim drifted.
//
// users/{uid}.familyId is only a pointer the client can read — the family's own
// memberUids list is the source of truth, so the claim is only ever granted for
// a family that actually lists this user as a member.
async function resolveVerifiedFamilyId(uid: string): Promise<string | null> {
  const userSnap = await db.collection('users').doc(uid).get();
  const claimed: string | null = userSnap.data()?.familyId || null;
  if (!claimed) return null;
  const famSnap = await db.collection('families').doc(claimed).get();
  const memberUids: string[] = famSnap.data()?.memberUids || [];
  return famSnap.exists && memberUids.includes(uid) ? claimed : null;
}

export const syncFamilyClaim = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;

  const familyId = await resolveVerifiedFamilyId(uid);
  const currentClaim = (request.auth.token as { familyId?: string }).familyId || null;

  if (currentClaim !== familyId) {
    await getAuth().setCustomUserClaims(uid, { familyId });
  }

  return { familyId };
});

// ---- Family membership: server-side only -------------------------------------
// Clients can no longer write memberUids, invites, or users/{uid}.familyId
// directly (see firestore.rules) — every change to who belongs to a family goes
// through these functions, which can rate-limit and check who is asking.

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
const INVITE_LENGTH = 8;
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const JOIN_ATTEMPTS_PER_HOUR = 10;

function newInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

async function mintInvite(familyId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    try {
      await db.collection('invites').doc(code).create({
        familyId,
        expiresAt: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
      });
      return code;
    } catch (err) {
      if ((err as { code?: number }).code === 6) continue; // already exists — try another code
      throw err;
    }
  }
  throw new HttpsError('internal', 'Could not generate an invite code.');
}

function memberFromToken(request: { auth?: { uid: string; token: Record<string, any> } }) {
  const token = request.auth!.token;
  return {
    uid: request.auth!.uid,
    displayName: (token.name as string) || (token.email as string) || 'Family member',
    email: (token.email as string) || '',
    photoURL: (token.picture as string) || '',
  };
}

async function enforceJoinRateLimit(uid: string): Promise<void> {
  const ref = db.collection('rateLimits').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { count?: number; windowStart?: number } | undefined;
    const windowStart = data?.windowStart && now - data.windowStart < 3600_000 ? data.windowStart : now;
    const count = data?.windowStart && windowStart === data.windowStart ? data.count || 0 : 0;
    if (count >= JOIN_ATTEMPTS_PER_HOUR) {
      throw new HttpsError('resource-exhausted', 'Too many attempts. Try again in an hour.');
    }
    tx.set(ref, { count: count + 1, windowStart });
  });
}

export const createFamily = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;
  const member = memberFromToken(request as any);
  const rawName = String((request.data as { name?: string })?.name || '').trim().slice(0, 60);

  const userRef = db.collection('users').doc(uid);
  if ((await userRef.get()).data()?.familyId) {
    throw new HttpsError('failed-precondition', 'You already belong to a family.');
  }

  const famRef = db.collection('families').doc();
  const inviteCode = await mintInvite(famRef.id);
  await famRef.set({
    name: rawName || `${member.displayName}'s family`,
    inviteCode,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    memberUids: [uid],
    members: { [uid]: member },
  });
  await userRef.set({ familyId: famRef.id }, { merge: true });
  return { familyId: famRef.id };
});

export const joinFamily = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const uid = request.auth.uid;
  const code = String((request.data as { code?: string })?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,8}$/.test(code)) throw new HttpsError('invalid-argument', 'That invite code is not valid.');

  await enforceJoinRateLimit(uid);

  const userRef = db.collection('users').doc(uid);
  if ((await userRef.get()).data()?.familyId) {
    throw new HttpsError('failed-precondition', 'You already belong to a family.');
  }

  const inviteSnap = await db.collection('invites').doc(code).get();
  const invite = inviteSnap.data() as { familyId?: string; expiresAt?: Timestamp } | undefined;
  // Codes minted before expiry existed have no expiresAt and stay valid until
  // someone regenerates the code (which deletes the old one).
  const expired = invite?.expiresAt ? invite.expiresAt.toMillis() < Date.now() : false;
  if (!inviteSnap.exists || !invite?.familyId || expired) {
    throw new HttpsError('not-found', 'That invite code was not found or has expired.');
  }

  const famRef = db.collection('families').doc(invite.familyId);
  if (!(await famRef.get()).exists) throw new HttpsError('not-found', 'That family no longer exists.');

  await famRef.update({
    memberUids: FieldValue.arrayUnion(uid),
    [`members.${uid}`]: memberFromToken(request as any),
  });
  await userRef.set({ familyId: invite.familyId }, { merge: true });
  await db.collection('rateLimits').doc(uid).delete();
  return { familyId: invite.familyId };
});

async function assertFamilyCreator(uid: string, familyId: string) {
  await assertFamilyMember(uid, familyId);
  const snap = await db.collection('families').doc(familyId).get();
  if (snap.data()?.createdBy !== uid) {
    throw new HttpsError('permission-denied', 'Only the person who created the family can do that.');
  }
  return snap;
}

export const regenerateInviteCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { familyId } = request.data as { familyId: string };
  const snap = await assertFamilyCreator(request.auth.uid, familyId);

  const oldCode: string | undefined = snap.data()?.inviteCode;
  const inviteCode = await mintInvite(familyId);
  await db.collection('families').doc(familyId).update({ inviteCode });
  if (oldCode) await db.collection('invites').doc(oldCode).delete().catch(() => undefined);
  return { inviteCode };
});

export const removeFamilyMember = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  const { familyId, memberUid } = request.data as { familyId: string; memberUid: string };
  await assertFamilyCreator(request.auth.uid, familyId);
  if (!memberUid || memberUid === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'You can only remove other members.');
  }

  await db.collection('families').doc(familyId).update({
    memberUids: FieldValue.arrayRemove(memberUid),
    [`members.${memberUid}`]: FieldValue.delete(),
  });
  await db.collection('users').doc(memberUid).set({ familyId: null }, { merge: true });
  // Their current ID token keeps the old claim until it refreshes (up to an
  // hour); clearing it here means the next refresh drops Storage access too.
  await getAuth().setCustomUserClaims(memberUid, { familyId: null });
  return { ok: true };
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
    const { familyId, text, mimeType, recordId, base64Image, base64Images: multiPage } = request.data as {
      familyId: string;
      text?: string;
      base64Image?: string;
      base64Images?: string[];
      mimeType?: string;
      recordId?: string;
    };
    let base64Images = multiPage && multiPage.length > 0 ? multiPage : base64Image ? [base64Image] : undefined;
    await assertFamilyMember(request.auth.uid, familyId);

    // Re-checking an already-saved scan: pull it straight from Storage via
    // Admin SDK instead of asking the browser to fetch it — a plain client-side
    // fetch() of a Storage download URL hits real CORS restrictions, while
    // server-to-server access here has none. A multi-page scan saves one file
    // per page (original-1.jpg, original-2.jpg, ...), so every page is re-fetched,
    // not just the first.
    let effectiveMimeType = mimeType;
    if ((!base64Images || base64Images.length === 0) && recordId) {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix: `families/${familyId}/records/${recordId}/` });
      if (files.length === 0) throw new HttpsError('not-found', 'No saved scan found for this record.');
      const sorted = files.sort((a, b) => a.name.localeCompare(b.name));
      const downloaded = await Promise.all(sorted.map((f) => f.download()));
      base64Images = downloaded.map(([buffer]) => buffer.toString('base64'));
      effectiveMimeType = sorted[0].metadata.contentType || 'image/jpeg';
    }

    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are an expert clinical medical record extraction engine for a caregiver health application.
Today's date is ${today}.
Carefully analyze this photographed or scanned medical document (lab report, prescription pad, imaging scan, or discharge summary).
${
  base64Images && base64Images.length > 1
    ? `This document spans ${base64Images.length} photographed pages, attached in order — treat them as one single document, not as separate reports, and merge facts that continue across pages.`
    : ''
}
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
7. This photo might sometimes be a doctor's business/visiting card or a clinic sign board instead of a clinical
   report — if so, there may be little or no clinical data on it at all, which is fine: leave "facts" and
   "medications" empty, and still fill in "doctor_name", "specialty", and "facility" from the card, plus "phone"
   and "address" if visible on it.
8. Separately, check whether the document mentions a follow-up or next appointment — a specific future date to
   return, whether or not it names a doctor. If so, populate "follow_up_visit" with its date (YYYY-MM-DD, resolved
   relative to this document's own date above if stated relatively, e.g. "review after 2 weeks"), "doctor_name"
   (use this document's own doctor if the follow-up doesn't name a different one), "specialty", and "reason" if
   stated. If no follow-up is mentioned anywhere, set "follow_up_visit" to null — never invent one.

Return ONLY valid JSON matching this exact structure:
{
  "doc_type": "lab" | "imaging" | "prescription" | "consultation_note" | "discharge" | "bill",
  "title": "Clear concise title",
  "doctor_name": "Doctor name or null",
  "specialty": "Medical specialty or null",
  "facility": "Hospital / Diagnostic center name or null",
  "phone": "Phone number visible on a business/visiting card, or null",
  "address": "Clinic/practice address visible on a business/visiting card, or null",
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
  ],
  "follow_up_visit": {
    "doctor_name": "Doctor name, or null if no follow-up was mentioned at all",
    "specialty": "Specialty or null",
    "date": "YYYY-MM-DD, or null if no follow-up was mentioned",
    "reason": "Reason stated, or null"
  }
}`;

    const parts: unknown[] = [{ text: prompt }];
    for (const img of base64Images || []) {
      parts.push({ inlineData: { data: img, mimeType: effectiveMimeType || 'image/jpeg' } });
    }
    if (text) parts.push({ text: `Context/OCR text:\n${text}` });

    const rawJson = await callGemini(GEMINI_API_KEY.value(), parts);
    return JSON.parse(rawJson);
  }
);

export const extractConsultationFacts = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { familyId, base64Audio, mimeType, doctorName, specialty } = request.data as {
      familyId: string;
      base64Audio: string;
      mimeType?: string;
      doctorName: string;
      specialty: string;
    };
    await assertFamilyMember(request.auth.uid, familyId);

    // The family may see specialists who don't speak the same language they do —
    // detecting the spoken language and translating it is the whole point of
    // sending Gemini the raw audio directly, rather than a browser-transcribed
    // (English-only) text string.
    const prompt = `You are a clinical assistant summarizing an audio recording of a medical consultation for a
family caregiver. The recording may be in any language, not necessarily English.
Doctor: ${doctorName} (${specialty})

From the attached audio, extract:
1. "detected_language": the language the consultation was conducted in (e.g. "English", "Hindi", "Telugu").
2. "full_transcript": a full transcript of the audio in its original spoken language.
3. "translated_transcript": an English translation of the full conversation. If the recording was already in
   English, set this to null (full_transcript already covers it).
4. "what_happened": a concise 2-sentence summary in English of what happened and the doctor's reasoning.
5. "decisions": key clinical decisions or medication changes made, in English.
6. "answers_captured": specific instructions or advice given to the family, in English.

If the audio is too unclear, silent, or too short to summarize responsibly, say so plainly in "what_happened"
and return empty arrays — do not invent details.

Return ONLY valid JSON matching this exact structure:
{
  "detected_language": "Language name",
  "full_transcript": "Transcript in the original language",
  "translated_transcript": "English translation, or null if the recording was already in English",
  "what_happened": "summary string",
  "decisions": ["decision 1", "decision 2"],
  "answers_captured": ["instruction 1", "instruction 2"]
}`;

    const parts: unknown[] = [
      { text: prompt },
      { inlineData: { data: base64Audio, mimeType: mimeType || 'audio/mp4' } },
    ];

    const rawJson = await callGemini(GEMINI_API_KEY.value(), parts);
    return JSON.parse(rawJson);
  }
);

export const generateVisitQuestions = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
    const { familyId, patientContext, doctorName, specialty, reason } = request.data as {
      familyId: string;
      patientContext: string;
      doctorName: string;
      specialty: string;
      reason?: string;
    };
    await assertFamilyMember(request.auth.uid, familyId);

    const prompt = `You are helping a family caregiver prepare for an upcoming medical visit, in an app whose whole
purpose is to carry information between specialists who don't talk to each other. The caregiver sees multiple
doctors for the same patient, and each doctor typically only sees their own slice of the picture.

Patient context (verified facts, active medications with prescriber, care team, and visit history):

${patientContext}

Upcoming visit: ${doctorName} (${specialty})${reason ? `, reason: ${reason}` : ''}

Draft 3-5 pre-visit questions the caregiver should ask ${doctorName}.

THE CENTERPIECE INSTRUCTION: prioritize questions that connect something a DIFFERENT specialist/doctor did,
prescribed, or found — a medication another doctor started or changed, a finding from another doctor's
report, a plan from a different specialty — to this upcoming visit. For example: "Dr. Iyer (Vascular) started
clopidogrel 75mg on 12 Jun — does that need to pause before today's anti-VEGF injection?" A generic
single-specialty follow-up question ("How is the condition progressing?") is much less valuable here and
should only fill remaining slots after cross-specialist questions are exhausted.

Hard rules:
1. Every question must cite the specific fact, medication, or record it is grounded in, in "fact_citations",
   so the caregiver can verify it against their own records — never cite something not present in the
   patient context above.
2. Every question must be phrased as a question to ask the doctor — never as a clinical claim, a diagnosis,
   or a judgment about what is or isn't a concern. "Ask whether X" or "Does X need Y" — never "X is a
   problem" or "X should be stopped."
3. Never invent a detail (a dose, a date, a doctor, a finding) that is not explicitly present in the patient
   context above. If there is not enough cross-specialist history in the context to responsibly ground a good
   cross-specialist question, it is fine and expected to fall back to fewer questions, or to more generic
   single-specialty ones — do not fabricate detail just to hit 5 questions or to force a cross-specialist
   angle that isn't actually supported by the data.
4. "rationale" is one line explaining why this question matters, referencing the source (e.g. which other
   doctor or record it connects to).

Return ONLY valid JSON matching this exact structure:
{
  "questions": [
    {
      "text": "The question to ask, phrased as a question",
      "rationale": "One line explaining why this question, referencing the source",
      "fact_citations": ["Fact name: value (Document title, date)", "Medication name strength (prescribed by Dr X, date)"]
    }
  ]
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
   Set "type": "qa_answer". Answer ONLY from facts present in the fact store above, with factCitations — and cite the exact
   parameter name as it appears in the fact store (e.g. "HbA1c", not "HbA1c Level" or "Hemoglobin A1c") so the app can
   match it back to its recorded history.
   If the question is about how a specific measurable parameter has changed over time (e.g. "what's his HbA1c trend", "how has creatinine been"), also set "trend_fact_name" to that exact parameter name, exactly as it appears in the fact store — the app itself checks whether there's enough recorded history to actually chart it, so just name the parameter and don't worry about double-checking that yourself; otherwise leave "trend_fact_name" unset.
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
7. If the user wants to schedule/book a not-yet-done test, scan, or lab work as a future reminder (e.g. "schedule an
   HbA1c test for next Monday", "I need to get a chest X-ray done on the 15th", "remind me to get a lipid panel done"):
   Set "type": "schedule_test_draft" with proposedScheduledTest. Resolve relative dates to YYYY-MM-DD using today's
   date above. Set "test_kind" to "imaging" only for scans/X-rays/ultrasounds/MRIs/CT — everything else (blood work,
   panels, cultures, urine tests) is "lab". Never invent a date the user didn't state or clearly imply — if no date
   was given at all, leave "date_iso" unset so the app can ask.
8. If the user wants to STOP a medicine already in the Active Medications list above — entirely, or just one or more of
   its dose times while continuing the rest (e.g. "stop metformin", "discontinue clopidogrel", "stop the evening dose of
   metformin, keep the morning one", "no longer needs the night dose of gabapentin"):
   Set "type": "medication_stop_draft" with "medicationStop". Set "molecule" to match it against Active Medications
   (use the name as listed there, even if the caregiver used a brand name or slightly different wording), and
   "current_strength" to its currently listed strength if you can tell which one they mean (leave unset if unsure —
   the app will show every plausible match for the caregiver to pick from, never guess silently). If the caregiver
   named specific dose times to stop (e.g. "evening", "night"), set "stop_times" to exactly those — this is a PARTIAL
   stop, the medicine keeps running at its other times. If they mean to stop it altogether, leave "stop_times" unset.
   Only set "stop_reason" if the caregiver actually stated one (e.g. "stop aspirin, GI bleed risk") — never invent one.
9. Otherwise set "type": "general".

Return ONLY valid JSON matching this schema:
{
  "type": "visit_draft" | "qa_answer" | "note_draft" | "medication_draft" | "medication_list_draft" | "medication_update_draft" | "schedule_test_draft" | "medication_stop_draft" | "general",
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
  "proposedScheduledTest": {
    "test_name": "e.g. HbA1c, Chest X-ray, Lipid Panel",
    "test_kind": "lab" | "imaging",
    "date_iso": "YYYY-MM-DD, or null if no date was stated",
    "notes": "Any other detail the user mentioned (e.g. fasting required, ordered by Dr X), or null"
  },
  "medicationStop": {
    "molecule": "Name matching an entry in Active Medications",
    "current_strength": "Its currently listed strength, or null if unclear which one",
    "stop_times": ["evening"] or null,
    "stop_reason": "Reason the caregiver stated, or null"
  },
  "trend_fact_name": "Parameter name exactly as it appears in the fact store (see rule 2), or null",
  "factCitations": [
    { "title": "Document Title", "fact_name": "Parameter name exactly as it appears in the fact store", "value": "Value", "date": "Date" }
  ]
}`;

    const rawJson = await callGemini(GEMINI_API_KEY.value(), [{ text: prompt }]);
    return JSON.parse(rawJson);
  }
);
