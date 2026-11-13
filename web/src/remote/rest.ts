// How his phone reads the board: two plain web requests, no sign-in and no
// Firebase library, so the app stays small and quick to open.

import { documentsUrl } from './config';

export type Fetched<T> = { kind: 'ok'; value: T } | { kind: 'missing' };

async function getDocument(path: string): Promise<Fetched<Record<string, Record<string, string>>>> {
  const res = await fetch(`${documentsUrl}/${path}`, { cache: 'no-store' });
  if (res.status === 404) return { kind: 'missing' };
  if (!res.ok) throw new Error(`Could not load (${res.status})`);
  const body = (await res.json()) as { fields?: Record<string, Record<string, string>> };
  return { kind: 'ok', value: body.fields ?? {} };
}

/** The board saved under this id, as the text the editor saved. */
export async function fetchBoardJson(boardId: string): Promise<Fetched<string>> {
  const doc = await getDocument(`boards/${encodeURIComponent(boardId)}`);
  if (doc.kind === 'missing') return doc;
  const json = doc.value.json?.stringValue;
  if (typeof json !== 'string') throw new Error('Board has no contents');
  return { kind: 'ok', value: json };
}

/** A recording as base64 MP3 data, or missing if it has not been made yet. */
export async function fetchRecording(boardId: string, id: string): Promise<Fetched<string>> {
  const doc = await getDocument(`boards/${encodeURIComponent(boardId)}/audio/${id}`);
  if (doc.kind === 'missing') return doc;
  const mp3 = doc.value.mp3?.bytesValue;
  if (typeof mp3 !== 'string') throw new Error('Recording has no sound');
  return { kind: 'ok', value: mp3 };
}

/** A person's photo as base64 JPEG data, or missing. */
export async function fetchPhoto(boardId: string, id: string): Promise<Fetched<string>> {
  const doc = await getDocument(`boards/${encodeURIComponent(boardId)}/photos/${encodeURIComponent(id)}`);
  if (doc.kind === 'missing') return doc;
  const jpg = doc.value.jpg?.bytesValue;
  if (typeof jpg !== 'string') throw new Error('Photo has no picture');
  return { kind: 'ok', value: jpg };
}
