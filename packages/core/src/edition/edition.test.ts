import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  DEPENDS_ON,
  FeatureSwitchesSchema,
  featureSwitchStates,
  type FeatureSwitch,
} from '@slovo/contracts';

import { inEffectWithoutRules, loadShippedEdition, type Edition } from '../index';
import { loadEdition } from '../testing';
import { InvalidEditionConfigError, type ShippedEdition } from './edition';

const validConfig = {
  id: 'test',
  locale: 'xx-XX',
  dailyGoals: { options: [10, 25, 50], highlighted: 10 },
  onboardingNotificationTimes: { morning: '09:00', midday: '13:00', evening: '20:30' },
  displayName: 'SLOVO Test',
  accountName: 'Test ID',
  languageTraits: {
    stress: { marked: true, vowels: 'a' },
    alphabet: 'a b c',
    sortLocale: 'xx',
  },
  featureSwitches: featureSwitchStates(),

  userSettingDefaults: {
    theme: 'system',
    textSize: 'system',
    vibration: true,
    notificationTimes: ['09:00'],
    mix: {
      categories: 'all',
      correctionCategories: 'all',
      kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
    },
    rarityCeiling: 5,
  },
  wordOfTheDayFont: 'Script-Regular.ttf',
  widgetPalette: {
    parchment: { background: '#F3E9D2', text: '#3B2A1A' },
    blue: { background: '#1F3A5F', text: '#F3EEE2' },
  },
  categories: [
    { id: 'nature', displayName: 'Nature', description: 'Nature.', tone: 'loud' },
    { id: 'speech', displayName: 'Speech', description: 'Speech.', tone: 'loud' },
  ],
  correctionCategories: [
    { id: 'work', displayName: 'At work', description: 'At work.', tone: 'loud' },
    { id: 'shop', displayName: 'In the shop', description: 'In the shop.', tone: 'loud' },
  ],
  categoriesRequiringHistory: ['speech'],
  originLanguages: [
    { code: 'la', name: 'Latin' },
    { code: 'other', name: 'Other' },
  ],
  moods: [
    {
      id: 'joyful',
      name: 'Joyful',
      emoji: '😊',
      reply: 'Catch a bright word!',
      effect: 'Another Feed.',
    },
    { id: 'calm', name: 'Calm', emoji: '😌', reply: 'No hurry.', effect: 'Another Feed.' },
    { id: 'sad', name: 'Sad', emoji: '😢', reply: 'A word warms.', effect: 'Another Feed.' },
    {
      id: 'energetic',
      name: 'Energetic',
      emoji: '⚡',
      reply: 'Keep the pace!',
      effect: 'Another Feed.',
    },
    {
      id: 'thoughtful',
      name: 'Thoughtful',
      emoji: '🤔',
      reply: 'Food for thought.',
      effect: 'Another Feed.',
    },
  ],
  dashboardMoods: ['energetic', 'thoughtful', 'calm', 'joyful', 'sad'],
  narratorVoices: {
    default: 'anna',
    voices: [
      { id: 'boris', name: 'Boris', description: 'Male · low' },
      { id: 'anna', name: 'Anna', description: 'Female · calm' },
    ],
    sample: {
      word: 'w_000001',
      syllables: ['ab', 'ra', 'ka'],
      stressed: 1,
      caption: 'ab-rá-ka · n.',
    },
  },
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
    seenWord: 1,
  },
  levels: { first: 50, growth: 0.1, growingUntil: 10, later: 120, names: ['Seed', 'Sprout'] },
  questionnaire: {
    level: [
      { id: 'starting', label: 'Starting', rarityCeiling: 2 },
      { id: 'good', label: 'Good', rarityCeiling: 4 },
    ],
    why: [{ id: 'play', label: 'Play', kindWeights: { idiom: 'more', synonymRow: 'more' } }],
    selfRating: [{ id: 'few', label: 'Few', offerRarityTest: false }],
  },
  badgeFamilies: [
    { id: 'run', name: 'Run', description: 'Days in a row', shape: 'hexagon', tone: 'red' },
    { id: 'skill', name: 'Skill', description: 'Clean play', shape: 'diamond', tone: 'ink' },
  ],
  badges: [
    {
      id: 'week',
      name: 'Week',
      symbol: '1',
      family: 'run',
      conditionText: '7 days in a row',
      condition: { kind: 'streak', days: 7 },
    },
    {
      id: 'sharp-stress',
      name: 'Sharp stress',
      symbol: '1',
      family: 'skill',
      conditionText: '100 right stresses',
      condition: { kind: 'rightAnswers', modes: ['stress'], count: 100 },
    },
  ],
  mascot: {
    onboarding: 'Hello',
    newLevel: 'New Level',
    dailyGoal: 'Goal met',
    streakMilestone: 'Streak grows',
    gameRight: 'Right',
    gameWrong: 'Almost',
    empty: 'Nothing yet',
  },
};

