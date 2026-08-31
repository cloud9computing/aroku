# Family Health Continuity — Product Proposal

**Prepared for:** Ravi
**Date:** 7 August 2026
**Context:** Multi-specialist care for a parent (neurology, cardiology, vascular surgery, retina, endocrinology). Built for one family first, designed so it could become a product.

---

## 1. Reframing the problem

The instinct is "we need a place to put the files." That's the visible pain, but it isn't the expensive one. Storage is a solved problem — a well-named Google Drive folder solves 80% of retrieval.

The expensive problem is this: **your father's care is being made by five people who each hold one-fifth of the picture, and the only integration layer is you.** You are the health information exchange. You are doing it from memory, under time pressure, in a 12-minute consultation, while also being a worried son.

That reframe changes what the product is. It is not a document vault with search. It is a **context-transfer machine** whose job is to put the right one page in front of the right specialist at the right moment.

Three concrete failure modes it must prevent:

| Failure | What it looks like | Why it happens |
|---|---|---|
| **Silent contradiction** | Cardiologist adds an antiplatelet; retina specialist plans an intravitreal injection and doesn't know | No shared med list; nobody asked |
| **Lost reasoning** | Neurologist ruled out a diagnosis six months ago; a new doctor re-orders the same MRI | The *why* was never written down, only the *what* |
| **Recall collapse** | You're asked "what was his HbA1c trend?" and you have the PDF but not the number | Data is stored as documents, not as values |

A file cabinet fixes none of these. Note that failure #3 is the tell: **the atomic unit of this product is a clinical fact, not a file.** Files are just where facts arrive.

### The hard constraint you must design around

The specialist will give your document **20 to 40 seconds**, at most, and often zero. Any design that assumes a doctor will read a long summary, log into a portal, listen to a recording, or create an account is dead on arrival. This single constraint eliminates most of the obvious feature ideas and should be pinned to the wall of whatever you build.

---

## 2. On your recording idea

Your instinct — record the consultations — is right about the diagnosis and probably wrong about the delivery.

**Right:** the highest-value information in this whole system is what the doctor *said and reasoned*, and it currently evaporates the moment you leave the room. Consultation notes in Indian private practice are typically a prescription pad with drug names and little else. The reasoning is verbal and it is lost.

**Wrong:** no other specialist will ever listen to a 22-minute recording. Not once. Doctors are optimising for throughput and treat unstructured patient-supplied media as a time sink and a liability risk.

**The fix:** the recording is *input*, never *output*. Record → transcribe → extract structured facts → discard the audio from the sharing path entirely. What the next doctor sees is four bullet points on one page, not a media file. The recording exists so *you* never lose the reasoning; the extract exists so the next doctor can absorb it in 20 seconds.

**Consent, practically:** in India, recording a conversation you are a party to is generally lawful, but that isn't the operative issue — rapport is. Ask, plainly, every time: *"Doctor, may I record this so I get your instructions right? It's only for our family."* Most agree; framing it as *your* memory problem rather than a record of *their* performance is what makes the difference. If someone declines, respect it and switch to typing notes. The app should make consent a first-class, per-doctor setting — one that remembers "Dr. Rao: declines" and doesn't ask twice.

---

## 3. Design principles

1. **The one-pager is the product.** Everything else is machinery to generate it.
2. **Facts, not files.** Every document is parsed into typed values (HbA1c = 7.4, 2026-06-12). Files are provenance, not the primary store.
3. **Zero friction for doctors.** No app, no login, no account. A printed page or a QR code. That's the whole surface area.
4. **The caregiver is the primary user.** Optimise for the son in the waiting room on one hand and a phone with 14% battery.
5. **Capture where it happens.** If filing a report requires going home and sitting at a laptop, it won't happen. It's a photo in the hospital corridor or it's nothing.
6. **Never give clinical advice.** Surface conflicts as *questions to ask the doctor*, never as recommendations. This is both an ethics line and your main liability shield.

---

## 4. Feature set

### P0 — the irreducible core (build this first, nothing else)

**4.1 Capture-in-30-seconds**
Point camera at report → auto-crop, deskew, multi-page → uploads in background → OCR + extraction. Works offline and syncs later (hospital basements have no signal). One tap from the home screen. If this takes more than 30 seconds the whole system fails, because capture is the step that must survive a bad day.

**4.2 The auto-filing layer**
The user should never choose a folder. Extraction assigns: family member · date · document type (lab / imaging / discharge / prescription / consultation note / bill / insurance) · issuing doctor · specialty · body system. Fully automatic, with a correction UI when it guesses wrong. Corrections train nothing fancy — just per-family aliases (this letterhead = Dr. Mehta, cardiology).

