# Aroku

**Your specialists don't talk to each other. Let Aroku talk to them.**

Aroku is a family health coordination app. Each of your family's doctors sees one slice of the picture; Aroku keeps the whole picture in one place, so you walk into every consultation prepared. It works the same way for people and pets.

**Live app:** https://healthyfam-fccd7.web.app · **What's new:** https://healthyfam-fccd7.web.app/changelog

Aroku is a PWA. On iPhone, tap Share → Add to Home Screen. On Android, open the menu → Install app.

> **Not medical advice.** Aroku is a personal and family project, not a medical device. It organizes information from your own records and never replaces a clinician's judgment.

## What it does

- **Talk to Aroku.** Ask about records, medicines or visits, and get answers with a link back to the source and trend charts when there's history to show. Add, change or stop a medicine (a whole medicine or just one dose time), book a visit, schedule a test, or leave a note for a doctor. Nothing saves until you confirm it.
- **Records.** Scan or upload a lab report, prescription or discharge summary (multi-page supported) and review the extracted values. Every value stays unverified until someone taps Verify. Scheduled test reminders, month-by-month timeline, and a tool to merge differently-named tests so trends line up.
- **Medicines.** The active list grouped by time of day, prescription capture, and courses that flag themselves when they end.
- **Visits.** AI-drafted prep questions that connect what one specialist did to the next appointment, consultation recording upload (transcribed, language-detected and translated to English), editable recaps, and edit/reschedule.
- **Doctors.** Contact cards with call and directions, visiting-card capture, and human doctors kept separate from pets' vets.
- **Reminders.** Heads-up notifications 7, 3 and 1 day before a visit or scheduled test.

## Design principles

These are deliberate and show up throughout the code.

- **Never fabricate clinical judgment.** No scores, no "improved" or "worsened" labels. Values are shown as recorded, with their source.
- **Confirm before save.** AI proposes drafts; a person confirms every change.
- **Facts carry provenance.** Each extracted value keeps the snippet it was read from, and stays unverified until a person verifies it. Trends only count verified readings.
- **Names are merged by people, not guessed.** The app suggests that two test names mean the same thing but never merges them automatically (formatting-only differences excepted).

## Tech stack

React 19, Vite, TypeScript and Tailwind CSS on the front end. Firebase for everything else: Auth (Google, optionally Yahoo), Firestore, Storage, Cloud Functions v2 (Node 22) and Hosting. Gemini is called only from Cloud Functions, so the API key never reaches the browser. A hand-rolled service worker provides the PWA shell.

## How it fits together

- Data lives under `families/{familyId}/…` in Firestore. Family members join with an invite code.
- Firestore and Storage security rules gate client access. Storage rules check a `familyId` custom claim on the user's token, kept in sync by the `syncFamilyClaim` function.
- Cloud Functions (`functions/src/index.ts`) proxy Gemini for document extraction, consultation audio, visit-question generation and the assistant.
- Rules only restrict client access. The Firebase project owner can still read all data through the console or Admin SDK.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Firebase web app config
npm run dev
```

You'll need your own Firebase project with:

1. **Authentication:** Google enabled. Yahoo is optional and needs a Yahoo Developer app (Web Application, redirect URI `https://<project>.firebaseapp.com/__/auth/handler`, OpenID `profile` and `email`) entered under Sign-in method → Yahoo.
2. **Firestore** and **Storage**, with the rules in this repo deployed.
3. **Cloud Functions** on the Blaze plan, with the Gemini key stored as a secret:

   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```

Deploy with:

```bash
npm run build
firebase deploy
```

Other useful commands: `npm run build` for a production build, and `npx tsc --noEmit -p tsconfig.json` (run it in the repo root and in `functions/`) to typecheck.

## Project layout

```
src/
  components/   records, medicines, visits, doctors, assistant, capture, common
  firebase/     auth, Firestore and Storage access, family model
  services/     Gemini client and assistant engine
  utils/        fact-name matching, trends, dates, notifications
functions/      Cloud Functions (Gemini proxy, family claim sync)
public/         PWA assets, changelog page
```

## License

License to be decided.
