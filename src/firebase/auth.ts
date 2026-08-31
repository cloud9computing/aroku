import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, db, functions } from './config';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  familyId: string | null;
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<void> {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err: any) {
    // Popups are blocked on some mobile/in-app browsers — fall back to a full redirect.
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider);
    } else {
      throw err;
    }
  }
}

export async function signOutCurrentUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const profile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Family member',
    email: user.email || '',
    photoURL: user.photoURL || '',
    familyId: null,
  };

  await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

const syncFamilyClaimFn = httpsCallable(functions, 'syncFamilyClaim');

// Keeps the familyId baked into the user's Auth token (used by Storage rules)
// in sync with users/{uid}.familyId, then forces a fresh ID token so the new
// claim actually takes effect on this device before any Storage call is made.
export async function syncFamilyClaim(): Promise<void> {
  if (!auth.currentUser) return;
  await syncFamilyClaimFn();
  await auth.currentUser.getIdToken(true);
}