**4.3 The problem-oriented timeline**
The core view. Not a file list — a chronological spine per family member, filterable by **condition**, not by document type. "Show me everything about the carotid stenosis" pulls the duplex scan, the vascular consult, the antiplatelet start, and the neurologist's note about it, across three hospitals and two years. This is the view you'll actually live in.

**4.4 The reconciled medication list**
One list, the single most valuable object in the system. Every drug: name, dose, frequency, **who prescribed it, when, and why**, still-active or stopped (and why stopped). Built by extracting every prescription. Flags duplicates (two doctors, same molecule, different brand — extremely common in India) and drugs nobody has reviewed in 12 months. Presented as *"ask about this"*, never *"stop this."*

**4.5 The Specialist Brief — the centrepiece**

One page, generated fresh before each appointment, **tailored to the specialty you're about to see**. The cardiologist's brief and the retina specialist's brief share a header and diverge completely below it.

Structure:

```
RAMESH K.  ·  M, 71  ·  ABHA 12-3456-...       Brief for: DR. S. NAIR (Cardiology)
Prepared 7 Aug 2026 by Ravi (son)             Visit: routine follow-up

ACTIVE PROBLEMS
  T2DM (2011) · HTN (2009) · CAD s/p PCI LAD (Mar 2024)
  R carotid stenosis 60-70% (Jan 2026) · Diabetic retinopathy, proliferative (2025)

MEDICATIONS (14 — full list overleaf)
  Cardiac:      Aspirin 75 · Clopidogrel 75 · Atorvastatin 40 · Metoprolol 25 BD
  Recent change: Clopidogrel ADDED 12 Jun by Dr. Iyer (vascular) post-duplex

SINCE YOUR LAST VISIT (14 Feb 2026)
  · Vascular (Dr. Iyer, 12 Jun): carotid duplex 60-70% R. Medical mgmt, review 6mo.
  · Retina (Dr. Kapoor, 2 Jul): PRP laser R eye. Anti-VEGF planned Sep.
  · Endo (Dr. Menon, 20 Jul): HbA1c 7.4 (was 8.1). Metformin unchanged.

RELEVANT TRENDS
  BP (home, 30d avg)  138/84  ↓ from 146/88
  HbA1c   8.1 → 7.6 → 7.4        LDL   102 → 88
  eGFR    68 → 64  ⚠ declining

THINGS WE'RE UNSURE ABOUT — 3 questions
  1. Dr. Kapoor plans anti-VEGF injection in Sep. Any concern with dual
     antiplatelet? Should anything be held?
  2. eGFR is drifting down. Does the atorvastatin dose need review?
  3. Dr. Iyer said "if symptoms, come immediately." What counts as symptoms?
```

Design notes that matter more than they look:

- **Specialty-aware filtering.** The retina specialist's version leads with glycaemic control, BP, and antiplatelets, and compresses the cardiac history to one line. Same data, different projection. This is the actual technical hard part.
- **"Since your last visit"** is the killer section. It's the thing a doctor genuinely wants and can never get, and it's the reason they'll accept the page instead of waving it away.
- **The questions section does the coordination work.** It converts "these doctors don't talk to each other" into a specific, answerable question placed in front of the one person who can answer it. This is the mechanism by which the whole product delivers its value. Everything upstream exists to generate good questions.
- **Delivery: paper first.** Hand it over. A4, one side, 11pt, no logo, no QR clutter. It looks like a referral letter, which is a format doctors already accept. A QR to a read-only web page is a *secondary* affordance for the doctor who asks for more.

**4.6 Consultation capture**
Record (with consent) → transcribe (Hindi/English/regional code-switching is the norm — pick an ASR that handles it) → extract into: diagnosis stated · reasoning given · meds changed · tests ordered · red flags to watch · follow-up interval · what the doctor said to tell the other doctors. Output is a structured note attached to the timeline. Audio retained privately, never shared outward.

**4.7 Multi-member, multi-caregiver**
Profiles per family member. Multiple caregivers with roles (you, your sibling, your mother) and an activity feed — "Ravi added Dr. Nair's brief, 2h ago". Prevents the second-most-common failure: two family members giving two doctors two different stories.

### P1 — high value, second

**4.8 Cross-specialty conflict detection**
Rules-based, conservative, and *always* phrased as a question. Drug–drug and drug–condition interactions across prescribers; procedure conflicts (anticoagulation vs. planned intervention); duplicate imaging within a window; contradictory instructions. Every flag links to its source documents. Never autonomous, never confident, never phrased as advice. Start with ~30 hand-written rules covering his actual conditions before touching anything general-purpose.

**4.9 Trends and vitals**
Auto-charted from extracted labs (HbA1c, lipids, creatinine/eGFR, Hb) plus manual home entry for BP, glucose, weight. The trend line is what a doctor absorbs instantly; a stack of PDFs is what they refuse to absorb at all.

