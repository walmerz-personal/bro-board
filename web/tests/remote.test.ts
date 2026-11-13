import { describe, expect, it } from 'vitest';
import boardData from '../src/data/default-board.json';
import { boardPhrases, boardWarnings, paginate, parseBoard, validateBoard, type Board } from '../src/board';
import { boardIdFromHash } from '../src/boardSource';
import { audioId } from '../src/remote/audioId';

const starter = boardData as Board;
const json = JSON.stringify(starter);

describe('parseBoard (checking a downloaded board)', () => {
  it('accepts the starter board', () => {
    expect(parseBoard(json)).toEqual(starter);
  });

  it('rejects text that is not a board', () => {
    expect(parseBoard('not json')).toBeNull();
    expect(parseBoard('{}')).toBeNull();
    expect(parseBoard('null')).toBeNull();
  });

  it('rejects a board with a label longer than 3 words', () => {
    expect(parseBoard(json.replace('"label":"Thirsty"', '"label":"Very very thirsty now"'))).toBeNull();
  });

  it('rejects a board with a wrongly typed part', () => {
    expect(parseBoard(json.replace('"phrase":"I am hungry."', '"phrase":42'))).toBeNull();
    expect(parseBoard(json.replace('"repeatDelayMs":600', '"repeatDelayMs":"600"'))).toBeNull();
  });

  it('rejects touch settings that would make the board unusable', () => {
    expect(parseBoard(json.replace('"holdMs":0', '"holdMs":60000'))).toBeNull();
  });

  it('drops fields it does not know about', () => {
    const extra = JSON.parse(json);
    extra.categories[0].surprise = 'x';
    expect(parseBoard(JSON.stringify(extra))).toEqual(starter);
  });
});

describe('validateBoard messages', () => {
  it('names buttons by their labels, not internal ids', () => {
    const board = parseBoard(json)!;
    board.categories[0].items![0].label = 'Very very hungry now';
    expect(validateBoard(board)).toEqual(['"Food and drink" › "Very very hungry now": label is longer than 3 words']);
  });

  it('rejects a phrase that is too long', () => {
    const board = parseBoard(json)!;
    board.categories[0].items![0].phrase = 'x'.repeat(151);
    expect(validateBoard(board)).toHaveLength(1);
  });
});

describe('boardWarnings', () => {
  it('warns about lists that need a More page', () => {
    expect(boardWarnings(starter)).toEqual(['"Pain" has 8 items, so it needs a More page (one extra tap).']);
  });

  it('warns when a one-tap button falls off the first page', () => {
    const board = parseBoard(json)!;
    const yes = board.categories.splice(3, 1)[0];
    board.categories.push(yes);
    expect(boardWarnings(board)).toContain('"Yes" speaks with one tap but is not on the first Home page.');
  });
});

describe('boardIdFromHash (his private link)', () => {
  const id = 'Sample_board-id_0123456789abcdef';
  it('reads the id from #b=', () => {
    expect(boardIdFromHash(`#b=${id}`)).toBe(id);
    expect(boardIdFromHash(`#x=1&b=${id}`)).toBe(id);
  });
  it('ignores short or odd ids', () => {
    expect(boardIdFromHash('#b=short')).toBeNull();
    expect(boardIdFromHash(`#b=${id}!`)).toBeNull();
    expect(boardIdFromHash('#edit')).toBeNull();
    expect(boardIdFromHash('')).toBeNull();
  });
});

describe('audioId', () => {
  it('names recordings the same way as tools/make-audio.py', async () => {
    // sha1("am_puck|I would like a cup of tea, please.")[:12], as Python makes it.
    expect(await audioId('am_puck', 'I would like a cup of tea, please.')).toBe('7bd73bde23ad');
    // And matches a recording that ships with the app.
    expect(`${await audioId('am_puck', 'I am hungry.')}.mp3`).toBe('3ff99349aa06.mp3');
  });
});

describe('boardPhrases', () => {
  it('lists each phrase once', () => {
    const phrases = boardPhrases(starter);
    expect(new Set(phrases).size).toBe(phrases.length);
    expect(phrases).toContain('Yes.');
  });
});

describe('colours', () => {
  it('keeps a known colour and drops an unknown one', async () => {
    const { colorFor, PALETTE } = await import('../src/colors');
    const board = parseBoard(json)!;
    expect(board.categories[0].color).toBe('orange');
    const odd = JSON.parse(json);
    odd.categories[0].color = 'neon';
    const parsed = parseBoard(JSON.stringify(odd))!;
    expect(parsed).not.toBeNull();
    expect(parsed.categories[0].color).toBeUndefined();
    // A category without a colour still gets the same one every time.
    expect(colorFor({ id: 'food' })).toBe(colorFor({ id: 'food' }));
    expect(Object.values(PALETTE)).toContain(colorFor({ id: 'anything' }));
  });

  it('gives every starter category a colour, different from its neighbours on the same screen', () => {
    const pages = paginate(starter.categories);
    for (const page of pages) {
      const colors = page.flatMap((t) => (t.kind === 'entry' ? [t.entry.color] : []));
      expect(colors.every(Boolean)).toBe(true);
      expect(new Set(colors).size).toBe(colors.length);
    }
  });

  it('accepts the optional buzz setting and rejects a wrong type', () => {
    expect(parseBoard(json.replace('"speechRate":0.9', '"speechRate":0.9,"vibrate":false'))?.settings.vibrate).toBe(false);
    expect(parseBoard(json.replace('"speechRate":0.9', '"speechRate":0.9,"vibrate":"no"'))).toBeNull();
  });
});

describe('texting', () => {
  it('turns typed numbers into the international form', async () => {
    const { normalizePhone } = await import('../src/texting');
    expect(normalizePhone('(555) 212-3456')).toBe('+15552123456');
    expect(normalizePhone('555.212.3456')).toBe('+15552123456');
    expect(normalizePhone('1 555 212 3456')).toBe('+15552123456');
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('212-3456')).toBeNull();
    expect(normalizePhone('call me')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('builds a Messages link with the phrase and the note', async () => {
    const { smsLink, formatPhone } = await import('../src/texting');
    expect(smsLink('+15552123456', 'I am hungry.')).toBe(
      'sms:+15552123456?&body=I%20am%20hungry.%20(sent%20from%20Bro%20Board)',
    );
    expect(formatPhone('+15552123456')).toBe('(555) 212-3456');
    expect(formatPhone('+447700900123')).toBe('+447700900123');
  });

  it('accepts people with complete numbers and rejects others', () => {
    const add = (phone: string, name = 'Mum') =>
      JSON.stringify({ ...JSON.parse(json), recipients: [{ id: 'mum', name, phone, icon: 'family' }] });
    expect(parseBoard(add('+15552123456'))?.recipients).toEqual([
      { id: 'mum', name: 'Mum', phone: '+15552123456', icon: 'family' },
    ]);
    expect(parseBoard(add('555 212 3456'))).toBeNull();
    expect(parseBoard(add('+15552123456', 'My very dear mother'))).toBeNull();
  });
});
