import { describe, expect, it } from 'vitest';

import { loadEdition } from '../index';
import { InvalidEditionConfigError } from './edition';

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
  featureSwitches: {
    game: true,
    corrections: true,
    idioms: true,
    synonymRows: true,
    tips: true,
    account: true,
    googleSignIn: true,
    sync: true,
    contentUpdates: true,
    notifications: true,
    widget: true,
    shareCards: true,
    pronunciation: true,
    wordOfTheDay: true,
    statistics: true,
    knowledge: true,
    selfCheck: true,
    rarityFloor: true,
    gameReview: true,
    gameGuessWord: true,
    gameCorrection: true,
    gameStress: true,
    gamePairs: true,
    gameSurvival: true,
    gameTimed: true,
    gameIdiomMeaning: true,
    gameAnglicism: true,
    gameBuildIdiom: true,
    gameTypeWord: true,
    gameAnagram: true,
    gameByLetters: true,
    gameOrigin: true,
    dailyCrossword: true,
    search: true,
    rarityTest: true,
    weeklyRecap: true,
    yesterday: true,
    wordOfTheDayArchive: true,
    activeDaysCalendar: true,
    dailyLimit: true,
    politePause: true,
    firstWeek: true,
    widgetHint: true,
    moods: true,
  },
  userSettingDefaults: {
    theme: 'system',
    fontSize: 'M',
    vibration: true,
    notificationTimes: ['09:00'],
    mix: {
      categories: 'all',
      correctionCategories: 'all',
      corrections: true,
      idioms: true,
      synonymRows: true,
      tips: true,
    },
  },
  legalPages: {
    privacy: 'https://example.org/test/privacy',
    terms: 'https://example.org/test/terms',
  },
  categories: [
    { id: 'nature', displayName: 'Nature' },
    { id: 'speech', displayName: 'Speech' },
  ],
  correctionCategories: [
    { id: 'work', displayName: 'At work' },
    { id: 'shop', displayName: 'In the shop' },
  ],
  categoriesRequiringHistory: ['speech'],
  originLanguages: [
    { code: 'la', name: 'Latin' },
    { code: 'other', name: 'Other' },
  ],
  moods: [
    { id: 'joyful', name: 'Joyful', emoji: '😊' },
    { id: 'calm', name: 'Calm', emoji: '😌' },
  ],
};

/** The Feature Switches of the Game Modes and the Daily Crossword (ADR 0052). */
const gamePartSwitches = [
  'gameGuessWord',
  'gameCorrection',
  'gameStress',
  'gamePairs',
  'gameSurvival',
  'gameTimed',
  'gameIdiomMeaning',
  'gameAnglicism',
  'gameBuildIdiom',
  'gameTypeWord',
  'gameAnagram',
  'gameByLetters',
  'gameOrigin',
  'dailyCrossword',
] as const;

