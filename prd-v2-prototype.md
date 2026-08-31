# Family Health Continuity — PRD v2 (Family Prototype)

**Owner:** Ravi
**Date:** 30 August 2026
**Status:** Ready to build in Google AI Studio
**Supersedes:** `prd-v1.md`, where they conflict. The three mechanisms (M1–M3) and the fact-store philosophy carry over unchanged. What changes is the stack, the navigation, and the stated scope: this version targets a **family-only prototype**, not a compliance-ready product.
**Reader:** you, and Google AI Studio's build/vibe-coding environment.

---

## 1. What changed, and why

Two decisions reshape this version. Everything else in `prd-v1.md` (the data model, the verification flow, the question engine, the non-goals) still applies unless noted below.

| # | Decision | Replaces | Why |
|---|---|---|---|
| **D5** | **Installable PWA, not a native app.** Chrome on Android, `Add to Home Screen`. | Expo / React Native | Every family member is on Android + Chrome. Chrome supports the Web Share Target API, so an installed PWA *can* receive a WhatsApp "Share to" — the one thing that made native non-negotiable when iOS was in scope. No install friction, no per-device setup, instant iterate-and-push updates. |
| **D6** | **DPDP/compliance posture is explicitly deprioritized.** Family-only prototype; revisit if this ever leaves the family. | The India-hosting / per-family-key posture in `prd-v1.md` §11 | Stated by the owner. This is a scope decision, not an oversight — it should be revisited deliberately before any wider use, not by default. |

Also folded in from design sessions after v1:

- Navigation is now **three tabs** (Records, Medicines, Visits) plus a **docked assistant bar**, replacing the original seven-screen S1–S7 list and the Brief-tab framing.
- **Family tab removed.** Care team, caregivers, and consent/delegation moved into the person-switcher menu — low-frequency, config-shaped content that doesn't earn a permanent nav slot.
- **Capture merged into the assistant bar** (camera icon + text input, one control), not a separate FAB.
- **Consultation recording moved into the Visit itself**, scoped to that doctor's consent state, instead of living as a global action.
- **New: creating an upcoming Visit via the assistant**, with a confirm-before-save card — Visits didn't have a creation path in v1 at all.
- **New fields:** `person.species` (for pets), `medication.time_of_day`, `medication.food_relation`.
- **Storage and inference move to a Google-native stack** (Drive, Gemini via AI Studio, Firebase) — see §8.

---

## 2. What this is

A capture-and-recall system for one caregiver, multiple family members (including pets), across however many specialists each of them sees. It turns photographed reports and prescriptions into typed, verified clinical facts with provenance, and assembles them into a pre-appointment brief the caregiver reads — with AI-drafted questions they curate before walking in.

It is not a document vault, not a doctor-facing product, and it does not make clinical judgments on its own authority. Those non-goals (`prd-v1.md` §3) are unchanged.

---

## 3. Users

**Primary — the caregiver (Ravi).** One-handed, on a phone, sometimes rushed, sometimes low on battery or signal.

