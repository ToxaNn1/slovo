import { describe, expect, it } from 'vitest';

import { createTextComparison } from './text-comparison';

/** The UA Edition's Language Traits and Search letters. */
const ua = createTextComparison({
  languageTraits: { apostrophes: ['ʼ', "'", '’'], sortLocale: 'uk' },
  searchLetters: { ґ: 'г', ё: 'е' },
});

describe('a typed answer', () => {
  const matches = (typed: string, right: string) => ua.same(typed, right, 'typedAnswer');

  it('matches the right answer typed exactly', () => {
    expect(matches('ганок', 'ганок')).toBe(true);
    expect(matches('ганок', 'ганка')).toBe(false);
  });

  it('ignores case', () => {
    expect(matches('ҐАНОК', 'ґанок')).toBe(true);
    expect(matches('Ганка', 'ганок')).toBe(false);
  });

  it('ignores Stress marks on either side', () => {
    expect(matches('ґанок', 'ґа́нок')).toBe(true);
    expect(matches('ґа́нок', 'ґанок')).toBe(true);
    expect(matches('ґа́нка', 'ґа́нок')).toBe(false);
  });

  it('ignores the kind of apostrophe', () => {
    expect(matches("м'ята", 'мʼята')).toBe(true);
    expect(matches('м’ята', 'мʼята')).toBe(true);
    expect(matches("м'ята", "м'яти")).toBe(false);
    expect(matches('мята', 'мʼята')).toBe(false);
  });

  it('ignores spaces at the ends, never inside', () => {
    expect(matches('  ґанок \n', 'ґанок')).toBe(true);
    expect(matches('вити гніздо', 'вити  гніздо')).toBe(false);
    expect(matches('витигніздо', 'вити гніздо')).toBe(false);
  });

  it('tells г from ґ', () => {
    expect(matches('ганок', 'ґанок')).toBe(false);
    expect(matches('ГАНОК', 'ґанок')).toBe(false);
  });

  it('tells е from ё, even when a Stress mark is ignored', () => {
    expect(matches('ёлка', 'ёлка')).toBe(true);
    expect(matches('елка', 'ёлка')).toBe(false);
    expect(matches('е́лка', 'ёлка')).toBe(false);
  });

  it('takes out a Stress mark typed over a precomposed letter', () => {
    expect(matches('ї́жак', 'їжак')).toBe(true);
  });
});

describe('a Search query', () => {
  const searchKey = (text: string) => ua.key(text, 'searchQuery');

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
    const plain = createTextComparison({
      languageTraits: { apostrophes: ['ʼ', "'", '’'], sortLocale: 'uk' },
      searchLetters: {},
    });
    expect(plain.same('Ґа́нок', 'ґанок', 'searchQuery')).toBe(true);
    expect(plain.same('ґанок', 'ганок', 'searchQuery')).toBe(false);
  });

  it('keeps every other letter apart', () => {
    expect(searchKey('ганок')).not.toBe(searchKey('ганка'));
    expect(searchKey('є')).not.toBe(searchKey('е'));
    expect(searchKey('ї')).not.toBe(searchKey('і'));
    expect(searchKey('й')).not.toBe(searchKey('и'));
    expect(searchKey('мята')).not.toBe(searchKey('мʼята'));
  });

  it('leaves a typed answer strict on г/ґ and е/ё', () => {
    expect(ua.same('ганок', 'ґанок', 'typedAnswer')).toBe(false);
    expect(ua.same('елка', 'ёлка', 'typedAnswer')).toBe(false);
    expect(ua.same("м'ята", 'мʼята', 'typedAnswer')).toBe(true);
  });
});

describe('a Definition or option', () => {
  const key = (text: string) => ua.key(text, 'definition');

  it('reads spaces between words as one, on top of a typed answer', () => {
    expect(key(' Невеликий  \n ГА́НОК ')).toBe('невеликий ганок');
    expect(key("прислів'я")).toBe('прислівʼя');
  });

  it('keeps г and ґ apart', () => {
    expect(key('ґанок')).not.toBe(key('ганок'));
  });
});

describe('an Edition’s own traits', () => {
  it('folds case with the Edition’s locale', () => {
    const tr = createTextComparison({
      languageTraits: { sortLocale: 'tr' },
      searchLetters: {},
    });
    expect(tr.key('KIZ', 'typedAnswer')).toBe('kız');
    expect(tr.same('KIZ', 'kiz', 'typedAnswer')).toBe(false);
  });

  it('compares no apostrophes alike in a language that lists none', () => {
    const en = createTextComparison({ languageTraits: { sortLocale: 'en' }, searchLetters: {} });
    expect(en.same("don't", 'don’t', 'typedAnswer')).toBe(false);
    expect(en.apostrophe).toBeUndefined();
  });

  it('writes every apostrophe as the first the Edition lists', () => {
    expect(ua.apostrophe).toBe('ʼ');
    expect(ua.key('м’ята', 'typedAnswer')).toBe('мʼята');
  });
});
