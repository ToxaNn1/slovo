import { describe, expect, it } from 'vitest';

import { typedAnswerMatches } from '../index';

describe('a typed answer', () => {
  it('matches the right answer typed exactly', () => {
    expect(typedAnswerMatches('ганок', 'ганок')).toBe(true);
    expect(typedAnswerMatches('ганок', 'ганка')).toBe(false);
  });

  it('ignores case', () => {
    expect(typedAnswerMatches('ҐАНОК', 'ґанок')).toBe(true);
    expect(typedAnswerMatches('Ганка', 'ганок')).toBe(false);
  });

  it('ignores Stress marks on either side', () => {
    expect(typedAnswerMatches('ґанок', 'ґа́нок')).toBe(true);
    expect(typedAnswerMatches('ґа́нок', 'ґанок')).toBe(true);
    expect(typedAnswerMatches('ґа́нка', 'ґа́нок')).toBe(false);
  });

  it('ignores the kind of apostrophe', () => {
    expect(typedAnswerMatches("м'ята", 'мʼята')).toBe(true);
    expect(typedAnswerMatches('м’ята', 'мʼята')).toBe(true);
    expect(typedAnswerMatches("м'ята", "м'яти")).toBe(false);
    expect(typedAnswerMatches('мята', 'мʼята')).toBe(false);
  });

  it('ignores spaces at the ends, never inside', () => {
    expect(typedAnswerMatches('  ґанок \n', 'ґанок')).toBe(true);
    expect(typedAnswerMatches('вити гніздо', 'вити  гніздо')).toBe(false);
    expect(typedAnswerMatches('витигніздо', 'вити гніздо')).toBe(false);
  });

  it('tells г from ґ', () => {
    expect(typedAnswerMatches('ґанок', 'ґанок')).toBe(true);
    expect(typedAnswerMatches('ганок', 'ґанок')).toBe(false);
    expect(typedAnswerMatches('ГАНОК', 'ґанок')).toBe(false);
  });

  it('tells е from ё, even when a Stress mark is ignored', () => {
    expect(typedAnswerMatches('ёлка', 'ёлка')).toBe(true);
    expect(typedAnswerMatches('елка', 'ёлка')).toBe(false);
    expect(typedAnswerMatches('е́лка', 'ёлка')).toBe(false);
    expect(typedAnswerMatches('ёлка', 'ёлка')).toBe(true);
  });
});
