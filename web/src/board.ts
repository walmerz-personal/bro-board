// The shape of the board data, plus small helpers that are easy to test.

import { isColorName } from './colors';
import { isStoredPhone } from './texting';

export interface Item {
  id: string;
  label: string;
  icon: string;
  phrase: string;
}

export interface Category {
  id: string;
  label: string;
  icon: string;
  /** One of the soft colours in colors.ts. */
  color?: string;
  /** A category with a phrase and no items goes straight to the message screen. */
  phrase?: string;
  /** Speak the phrase the moment the button is pressed, with no Speak step. */
  speakOnOpen?: boolean;
  items?: Item[];
}

/** Someone he can text. The phone number is stored as +15551234567. */
export interface Recipient {
  id: string;
  name: string;
  phone: string;
  icon: string;
}

export const MAX_RECIPIENTS = 20;

export interface Settings {
  /** After a press, ignore further presses for this long (milliseconds). */
  repeatDelayMs: number;
  /** The finger must rest on a button this long before it counts. 0 turns it off. */
  holdMs: number;
  /** Say each button's label aloud when it is pressed. */
  speakLabels: boolean;
  /** 1 is normal speed. Lower is slower. */
  speechRate: number;
  /** A short buzz when a press counts, on phones that can. On unless turned off. */
  vibrate?: boolean;
  /** Small, gentle animations (ticks, glows, springy buttons). On unless turned off. */
  animations?: boolean;
}

export interface Board {
  version: number;
  settings: Settings;
  categories: Category[];
  /** People he can text. With none, the Text button does not show. */
  recipients?: Recipient[];
}

/** One button on a grid screen: either a real choice or the "More" button. */
export type Tile<T> = { kind: 'entry'; entry: T } | { kind: 'more' };

export const TILES_PER_SCREEN = 6;

/**
 * Split a list into screens of at most 6 buttons, with no scrolling.
 * If everything fits on one screen there is no "More" button.
 * Otherwise each screen shows 5 choices plus "More", which leads to the next
 * screen and wraps back to the first.
 */
export function paginate<T>(entries: T[], perScreen = TILES_PER_SCREEN): Tile<T>[][] {
  if (entries.length <= perScreen) {
    return [entries.map((entry) => ({ kind: 'entry', entry }))];
  }
  const size = perScreen - 1;
  const pages: Tile<T>[][] = [];
  for (let i = 0; i < entries.length; i += size) {
    const page: Tile<T>[] = entries.slice(i, i + size).map((entry) => ({ kind: 'entry', entry }));
    page.push({ kind: 'more' });
    pages.push(page);
  }
  return pages;
}

export interface PressTiming {
  /** Time now. */
  now: number;
  /** When the last press was accepted, or null if none yet. */
  lastAcceptedAt: number | null;
  /** When the finger went down, or null for keyboard presses. */
  downAt: number | null;
}

/** Decide whether a press counts, so a shaky double tap or a brush is ignored. */
export function shouldAcceptPress(
  timing: PressTiming,
  settings: Pick<Settings, 'repeatDelayMs' | 'holdMs'>,
): boolean {
  const { now, lastAcceptedAt, downAt } = timing;
  if (lastAcceptedAt !== null && now - lastAcceptedAt < settings.repeatDelayMs) return false;
  if (settings.holdMs > 0 && downAt !== null && now - downAt < settings.holdMs) return false;
  return true;
}

/** Problems that would make a board confusing or broken. Empty means it is fine. */
export const MAX_PHRASE_LENGTH = 150;

export function validateBoard(board: Board): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const { repeatDelayMs, holdMs, speechRate } = board.settings;
  if (repeatDelayMs < 0 || repeatDelayMs > 5000) problems.push('settings: repeat-tap delay must be 0 to 5 seconds');
  if (holdMs < 0 || holdMs > 3000) problems.push('settings: hold time must be 0 to 3 seconds');
  if (speechRate < 0.3 || speechRate > 2) problems.push('settings: speech speed must be 0.3 to 2');
  if (board.categories.length === 0) problems.push('the Home screen needs at least one button');
  const checkPhrase = (where: string, phrase: string) => {
    if (phrase.length > MAX_PHRASE_LENGTH) problems.push(`${where}: phrase is longer than ${MAX_PHRASE_LENGTH} letters`);
  };
  const checkLabel = (where: string, label: string) => {
    if (!label.trim()) problems.push(`${where}: label is empty`);
    if (label.trim().split(/\s+/).length > 3) problems.push(`${where}: label is longer than 3 words`);
  };
  const name = (label: string, id: string) => `"${label.trim() || id}"`;
  for (const cat of board.categories) {
    const catName = `Home button ${name(cat.label, cat.id)}`;
    if (seen.has(cat.id)) problems.push(`category "${cat.id}": id used twice`);
    seen.add(cat.id);
    checkLabel(catName, cat.label);
    const hasItems = !!cat.items && cat.items.length > 0;
    if (!hasItems && !cat.phrase?.trim()) problems.push(`${catName}: needs a message or at least one need inside`);
    if (cat.phrase) checkPhrase(catName, cat.phrase);
    const itemIds = new Set<string>();
    for (const item of cat.items ?? []) {
      const itemName = `${name(cat.label, cat.id)} › ${name(item.label, item.id)}`;
      if (itemIds.has(item.id)) problems.push(`item "${cat.id}/${item.id}": id used twice`);
      itemIds.add(item.id);
      checkLabel(itemName, item.label);
      if (!item.phrase.trim()) problems.push(`${itemName}: what the phone says is empty`);
      checkPhrase(itemName, item.phrase);
    }
  }
  const people = board.recipients ?? [];
  if (people.length > MAX_RECIPIENTS) problems.push(`people to text: at most ${MAX_RECIPIENTS}`);
  const personIds = new Set<string>();
  for (const person of people) {
    const who = `Person ${name(person.name, person.id)}`;
    if (personIds.has(person.id)) problems.push(`person "${person.id}": id used twice`);
    personIds.add(person.id);
    checkLabel(who, person.name);
    if (!isStoredPhone(person.phone)) problems.push(`${who}: phone number is not complete`);
  }
  return problems;
}