**4.10 Appointment prep flow**
Two days before a visit, the app assembles a draft brief, surfaces open loops ("Dr. Iyer asked for a repeat duplex — not done"), collects questions from all caregivers, and produces the printable page. This turns a scramble into a checklist.

**4.11 The care map**
A visual of all doctors, all conditions, and which doctor owns which. Immediately exposes gaps ("nobody owns the kidney function") and overlaps. Doubles as onboarding for a new caregiver or a new doctor.

**4.12 Discharge-summary mode**
Hospitalisations generate 40+ pages of chaos. A dedicated flow: photograph everything, extract discharge diagnosis, procedures, med changes, follow-up plan, and pending results into a structured episode. Generate the "what happened in hospital" brief for every outpatient specialist afterwards — this is where continuity most often shatters.

**4.13 Insurance and expense tracking**
Bills, claims, reimbursement status, per-member spend. Not a nice-to-have — a real recurring pain in Indian private care, and it drives retention because it's a monthly-touch reason to open the app.

### P2 — later, once the core is proven

- **ABDM/ABHA integration.** Fetch records from participating facilities into the timeline; ~900M ABHA accounts as of May 2026 means it's real, but private multi-specialty coverage is still patchy. Treat as an *additional inlet*, never the foundation.
- **Doctor-to-doctor referral notes** — generated draft letters you can hand to Dr. A addressed to Dr. B.
- **WhatsApp delivery** of the brief PDF (WhatsApp is where Indian doctors actually live; this may outperform paper for follow-ups — worth testing early even though it sits in P2).
- **Second-opinion pack** — a complete, well-organised export for a new doctor or an overseas opinion.
- **Symptom/event journal** with photo support.
- **Emergency card** — QR on a wallet card / lock screen: conditions, meds, allergies, contacts, treating doctors.
- **Voice-first query.** "What was his creatinine in March?" spoken, answered.

### Explicitly out of scope

Teleconsultation, doctor booking, pharmacy delivery, wearables, AI diagnosis, a doctor-side app. Each is a different product. The doctor-side app in particular is the graveyard this category dies in — it inverts the zero-friction principle and requires selling to hospitals.

---

## 5. Ideas that need no app at all

Worth starting **this week**, both because they help immediately and because they're how you'll learn what to build:

1. **Start recording now**, with permission. Even unprocessed, on your phone, it's the only irrecoverable data.
2. **Write the one-pager by hand** before the next three appointments. Watch what the doctor does with it — reads it, glances, ignores, asks a question. That reaction is your entire product validation, and it costs nothing.
3. **Keep a running "questions across doctors" list** on your phone. Notice how many resolve to *"I need doctor X to know what doctor Y said."*
4. **Ask each specialist directly:** "What would you want to know from the others that you currently don't get?" Doctors answer this question well and it's a free spec.
5. **Ask for a "to whom it may concern" note** after significant decisions. Many will write one, and it carries far more weight doctor-to-doctor than anything you write.
6. **Nominate a quarterback.** A trusted physician, GP, or geriatrician who holds the whole picture and whom the others will actually correspond with. This is the highest-leverage non-technical move available, and no software substitutes for it. If you do only one thing on this list, do this one.
7. **Consistent file naming today:** `2026-07-20_Endo_Menon_HbA1c.pdf`. Boring, and it works.

---

## 6. India-specific considerations

**ABDM / ABHA.** Over 900 million ABHA accounts as of May 2026. Integration is encouraged, not mandated for private apps — mandatory only for PM-JAY empanelment. DigiLocker now functions as a PHR app and Samsung Health has native ABHA record storage. **Implication:** ABDM is a useful data *inlet* and a credibility marker later. It is not the product, and coverage of private multi-specialty practice is incomplete. Don't block on it.

**DPDP Act 2023 / DPDP Rules 2025.** Rules notified 13 Nov 2025, phased rollout; consent-manager registration framework activates 13 Nov 2026. Health data attracts the strictest treatment. For family-only use the obligations are light, but if this becomes a product: verifiable consent, revocability, breach notification, data-principal rights (access, correction, erasure), and demonstrable security.