describe('loadEdition', () => {
  it('reports the Edition id, locale and whether it marks Stress', () => {
    const edition = loadEdition(validConfig);

    expect(edition.id).toBe('test');
    expect(edition.locale).toBe('xx-XX');
    expect(edition.languageTraits.stress.marked).toBe(true);
  });

  it('reports the display name, the watermark of its Share Cards', () => {
    expect(loadEdition(validConfig).displayName).toBe('SLOVO Test');
  });

  it('reports an Edition that does not mark Stress', () => {
    const edition = loadEdition({
      ...validConfig,
      languageTraits: { ...validConfig.languageTraits, stress: { marked: false } },
    });

    expect(edition.languageTraits.stress).toEqual({ marked: false });
  });

  it('reports the Game as disabled when its Feature Switch is off', () => {
    const edition = loadEdition({
      ...validConfig,
      featureSwitches: { ...validConfig.featureSwitches, game: 'off' },
    });

    expect(edition.isFeatureEnabled('game')).toBe(false);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
  });

  it.each(['system', 'larger', 'largest'] as const)(
    'reports the three-step default text size %s',
    (textSize) => {
      const edition = loadEdition({
        ...validConfig,
        userSettingDefaults: { ...validConfig.userSettingDefaults, textSize },
      });

      expect(edition.userSettingDefaults.textSize).toBe(textSize);
    },
  );

  it('refuses a default text size off the three steps, an S…XL one included', () => {
    for (const textSize of ['M', 'huge', undefined]) {
      expect(() =>
        loadEdition({
          ...validConfig,
          userSettingDefaults: { ...validConfig.userSettingDefaults, textSize },
        }),
      ).toThrow(InvalidEditionConfigError);
    }
  });

  it('reports the language traits', () => {
    const { languageTraits } = loadEdition(validConfig);

    expect(languageTraits.alphabet).toEqual(['a', 'b', 'c']);
    expect(languageTraits.sortLocale).toBe('xx');
    expect(languageTraits.stress).toEqual({ marked: true, vowels: ['a'] });
  });

  it('reports the user-setting defaults, with a Mix of all left to the Language Pack', () => {
    const edition = loadEdition(validConfig);

    expect(edition.userSettingDefaults).toEqual({
      theme: 'system',
      textSize: 'system',
      vibration: true,
      narratorVoice: 'anna',
      notificationTimes: ['09:00'],
      rarityCeiling: 5,
      mix: {
        categoryIds: 'all',
        correctionCategoryIds: 'all',
        kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
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
          kinds: { correction: false, idiom: true, synonymRow: true, tip: true },
        },
      },
    });

    expect(edition.userSettingDefaults.mix).toEqual({
      categoryIds: ['speech'],
      correctionCategoryIds: ['work'],
      kinds: { correction: false, idiom: true, synonymRow: true, tip: true },
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
      seenWord: 1,
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

  it('reports the questionnaire: the options of the level question and «Навіщо» and what each sets', () => {
    expect(loadEdition(validConfig).questionnaire).toEqual(validConfig.questionnaire);
  });

  it('refuses an Edition without a questionnaire, with no option, a repeated option id, an unknown Mix kind or a Ceiling below the default Floor', () => {
    const { questionnaire, ...withoutQuestionnaire } = validConfig;
    const [starting, good] = questionnaire.level;
    expect(() => loadEdition(withoutQuestionnaire)).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({ ...validConfig, questionnaire: { ...questionnaire, why: [] } }),
    ).toThrow(InvalidEditionConfigError);
    expect(() =>
      loadEdition({
        ...validConfig,
        questionnaire: { ...questionnaire, level: [starting, { ...good, id: 'starting' }] },
      }),
    ).toThrow('questionnaire.level.1.id: Duplicate option id "starting"');
    expect(() =>
      loadEdition({
        ...validConfig,
        questionnaire: {
          ...questionnaire,
          why: [{ id: 'play', label: 'Play', kindWeights: { word: 'more' } }],
        },
      }),
    ).toThrow(InvalidEditionConfigError);
  });

  it('reports the Badges the Edition chooses, their names and conditions, in order (ADR 0066)', () => {
    expect(loadEdition(validConfig).badges).toEqual(validConfig.badges);
  });

  it('reports the Badge families in their order, each with its name, description, shape and tone', () => {
    expect(loadEdition(validConfig).badgeFamilies).toEqual(validConfig.badgeFamilies);
  });

  it('reads a flawless Game and a run of right answers as Badge conditions', () => {
    const [week, sharpStress] = validConfig.badges;
    const badges = [
      { ...week, condition: { kind: 'flawlessGame', modes: ['correction', 'anglicism'] } },
      { ...sharpStress, condition: { kind: 'rightRun', modes: ['stress'], count: 10 } },
    ];

    expect(loadEdition({ ...validConfig, badges }).badges).toEqual(badges);
  });

  it('refuses a flawless Game or a run with no mode, and a run of 0', () => {
    const [week] = validConfig.badges;
    for (const condition of [
      { kind: 'flawlessGame', modes: [] },
      { kind: 'rightRun', modes: [], count: 10 },
      { kind: 'rightRun', modes: ['stress'], count: 0 },
    ])
      expect(() => loadEdition({ ...validConfig, badges: [{ ...week, condition }] })).toThrow(
        InvalidEditionConfigError,
      );
  });

  it('refuses a Badge without a family or of a family the Edition does not declare', () => {
    const [week] = validConfig.badges;
    if (week === undefined) throw new Error('the fixture declares no Badge');
    const { family: _removed, ...withoutFamily } = week;
    expect(() => loadEdition({ ...validConfig, badges: [withoutFamily] })).toThrow(
      InvalidEditionConfigError,
    );
    const load = () => loadEdition({ ...validConfig, badges: [{ ...week, family: 'crossword' }] });
    expect(load).toThrow(InvalidEditionConfigError);
    expect(load).toThrow('\nbadges.0.family: ');
  });

  it('reads the checker shape of a Badge family and a Badge stamp kicker', () => {
    const [run, skill] = validConfig.badgeFamilies;
    const [week, sharpStress] = validConfig.badges;
    const badgeFamilies = [run, { ...skill, shape: 'checker' }];
    const badges = [{ ...week, stampKicker: '7 IN A ROW' }, sharpStress];
    const edition = loadEdition({ ...validConfig, badgeFamilies, badges });

    expect(edition.badgeFamilies).toEqual(badgeFamilies);
    expect(edition.badges).toEqual(badges);
  });

  it('refuses an empty Badge stamp kicker', () => {
    const [week, sharpStress] = validConfig.badges;
    const load = () =>
      loadEdition({ ...validConfig, badges: [{ ...week, stampKicker: '' }, sharpStress] });

    expect(load).toThrow('\nbadges.0.stampKicker: ');
  });

  it('refuses Badge families left out, a family id twice, an unknown shape or tone', () => {
    const { badgeFamilies, ...withoutFamilies } = validConfig;
    const [run, skill] = badgeFamilies;
    expect(() => loadEdition(withoutFamilies)).toThrow(InvalidEditionConfigError);
    for (const families of [
      [run, { ...skill, id: 'run' }],
      [run, { ...skill, shape: 'star' }],
      [run, { ...skill, tone: 'blue' }],
      [run, { ...skill, description: '' }],
    ])
      expect(() => loadEdition({ ...validConfig, badgeFamilies: families })).toThrow(
        InvalidEditionConfigError,
      );
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

  it('reports the Daily Goals in Words and refuses a highlighted one not among them', () => {
    const dailyGoals = { options: [5, 15], highlighted: 15 };
    expect(loadEdition({ ...validConfig, dailyGoals }).dailyGoals).toEqual(dailyGoals);
    expect(() =>
      loadEdition({ ...validConfig, dailyGoals: { ...dailyGoals, highlighted: 10 } }),
    ).toThrow();
  });

  it('reports the Notification times «Коли нагадати?» offers, one for each bucket', () => {
    const onboardingNotificationTimes = { morning: '08:15', midday: '12:00', evening: '21:00' };
    expect(
      loadEdition({ ...validConfig, onboardingNotificationTimes }).onboardingNotificationTimes,
    ).toEqual(onboardingNotificationTimes);
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
    expect(loadEdition({ ...validConfig, originLanguages: [] }).originLanguages).toEqual([]);
  });

  it('reports the letters Search reads as another', () => {
    expect(loadEdition(validConfig).searchLetters).toEqual({ b: 'a' });
  });

  it('accepts an Edition whose Search reads every letter as itself', () => {
    expect(loadEdition({ ...validConfig, searchLetters: {} }).searchLetters).toEqual({});
  });

  it('reports the moods in their order', () => {
    expect(loadEdition(validConfig).moods.map(({ id }) => id)).toEqual([
      'joyful',
      'calm',
      'sad',
      'energetic',
      'thoughtful',
    ]);
  });

  it('declares its Narrator Voices in their order', () => {
    expect(loadEdition(validConfig).narratorVoices).toEqual([
      { id: 'boris', name: 'Boris', description: 'Male · low' },
      { id: 'anna', name: 'Anna', description: 'Female · calm' },
    ]);
  });

  it('reads the default Narrator Voice without a choice', () => {
    expect(loadEdition(validConfig).narratorVoiceOf(undefined)).toEqual({
      id: 'anna',
      name: 'Anna',
      description: 'Female · calm',
    });
  });

  it('reads the chosen Narrator Voice', () => {
    expect(loadEdition(validConfig).narratorVoiceOf('boris').name).toBe('Boris');
  });

  it('gives the sample Word its voice screen reads in every Narrator Voice', () => {
    expect(loadEdition(validConfig).narratorVoiceSample).toEqual({
      word: 'w_000001',
      syllables: ['ab', 'ra', 'ka'],
      stressed: 1,
      caption: 'ab-rá-ka · n.',
    });
  });

  it('reads a Narrator Voice it no longer declares as the default', () => {
    expect(loadEdition(validConfig).narratorVoiceOf('olga').id).toBe('anna');
  });

  it('resolves the five Dashboard moods, in their order', () => {
    const { moods, dashboardMoods } = loadEdition(validConfig);
    expect(dashboardMoods).toEqual([moods[3], moods[4], moods[1], moods[0], moods[2]]);
  });

  it('resolves three Dashboard moods, the Edition keeping the rest among its moods', () => {
    const { moods, dashboardMoods } = loadEdition({
      ...validConfig,
      dashboardMoods: ['energetic', 'thoughtful', 'calm'],
    });
    expect(dashboardMoods.map(({ id }) => id)).toEqual(['energetic', 'thoughtful', 'calm']);
    expect(moods.map(({ id }) => id)).toEqual(expect.arrayContaining(['joyful', 'sad']));
  });

  it('accepts an Edition whose Categories require no history', () => {
    // Code outside the Core reads this field from the Edition config; the loaded Edition does not carry it.
    expect(loadEdition({ ...validConfig, categoriesRequiringHistory: [] }).id).toBe(validConfig.id);
  });

  it('requires the font file of the Word of the Day', () => {
    const { wordOfTheDayFont: _removed, ...config } = validConfig;

    expect(() => loadEdition(config)).toThrow('wordOfTheDayFont');
    // Code outside the Core reads this field from the Edition config; the loaded Edition does not carry it.
    expect(loadEdition({ ...validConfig, wordOfTheDayFont: 'Script.otf' }).id).toBe(validConfig.id);
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

    // Code outside the Core reads the palette from the Edition config; the loaded Edition does not carry it.
    expect(
      loadEdition({ ...validConfig, widgetPalette: { ...validConfig.widgetPalette, parchment } })
        .id,
    ).toBe(validConfig.id);
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

  it.each([
    [
      'an unknown Feature Switch',
      { featureSwitches: { ...validConfig.featureSwitches, share: 'on' } },
      'featureSwitches',
    ],
    [
      'a Distractor rule',
      { languageTraits: { ...languageTraits, distractorRule: 'same-part-of-speech' } },
      'languageTraits',
    ],
    [
      'a repeated letter in the alphabet',
      { languageTraits: { ...languageTraits, alphabet: 'a b a' } },
      'languageTraits.alphabet',
    ],
    [
      'a Stress-marking Edition without vowels',
      { languageTraits: { ...languageTraits, stress: { marked: true } } },
      'languageTraits.stress.vowels',
    ],
    [
      'a vowel that is not a letter of the alphabet',
      { languageTraits: { ...languageTraits, stress: { marked: true, vowels: 'a e' } } },
      'languageTraits.stress.vowels.1',
    ],
    [
      'an unknown Theme',
      { userSettingDefaults: { ...userSettingDefaults, theme: 'sepia' } },
      'userSettingDefaults.theme',
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
      'Daily Goals out of rising order',
      { dailyGoals: { options: [25, 10], highlighted: 10 } },
      'dailyGoals.options',
    ],
    [
      'onboarding Notification times out of time order',
      { onboardingNotificationTimes: { morning: '13:00', midday: '09:00', evening: '20:30' } },
      'onboardingNotificationTimes',
    ],
    [
      'an onboarding Notification time for a fourth bucket',
      {
        onboardingNotificationTimes: {
          morning: '09:00',
          midday: '13:00',
          evening: '20:30',
          night: '23:00',
        },
      },
      'onboardingNotificationTimes',
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
            kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
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
            kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
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
            kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
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
            kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
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
            kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
          },
        },
      },
      'userSettingDefaults.mix.correctionCategories',
    ],
    [
      'a default Rarity Range that is not a rarity',
      { userSettingDefaults: { ...userSettingDefaults, rarityCeiling: 6 } },
      'userSettingDefaults.rarityCeiling',
    ],
    [
      'no default Rarity Range',
      { userSettingDefaults: { ...userSettingDefaults, rarityCeiling: undefined } },
      'userSettingDefaults.rarityCeiling',
    ],
    [
      'a default Mix that still sets a Rarity Range',
      {
        userSettingDefaults: {
          ...userSettingDefaults,
          mix: { ...userSettingDefaults.mix, rarityCeiling: 3 },
        },
      },
      'userSettingDefaults.mix',
    ],
    [
      'a repeated Category id',
      {
        categories: [
          { id: 'nature', displayName: 'Nature', description: 'Nature.', tone: 'loud' },
          { id: 'nature', displayName: 'Weather', description: 'Weather.', tone: 'loud' },
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
          { id: 'work', displayName: 'At work', description: 'At work.', tone: 'loud' },
          { id: 'work', displayName: 'At the office', description: 'At the office.', tone: 'loud' },
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
          { id: 'joyful', name: 'Joyful', emoji: '😊', reply: 'Catch a bright word!' },
          { id: 'joyful', name: 'Glad', emoji: '😀', reply: 'Glad words.' },
        ],
        dashboardMoods: [],
      },
      'moods.1.id',
    ],
    [
      'a mood without a name',
      { moods: [{ id: 'calm', name: '', emoji: '😌', reply: 'No hurry.' }], dashboardMoods: [] },
      'moods.0.name',
    ],
    [
      'a mood without an emoji',
      { moods: [{ id: 'calm', name: 'Calm', emoji: '', reply: 'No hurry.' }], dashboardMoods: [] },
      'moods.0.emoji',
    ],
    [
      'a mood without a reply',
      { moods: [{ id: 'calm', name: 'Calm', emoji: '😌', reply: '' }], dashboardMoods: [] },
      'moods.0.reply',
    ],
    [
      'a mood id not in kebab case',
      {
        moods: [{ id: 'In Love', name: 'In love', emoji: '😍', reply: 'Tender words.' }],
        dashboardMoods: [],
      },
      'moods.0.id',
    ],
    ['no `dashboardMoods`', { dashboardMoods: undefined }, 'dashboardMoods'],
    ['no Dashboard moods', { moods: [], dashboardMoods: [] }, 'dashboardMoods'],
    ['two Dashboard moods', { dashboardMoods: ['joyful', 'calm'] }, 'dashboardMoods'],
    [
      'a Dashboard mood without its effect on the Feed',
      {
        moods: [
          { id: 'joyful', name: 'Joyful', emoji: '😊', reply: 'Catch a bright word!' },
          ...['calm', 'sad'].map((id) => ({
            id,
            name: id,
            emoji: '😌',
            reply: 'No hurry.',
            effect: 'Another Feed.',
          })),
        ],
        dashboardMoods: ['calm', 'joyful', 'sad'],
      },
      'dashboardMoods.1',
    ],
    [
      'six Dashboard moods',
      { dashboardMoods: ['joyful', 'calm', 'sad', 'energetic', 'thoughtful', 'sleepy'] },
      'dashboardMoods',
    ],
    [
      'a Dashboard mood the Edition does not list',
      { dashboardMoods: ['joyful', 'calm', 'sad', 'energetic', 'angry'] },
      'dashboardMoods.4',
    ],
    [
      'a repeated Dashboard mood',
      { dashboardMoods: ['joyful', 'calm', 'sad', 'energetic', 'calm'] },
      'dashboardMoods.4',
    ],
    ['no Narrator Voices', { narratorVoices: undefined }, 'narratorVoices'],
    [
      'no Narrator Voice at all',
      { narratorVoices: { default: 'anna', voices: [] } },
      'narratorVoices.voices',
    ],
    [
      'a repeated Narrator Voice id',
      {
        narratorVoices: {
          ...validConfig.narratorVoices,
          default: 'anna',
          voices: [
            { id: 'anna', name: 'Anna', description: 'Female · calm' },
            { id: 'anna', name: 'Ann', description: 'Female · lively' },
          ],
        },
      },
      'narratorVoices.voices.1.id',
    ],
    [
      'a default Narrator Voice it does not declare',
      {
        narratorVoices: {
          ...validConfig.narratorVoices,
          default: 'olga',
          voices: [{ id: 'anna', name: 'Anna', description: 'Female · calm' }],
        },
      },
      'narratorVoices.default',
    ],
    [
      'a sample stressed past its syllables',
      {
        narratorVoices: {
          ...validConfig.narratorVoices,
          sample: { word: 'w_000001', syllables: ['ab', 'ra'], stressed: 2, caption: 'ab-ra' },
        },
      },
      'narratorVoices.sample.stressed',
    ],
    [
      'a sample without syllables',
      {
        narratorVoices: {
          ...validConfig.narratorVoices,
          sample: { word: 'w_000001', syllables: [], stressed: 0, caption: 'ab' },
        },
      },
      'narratorVoices.sample.syllables',
    ],
    [
      'a Narrator Voice without a name',
      {
        narratorVoices: {
          default: 'anna',
          voices: [{ id: 'anna', name: '', description: 'Female · calm' }],
        },
      },
      'narratorVoices.voices.0.name',
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
});

/** Every Feature Switch of the catalogue (ADR 0199). */
const FEATURES = FeatureSwitchesSchema.keyof().options;

/** Whether a feature stands on another, directly or through a switch between them. */
const standsOn = (feature: FeatureSwitch, needed: FeatureSwitch): boolean =>
  (DEPENDS_ON[feature] ?? []).some(
    (dependency) => dependency === needed || standsOn(dependency, needed),
  );

describe('every Feature Switch of the catalogue', () => {
  it('is in effect while on, and not while off or unavailable', () => {
    const on = loadEdition(validConfig);
    for (const feature of FEATURES) {
      expect(on.isFeatureEnabled(feature)).toBe(true);
      for (const state of ['off', 'unavailable'] as const) {
        const edition = loadEdition({
          ...validConfig,
          featureSwitches: featureSwitchStates({ [feature]: state }),
        });
        expect(edition.isFeatureEnabled(feature)).toBe(false);
      }
    }
  });

  it('is refused when the Edition leaves it out, naming the field', () => {
    for (const feature of FEATURES) {
      const featureSwitches = Object.fromEntries(
        Object.entries(validConfig.featureSwitches).filter(([name]) => name !== feature),
      );
      const load = () => loadEdition({ ...validConfig, featureSwitches });

      expect(load).toThrow(InvalidEditionConfigError);
      expect(load).toThrow(`\nfeatureSwitches.${feature}: `);
    }
  });

  it('turns off with any switch it stands on, and stays on while any other is off', () => {
    for (const off of FEATURES) {
      const edition = loadEdition({
        ...validConfig,
        featureSwitches: featureSwitchStates({ [off]: 'off' }),
      });
      for (const feature of FEATURES) {
        expect(edition.isFeatureEnabled(feature), `${feature} while ${off} is off`).toBe(
          feature !== off && !standsOn(feature, off),
        );
      }
    }
  });
});

describe('the Feature Switches a feature depends on', () => {
  it('keep a feature on while only a feature that depends on it is off', () => {
    const edition = loadEdition({
      ...validConfig,
      featureSwitches: { ...validConfig.featureSwitches, badges: 'off', quickQuestion: 'off' },
    });

    expect(edition.isFeatureEnabled('xpLog')).toBe(true);
    expect(edition.isFeatureEnabled('game')).toBe(true);
    expect(edition.isFeatureEnabled('streakBreak')).toBe(true);
  });
});

describe('loadShippedEdition', () => {
  const shipped = loadShippedEdition({
    ...validConfig,
    featureSwitches: { ...validConfig.featureSwitches, game: 'off' },
  });

  it('answers as the build shipped it, under a name of its own', () => {
    expect(shipped.isShippedOn('game')).toBe(false);
    expect(shipped.isShippedOn('corrections')).toBe(true);
    expect(shipped.featureSwitches.game).toBe('off');
    expect(shipped).not.toHaveProperty('isFeatureEnabled');
  });

  it('is no Edition in effect to the compiler, nor the Edition in effect a shipped one', () => {
    expectTypeOf(shipped).not.toExtend<Pick<Edition, 'isFeatureEnabled'>>();
    expectTypeOf<Edition>().not.toExtend<Pick<ShippedEdition, 'isShippedOn' | 'featureSwitches'>>();
    expectTypeOf(inEffectWithoutRules(shipped)).toEqualTypeOf<Edition>();
  });

  it('is in effect as shipped where no remote Rule is read', () => {
    const edition = inEffectWithoutRules(shipped);

    expect(edition.isFeatureEnabled('game')).toBe(false);
    expect(edition.isFeatureEnabled('corrections')).toBe(true);
    expect(edition).not.toHaveProperty('isShippedOn');
    expect(edition).not.toHaveProperty('featureSwitches');
  });
});
