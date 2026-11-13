// Where his phone gets its board from.
//
// His private link ends in #b=<long random id>. The phone remembers that id,
// so the home screen icon still works even if it drops the end of the link.
// With an id, the phone keeps a saved copy of the board and its recordings,
// starts with that copy (so it works offline), and checks for changes when the
// app opens, when he comes back to it, and every few minutes.
// Without an id, the built-in starter board is used, as before.

import { useEffect, useState } from 'react';
import { boardPhrases, parseBoard, type Board } from './board';
import { audioId } from './remote/audioId';
import { VOICE } from './remote/config';
import { fetchBoardJson, fetchRecording } from './remote/rest';
import { recordingFor, setDownloadedRecordings } from './speech';

const ID_KEY = 'bro-board:board-id';
const BOARD_KEY = 'bro-board:board';
const AUDIO_KEY = 'bro-board:recordings';
const CHECK_EVERY_MS = 5 * 60 * 1000;

/** The board id in a link's #b=... part, or null if there is none. */
export function boardIdFromHash(hash: string): string | null {
  const match = /(?:^#|&)b=([A-Za-z0-9_-]{32,64})(?=&|$)/.exec(hash);
  return match ? match[1] : null;
}

// Saved copies live in the phone's own storage. If that is full or blocked,
// the app still works; it just cannot keep a copy.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do. The live copy is still used.
  }
}

/** The board id from the link, or the one remembered from an earlier visit. */
export function rememberedBoardId(): string | null {
  const fromLink = boardIdFromHash(window.location.hash);
  if (fromLink) {
    write(ID_KEY, fromLink);
    return fromLink;
  }
  return read(ID_KEY);
}

interface SavedBoard {
  id: string;
  json: string;
}

function savedBoard(boardId: string): SavedBoard | null {
  try {
    const saved = JSON.parse(read(BOARD_KEY) ?? 'null') as SavedBoard | null;
    return saved && saved.id === boardId && typeof saved.json === 'string' ? saved : null;
  } catch {
    return null;
  }
}

function savedRecordings(): Record<string, string> {
  try {
    const saved = JSON.parse(read(AUDIO_KEY) ?? '{}') as unknown;
    return saved && typeof saved === 'object' ? (saved as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Download any recordings this board needs that the phone does not have yet. */
async function syncRecordings(boardId: string, board: Board): Promise<void> {
  const saved = savedRecordings();
  const next: Record<string, string> = {};
  for (const phrase of boardPhrases(board)) {
    if (recordingFor(phrase)) continue; // comes with the app
    if (saved[phrase]) {
      next[phrase] = saved[phrase];
      continue;
    }
    try {
      const found = await fetchRecording(boardId, await audioId(VOICE, phrase));
      // Not made yet: the phone's voice is used until it is.
      if (found.kind === 'ok') next[phrase] = found.value;
    } catch {
      // Offline or a hiccup. Try again at the next check.
    }
  }
  write(AUDIO_KEY, JSON.stringify(next));
  setDownloadedRecordings(next);
}

/** The board to show: the saved or downloaded one if he has a link, else the starter board. */
export function useBoard(starter: Board): Board {
  const [boardId] = useState(rememberedBoardId);
  const [board, setBoard] = useState<Board>(() => {
    const saved = boardId ? savedBoard(boardId) : null;
    return (saved && parseBoard(saved.json)) || starter;
  });

  useEffect(() => {
    if (!boardId) return;
    setDownloadedRecordings(savedRecordings());
    let lastJson = savedBoard(boardId)?.json ?? null;
    let busy = false;

    const check = async () => {
      if (busy || !navigator.onLine) return;
      busy = true;
      try {
        const found = await fetchBoardJson(boardId);
        if (found.kind !== 'ok') return; // Deleted or not made yet: keep the saved copy.
        const next = parseBoard(found.value);
        if (!next) return; // Damaged: keep the last good copy.
        if (found.value !== lastJson) {
          lastJson = found.value;
          write(BOARD_KEY, JSON.stringify({ id: boardId, json: found.value } satisfies SavedBoard));
          setBoard(next);
        }
        await syncRecordings(boardId, next);
      } catch {
        // Offline or a hiccup. The saved copy keeps working.
      } finally {
        busy = false;
      }
    };

    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      window.clearInterval(timer);
    };
  }, [boardId]);

  return board;
}