/** The Feature Switches of the features of 0.8.13 (ADR 0054). */
const learningSwitches = [
  'search',
  'rarityTest',
  'weeklyRecap',
  'yesterday',
  'wordOfTheDayArchive',
  'activeDaysCalendar',
  'dailyLimit',
  'politePause',
  'firstWeek',
  'widgetHint',
  'moods',
] as const;

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

  it('reports the bundle id, which names the App Group the app shares with its widget', () => {
    expect(loadEdition(validConfig).bundleId).toBe('app.slovo.test');
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
      featureSwitches: { ...validConfig.featureSwitches, game: false },
    });

    expect(edition.isFeatureEnabled('game')).toBe(false);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
  });

  it('turns every Game Mode and the Daily Crossword off while the Game is off', () => {
    const edition = loadEdition({
      ...validConfig,
      featureSwitches: { ...validConfig.featureSwitches, game: false },
    });

    for (const feature of gamePartSwitches) expect(edition.isFeatureEnabled(feature)).toBe(false);
    expect(edition.isFeatureEnabled('gameReview')).toBe(true);
  });

  it.each([
    ...gamePartSwitches,
    ...learningSwitches,
    'synonymRows',
    'tips',
    'account',
    'sync',
    'contentUpdates',
    'notifications',
    'widget',
    'shareCards',
    'pronunciation',
    'wordOfTheDay',
    'statistics',
    'knowledge',
    'selfCheck',
    'rarityFloor',
    'gameReview',
  ] as const)('reports the %s Feature Switch, which an Edition may turn off', (feature) => {
    const on = loadEdition(validConfig);
    const off = loadEdition({
      ...validConfig,
      featureSwitches: { ...validConfig.featureSwitches, [feature]: false },
    });

    expect(on.isFeatureEnabled(feature)).toBe(true);
    expect(off.isFeatureEnabled(feature)).toBe(false);
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
      mix: {
        categoryIds: 'all',
        correctionCategoryIds: 'all',
        corrections: true,
        idioms: true,
        synonymRows: true,
        tips: true,
      },
    });
  });

  it('reports a default Mix of only the listed Categories', () => {
    const edition = loadEdition({
      ...validConfig,
      userSettingDefaults: {
        ...validConfig.userSettingDefaults,
        mix: {
          categories: ['speech'],
          correctionCategories: ['work'],
          corrections: false,
          idioms: true,
          synonymRows: true,
          tips: true,
        },
      },
    });

    expect(edition.userSettingDefaults.mix).toEqual({
      categoryIds: ['speech'],
      correctionCategoryIds: ['work'],
      corrections: false,
      idioms: true,
      synonymRows: true,
      tips: true,
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

  it('reports the addresses of its privacy policy and its terms, which About opens', () => {
    expect(loadEdition(validConfig).legalPages).toEqual({
      privacy: 'https://example.org/test/privacy',
      terms: 'https://example.org/test/terms',
    });
  });

  it.each(['privacy', 'terms'] as const)('requires the address of the %s page', (page) => {
    const { [page]: _removed, ...legalPages } = validConfig.legalPages;

    expect(() => loadEdition({ ...validConfig, legalPages })).toThrow(`legalPages.${page}`);
  });

  it('accepts an Edition that lists no origin languages', () => {
    expect(() => loadEdition({ ...validConfig, originLanguages: [] })).not.toThrow();
  });

  it('accepts an Edition that lists no moods', () => {
    expect(() => loadEdition({ ...validConfig, moods: [] })).not.toThrow();
  });

  it('accepts an Edition whose Categories require no history', () => {
    expect(() => loadEdition({ ...validConfig, categoriesRequiringHistory: [] })).not.toThrow();
  });

  it('requires the legal pages', () => {
    const { legalPages: _removed, ...config } = validConfig;

    expect(() => loadEdition(config)).toThrow('legalPages');
  });

  it('rejects a legal page address that is not a web address', () => {
    expect(() =>
      loadEdition({ ...validConfig, legalPages: { ...validConfig.legalPages, terms: 'terms.md' } }),
    ).toThrow('legalPages.terms');
  });

  it('rejects an invalid Edition config, naming the field', () => {
    expect(() => loadEdition({ ...validConfig, locale: undefined })).toThrow(/locale/);
  });

  const { languageTraits, userSettingDefaults } = validConfig;

  const withoutSwitch = (name: keyof typeof validConfig.featureSwitches) => {
    const { [name]: _removed, ...featureSwitches } = validConfig.featureSwitches;
    return { featureSwitches };
  };

  it.each([
    ['a missing Feature Switch', withoutSwitch('game'), 'featureSwitches.game'],
    ['a missing Account Feature Switch', withoutSwitch('account'), 'featureSwitches.account'],
    [
      'a missing Google sign-in Feature Switch',
      withoutSwitch('googleSignIn'),
      'featureSwitches.googleSignIn',
    ],
    ['a missing sync Feature Switch', withoutSwitch('sync'), 'featureSwitches.sync'],
    [
      'a missing content updates Feature Switch',
      withoutSwitch('contentUpdates'),
      'featureSwitches.contentUpdates',
    ],
    [
      'a missing notifications Feature Switch',
      withoutSwitch('notifications'),
      'featureSwitches.notifications',
    ],
    ['a missing widget Feature Switch', withoutSwitch('widget'), 'featureSwitches.widget'],
    [
      'a missing Share Cards Feature Switch',
      withoutSwitch('shareCards'),
      'featureSwitches.shareCards',
    ],
    [
      'a missing Pronunciation Feature Switch',
      withoutSwitch('pronunciation'),
      'featureSwitches.pronunciation',
    ],
    [
      'a missing Word of the Day Feature Switch',
      withoutSwitch('wordOfTheDay'),
      'featureSwitches.wordOfTheDay',
    ],
    [
      'a missing statistics Feature Switch',
      withoutSwitch('statistics'),
      'featureSwitches.statistics',
    ],
    ['a missing knowledge Feature Switch', withoutSwitch('knowledge'), 'featureSwitches.knowledge'],
    [
      'a missing self-check Feature Switch',
      withoutSwitch('selfCheck'),
      'featureSwitches.selfCheck',
    ],
    [
      'a missing Rarity Floor Feature Switch',
      withoutSwitch('rarityFloor'),
      'featureSwitches.rarityFloor',
    ],
    [
      'a missing Game Review Feature Switch',
      withoutSwitch('gameReview'),
      'featureSwitches.gameReview',
    ],
    [
      'a missing Synonym Rows Feature Switch',
      withoutSwitch('synonymRows'),
      'featureSwitches.synonymRows',
    ],
    ['a missing Tips Feature Switch', withoutSwitch('tips'), 'featureSwitches.tips'],
    [
      'an unknown Feature Switch',
      { featureSwitches: { ...validConfig.featureSwitches, share: true } },
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
          mix: {
            categories: ['nature', 'military'],
            correctionCategories: 'all',
            corrections: true,
            idioms: true,
            synonymRows: true,
            tips: true,
          },
        },
      },
      'userSettingDefaults.mix.categories.1',
    ],
    [
      'a default Mix with no Category',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: {
            categories: [],
            correctionCategories: 'all',
            corrections: true,
            idioms: true,
            synonymRows: true,
            tips: true,
          },
        },
      },
      'userSettingDefaults.mix.categories',
    ],
    [
      'a default Mix with an unknown Category of Corrections',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: {
            categories: 'all',
            correctionCategories: ['nature'],
            corrections: true,
            idioms: true,
            synonymRows: true,
            tips: true,
          },
        },
      },
      'userSettingDefaults.mix.correctionCategories.0',
    ],
    [
      'a default Mix with no Category of Corrections',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: {
            categories: 'all',
            correctionCategories: [],
            corrections: true,
            idioms: true,
            synonymRows: true,
            tips: true,
          },
        },
      },
      'userSettingDefaults.mix.correctionCategories',
    ],
    [
      'a default Mix without the Categories of Corrections',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: {
            categories: 'all',
            corrections: true,
            idioms: true,
            synonymRows: true,
            tips: true,
          },
        },
      },
      'userSettingDefaults.mix.correctionCategories',
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
    ['no Correction Categories', { correctionCategories: undefined }, 'correctionCategories'],
    [
      'an empty list of Correction Categories',
      { correctionCategories: [] },
      'correctionCategories',
    ],
    [
      'a repeated Correction Category id',
      {
        correctionCategories: [
          { id: 'work', displayName: 'At work' },
          { id: 'work', displayName: 'At the office' },
        ],
      },
      'correctionCategories.1.id',
    ],
    [
      'no Categories that require history',
      { categoriesRequiringHistory: undefined },
      'categoriesRequiringHistory',
    ],
    [
      'an unknown Category that requires history',
      { categoriesRequiringHistory: ['speech', 'work'] },
      'categoriesRequiringHistory.1',
    ],
    ['no origin languages', { originLanguages: undefined }, 'originLanguages'],
    [
      'a repeated origin language code',
      {
        originLanguages: [
          { code: 'la', name: 'Latin' },
          { code: 'la', name: 'Late Latin' },
        ],
      },
      'originLanguages.1.code',
    ],
    [
      'an origin language without a name',
      { originLanguages: [{ code: 'la', name: '' }] },
      'originLanguages.0.name',
    ],
    ['no moods', { moods: undefined }, 'moods'],
    [
      'a repeated mood id',
      {
        moods: [
          { id: 'joyful', name: 'Joyful', emoji: '😊' },
          { id: 'joyful', name: 'Glad', emoji: '😀' },
        ],
      },
      'moods.1.id',
    ],
    ['a mood without a name', { moods: [{ id: 'calm', name: '', emoji: '😌' }] }, 'moods.0.name'],
    [
      'a mood without an emoji',
      { moods: [{ id: 'calm', name: 'Calm', emoji: '' }] },
      'moods.0.emoji',
    ],
    [
      'a mood id not in kebab case',
      { moods: [{ id: 'In Love', name: 'In love', emoji: '😍' }] },
      'moods.0.id',
    ],
  ])('rejects %s, naming the field', (_, override, field) => {
    const load = () => loadEdition({ ...validConfig, ...override });

    expect(load).toThrow(InvalidEditionConfigError);
    expect(load).toThrow(`\n${field}: `);
  });

  it.each([...gamePartSwitches, ...learningSwitches])(
    'rejects a missing %s Feature Switch, naming the field',
    (feature) => {
      const load = () => loadEdition({ ...validConfig, ...withoutSwitch(feature) });

      expect(load).toThrow(InvalidEditionConfigError);
      expect(load).toThrow(`\nfeatureSwitches.${feature}: `);
    },
  );
});
