import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { UserProfile } from './auth';

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
  memberUids: string[];
  members: Record<string, FamilyMember>;
}

function randomInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function toMember(user: UserProfile): FamilyMember {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export async function createFamily(user: UserProfile, familyName: string): Promise<string> {
  const familyRef = doc(collection(db, 'families'));
  const inviteCode = randomInviteCode();
  const member = toMember(user);

  await setDoc(familyRef, {
    name: familyName || `${user.displayName}'s family`,
    inviteCode,
    createdAt: serverTimestamp(),
    createdBy: user.uid,
    memberUids: [user.uid],
    members: { [user.uid]: member },
  });

  await setDoc(doc(db, 'invites', inviteCode), { familyId: familyRef.id });
  await updateDoc(doc(db, 'users', user.uid), { familyId: familyRef.id });

  return familyRef.id;
}

export async function joinFamilyWithCode(user: UserProfile, rawCode: string): Promise<string> {
  const code = rawCode.trim().toUpperCase();
  const inviteSnap = await getDoc(doc(db, 'invites', code));
  if (!inviteSnap.exists()) {
    throw new Error('That invite code was not found. Double-check it and try again.');
  }
  const familyId = inviteSnap.data().familyId as string;
  const member = toMember(user);

  // A transactional read-then-write here would need `read` access to the family
  // doc first, but the security rules only grant read to existing members —
  // exactly the thing a joiner isn't yet. arrayUnion sidesteps that: it's an
  // atomic, idempotent update that never needs to read the current value first.
  await updateDoc(doc(db, 'families', familyId), {
    memberUids: arrayUnion(user.uid),
    [`members.${user.uid}`]: member,
  });

  await updateDoc(doc(db, 'users', user.uid), { familyId });
  return familyId;
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
