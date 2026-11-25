import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { clearIndexedDbPersistence, doc, getDoc, serverTimestamp, setDoc, terminate } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, googleProvider, yahooProvider, db, functions } from './config';

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

export async function signInWithYahoo(): Promise<void> {
  try {
    await signInWithPopup(auth, yahooProvider);
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, yahooProvider);
    } else {
      throw err;
    }
  }
}

// Signing out must also wipe the offline copy of everyone's health records that
// Firestore keeps in the browser — otherwise the next person using a shared
// phone or laptop can still read it straight out of IndexedDB. The SDK has to be
// shut down before its cache can be cleared, so the page reloads afterwards to
// come back up clean.
export async function signOutCurrentUser(): Promise<void> {
  await firebaseSignOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (err) {
    console.warn('Could not clear the local data cache on sign-out:', err);
  }
  window.location.reload();
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
