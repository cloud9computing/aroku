import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import {
  Person,
  DocumentRecord,
  Medication,
  Visit,
  CareTeamMember,
  AppNotification,
} from '../types';
import { deleteRecordFiles, deleteVisitFiles } from './storageService';

function familyCollection(familyId: string, name: string) {
  return collection(db, 'families', familyId, name);
}

// Firestore's setDoc/updateDoc throw on any literal `undefined` value, including
// nested inside objects/arrays (e.g. optional fields written as `x ? x : undefined`).
// Every write in this file runs through this first so an unset optional field
// never crashes the whole write — it's just omitted, as it would be in plain JSON.
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) result[key] = stripUndefinedDeep(val);
    }
    return result as T;
  }
  return value;
}

function subscribeCollection<T>(
  familyId: string,
  name: string,
  personId: string | null,
  callback: (items: T[]) => void
): () => void {
  const col = familyCollection(familyId, name);
  const q = personId ? query(col, where('person_id', '==', personId)) : query(col);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as T));
  }, (err) => console.error(`Firestore subscription error (${name}):`, err));
}

// People — shared across the whole family, not scoped to a single person.
export function subscribePeople(familyId: string, callback: (people: Person[]) => void): () => void {
  return onSnapshot(familyCollection(familyId, 'people'), (snap) => {
    callback(snap.docs.map((d) => d.data() as Person));
  }, (err) => console.error('Firestore subscription error (people):', err));
}

export async function addPerson(familyId: string, person: Person): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'people'), person.id), stripUndefinedDeep(person));
}

// Records
export function subscribeRecords(
  familyId: string,
  personId: string,
  callback: (records: DocumentRecord[]) => void
): () => void {
  return subscribeCollection<DocumentRecord>(familyId, 'records', personId, (items) =>
    callback(items.sort((a, b) => (a.date < b.date ? 1 : -1)))
  );
}

export async function addRecord(familyId: string, record: DocumentRecord): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'records'), record.id), stripUndefinedDeep(record));
}

export async function updateRecord(familyId: string, record: DocumentRecord): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'records'), record.id), stripUndefinedDeep(record));
}

export async function deleteRecord(familyId: string, recordId: string): Promise<void> {
  await deleteDoc(doc(familyCollection(familyId, 'records'), recordId));
  await deleteRecordFiles(familyId, recordId).catch((e) => console.warn('Could not delete record files:', e));
}

export async function verifyFactInRecord(
  familyId: string,
  record: DocumentRecord,
  factId: string,
  verified: boolean
): Promise<DocumentRecord> {
  const facts = record.facts.map((f) => (f.id === factId ? { ...f, is_verified: verified } : f));
  const unverified_count = facts.filter((f) => !f.is_verified).length;
  const subtitle =
    unverified_count === 0 && record.subtitle.includes('values need a quick check')
      ? `${record.doctor_name || 'Lab'} · Verified`
      : record.subtitle;

  const updated: DocumentRecord = { ...record, facts, unverified_count, subtitle };
  await setDoc(doc(familyCollection(familyId, 'records'), record.id), stripUndefinedDeep(updated));
  return updated;
}

// Medications
export function subscribeMedications(
  familyId: string,
  personId: string,
  callback: (meds: Medication[]) => void
): () => void {
  return subscribeCollection<Medication>(familyId, 'medications', personId, callback);
}

export async function addMedication(familyId: string, med: Medication): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'medications'), med.id), stripUndefinedDeep(med));
}

export async function updateMedication(familyId: string, med: Medication): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'medications'), med.id), stripUndefinedDeep(med));
}

export async function deleteMedication(familyId: string, medId: string): Promise<void> {
  await deleteDoc(doc(familyCollection(familyId, 'medications'), medId));
}

// Visits
export function subscribeVisits(
  familyId: string,
  personId: string,
  callback: (visits: Visit[]) => void
): () => void {
  return subscribeCollection<Visit>(familyId, 'visits', personId, callback);
}

export async function addVisit(familyId: string, visit: Visit): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'visits'), visit.id), stripUndefinedDeep(visit));
}

export async function updateVisit(familyId: string, visit: Visit): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'visits'), visit.id), stripUndefinedDeep(visit));
}

export async function deleteVisit(familyId: string, visitId: string): Promise<void> {
  await deleteDoc(doc(familyCollection(familyId, 'visits'), visitId));
  await deleteVisitFiles(familyId, visitId).catch((e) => console.warn('Could not delete visit files:', e));
}

// Care team — a family-wide doctor directory, not scoped to one person.
export function subscribeCareTeam(familyId: string, callback: (team: CareTeamMember[]) => void): () => void {
  return onSnapshot(familyCollection(familyId, 'care_team'), (snap) => {
    callback(snap.docs.map((d) => d.data() as CareTeamMember));
  }, (err) => console.error('Firestore subscription error (care_team):', err));
}

export async function addCareTeamMember(familyId: string, member: CareTeamMember): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'care_team'), member.id), stripUndefinedDeep(member));
}

export async function updateCareTeamMember(familyId: string, member: CareTeamMember): Promise<void> {
  await setDoc(doc(familyCollection(familyId, 'care_team'), member.id), stripUndefinedDeep(member));
}

export async function deleteCareTeamMember(familyId: string, memberId: string): Promise<void> {
  await deleteDoc(doc(familyCollection(familyId, 'care_team'), memberId));
}

// Notifications
export function subscribeNotifications(
  familyId: string,
  personId: string,
  callback: (notifs: AppNotification[]) => void
): () => void {
  return subscribeCollection<AppNotification>(familyId, 'notifications', personId, callback);
}

export async function markNotificationRead(familyId: string, id: string): Promise<void> {
  await updateDoc(doc(familyCollection(familyId, 'notifications'), id), { read: true });
}
