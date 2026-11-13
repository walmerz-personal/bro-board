import { describe, expect, it } from 'vitest';
import boardData from '../src/data/default-board.json';
import { boardPhrases, boardWarnings, parseBoard, validateBoard, type Board } from '../src/board';
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
