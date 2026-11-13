// Checks firebase/firestore.rules against a local copy of Firestore.
// Nothing here touches the real database. The emails are made up.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Bytes,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const BOARD = 'abcdefghijklmnopqrstuvwxyz012345_-AB';
const EDITOR = 'editor@example.com';
const STRANGER = 'stranger@example.com';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-bro-board',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firebase/firestore.rules'), 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'editors', EDITOR), {});
    await setDoc(doc(db, 'boards', BOARD), { json: '{}', updatedAt: Timestamp.now() });
    await setDoc(doc(db, 'boards', BOARD, 'audio', '0123456789ab'), {
      phrase: 'Hi.', voice: 'am_puck', mp3: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])),
    });
    await setDoc(doc(db, 'boards', BOARD, 'history', 'v1'), { json: '{}', savedAt: Timestamp.now() });
  });
});

const nobody = () => env.unauthenticatedContext().firestore();
const user = (email: string, verified = true) =>
  env.authenticatedContext(email, { email, email_verified: verified }).firestore();
const editor = () => user(EDITOR);

const boardData = () => ({ json: '{"version":1}', updatedAt: serverTimestamp() });
const photoData = () => ({ jpg: Bytes.fromUint8Array(new Uint8Array([255, 216, 255])) });
const audioData = () => ({
  phrase: 'Hello.', voice: 'am_puck', mp3: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])),
});

describe('his phone (no sign-in)', () => {
  it('can read a board whose id it knows', async () => {
    await assertSucceeds(getDoc(doc(nobody(), 'boards', BOARD)));
  });
  it('can read a recording on that board', async () => {
    await assertSucceeds(getDoc(doc(nobody(), 'boards', BOARD, 'audio', '0123456789ab')));
  });
  it('cannot list boards to discover ids', async () => {
    await assertFails(getDocs(collection(nobody(), 'boards')));
  });
  it('cannot list recordings', async () => {
    await assertFails(getDocs(collection(nobody(), 'boards', BOARD, 'audio')));
  });
  it('cannot read old versions', async () => {
    await assertFails(getDoc(doc(nobody(), 'boards', BOARD, 'history', 'v1')));
  });
  it('cannot change a board', async () => {
    await assertFails(setDoc(doc(nobody(), 'boards', BOARD), boardData()));
  });
  it('cannot add a recording', async () => {
    await assertFails(setDoc(doc(nobody(), 'boards', BOARD, 'audio', 'aaaaaaaaaaaa'), audioData()));
  });
  it('can read a photo whose id it knows, but not list photos', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'boards', BOARD, 'photos', 'photo_abcdef123'), photoData()));
    await assertSucceeds(getDoc(doc(nobody(), 'boards', BOARD, 'photos', 'photo_abcdef123')));
    await assertFails(getDocs(collection(nobody(), 'boards', BOARD, 'photos')));
  });
  it('cannot upload a photo', async () => {
    await assertFails(setDoc(doc(nobody(), 'boards', BOARD, 'photos', 'photo_abcdef123'), photoData()));
  });
  it('cannot read the editors list', async () => {
    await assertFails(getDoc(doc(nobody(), 'editors', EDITOR)));
  });
});

describe('a signed-in person who is not approved', () => {
  it('cannot change a board', async () => {
    await assertFails(setDoc(doc(user(STRANGER), 'boards', BOARD), boardData()));
  });
  it('cannot upload a photo', async () => {
    await assertFails(setDoc(doc(user(STRANGER), 'boards', BOARD, 'photos', 'photo_abcdef123'), photoData()));
  });
  it('cannot delete a board', async () => {
    await assertFails(deleteDoc(doc(user(STRANGER), 'boards', BOARD)));
  });
  it('cannot list boards', async () => {
    await assertFails(getDocs(collection(user(STRANGER), 'boards')));
  });
  it('cannot add themselves as an editor', async () => {
    await assertFails(setDoc(doc(user(STRANGER), 'editors', STRANGER), {}));
  });
  it('can see that they are not on the list', async () => {
    await assertSucceeds(getDoc(doc(user(STRANGER), 'editors', STRANGER)));
  });
  it('cannot look at someone else’s entry', async () => {
    await assertFails(getDoc(doc(user(STRANGER), 'editors', EDITOR)));
  });
  it('cannot use an approved email that Google has not confirmed', async () => {
    await assertFails(setDoc(doc(user(EDITOR, false), 'boards', BOARD), boardData()));
  });
});

describe('an approved editor', () => {
  it('can save the board', async () => {
    await assertSucceeds(setDoc(doc(editor(), 'boards', BOARD), boardData()));
  });
  it('can list boards', async () => {
    await assertSucceeds(getDocs(collection(editor(), 'boards')));
  });
  it('can add a recording', async () => {
    await assertSucceeds(setDoc(doc(editor(), 'boards', BOARD, 'audio', 'aaaaaaaaaaaa'), audioData()));
  });
  it('can save and read old versions', async () => {
    await assertSucceeds(
      setDoc(doc(editor(), 'boards', BOARD, 'history', 'v2'), { json: '{}', savedAt: serverTimestamp() }),
    );
    await assertSucceeds(getDocs(collection(editor(), 'boards', BOARD, 'history')));
  });
  it('can delete a board (for "make a new link")', async () => {
    await assertSucceeds(deleteDoc(doc(editor(), 'boards', BOARD)));
  });
  it('cannot create a board with a short, guessable id', async () => {
    await assertFails(setDoc(doc(editor(), 'boards', 'bro'), boardData()));
  });
  it('cannot add unexpected fields to a board', async () => {
    await assertFails(setDoc(doc(editor(), 'boards', BOARD), { ...boardData(), owner: EDITOR }));
  });
  it('cannot store something that is not a recording', async () => {
    await assertFails(
      setDoc(doc(editor(), 'boards', BOARD, 'audio', 'aaaaaaaaaaaa'), { ...audioData(), mp3: 'text' }),
    );
  });
  it('can upload a photo, but only a small image under a long id', async () => {
    await assertSucceeds(setDoc(doc(editor(), 'boards', BOARD, 'photos', 'photo_abcdef123'), photoData()));
    await assertFails(setDoc(doc(editor(), 'boards', BOARD, 'photos', 'p1'), photoData()));
    await assertFails(setDoc(doc(editor(), 'boards', BOARD, 'photos', 'photo_abcdef123'), { jpg: 'not a picture' }));
    await assertFails(
      setDoc(doc(editor(), 'boards', BOARD, 'photos', 'photo_abcdef123'), {
        jpg: Bytes.fromUint8Array(new Uint8Array(310000)),
      }),
    );
  });
  it('cannot change the editors list', async () => {
    await assertFails(setDoc(doc(editor(), 'editors', STRANGER), {}));
  });
});
