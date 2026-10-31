import { describe, expect, it } from 'vitest';

import { searchKey as searchKeyOf, type SearchLetters } from './search-key';
import { typedAnswerMatches } from '../game/typed-answer';

/** The UA Edition's Search letters (ADR 0054). */
const LETTERS: SearchLetters = { ґ: 'г', ё: 'е' };
const searchKey = (text: string) => searchKeyOf(text, LETTERS);

describe('a Search key', () => {
  it('is one for a text with or without capitals, Stress and ґ', () => {
    expect(searchKey('Ґанок')).toBe(searchKey('ганок'));
    expect(searchKey('га́нок')).toBe(searchKey('ганок'));
    expect(searchKey('ГА́НОК')).toBe(searchKey('ґанок'));
  });

  it('treats е and ё alike, with or without Stress', () => {
    expect(searchKey('Ёлка')).toBe(searchKey('елка'));
    expect(searchKey('ё́лка')).toBe(searchKey('елка'));
  });

  it('treats every kind of apostrophe alike', () => {
    expect(searchKey('мʼята')).toBe(searchKey("м'ята"));
    expect(searchKey('м’ята')).toBe(searchKey("м'ята"));
  });

  it('drops the spaces at the ends, never inside', () => {
    expect(searchKey('  на сумирному \n')).toBe(searchKey('на сумирному'));
    expect(searchKey('на сумирному')).not.toBe(searchKey('насумирному'));
  });

  it('reads no letters alike in an Edition without Search letters', () => {
    expect(searchKeyOf('Ґа́нок', {})).toBe(searchKeyOf('ґанок', {}));
    expect(searchKeyOf('ґанок', {})).not.toBe(searchKeyOf('ганок', {}));
  });

  it('keeps every other letter apart', () => {
    expect(searchKey('ганок')).not.toBe(searchKey('ганка'));
    expect(searchKey('є')).not.toBe(searchKey('е'));
    expect(searchKey('ї')).not.toBe(searchKey('і'));
    expect(searchKey('й')).not.toBe(searchKey('и'));
    expect(searchKey('мята')).not.toBe(searchKey('мʼята'));
  });

  it('leaves the Game strict on г/ґ and е/ё', () => {
    expect(typedAnswerMatches('ганок', 'ґанок')).toBe(false);
    expect(typedAnswerMatches('елка', 'ёлка')).toBe(false);
    expect(typedAnswerMatches("м'ята", 'мʼята')).toBe(true);
  });
});