const isText = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Turn saved text back into a board, checking every part of it. Returns null
 * if anything is missing, the wrong type, or breaks the rules in validateBoard,
 * so a damaged download can never replace a board that works.
 */
export function parseBoard(json: string): Board | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const b = data as Record<string, unknown>;
  const s = b.settings as Record<string, unknown> | undefined;
  if (!isNumber(b.version) || !s || typeof s !== 'object') return null;
  if (!isNumber(s.repeatDelayMs) || !isNumber(s.holdMs) || !isNumber(s.speechRate)) return null;
  if (typeof s.speakLabels !== 'boolean') return null;
  if (s.vibrate !== undefined && typeof s.vibrate !== 'boolean') return null;
  if (s.animations !== undefined && typeof s.animations !== 'boolean') return null;
  if (!Array.isArray(b.categories) || b.categories.length === 0) return null;

  const categories: Category[] = [];
  for (const raw of b.categories as unknown[]) {
    const c = raw as Record<string, unknown>;
    if (!c || !isText(c.id) || !isText(c.label) || !isText(c.icon)) return null;
    if (c.phrase !== undefined && !isText(c.phrase)) return null;
    if (c.speakOnOpen !== undefined && typeof c.speakOnOpen !== 'boolean') return null;
    const category: Category = { id: c.id, label: c.label, icon: c.icon };
    // An unknown colour is dropped rather than rejecting the whole board.
    if (isColorName(c.color)) category.color = c.color;
    if (c.phrase !== undefined) category.phrase = c.phrase;
    if (c.speakOnOpen !== undefined) category.speakOnOpen = c.speakOnOpen;
    if (c.items !== undefined) {
      if (!Array.isArray(c.items)) return null;
      const items: Item[] = [];
      for (const rawItem of c.items as unknown[]) {
        const i = rawItem as Record<string, unknown>;
        if (!i || !isText(i.id) || !isText(i.label) || !isText(i.icon) || !isText(i.phrase)) return null;
        items.push({ id: i.id, label: i.label, icon: i.icon, phrase: i.phrase });
      }
      category.items = items;
    }
    categories.push(category);
  }

  let recipients: Recipient[] | undefined;
  if (b.recipients !== undefined) {
    if (!Array.isArray(b.recipients)) return null;
    recipients = [];
    for (const raw of b.recipients as unknown[]) {
      const r = raw as Record<string, unknown>;
      if (!r || !isText(r.id) || !isText(r.name) || !isText(r.phone) || !isText(r.icon)) return null;
      recipients.push({ id: r.id, name: r.name, phone: r.phone, icon: r.icon });
    }
  }

  const board: Board = {
    version: b.version,
    settings: {
      repeatDelayMs: s.repeatDelayMs,
      holdMs: s.holdMs,
      speakLabels: s.speakLabels,
      speechRate: s.speechRate,
      ...(s.vibrate !== undefined ? { vibrate: s.vibrate } : {}),
      ...(s.animations !== undefined ? { animations: s.animations } : {}),
    },
    categories,
    ...(recipients ? { recipients } : {}),
  };
  return validateBoard(board).length === 0 ? board : null;
}

/** Every phrase on the board that can be spoken, each listed once. */
export function boardPhrases(board: Board): string[] {
  const all = board.categories.flatMap((c) => [
    ...(c.phrase ? [c.phrase] : []),
    ...(c.items ?? []).map((i) => i.phrase),
  ]);
  return [...new Set(all)];
}

/**
 * Things that are allowed but make the board harder for him to use. The editor
 * shows these as warnings; they do not stop a save.
 */
export function boardWarnings(board: Board): string[] {
  const warnings: string[] = [];
  const firstPage = new Set(
    paginate(board.categories)[0].flatMap((t) => (t.kind === 'entry' ? [t.entry.id] : [])),
  );
  for (const cat of board.categories) {
    const count = cat.items?.length ?? 0;
    if (count > TILES_PER_SCREEN) {
      warnings.push(`"${cat.label}" has ${count} items, so it needs a More page (one extra tap).`);
    }
    if (cat.speakOnOpen && !firstPage.has(cat.id)) {
      warnings.push(`"${cat.label}" speaks with one tap but is not on the first Home page.`);
    }
  }
  return warnings;
}