**Patients — any family member added via the person switcher.** Humans (parent, self, child) and pets. A pet profile drops the human-only fields (ABHA ID, sex categories aren't required) and gains a `species` field; the practitioner specialty list gains a veterinary slice (general vet, ortho, dermatology, etc.).

**Secondary caregivers** — Phase 4, unchanged from v1.

**Explicit non-user — the treating specialist or vet.** Never asked to install, log in, or scan anything.

---

## 4. The three mechanisms (unchanged from v1)

- **M1 — Capture without friction.** Photo or WhatsApp forward to queued fact in under a minute, offline-tolerant.
- **M2 — Facts with provenance, verified once.** Every clinical value is typed, source-linked, and verified a single time — never re-reviewed at brief time.
- **M3 — Questions that carry the coordination.** AI drafts 3–5 questions citing verified facts; the caregiver keeps, edits, or drops each one. Nothing unkept ever prints.

See `prd-v1.md` §4–§9 for the full mechanics of extraction, verification, and question generation — unchanged here.

---

## 5. Information architecture

### 5.1 Navigation

Three tabs, plus a docked assistant bar that's present on every screen, plus a person switcher in the header.

```
┌─────────────────────────────┐
│  [Ramesh ▾]            🔔   │  ← person switcher + notifications
├─────────────────────────────┤
│                              │
│         (tab content)        │
│                              │
├─────────────────────────────┤
│  📷  Ask, or tell me…    ➤  │  ← docked assistant bar, every screen
├─────────────────────────────┤
│   📁 Records  💊 Meds  📅 Visits  │  ← bottom nav, 3 tabs
└─────────────────────────────┘
```

**Why three tabs, not more:** everything else that was considered (a Family tab; a separate capture button) turned out to be either low-frequency configuration (→ folded into the person switcher) or a duplicate of a control that already exists elsewhere (→ folded into the assistant bar). Three tabs plus one global input surface is the whole nav.

### 5.2 Person switcher

Tapping the name in the header opens:

```
┌──────────────────────────────┐
│  ✓ Ramesh                    │  ← current
│    Sunita (mother)           │
│    🐾 Bruno                  │  ← pet, species field set
│  ─────────────────────────   │
│  + Add family member         │
└──────────────────────────────┘
```

Care team, caregivers, and consent/delegation settings live one level deeper from here (a "Care team" / "Caregivers" / "Consent & delegation" row under the current profile) — built out from Phase 2 onward, not in the first slice.

### 5.3 The docked assistant bar

Present on every screen, unchanged position. Three things happen through it:

1. **Ask** — free-text query against the fact store ("what was his creatinine in March?")
2. **Tell it something new** — free-text note that becomes a fact or prompts a follow-up ("ask Dr. Iyer to hold clopidogrel if there's bleeding" → offered as a note to attach)
3. **Capture** — the camera icon opens the shutter directly; a photographed report flows into the same extraction pipeline as before (M1/M2)

The assistant never writes a fact or creates a Visit silently — every AI-proposed change surfaces as a confirm-before-save card (see §5.6). This is the same "draft, then curate" discipline as the question engine (M3), applied consistently to every kind of write the assistant can make.

---

## 6. Screens

### 6.1 Records tab

**Default view: Timeline** — reverse-chronological, one row per document (a lab report, an imaging scan, a prescription photo, a consultation note — each is a separate capture with its own provenance, not folded into a visit summary).

**Toggle (top-right, icon pair):** Timeline ↔ By type. By-type groups the same documents under Labs / Imaging / Prescriptions / Discharge / Consultation notes — useful once volume builds up and "find that one blood test from March" becomes a real need.

**Filter chips (top-left):** by condition ("Carotid stenosis," "Diabetes") — not by document type. This is the view that pays for the fact store: "show me everything about the carotid stenosis" pulls the duplex scan, the vascular consult, and the antiplatelet start, across doctors and years.

**Row anatomy:** icon (by doc type) · title · date, with a doctor/source subtitle underneath. A row with unverified facts renders the subtitle in italic with a dotted underline and softened language ("2 values need a quick check") — never a red flag or alarm color.

**Capture:** via the assistant bar's camera icon. No separate button on this screen.

### 6.2 Medicines tab

**Default view: Today** — grouped by **Morning / Afternoon / Evening / Night**, each with a small icon (sunrise / sun / moon-stars) rather than a text label doing all the work. Each row: molecule + strength, with food relation as a muted inline note ("after food") — not a separate column or a warning.

**Toggle (top-right, same treatment as Records):** Today ↔ All. All shows the reconciled Active/Stopped list, grouped by molecule — two brands of the same molecule from two prescribers sit under one heading with both prescribers named. This is a **neutral display grouping**, never an alert: no color, no icon, no "duplicate" label. Proximity is the only signal.

**Left-side context text** (where Records has filter chips): a plain count, e.g. "14 doses today."

### 6.3 Visits tab

**One continuous chronological timeline** — upcoming and past visits in the same list, not split into sections. The single upcoming visit naturally sits at the top; the list continues backward through history.

**Visual distinction, not a section break:** a **filled dot** on the timeline stem for the upcoming visit, **hollow dots** for past ones. Upcoming rows also carry a status line — "Brief ready · 3 questions kept" or "Not prepped yet" — so you know at a glance whether prep is done.

**Toggle (top-right):** Timeline ↔ By doctor. By-doctor groups all visits under each practitioner ("Dr. Nair — 4 visits"), answering "when did we last see X" directly.

**Filter chips:** by specialty (Cardiology, Retina, Vascular…), the natural cut for "which doctor track am I on."

**Tapping an upcoming visit → Visit detail (§6.4). Tapping a past visit →** a read-only recap: what happened, any post-visit answers captured, and a link to the brief that was actually used.

### 6.4 Visit detail

Header: doctor, specialty, date/time, location.

**Record this consultation** — sits directly on this screen, scoped to this doctor. Shows the doctor's consent state inline before anything else ("Dr. Nair OK'd recording" / declined / not yet asked) — the same consent-first posture as v1's AC7.1, just relocated from a global action into the one place it actually makes sense: the specific upcoming appointment with the specific doctor.

**Your prep brief** — sits below Record, same screen. Sections per `prd-v1.md` §9: Since your last visit, Active problems, Medications, Trends, Questions. Specialty-aware ordering remains v1.5-not-v1 (order by recency; revisit only if the printed hand-off proves itself in real use).

**Assistant bar** — docked at the bottom of this screen too, same as everywhere.

### 6.5 Creating a Visit via the assistant

There's no separate "+ New visit" button. Typing an appointment into the assistant bar ("Appointment with Dr Nair next Thursday around 4:30") returns a **confirm-before-save card**, not a silent write:

```
┌──────────────────────────────────┐
│  Doctor          Dr. S. Nair      │  ✎
│                  Cardiology       │
│  Date & time     Thu, 3 Sep       │  ✎
│                  4:30 PM          │
│  Reason          Not set — add?   │  ✎
│                                    │
│  [ Add to visits ]   [ Not now ]  │
└──────────────────────────────────┘
```

- Doctor name is matched against existing `practitioner` rows and shown with specialty attached, so a wrong match is visible before it's saved — same trust-but-verify posture as letterhead-alias matching (AC2.3).
- Every field has its own edit control — fixing the time doesn't mean retyping the doctor.
- **Nothing is written until "Add to visits" is tapped.** "Not now" discards the draft entirely. This mirrors D3's draft → curate → commit shape, applied to a new object type (`encounter`) instead of a fact or a question.
- Ambiguous relative dates ("next Thursday") resolve against the device clock at the moment of sending; the resolved date shown on the card is the one source of truth to check.

---

## 7. Data model deltas from v1

The full schema lives in `prd-v1.md` §5 — Postgres, FHIR-shaped where free. These are the additions for this version; apply them as a migration on top of that schema (or as the initial schema if building fresh — see §8 on the storage-layer change).

```sql
-- Pets and non-ABHA family members
alter table person
  add column species text not null default 'human'
    check (species in ('human', 'dog', 'cat', 'other')),
  alter column sex drop not null,
  alter column abha_id drop not null; -- already nullable in v1; explicit here for clarity

-- Vet-side specialties, appended to the SPECIALTIES vocab (kept in code, not DB — see prd-v1.md §5.1)
-- 'veterinary_general', 'veterinary_ortho', 'veterinary_dermatology', 'veterinary_other'

-- Medication timing and food relation
alter table medication
  add column time_of_day text[] default '{}',   -- subset of morning/afternoon/evening/night
    add constraint time_of_day_values check (
      time_of_day <@ array['morning','afternoon','evening','night']::text[]
    ),
  add column food_relation text
    check (food_relation in ('before_food','after_food','with_food','either'));
```

**Important constraint carried over from D2 (v1):** `time_of_day` and `food_relation` cannot be reliably extracted from a photographed prescription — Indian shorthand like "BD" doesn't map 1:1 to specific clock times, and food relation is rarely written down at all. These fields default to a sensible guess (BD → morning+night) at extraction time but are **pinned to the top of the review queue** exactly like a low-confidence fact, and go through the same one-time verification flow as everything else in §7 of `prd-v1.md`. Don't skip verification just because the value looks obviously right.

**Encounter creation via assistant** doesn't need a new table — it's a new *write path* into the existing `encounter` table (`prd-v1.md` §5), gated by the confirm-before-save card in §6.5 above rather than by a form. `is_future` is already a generated column, so an unconfirmed draft simply never gets inserted at all — there's no "draft encounter" state to model.

---

## 8. Stack (revised for this prototype)

`prd-v1.md` §11 specified Supabase/Postgres in `ap-south-1`, chosen for DPDP-driven India residency. With D6 (compliance deprioritized) and D5 (Android+Chrome only), the stack shifts to a Google-native one — less infrastructure to stand up, and it pairs naturally with building in AI Studio.

| Layer | Choice | Note |
|---|---|---|
| Client | **Installable PWA** (Service Worker + manifest), built via Google AI Studio's Build/vibe-coding mode | `Add to Home Screen` on Android Chrome. No app store, no per-device setup — send a link, everyone's on the latest version. |
| Offline / local store | **IndexedDB**, with a sync queue | Chrome's IndexedDB + Service Worker background sync is reliable; this is the one piece that would have been materially worse on iOS Safari, which is why D5 depends on being Android-only. |
| Backend / data store | **Firestore** (Firebase) | Pairs with the Google-native stack; auth, hosting, and Cloud Messaging (for reminders) come from the same project with minimal setup. This *replaces* `prd-v1.md`'s Postgres choice for this prototype — accept that a real relational fact store (§5's schema, expressed as Postgres in v1) is harder to express cleanly in a document DB, and treat that as a deliberate, known trade-off for prototype speed, not an oversight. |
| Document storage | **Google Drive**, via the Drive API | Your family already has Drive access and trust; no separate storage bucket to provision. Traded off against `prd-v1.md`'s "store in India" principle — acceptable per D6, but worth remembering as debt if this ever grows past family use. |
| Extraction / assistant | **Gemini**, called from the app | **Dev phase:** use your existing Google AI Pro/Ultra subscription's elevated AI Studio quota for prototyping — no separate billing to set up yet. **Before real family usage starts:** switch to a billed, pay-as-you-go Gemini API key. This matters for one specific reason: Gemini's *free* API tier allows Google to use prompts/outputs to improve its models; only the paid tier (or Vertex AI) turns that off. Don't let the app silently fall back to a free key once real health data — even just a family prototype's worth — is flowing through it. |
| Calendar | **Google Calendar API** | Sync confirmed Visits so reminders come from a tool everyone already trusts. Optionally read Calendar to suggest "should this become a tracked Visit?" when an event with a doctor's name appears. This is calendar *sync*, not appointment *booking* — booking a clinic slot remains out of scope per `prd-v1.md` §3. |
| Consult recording | Browser `MediaRecorder` API, uploaded to Drive (encrypted at rest via Drive's own protections) | Phase 3, unchanged in spirit from v1 — consent-gated, audio never attached to a shared brief. |

---

## 9. Build plan

Simplified from `prd-v1.md` §12 — no P5 (product/compliance) phase, since that's explicitly out of scope for a family prototype.

| Phase | Scope | Done when |
|---|---|---|
| **P0 — Manual** *(parallel, ongoing)* | Hand-written brief for real appointments; two-document control alongside. | You can tell whether the extraction pipeline is earning its keep. |
| **P1 — Capture and recall** | Records + Medicines tabs, extraction, verification, PWA shell, IndexedDB offline queue. | Family stops using WhatsApp/Drive folders directly — they open the app instead. |
| **P2 — Visits and questions** | Visits tab, Visit detail, question engine, brief, assistant-driven Visit creation, Calendar sync. | Someone walks into an appointment having read a generated brief and asks a question they wouldn't have otherwise. |
| **P3 — Consult capture** | Recording inside Visit detail, transcription, extraction into facts. | A consult's reasoning is in the timeline as text within an hour of leaving the room. |
| **P4 — Family rollout** | Person switcher fully live for all members (incl. Bruno), care team / caregivers / consent screens, second-caregiver read access. | Everyone in the family is using their own profile unprompted. |

**No durations**, per v1's own reasoning — still true, arguably more so now that this spans multiple family members' schedules, not just one caregiver's evenings.

---

## 10. Open questions carried forward

From `prd-v1.md` §15, still open, DPDP-related ones deprioritized per D6:

- **OQ-1 — Is there a quarterback physician?** Unchanged, still worth pursuing independently of the build.
- **OQ-2 — Does the two-document control lose?** Unchanged — still the real control arm for P0.
- **OQ-3 — Does the printed/screen brief do anything?** Unchanged.
- **OQ-4 — Consent from patients who can't consent for themselves** (your father; arguably Bruno). Still the right thing to do even without a DPDP deadline forcing it — deprioritized in *urgency*, not in *importance*.
- ~~OQ-5 — the doctor-side flank / churn~~ — **dropped for this version.** Both were product-viability questions for a fundraising or wide-release scenario; irrelevant to a family prototype with no revenue model.

**New for v2:**

- **OQ-6 — Where's the line between "family prototype" and "something that needs the DPDP posture back"?** Not urgent, but worth deciding *in advance* what triggers it (a friend asking to use it? a second family?) rather than noticing after the fact that the line was crossed.

---

*Prototype specification, not medical guidance. Nothing in this system advises, diagnoses, or recommends. Have anything touching medication or clinical decisions reviewed by a qualified clinician (or vet) before it reaches real use.*
