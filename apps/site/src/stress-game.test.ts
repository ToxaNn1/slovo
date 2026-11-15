import { describe, expect, it } from 'vitest';

import { isVowel, stressGame, stressed, verdict } from './stress-game';

describe('the landing Наголос game', () => {
  it('plays the design five words with their stressed letters', () => {
    expect(stressGame.map((round) => stressed(round.word, round.stress))).toEqual([
      'кіломе́тр',
      'чорносли́в',
      'завда́ння',
      'ви́падок',
      'о́лень',
    ]);
  });

  it('lets only vowels be picked', () => {
    expect(isVowel('о')).toBe(true);
    expect(isVowel('ї')).toBe(true);
    expect(isVowel('л')).toBe(false);
  });

  it('praises a right pick and corrects a wrong one', () => {
    expect(verdict({ word: 'олень', stress: 0 }, 0)).toBe('Так! о́лень');
    expect(verdict({ word: 'олень', stress: 0 }, 2)).toBe('Ні — правильно о́лень');
  });
});
