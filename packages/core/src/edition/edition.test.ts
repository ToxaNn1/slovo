import { describe, expect, it } from 'vitest';

import { loadEdition } from '../index';
import { InvalidEditionConfigError } from './edition';

const validConfig = {
  id: 'test',
  locale: 'xx-XX',
  displayName: 'SLOVO Test',
  accountName: 'Test ID',
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
    signInWithApple: true,
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
    rarityCeiling: true,
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
    confirmedEntries: true,
    yesterday: true,
    wordOfTheDayArchive: true,
    activeDaysCalendar: true,
    politePause: true,
    firstWeek: true,
    widgetHint: true,
    moods: true,
    seasonalDecor: true,
    stressAnimation: true,
    illustrations: true,
    mistakeReports: true,
    communityCounters: true,
    communityWord: true,
    calligraphy: true,
    spotlight: true,
    appIntents: true,
    collectionLinks: true,
    replaceOpenEntry: true,
    mixKindWeights: true,
    analytics: true,
    xpLog: true,
    streakFreezes: true,
    streakBreak: true,
    quickQuestion: true,
    levels: true,
    noCounters: true,
    dailyGoal: true,
    enoughForToday: true,
    widgetGoalRing: true,
    lockScreenWidget: true,
    questionnaire: true,
    badges: true,
    progressShareCards: true,
    dailyCrosswordShare: true,
    eveningNotification: true,
    notificationFarewell: true,
    notificationExplainer: true,
    laterQuestions: true,
    profile: true,
    mascot: true,
  },
  userSettingDefaults: {
    theme: 'system',
    fontSize: 'M',
    vibration: true,
    dailyGoal: 20,
    notificationTimes: ['09:00'],
    mix: {
      categories: 'all',
      correctionCategories: 'all',
      corrections: true,
      idioms: true,
      synonymRows: true,
      tips: true,
      rarityFloor: 1,
      rarityCeiling: 5,
    },
  },
  wordOfTheDayFont: 'Script-Regular.ttf',
  widgetPalette: {
    parchment: { background: '#F3E9D2', text: '#3B2A1A' },
    blue: { background: '#1F3A5F', text: '#F3EEE2' },
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
  searchLetters: { b: 'a' },
  xp: {
    round: 1,
    finishedGame: 5,
    finishedGameShare: 0.5,
    bestResult: 5,
    dailyCrossword: 15,
    reviewAnswer: 1,
    reviewDailyCap: 10,
    quickQuestion: 2,
  },
  levels: { first: 50, growth: 0.1, growingUntil: 10, later: 120, names: ['Seed', 'Sprout'] },
  questionnaire: {
    who: [
      { id: 'studying', label: 'Studying', rarityCeiling: 4 },
      { id: 'working', label: 'Working', rarityCeiling: 5 },
    ],
    why: [{ id: 'play', label: 'Play', kindWeights: { idiom: 'more', synonymRow: 'more' } }],
    selfRating: [{ id: 'few', label: 'Few', rarityFloor: 1, offerRarityTest: false }],
  },
  badges: [
    { id: 'week', name: 'Week', condition: { kind: 'streak', days: 7 } },
    {
      id: 'sharp-stress',
      name: 'Sharp stress',
      condition: { kind: 'rightAnswers', modes: ['stress'], count: 100 },
    },
  ],
  mascot: {
    onboarding: 'Hello',
    newLevel: 'New Level',
    badge: 'New Badge',
    dailyGoal: 'Goal met',
    streakMilestone: 'Streak grows',
    gameRight: 'Right',
    gameWrong: 'Almost',
    gameEnd: 'Game over',
    empty: 'Nothing yet',
  },
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
  'dailyGoal',
  'enoughForToday',
  'politePause',
  'firstWeek',
  'widgetHint',
  'moods',
] as const;

/** The Feature Switches of the features of 0.8.14. */
const feelSwitches = [
  'seasonalDecor',
  'stressAnimation',
  'illustrations',
  'mistakeReports',
  'communityCounters',
  'communityWord',
] as const;

