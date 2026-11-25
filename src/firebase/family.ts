import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './config';

export interface FamilyMember {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  memberUids: string[];
  members: Record<string, FamilyMember>;
}

// Creating, joining and changing a family's membership all happen in Cloud
// Functions — the security rules don't let a client write memberUids, invite
// codes or users/{uid}.familyId, so these can't be bypassed from the browser.
const createFamilyFn = httpsCallable(functions, 'createFamily');
const joinFamilyFn = httpsCallable(functions, 'joinFamily');
const regenerateInviteCodeFn = httpsCallable(functions, 'regenerateInviteCode');
const removeFamilyMemberFn = httpsCallable(functions, 'removeFamilyMember');

export async function createFamily(familyName: string): Promise<string> {
  const { data } = await createFamilyFn({ name: familyName });
  return (data as { familyId: string }).familyId;
}

export async function joinFamilyWithCode(rawCode: string): Promise<string> {
  const { data } = await joinFamilyFn({ code: rawCode });
  return (data as { familyId: string }).familyId;
}

export async function regenerateInviteCode(familyId: string): Promise<string> {
  const { data } = await regenerateInviteCodeFn({ familyId });
  return (data as { inviteCode: string }).inviteCode;
}

export async function removeFamilyMember(familyId: string, memberUid: string): Promise<void> {
  await removeFamilyMemberFn({ familyId, memberUid });
}

export function subscribeToFamily(
  familyId: string,
  callback: (family: Family | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    doc(db, 'families', familyId),
    (snap) => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Family) : null);
    },
    (err) => {
      console.error('Firestore subscription error (family):', err);
      onError?.(err);
    }
  );
}
