// Everything the editor page does with Firebase. Only loaded on the editor page.

import { initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  Bytes,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import { emulator, firebaseConfig } from '../remote/config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
if (emulator) {
  connectAuthEmulator(auth, `http://127.0.0.1:${emulator.authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', emulator.firestorePort);
  // Lets automated checks sign in as a made-up person. Only exists when testing locally.
  (window as unknown as Record<string, unknown>).__testSignIn = (email: string) =>
    signInWithCredential(
      auth,
      GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })),
    );
}

export const HISTORY_LIMIT = 10;

export function onUserChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signIn(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/** Whether this email is on the approved editors list. */
export async function isApproved(email: string): Promise<boolean> {
  return (await getDoc(doc(db, 'editors', email))).exists();
}

export interface SavedBoard {
  id: string;
  json: string;
  updatedAt: Date | null;
}

/** All boards, newest first. Normally there is just one: his. */
export async function listBoards(): Promise<SavedBoard[]> {
  const snap = await getDocs(collection(db, 'boards'));
  return snap.docs
    .map((d) => ({
      id: d.id,
      json: d.data().json as string,
      updatedAt: (d.data().updatedAt as Timestamp | null)?.toDate() ?? null,
    }))
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

/** A new long random id. It becomes the private part of his link. */
export function newBoardId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

/** Save the board and keep a copy in its history, trimming the history to the newest few. */
export async function saveBoard(boardId: string, json: string): Promise<void> {
  await setDoc(doc(db, 'boards', boardId), { json, updatedAt: serverTimestamp() });
  await addDoc(collection(db, 'boards', boardId, 'history'), { json, savedAt: serverTimestamp() });
  const versions = await listHistory(boardId);
  await Promise.all(versions.slice(HISTORY_LIMIT).map((v) => deleteDoc(doc(db, 'boards', boardId, 'history', v.id))));
}

export interface Version {
  id: string;
  json: string;
  savedAt: Date | null;
}

/** Saved versions, newest first. */
export async function listHistory(boardId: string): Promise<Version[]> {
  const snap = await getDocs(query(collection(db, 'boards', boardId, 'history'), orderBy('savedAt', 'desc')));
  return snap.docs.map((d) => ({
    id: d.id,
    json: d.data().json as string,
    savedAt: (d.data().savedAt as Timestamp | null)?.toDate() ?? null,
  }));
}

/** The names of the recordings already saved for this board. */
export async function listRecordingIds(boardId: string): Promise<Set<string>> {
  const snap = await getDocs(collection(db, 'boards', boardId, 'audio'));
  return new Set(snap.docs.map((d) => d.id));
}

export async function saveRecording(boardId: string, id: string, phrase: string, voice: string, mp3: Uint8Array) {
  await setDoc(doc(db, 'boards', boardId, 'audio', id), { phrase, voice, mp3: Bytes.fromUint8Array(mp3) });
}

export async function deleteRecording(boardId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'boards', boardId, 'audio', id));
}

/**
 * Move the board to a new private link: copy the board and its recordings to a
 * new id, then delete everything under the old id so the old link stops working.
 */
export async function moveToNewLink(oldId: string, json: string): Promise<string> {
  const newId = newBoardId();
  await saveBoard(newId, json);
  const audio = await getDocs(collection(db, 'boards', oldId, 'audio'));
  for (const d of audio.docs) await setDoc(doc(db, 'boards', newId, 'audio', d.id), d.data());
  await deleteBoard(oldId);
  return newId;
}

async function deleteBoard(boardId: string): Promise<void> {
  for (const sub of ['audio', 'history']) {
    const snap = await getDocs(collection(db, 'boards', boardId, sub));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, 'boards', boardId));
}
