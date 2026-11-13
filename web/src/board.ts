// The shape of the board data, plus small helpers that are easy to test.

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
  /** A category with a phrase and no items goes straight to the message screen. */
  phrase?: string;
  /** Speak the phrase the moment the button is pressed, with no Speak step. */
  speakOnOpen?: boolean;
  items?: Item[];
}

export interface Settings {
  /** After a press, ignore further presses for this long (milliseconds). */
  repeatDelayMs: number;
  /** The finger must rest on a button this long before it counts. 0 turns it off. */
  holdMs: number;
  /** Say each button's label aloud when it is pressed. */
  speakLabels: boolean;
  /** 1 is normal speed. Lower is slower. */
  speechRate: number;
}

export interface Board {
  version: number;
  settings: Settings;
  categories: Category[];
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
export function validateBoard(board: Board): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const checkLabel = (where: string, label: string) => {
    if (!label.trim()) problems.push(`${where}: label is empty`);
    if (label.trim().split(/\s+/).length > 3) problems.push(`${where}: label is longer than 3 words`);
  };
  for (const cat of board.categories) {
    if (seen.has(cat.id)) problems.push(`category "${cat.id}": id used twice`);
    seen.add(cat.id);
    checkLabel(`category "${cat.id}"`, cat.label);
    const hasItems = !!cat.items && cat.items.length > 0;
    if (!hasItems && !cat.phrase) problems.push(`category "${cat.id}": needs items or a phrase`);
    const itemIds = new Set<string>();
    for (const item of cat.items ?? []) {
      if (itemIds.has(item.id)) problems.push(`item "${cat.id}/${item.id}": id used twice`);
      itemIds.add(item.id);
      checkLabel(`item "${cat.id}/${item.id}"`, item.label);
      if (!item.phrase.trim()) problems.push(`item "${cat.id}/${item.id}": phrase is empty`);
    }
  }
  return problems;
}
