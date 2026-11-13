import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import boardData from '../src/data/default-board.json';
import { paginate, shouldAcceptPress, validateBoard, type Board } from '../src/board';
import { current, initialNav, navReducer, type NavAction } from '../src/nav';
import { pickVoice, type VoiceInfo } from '../src/speech';
import manifest from '../src/data/audio-manifest.json';

const board = boardData as Board;
const symbol = (icon: string) => fileURLToPath(new URL(`../public/symbols/${icon}.svg`, import.meta.url));

describe('starter board', () => {
  it('has no problems', () => {
    expect(validateBoard(board)).toEqual([]);
  });

  it('has a picture file for every button', () => {
    const icons = board.categories.flatMap((c) => [c.icon, ...(c.items ?? []).map((i) => i.icon)]);
    const missing = icons.filter((icon) => !existsSync(symbol(icon)));
    expect(missing).toEqual([]);
  });

  it('has a recording for every phrase', () => {
    const phrases = board.categories.flatMap((c) => [
      ...(c.phrase ? [c.phrase] : []),
      ...(c.items ?? []).map((i) => i.phrase),
    ]);
    const files: Record<string, string> = manifest.files;
    const audio = (file: string) => fileURLToPath(new URL(`../public/audio/${file}`, import.meta.url));
    // If this fails after editing a phrase, run tools/make-audio.py again.
    const missing = phrases.filter((p) => !files[p] || !existsSync(audio(files[p])));
    expect(missing).toEqual([]);
  });

  it('puts Yes and No on the first page, speaking with one tap', () => {
    const firstPage = paginate(board.categories)[0].flatMap((t) => (t.kind === 'entry' ? [t.entry] : []));
    for (const id of ['yes', 'no']) {
      const entry = firstPage.find((c) => c.id === id);
      expect(entry?.speakOnOpen).toBe(true);
      expect(entry?.phrase).toBeTruthy();
    }
  });

  it('reaches every message in three taps or fewer', () => {
    // Tap 1 picks a category, tap 2 picks an item, tap 3 is Speak or Show big.
    // "More" adds a tap, so a category with a second page must stay rare.
    const needMore = board.categories.filter((c) => (c.items?.length ?? 0) > 6).map((c) => c.id);
    expect(needMore).toEqual(['pain']);
  });
});

describe('paginate', () => {
  it('shows up to 6 on one screen with no More button', () => {
    const pages = paginate([1, 2, 3, 4, 5, 6]);
    expect(pages).toHaveLength(1);
    expect(pages[0].every((t) => t.kind === 'entry')).toBe(true);
  });

  it('splits 7 or more into screens of 5 plus More', () => {
    const pages = paginate([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(6);
    expect(pages[0][5]).toEqual({ kind: 'more' });
    expect(pages[1]).toHaveLength(4);
    expect(pages[1][3]).toEqual({ kind: 'more' });
  });

  it('never puts more than 6 buttons on a screen', () => {
    for (let n = 0; n < 40; n++) {
      const pages = paginate(Array.from({ length: n }, (_, i) => i));
      expect(pages.every((p) => p.length <= 6)).toBe(true);
      const shown = pages.flat().filter((t) => t.kind === 'entry').length;
      expect(shown).toBe(n);
    }
  });
});

describe('shouldAcceptPress', () => {
  const settings = { repeatDelayMs: 600, holdMs: 0 };

  it('accepts the first press', () => {
    expect(shouldAcceptPress({ now: 1000, lastAcceptedAt: null, downAt: 950 }, settings)).toBe(true);
  });

  it('ignores a second press that comes too soon', () => {
    expect(shouldAcceptPress({ now: 1300, lastAcceptedAt: 1000, downAt: 1250 }, settings)).toBe(false);
  });

  it('accepts a press after the delay has passed', () => {
    expect(shouldAcceptPress({ now: 1700, lastAcceptedAt: 1000, downAt: 1650 }, settings)).toBe(true);
  });

  it('ignores a quick brush when a hold time is set', () => {
    const hold = { repeatDelayMs: 600, holdMs: 300 };
    expect(shouldAcceptPress({ now: 1100, lastAcceptedAt: null, downAt: 1000 }, hold)).toBe(false);
    expect(shouldAcceptPress({ now: 1400, lastAcceptedAt: null, downAt: 1000 }, hold)).toBe(true);
  });
});

describe('navigation', () => {
  const run = (...actions: NavAction[]) => actions.reduce((s, a) => navReducer(board, s, a), initialNav);
  const food = board.categories.find((c) => c.id === 'food')!;
  const yes = board.categories.find((c) => c.id === 'yes')!;

  it('opens a category, then an item, then the message', () => {
    const state = run({ type: 'openCategory', category: food }, { type: 'openItem', item: food.items![0] });
    expect(current(state)).toEqual({ name: 'message', phrase: 'I am hungry.', icon: 'hungry', categoryId: 'food' });
  });

  it('goes straight to the message for a category with no items', () => {
    const state = run({ type: 'openCategory', category: yes });
    expect(current(state)).toEqual({ name: 'message', phrase: 'Yes.', icon: 'yes', categoryId: 'yes' });
  });

  it('More moves to the next home page and wraps around', () => {
    expect(current(run({ type: 'more' }))).toEqual({ name: 'home', page: 1 });
    expect(current(run({ type: 'more' }, { type: 'more' }))).toEqual({ name: 'home', page: 0 });
  });

  it('Back goes up one level and Home goes to the start', () => {
    const deep = run({ type: 'openCategory', category: food }, { type: 'openItem', item: food.items![0] });
    expect(current(navReducer(board, deep, { type: 'back' })).name).toBe('items');
    expect(navReducer(board, deep, { type: 'home' })).toEqual(initialNav);
  });

  it('Back from Show big returns to the message', () => {
    const big = run({ type: 'openCategory', category: yes }, { type: 'showBig' });
    expect(current(big)).toEqual({ name: 'big', phrase: 'Yes.', icon: 'yes', categoryId: 'yes' });
    expect(current(navReducer(board, big, { type: 'back' })).name).toBe('message');
  });
});

describe('pickVoice', () => {
  const voice = (name: string, lang = 'en-US', isDefault = false): VoiceInfo => ({
    name,
    lang,
    localService: true,
    default: isDefault,
  });

  it('prefers a higher-quality voice over the default', () => {
    const picked = pickVoice([voice('Samantha', 'en-US', true), voice('Ava (Premium)'), voice('Bells')]);
    expect(picked?.name).toBe('Ava (Premium)');
  });

  it('never picks a joke voice when a normal one exists', () => {
    const picked = pickVoice([voice('Albert'), voice('Zarvox'), voice('Samantha')]);
    expect(picked?.name).toBe('Samantha');
  });

  it('keeps the phone default when nothing is clearly better', () => {
    const picked = pickVoice([voice('English United States'), voice('English Australia', 'en-AU', true)]);
    expect(picked?.name).toBe('English Australia');
  });

  it('lets the phone decide when there is no English voice', () => {
    expect(pickVoice([voice('Amelie', 'fr-FR', true)])).toBeNull();
  });
});
