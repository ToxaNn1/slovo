import { describe, expect, it } from 'vitest';

import { ukrainian as edition } from './test-support';

describe('the Ukrainian Edition', () => {
  it('marks Stress, sorts with the Ukrainian alphabet and allows the apostrophe and hyphen in a Lemma', () => {
    expect(edition.languageTraits).toEqual({
      marksStress: true,
      alphabet: 'а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я'.split(' '),
      lemmaPunctuation: ["'", '-'],
      sortLocale: 'uk',
      distractorRule: 'same-part-of-speech',
      vowels: 'а е є и і ї о у ю я'.split(' '),
    });
  });

  it('turns the Game and Corrections on', () => {
    expect(edition.isFeatureEnabled('game')).toBe(true);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
  });

  it('starts new users on the agreed defaults', () => {
    expect(edition.userSettingDefaults).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      notificationTimes: ['09:00', '13:00', '19:00'],
      mix: { categoryIds: 'all', corrections: true },
    });
  });
});
