import { describe, expect, it } from 'vitest';

import { InvalidEditionConfigError, loadEdition } from '../index';

const validConfig = {
  id: 'test',
  locale: 'xx-XX',
  displayName: 'SLOVO Test',
  bundleId: 'app.slovo.test',
  languageTraits: {
    marksStress: true,
    alphabet: 'a b c',
    sortLocale: 'xx',
    distractorRule: 'same-part-of-speech',
    vowels: 'a',
  },
  featureSwitches: { game: true, corrections: true },
  userSettingDefaults: {
    theme: 'system',
    fontSize: 'M',
    vibration: true,
    notificationTimes: ['09:00'],
    mix: { categories: 'all', corrections: true },
  },
  categories: [
    { id: 'nature', displayName: 'Nature' },
    { id: 'speech', displayName: 'Speech' },
  ],
};

describe('loadEdition', () => {
  it('reports the Edition id, locale and whether it marks Stress', () => {
    const edition = loadEdition(validConfig);

    expect(edition.id).toBe('test');
    expect(edition.locale).toBe('xx-XX');
    expect(edition.languageTraits.marksStress).toBe(true);
  });

  it('reports the display name, the watermark of its Share Cards', () => {
    expect(loadEdition(validConfig).displayName).toBe('SLOVO Test');
  });

  it('reports an Edition that does not mark Stress', () => {
    const edition = loadEdition({
      ...validConfig,
      languageTraits: { ...validConfig.languageTraits, marksStress: false },
    });

    expect(edition.languageTraits.marksStress).toBe(false);
  });

  it('reports the Game as disabled when its Feature Switch is off', () => {
    const edition = loadEdition({
      ...validConfig,
      featureSwitches: { game: false, corrections: true },
    });

    expect(edition.isFeatureEnabled('game')).toBe(false);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
  });

  it('reports the language traits', () => {
    const { languageTraits } = loadEdition(validConfig);

    expect(languageTraits.alphabet).toEqual(['a', 'b', 'c']);
    expect(languageTraits.sortLocale).toBe('xx');
    expect(languageTraits.distractorRule).toBe('same-part-of-speech');
    expect(languageTraits.vowels).toEqual(['a']);
  });

  it('reports the user-setting defaults, with a Mix of all left to the Language Pack', () => {
    const edition = loadEdition(validConfig);

    expect(edition.userSettingDefaults).toEqual({
      theme: 'system',
      fontSize: 'M',
      vibration: true,
      notificationTimes: ['09:00'],
      mix: { categoryIds: 'all', corrections: true },
    });
  });

  it('reports a default Mix of only the listed Categories', () => {
    const edition = loadEdition({
      ...validConfig,
      userSettingDefaults: {
        ...validConfig.userSettingDefaults,
        mix: { categories: ['speech'], corrections: false },
      },
    });

    expect(edition.userSettingDefaults.mix).toEqual({
      categoryIds: ['speech'],
      corrections: false,
    });
  });

  it('reports the default notification times in time order', () => {
    const edition = loadEdition({
      ...validConfig,
      userSettingDefaults: {
        ...validConfig.userSettingDefaults,
        notificationTimes: ['19:00', '09:00', '13:30', '00:05'],
      },
    });

    expect(edition.userSettingDefaults.notificationTimes).toEqual([
      '00:05',
      '09:00',
      '13:30',
      '19:00',
    ]);
  });

  it("reports the file of the Edition's notification sound, if it has one", () => {
    const withSound = loadEdition({ ...validConfig, notificationSound: 'notification.wav' });

    expect(loadEdition(validConfig).notificationSound).toBeUndefined();
    expect(withSound.notificationSound).toBe('notification.wav');
  });

  it('reports a default of Vibration off', () => {
    const edition = loadEdition({
      ...validConfig,
      userSettingDefaults: { ...validConfig.userSettingDefaults, vibration: false },
    });

    expect(edition.userSettingDefaults.vibration).toBe(false);
  });

  it('rejects an invalid Edition config, naming the field', () => {
    expect(() => loadEdition({ ...validConfig, locale: undefined })).toThrow(/locale/);
  });

  const { languageTraits, userSettingDefaults } = validConfig;

  it.each([
    [
      'a missing Feature Switch',
      { featureSwitches: { corrections: true } },
      'featureSwitches.game',
    ],
    [
      'an unknown Feature Switch',
      { featureSwitches: { game: true, corrections: true, share: true } },
      'featureSwitches',
    ],
    [
      'an unknown Distractor rule',
      { languageTraits: { ...languageTraits, distractorRule: 'random' } },
      'languageTraits.distractorRule',
    ],
    [
      'a repeated letter in the alphabet',
      { languageTraits: { ...languageTraits, alphabet: 'a b a' } },
      'languageTraits.alphabet',
    ],
    [
      'a Stress-marking Edition without vowels',
      { languageTraits: { ...languageTraits, vowels: undefined } },
      'languageTraits.vowels',
    ],
    [
      'a vowel that is not a letter of the alphabet',
      { languageTraits: { ...languageTraits, vowels: 'a e' } },
      'languageTraits.vowels.1',
    ],
    [
      'an unknown Theme',
      { userSettingDefaults: { ...userSettingDefaults, theme: 'sepia' } },
      'userSettingDefaults.theme',
    ],
    [
      'an unknown font size',
      { userSettingDefaults: { ...userSettingDefaults, fontSize: 'XXL' } },
      'userSettingDefaults.fontSize',
    ],
    [
      'a missing Vibration default',
      { userSettingDefaults: { ...userSettingDefaults, vibration: undefined } },
      'userSettingDefaults.vibration',
    ],
    [
      'a Vibration default that is not on or off',
      { userSettingDefaults: { ...userSettingDefaults, vibration: 'on' } },
      'userSettingDefaults.vibration',
    ],
    [
      'a notification time that is not HH:MM',
      { userSettingDefaults: { ...userSettingDefaults, notificationTimes: ['9:00'] } },
      'userSettingDefaults.notificationTimes.0',
    ],
    [
      'more than 10 notification times',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          notificationTimes: Array.from({ length: 11 }, (_, hour) => `${String(hour + 10)}:00`),
        },
      },
      'userSettingDefaults.notificationTimes',
    ],
    [
      'a repeated notification time',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          notificationTimes: ['19:00', '09:00', '19:00'],
        },
      },
      'userSettingDefaults.notificationTimes',
    ],
    [
      'a default Mix with an unknown Category',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: { categories: ['nature', 'military'], corrections: true },
        },
      },
      'userSettingDefaults.mix.categories.1',
    ],
    [
      'a default Mix with no Category',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: { categories: [], corrections: true },
        },
      },
      'userSettingDefaults.mix.categories',
    ],
    [
      'a repeated Category id',
      {
        categories: [
          { id: 'nature', displayName: 'Nature' },
          { id: 'nature', displayName: 'Weather' },
        ],
      },
      'categories.1.id',
    ],
  ])('rejects %s, naming the field', (_, override, field) => {
    const load = () => loadEdition({ ...validConfig, ...override });

    expect(load).toThrow(InvalidEditionConfigError);
    expect(load).toThrow(`\n${field}: `);
  });
});