/** The Feature Switches of the features of 0.8.15. */
const nativeSwitches = ['calligraphy', 'spotlight', 'appIntents', 'collectionLinks'] as const;

function withoutQuestionnaireSwitch() {
  const { questionnaire: _removed, ...featureSwitches } = validConfig.featureSwitches;
  return { featureSwitches };
}
/** The Feature Switches of the 1.0 notification plan. */
const notificationSwitches = [
  'eveningNotification',
  'notificationFarewell',
  'notificationExplainer',
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
    ...feelSwitches,
    ...nativeSwitches,
    ...notificationSwitches,
    'signInWithApple',
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
    'progressShareCards',
    'dailyCrosswordShare',
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
      dailyGoal: 20,
      notificationTimes: ['09:00'],
      mix: {
        categoryIds: 'all',
        correctionCategoryIds: 'all',
        corrections: true,
        idioms: true,
        synonymRows: true,
        tips: true,
        rarityFloor: 1,
        rarityCeiling: 5,
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
          rarityFloor: 1,
          rarityCeiling: 5,
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
      rarityFloor: 1,
      rarityCeiling: 5,
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

  it('reports the XP table, what each learning action earns (ADR 0066)', () => {
    expect(loadEdition(validConfig).xp).toEqual({
      round: 1,
      finishedGame: 5,
      finishedGameShare: 0.5,
      bestResult: 5,
      dailyCrossword: 15,
      reviewAnswer: 1,
      quickQuestion: 2,
      reviewDailyCap: 10,
    });
  });

  it('refuses an Edition without an XP table, a negative amount or a share above 1', () => {
    const { xp, ...withoutXp } = validConfig;
    expect(() => loadEdition(withoutXp)).toThrow(InvalidEditionConfigError);
    expect(() => loadEdition({ ...validConfig, xp: { ...xp, round: -1 } })).toThrow(
      InvalidEditionConfigError,
    );
    expect(() => loadEdition({ ...validConfig, xp: { ...xp, finishedGameShare: 1.5 } })).toThrow(
      InvalidEditionConfigError,
    );
    const { reviewDailyCap: _, ...withoutCap } = xp;
    expect(() => loadEdition({ ...validConfig, xp: withoutCap })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('reports the Level curve and the Level names (ADR 0066)', () => {
    expect(loadEdition(validConfig).levels).toEqual({
      first: 50,
      growth: 0.1,
      growingUntil: 10,
      later: 120,
      names: ['Seed', 'Sprout'],
    });
  });

  it('refuses an Edition without a Level curve, with a Level costing nothing or with no Level name', () => {
    const { levels, ...withoutLevels } = validConfig;
    expect(() => loadEdition(withoutLevels)).toThrow(InvalidEditionConfigError);
    expect(() => loadEdition({ ...validConfig, levels: { ...levels, first: 0 } })).toThrow(
      InvalidEditionConfigError,
    );
    expect(() => loadEdition({ ...validConfig, levels: { ...levels, growth: -0.1 } })).toThrow(
      InvalidEditionConfigError,
    );
    expect(() => loadEdition({ ...validConfig, levels: { ...levels, names: [] } })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('reports the questionnaire: the options of «Хто ви» and «Навіщо» and what each sets (ADR 0067)', () => {
    expect(loadEdition(validConfig).questionnaire).toEqual(validConfig.questionnaire);
  });

  it('refuses an Edition without a questionnaire, with no option, a repeated option id, an unknown Mix kind or a Ceiling below the default Floor', () => {
    const { questionnaire, ...withoutQuestionnaire } = validConfig;
    const [studying, working] = questionnaire.who;
    expect(() => loadEdition(withoutQuestionnaire)).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({ ...validConfig, questionnaire: { ...questionnaire, why: [] } }),
    ).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({
        ...validConfig,
        questionnaire: { ...questionnaire, who: [studying, { ...working, id: 'studying' }] },
      }),
    ).toThrow('questionnaire.who.1.id: Duplicate option id "studying"');
    expect(() =>
      loadEdition({
        ...validConfig,
        questionnaire: {
          ...questionnaire,
          why: [{ id: 'play', label: 'Play', kindWeights: { word: 'more' } }],
        },
      }),
    ).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({
        ...validConfig,
        userSettingDefaults: {
          ...validConfig.userSettingDefaults,
          mix: { ...validConfig.userSettingDefaults.mix, rarityFloor: 5, rarityCeiling: 5 },
        },
      }),
    ).toThrow('questionnaire.who.0.rarityCeiling: A Rarity Ceiling below the default Rarity Floor');
  });

  it('refuses an Edition without the questionnaire Feature Switch', () => {
    expect(() => loadEdition({ ...validConfig, ...withoutQuestionnaireSwitch() })).toThrow(
      'featureSwitches.questionnaire',
    );
  });

  it('refuses an Edition without the levels Feature Switch', () => {
    const { levels, ...switches } = validConfig.featureSwitches;
    expect(levels).toBe(true);
    expect(() => loadEdition({ ...validConfig, featureSwitches: switches })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('reports the Badges the Edition chooses, their names and conditions, in order (ADR 0066)', () => {
    expect(loadEdition(validConfig).badges).toEqual([
      { id: 'week', name: 'Week', condition: { kind: 'streak', days: 7 } },
      {
        id: 'sharp-stress',
        name: 'Sharp stress',
        condition: { kind: 'rightAnswers', modes: ['stress'], count: 100 },
      },
    ]);
  });

  it('refuses an Edition without Badges, with a Badge id twice, an unknown condition or a threshold of 0', () => {
    const { badges, ...withoutBadges } = validConfig;
    const [week, sharpStress] = badges;
    expect(() => loadEdition(withoutBadges)).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({ ...validConfig, badges: [week, { ...sharpStress, id: 'week' }] }),
    ).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({
        ...validConfig,
        badges: [{ ...week, condition: { kind: 'shares', count: 3 } }],
      }),
    ).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({
        ...validConfig,
        badges: [{ ...week, condition: { kind: 'streak', days: 0 } }],
      }),
    ).toThrow(InvalidEditionConfigError);
  });

  it('reports what the Account is called, which the Edition names', () => {
    expect(loadEdition(validConfig).accountName).toBe('Test ID');
  });

  it('refuses an Edition without an Account name or with an empty one', () => {
    const { accountName: _removed, ...withoutName } = validConfig;
    expect(() => loadEdition(withoutName)).toThrow(InvalidEditionConfigError);
    expect(() => loadEdition({ ...validConfig, accountName: '' })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('refuses an Edition without the profile Feature Switch', () => {
    const { profile, ...switches } = validConfig.featureSwitches;
    expect(profile).toBe(true);
    expect(() => loadEdition({ ...validConfig, featureSwitches: switches })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('refuses an Edition without the badges Feature Switch', () => {
    const { badges, ...switches } = validConfig.featureSwitches;
    expect(badges).toBe(true);
    expect(() => loadEdition({ ...validConfig, featureSwitches: switches })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('reports the Mascot line of each moment', () => {
    expect(loadEdition(validConfig).mascot).toEqual(validConfig.mascot);
  });

  it('refuses an Edition without Mascot lines, a moment left out or an empty line', () => {
    const { mascot, ...withoutMascot } = validConfig;
    const { empty, ...withoutEmpty } = mascot;
    expect(empty).toBe('Nothing yet');
    expect(() => loadEdition(withoutMascot)).toThrow(InvalidEditionConfigError);
    expect(() => loadEdition({ ...validConfig, mascot: withoutEmpty })).toThrow(
      InvalidEditionConfigError,
    );
    expect(() => loadEdition({ ...validConfig, mascot: { ...mascot, gameRight: '' } })).toThrow(
      InvalidEditionConfigError,
    );
  });

  it('refuses an Edition without the mascot Feature Switch', () => {
    const { mascot, ...switches } = validConfig.featureSwitches;
    expect(mascot).toBe(true);
    expect(() => loadEdition({ ...validConfig, featureSwitches: switches })).toThrow(
      InvalidEditionConfigError,
    );
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

  it('reports a Daily Goal default of 30', () => {
    const edition = loadEdition({
      ...validConfig,
      userSettingDefaults: { ...validConfig.userSettingDefaults, dailyGoal: 30 },
    });

    expect(edition.userSettingDefaults.dailyGoal).toBe(30);
  });

  it('refuses hand-written legal page addresses in the config', () => {
    const legalPages = {
      privacy: 'https://example.org/privacy',
      terms: 'https://example.org/terms',
    };

    expect(() => loadEdition({ ...validConfig, legalPages })).toThrow('legalPages');
  });

  it.each(['linkDomain', 'legalDomain'])(
    'refuses a %s of its own: every Edition lives under the one domain of the app (ADR 0065)',
    (field) => {
      expect(() => loadEdition({ ...validConfig, [field]: 'slovo.example' })).toThrow(field);
    },
  );

  it('accepts an Edition that lists no origin languages', () => {
    expect(() => loadEdition({ ...validConfig, originLanguages: [] })).not.toThrow();
  });

  it('lists the Illustrations the app bundles as Edition assets', () => {
    expect(loadEdition(validConfig, ['a.png', 'b.png']).illustrations).toEqual(
      new Set(['a.png', 'b.png']),
    );
  });

  it('lists no Illustrations when the app bundles none', () => {
    expect(loadEdition(validConfig).illustrations).toEqual(new Set());
  });

  it('reports the letters Search reads as another', () => {
    expect(loadEdition(validConfig).searchLetters).toEqual({ b: 'a' });
  });

  it('accepts an Edition whose Search reads every letter as itself', () => {
    expect(loadEdition({ ...validConfig, searchLetters: {} }).searchLetters).toEqual({});
  });

  it('reports the moods in their order', () => {
    expect(loadEdition(validConfig).moods.map(({ id }) => id)).toEqual(['joyful', 'calm']);
  });

  it('accepts an Edition that lists no moods', () => {
    expect(() => loadEdition({ ...validConfig, moods: [] })).not.toThrow();
  });

  it('accepts an Edition whose Categories require no history', () => {
    expect(() => loadEdition({ ...validConfig, categoriesRequiringHistory: [] })).not.toThrow();
  });

  it('requires the font file of the Word of the Day', () => {
    const { wordOfTheDayFont: _removed, ...config } = validConfig;

    expect(() => loadEdition(config)).toThrow('wordOfTheDayFont');
    expect(() => loadEdition({ ...validConfig, wordOfTheDayFont: 'Script.otf' })).not.toThrow();
  });

  it.each(['script.woff', 'fonts/Script.ttf', '', '.ttf'])(
    'refuses %j as the font file of the Word of the Day',
    (wordOfTheDayFont) => {
      expect(() => loadEdition({ ...validConfig, wordOfTheDayFont })).toThrow('wordOfTheDayFont');
    },
  );

  it('requires the widget palette', () => {
    const { widgetPalette: _removed, ...config } = validConfig;

    expect(() => loadEdition(config)).toThrow('widgetPalette');
  });

  it.each(['parchment', 'blue'] as const)('requires the %s background of the widget', (name) => {
    const { [name]: _removed, ...widgetPalette } = validConfig.widgetPalette;

    expect(() => loadEdition({ ...validConfig, widgetPalette })).toThrow(`widgetPalette.${name}`);
  });

  it.each([
    ['parchment', '#F3E9D2', '#A08C70'],
    ['blue', '#1F3A5F', '#4F6A8F'],
  ] as const)(
    'refuses %s text below 4.5:1 contrast with its background (%s on %s)',
    (name, background, text) => {
      expect(() =>
        loadEdition({
          ...validConfig,
          widgetPalette: { ...validConfig.widgetPalette, [name]: { background, text } },
        }),
      ).toThrow(`widgetPalette.${name}.text`);
    },
  );

  it('accepts text at 4.5:1 contrast with its background', () => {
    // #767676 on white is 4.54:1, the lightest grey that passes WCAG AA.
    const parchment = { background: '#FFFFFF', text: '#767676' };

    expect(() =>
      loadEdition({ ...validConfig, widgetPalette: { ...validConfig.widgetPalette, parchment } }),
    ).not.toThrow();
  });

  it.each(['F3E9D2', '#F3E9D', 'rgba(0, 0, 0, 1)'])(
    'refuses %j as a colour of the widget palette',
    (background) => {
      expect(() =>
        loadEdition({
          ...validConfig,
          widgetPalette: { ...validConfig.widgetPalette, blue: { background, text: '#FFFFFF' } },
        }),
      ).toThrow('widgetPalette.blue.background');
    },
  );

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
    [
      'a missing Sign in with Apple Feature Switch',
      withoutSwitch('signInWithApple'),
      'featureSwitches.signInWithApple',
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
      'a missing Seasonal Decor Feature Switch',
      withoutSwitch('seasonalDecor'),
      'featureSwitches.seasonalDecor',
    ],
    [
      'a missing falling Stress Feature Switch',
      withoutSwitch('stressAnimation'),
      'featureSwitches.stressAnimation',
    ],
    [
      'a missing Illustrations Feature Switch',
      withoutSwitch('illustrations'),
      'featureSwitches.illustrations',
    ],
    [
      'a missing Mistake Reports Feature Switch',
      withoutSwitch('mistakeReports'),
      'featureSwitches.mistakeReports',
    ],
    [
      'a missing Community Counters Feature Switch',
      withoutSwitch('communityCounters'),
      'featureSwitches.communityCounters',
    ],
    [
      'a missing Community Word Feature Switch',
      withoutSwitch('communityWord'),
      'featureSwitches.communityWord',
    ],
    [
      'a missing calligraphic Lemma Feature Switch',
      withoutSwitch('calligraphy'),
      'featureSwitches.calligraphy',
    ],
    ['a missing Spotlight Feature Switch', withoutSwitch('spotlight'), 'featureSwitches.spotlight'],
    [
      'a missing App Intents Feature Switch',
      withoutSwitch('appIntents'),
      'featureSwitches.appIntents',
    ],
    [
      'a missing Collection Links Feature Switch',
      withoutSwitch('collectionLinks'),
      'featureSwitches.collectionLinks',
    ],
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
      'a missing Daily Goal default',
      { userSettingDefaults: { ...userSettingDefaults, dailyGoal: undefined } },
      'userSettingDefaults.dailyGoal',
    ],
    [
      'a Daily Goal default the Core does not offer',
      { userSettingDefaults: { ...userSettingDefaults, dailyGoal: 15 } },
      'userSettingDefaults.dailyGoal',
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
            rarityFloor: 1,
            rarityCeiling: 5,
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
            rarityFloor: 1,
            rarityCeiling: 5,
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
            rarityFloor: 1,
            rarityCeiling: 5,
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
            rarityFloor: 1,
            rarityCeiling: 5,
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
            rarityFloor: 1,
            rarityCeiling: 5,
          },
        },
      },
      'userSettingDefaults.mix.correctionCategories',
    ],
    [
      'a default Rarity Floor above the default Rarity Ceiling',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: { ...userSettingDefaults.mix, rarityFloor: 4, rarityCeiling: 3 },
        },
      },
      'userSettingDefaults.mix.rarityCeiling',
    ],
    [
      'a default Mix without a Rarity Ceiling',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: { ...userSettingDefaults.mix, rarityCeiling: undefined },
        },
      },
      'userSettingDefaults.mix.rarityCeiling',
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
    ['no Search letters', { searchLetters: undefined }, 'searchLetters'],
    ['a Search letter of two letters', { searchLetters: { ab: 'a' } }, 'searchLetters.ab'],
    ['an upper-case Search letter', { searchLetters: { B: 'a' } }, 'searchLetters.B'],
    ['a Search letter read as two letters', { searchLetters: { b: 'ac' } }, 'searchLetters.b'],
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