**Design consequences regardless of scale:**
- **Consent architecture matters from day one.** Your father is the data principal; you are acting on his behalf. Build explicit, recorded delegation now — retrofitting it is painful, and it's also just the right way to treat him.
- **Encrypt at rest, per-family keys.** Consider end-to-end encryption. It complicates server-side extraction (you'd process on-device or in an ephemeral enclave) but it is the correct default for this data and a genuine differentiator.
- **Store in India.** Cross-border transfer rules make this the path of least resistance.
- **Retention policy for audio.** Recordings are the most sensitive artefact you hold. Default to on-device or encrypted, auto-purge after extraction unless pinned.

**Practical realities to build for:** reports arrive as paper, WhatsApp forwards, and photos of screens far more often than as clean PDFs. Handwritten prescriptions are common and OCR handles them badly — accept that and design a fast manual-correction path rather than pretending extraction will be clean. Multilingual and code-switched speech is the norm. Assume patchy connectivity inside hospitals.

**Competitive landscape.** MyDigiRecords, Health-e, Eka Care all occupy the "store your records" space, with family profiles and ABDM certification. None of them, as far as I can tell, solve the cross-specialist continuity problem — they are lockers with reminders. **That gap is the opening**, and it's also a warning: the storage layer is commoditised, so if you build only that, you've built a worse version of three existing apps.

---

## 7. Architecture sketch

Deliberately boring — a family of one shouldn't be running Kubernetes.

- **Client:** React Native or Flutter (iOS + Android; Android matters most in India). Offline-first local store, background sync.
- **Backend:** single managed Postgres + object storage, region ap-south-1. A modest API service. Row-level isolation per family.
- **Extraction pipeline:** queue → OCR (cloud vision for print, specialised model for handwriting) → LLM structured extraction into a typed schema → confidence scores → low-confidence items routed to a human-review queue in the app.
- **Data model:** the important decision. Model **clinical facts** as first-class entities — `Observation`, `Medication`, `Condition`, `Encounter`, `Procedure` — linked to source documents. Follow **FHIR resource shapes** loosely from day one, even without a FHIR server. It costs little now and saves a rewrite when you touch ABDM or a hospital API.
- **Brief generation:** deterministic templating over the fact store, with an LLM used only for narrative smoothing — never as the source of a number. Every figure on the brief traces to an extracted fact with provenance. **A hallucinated lab value on a page handed to a cardiologist is the one catastrophic failure mode of this product**; the architecture should make it structurally impossible rather than merely unlikely.
- **Sharing:** signed, expiring, read-only web links. No account for the recipient.

---

## 8. Phasing

| Phase | Duration | Scope | Success test |
|---|---|---|---|
| **0 — Manual** | Now, 4–6 weeks | You do it by hand: record, transcribe, write the one-pager | Does a specialist read it? Does it change a decision? |
| **1 — Personal MVP** | ~2 months | Capture, auto-file, timeline, med list, manual brief builder | You stop using WhatsApp/Drive for this |
| **2 — Brief engine** | ~2 months | Specialty-aware brief generation, consult recording + extraction, trends | Brief needs <5 min of editing before an appointment |
| **3 — Family** | ~1 month | Multi-member, multi-caregiver, roles, activity feed | Your sibling uses it unprompted |
| **4 — Harden** | ~2 months | Conflict detection, discharge mode, insurance, security review | Ready to hand to a family you don't know |
| **5 — Product** | — | Onboarding, ABDM, DPDP compliance, pricing | 10 unrelated families retained at 3 months |

Phase 0 is not a warm-up. It's the phase that determines whether the rest is worth building.

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Extraction errors produce a wrong number on a doctor-facing page | **Critical** | Confidence thresholds; never print an unverified value; show provenance; human review before every brief |
| Doctors ignore the brief | High | Validate in Phase 0 before writing code; format as a referral letter; lead with "since your last visit" |
| Capture friction kills adoption | High | 30-second rule; offline; measure time-to-file as a core metric |
| Liability from perceived medical advice | High | Never advise; only surface questions. Clear disclaimers. Legal review before public launch |
| Data breach | **Critical** | Encryption at rest, per-family keys, India-hosted, minimal audio retention, external security review at Phase 4 |
| Building a locker that competes with three commoditised apps | Medium | The brief is the product. If Phase 2 slips, you've built nothing differentiated |
| Scope creep into teleconsult/booking | Medium | Written out-of-scope list; revisit only after Phase 5 |

---

## 10. What to decide next

1. **Run Phase 0 for three appointments.** Hand-write the brief. Record with consent. Watch the doctor's face. Everything else depends on what you learn.
2. **Pick the quarterback physician.** Independent of the app, highest leverage available to you right now.
3. **Decide family-only vs. product** after Phase 2 — not before. The architecture above supports both; the compliance and onboarding work is what diverges, and that's genuinely deferrable.
4. **If the answer is "product":** the wedge is *multi-specialist chronic care in Indian metros, sold to the adult child, not the patient.* That buyer has money, urgency, guilt, and no good option. It's a narrow, real, underserved market — and it's a market you're currently a member of, which is the best possible starting position.

---

*This document is a product proposal, not medical guidance. Any feature that touches medication or clinical decisions should be reviewed by a qualified clinician before it reaches a real user — including your father.*
