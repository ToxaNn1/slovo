import {
  FeatureSwitchesSchema,
  type Correction,
  type FeatureSwitches,
  type Idiom,
  type LanguageTraits,
  type SynonymRow,
  type Tip,
  type Word,
} from '@slovo/contracts';

import {
  loadEdition,
  switchedOn,
  type DefaultMix,
  type Edition,
  type UserSettingDefaults,
} from './edition/edition';
import type { PlayedRound, Round, RoundAnswer } from './game/game';
import type { RoundOption } from './game/game-mode';
import type { KnownCounts } from './knowledge/knowledge';
import type { AnalyticsPort, AnalyticsSink } from './analytics/analytics';
import type { ReaderFacts } from './edition/remote-switches';
import { evaluateSwitches } from './edition/switch-evaluator';
import type { Clock, ContentReadPort, PlannedNotification, Random, Schedule } from './ports';
import { openEligibility } from './mix/open-eligibility';
import { createSubject } from './subject';
import type { UserState } from './user-state/user-state';
import { createTextComparison } from './text/text-comparison';

// Helpers the Core's tests share. They are not part of the public `index.ts`;
// `testing.ts` exports `testEdition` to the tests of other packages.

/**
 * The config of the test Edition, in the shape of a real Edition's
 * `edition.json`: every Feature Switch on, one Category `test`, the one the
 * test Words carry, in its default Mix with every kind of Entry, the Daily
 * Limit off, four moods that shift nothing, the UA Edition's apostrophes, and
 * no notification time, origin language or search letter.
 */
const testEditionConfig = {
  id: 'test',
  locale: 'en-US',
  displayName: 'SLOVO Test',
  accountName: 'Test ID',
  languageTraits: {
    stress: { marked: false },
    alphabet: 'a b c d e f g h i j k l m n o p q r s t u v w x y z',
    apostrophes: "ʼ ' ’",
    sortLocale: 'en',
  },
  featureSwitches: Object.fromEntries(
    Object.keys(FeatureSwitchesSchema.shape).map((feature) => [feature, 'on']),
  ),
  userSettingDefaults: {
    theme: 'system',
    fontSize: 'M',
    vibration: true,
    notificationTimes: [],
    rarityCeiling: 5,
    mix: {
      categories: ['test'],
      correctionCategories: 'all',
      kinds: { correction: true, idiom: true, synonymRow: true, tip: true },
    },
  },
  wordOfTheDayFont: 'Test-Regular.ttf',
  widgetPalette: {
    parchment: { background: '#F3E9D2', text: '#3B2A1A' },
    blue: { background: '#1F3A5F', text: '#F3EEE2' },
  },
  categories: [{ id: 'test', displayName: 'Test', description: 'Test Words.', tone: 'loud' }],
  correctionCategories: [
    { id: 'everyday', displayName: 'Everyday', description: 'Everyday Corrections.', tone: 'loud' },
  ],
  categoriesRequiringHistory: [],
  originLanguages: [],
  moods: [
    { id: 'energetic', name: 'Energetic', emoji: '⚡', reply: 'Keep the pace!' },
    { id: 'thoughtful', name: 'Thoughtful', emoji: '🤔', reply: 'Food for thought.' },
    { id: 'calm', name: 'Calm', emoji: '😌', reply: 'No hurry.' },
    { id: 'joyful', name: 'Joyful', emoji: '😊', reply: 'Catch a bright word!' },
    { id: 'sad', name: 'Sad', emoji: '😢', reply: 'A word warms.' },
  ],
  dashboardMoods: ['energetic', 'thoughtful', 'calm', 'joyful', 'sad'],
  narratorVoices: {
    default: 'anna',
    voices: [{ id: 'anna', name: 'Anna', description: 'Female · calm' }],
    sample: { word: 'w_000001', syllables: ['ab', 'ra', 'ka'], stressed: 1, caption: 'ab-rá-ka' },
  },
  searchLetters: {},
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
  dailyGoals: { options: [10, 25, 50], highlighted: 10 },
  onboardingNotificationTimes: { morning: '09:00', midday: '13:00', evening: '20:30' },
  levels: {
    first: 50,
    growth: 0.1,
    growingUntil: 10,
    later: 120,
    names: ['Seed', 'Sprout', 'Sapling', 'Tree', 'Grove'],
  },
  questionnaire: {
    level: [
      { id: 'starting', label: 'Starting', rarityCeiling: 2 },
      { id: 'good', label: 'Good', rarityCeiling: 4 },
      { id: 'dont-know', label: 'Not sure', rarityTest: true },
    ],
    why: [
      { id: 'write-correctly', label: 'Write correctly', kindWeights: { correction: 'more' } },
      { id: 'play', label: 'Play', kindWeights: { idiom: 'more', synonymRow: 'more' } },
    ],
    selfRating: [
      { id: 'few', label: 'Few', offerRarityTest: false },
      { id: 'many', label: 'Many', offerRarityTest: true },
    ],
  },
  badgeFamilies: [
    { id: 'run', name: 'Run', description: 'Days in a row', shape: 'hexagon', tone: 'red' },
  ],
  badges: [],
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

/** The test Edition as `loadEdition` gives it, which every `testEdition` starts from. */
const baseTestEdition = loadEdition(testEditionConfig);

/**
 * What a test changes of the test Edition: any field of the Edition, and
 * `languageTraits` and `userSettingDefaults`, its `mix` included, field by
 * field over the defaults.
 */
export interface TestEditionOverrides extends Partial<
  Omit<Edition, 'languageTraits' | 'userSettingDefaults'>
> {
  readonly languageTraits?: Partial<LanguageTraits>;
  readonly userSettingDefaults?: Partial<Omit<UserSettingDefaults, 'mix'>> & {
    readonly mix?: Partial<Omit<DefaultMix, 'kinds'>> & {
      readonly kinds?: Partial<DefaultMix['kinds']>;
    };
  };
}

/**
 * The Edition a test runs the Core as: the test Edition with the overrides,
 * most often `isFeatureEnabled` and the default Mix. `isFeatureEnabled` says
 * which switches are on by themselves; the Edition answers what is in effect,
 * a feature off while a switch it depends on is off. Built by `loadEdition`
 * from a config in the shape of a real Edition's, so what the Core reads of
 * an Edition is what a config can say.
 */
export function testEdition({
  languageTraits = {},
  userSettingDefaults = {},
  ...overrides
}: TestEditionOverrides = {}): Edition {
  const { mix: { kinds = {}, ...mix } = {}, ...settings } = userSettingDefaults;
  const { isFeatureEnabled } = overrides;
  return {
    ...baseTestEdition,
    ...overrides,
    ...(isFeatureEnabled === undefined ? {} : { isFeatureEnabled: switchedOn(isFeatureEnabled) }),
    languageTraits: { ...baseTestEdition.languageTraits, ...languageTraits },
    userSettingDefaults: {
      ...baseTestEdition.userSettingDefaults,
      ...settings,
      mix: {
        ...baseTestEdition.userSettingDefaults.mix,
        ...mix,
        kinds: { ...baseTestEdition.userSettingDefaults.mix.kinds, ...kinds },
      },
    },
  };
}

/** The Known counts by kind of Entry: those named, and 0 for every other kind. */
/** How the test Edition compares text. */
export const testComparison = createTextComparison(testEdition());

export const knownCounts = (counts: Partial<KnownCounts> = {}): KnownCounts => ({
  word: 0,
  correction: 0,
  idiom: 0,
  synonymRow: 0,
  tip: 0,
  ...counts,
});

/** The instant a fake clock starts at, unless a test names one: 09:00 in Kyiv. */
const defaultStart = '2026-10-11T09:00:00+03:00';

/**
 * A clock the test moves by hand: `advance` by milliseconds, `set` to an
 * instant, `moveTo` another time zone.
 */
export function fakeClock(start = defaultStart, timeZone = 'Europe/Kyiv') {
  let now = new Date(start).getTime();
  let zone = timeZone;
  const clock: Clock = { now: () => new Date(now), timeZone: () => zone };
  return {
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    set: (instant: string) => {
      now = new Date(instant).getTime();
    },
    moveTo: (timeZoneName: string) => {
      zone = timeZoneName;
    },
  };
}

/**
 * Lets every promise the Core has started settle: with the user state in
 * memory and the fakes, nothing it waits for takes more than a microtask.
 */
export async function settle(): Promise<void> {
  for (let tick = 0; tick < 1_000; tick += 1) await Promise.resolve();
}

/**
 * A test `Schedule` on the fake clock: what is scheduled runs only when the
 * test moves time past it, in the order it is due.
 */
export function testSchedule(time: ReturnType<typeof fakeClock>) {
  const waiting = new Set<{ at: number; run: () => void }>();
  const schedule: Schedule = (run, delay) => {
    const timer = { at: time.clock.now().getTime() + delay, run };
    waiting.add(timer);
    return () => {
      waiting.delete(timer);
    };
  };
  /** Moves the clock on by `ms`, running each timer when it is due. */
  async function advance(ms: number): Promise<void> {
    const end = time.clock.now().getTime() + ms;
    for (;;) {
      await settle();
      const [next] = [...waiting].filter(({ at }) => at <= end).sort((a, b) => a.at - b.at);
      if (next === undefined) break;
      waiting.delete(next);
      time.advance(next.at - time.clock.now().getTime());
      next.run();
    }
    time.advance(end - time.clock.now().getTime());
    await settle();
  }
  return { schedule, advance };
}

/** A live noun of the Category `test`, with nothing but what the Core reads. */
export function word(id: string, overrides: Partial<Word> = {}): Word {
  const lemma = overrides.lemma ?? id.slice(2);
  return {
    kind: 'word',
    id,
    lemma,
    stress: [0],
    partOfSpeech: 'noun',
    primaryDefinition: `The meaning of ${lemma}.`,
    extraDefinitions: [],
    examples: [],
    synonyms: [],
    antonyms: [],
    registers: [],
    categoryId: 'test',
    rarity: 3,
    sources: [{ title: 'Test source' }],
    correctionIds: [],
    retired: false,
    ...overrides,
  };
}

/** A live Correction of a calque, with nothing but what the Core reads. */
export function correction(id: string, overrides: Partial<Correction> = {}): Correction {
  return {
    kind: 'correction',
    id,
    nonStandardForm: `not ${id.slice(2)}`,
    correctionType: 'calque',
    standardEquivalents: [id.slice(2), `also ${id.slice(2)}`],
    explanation: 'An explanation.',
    examplePair: { nonStandard: 'People say this.', standard: 'Better say this.' },
    categoryId: 'everyday',
    sources: [{ title: 'Test source' }],
    literaryUses: [],
    retired: false,
    ...overrides,
  };
}

/** A live Idiom, an idiom proper, with nothing but what the Core reads. */
export function idiom(id: string, overrides: Partial<Idiom> = {}): Idiom {
  return {
    kind: 'idiom',
    id,
    expression: `to ${id.slice(2)}`,
    idiomType: 'idiom',
    primaryDefinition: 'A meaning.',
    extraDefinitions: [],
    examples: [],
    sources: [{ title: 'Test source' }],
    retired: false,
    ...overrides,
  };
}

/** A live Synonym Row of «walk», with nothing but what the Core reads. */
export function synonymRow(id: string, overrides: Partial<SynonymRow> = {}): SynonymRow {
  return {
    kind: 'synonymRow',
    id,
    dominant: { text: 'walk', stress: [1] },
    meaning: 'To move on foot.',
    members: ['stroll', 'stride', 'trudge', 'amble', 'plod'].map((text) => ({ text, stress: [0] })),
    sources: [{ title: 'Test source' }],
    retired: false,
    ...overrides,
  };
}

/** A live Tip, with nothing but what the Core reads. */
export function tip(id: string, overrides: Partial<Tip> = {}): Tip {
  return {
    kind: 'tip',
    id,
    title: 'What time is it?',
    nonStandardForm: 'How much time?',
    standardForm: 'What time is it?',
    explanation: 'Time is asked, not counted.',
    sources: [{ title: 'Test source' }],
    gameQuestion: { prompt: 'How to ask?', rightAnswer: 'This', wrongAnswers: ['A', 'B', 'C'] },
    retired: false,
    ...overrides,
  };
}

/** A random port that always draws the same number. */
export const randomOf = (value: number): Random => ({ next: () => value });

/** A random port that draws the given numbers in turn, so each new Cycle gets the next seed. */
export function randomSequence(...values: number[]): Random {
  let drawn = 0;
  return { next: () => values[drawn++ % values.length] ?? 0 };
}

/** A random port that steps through the golden ratio: spread out, and the same every run. */
export function steppingRandom(): Random {
  let step = 0;
  return {
    next() {
      step += 1;
      return (step * 0.6180339887) % 1;
    },
  };
}

/** A seeded linear congruential generator: the same draws for the same seed. */
export function seededRandom(seed: number): Random {
  let state = seed;
  return {
    next() {
      state = (state * 1_664_525 + 1_013_904_223) % 2 ** 32;
      return state / 2 ** 32;
    },
  };
}

/** The content read port, counting each read it answers, of any kind. */
export function countingReads(content: ContentReadPort): {
  content: ContentReadPort;
  reads: () => number;
} {
  let reads = 0;
  const counted = Object.fromEntries(
    Object.entries(content).map(([name, read]) => [
      name,
      (...args: never[]) => {
        reads += 1;
        return (read as (...args: never[]) => unknown)(...args);
      },
    ]),
  ) as unknown as ContentReadPort;
  return { content: counted, reads: () => reads };
}

/** The options of a Round of the pick form, the one every Core mode of 0.8.11 plays. */
export function optionsOf(round: Round): readonly RoundOption[] {
  if (round.form !== 'pick') throw new Error(`Round ${String(round.number)} is no pick`);
  return round.options;
}

/** A Round played in the pick form, its options and its answer's places narrowed to it. */
export function pickPlayed(round: PlayedRound): PlayedRound & {
  readonly form: 'pick';
  readonly options: readonly RoundOption[];
  readonly answer: RoundAnswer & { readonly form: 'pick' };
} {
  if (round.form !== 'pick' || round.answer.form !== 'pick') {
    throw new Error(`Round ${String(round.number)} is no pick`);
  }
  return { ...round, answer: round.answer };
}

/** The Word a planned notification carries; none for the farewell. */
export function wordIdOf(notification: PlannedNotification | undefined): string | undefined {
  return notification?.kind === 'word' ? notification.wordId : undefined;
}

/** The title of a planned notification; none for the farewell. */
export function titleOf(notification: PlannedNotification | undefined): string | undefined {
  return notification?.kind === 'word' ? notification.title : undefined;
}

/**
 * The Entries over the live Mix, Rarity Ceiling and Hidden Entries opened
 * over the user state, wired as the Core composition wires them, for the
 * tests of the Entries without the whole composition.
 */
export async function openLiveEntries({
  content,
  edition,
  userState,
}: {
  content: ContentReadPort;
  edition: Parameters<typeof openEligibility>[0]['edition'];
  userState: UserState;
}) {
  const { entries, mix, rarityCeiling, hiddenEntries } = await openEligibility({
    content,
    edition,
    userState,
    clock: fakeClock().clock,
    eligibility: createSubject(),
  });
  return { entries, mix, rarityCeiling, hiddenEntries };
}

/** The Feature Switch states of an Edition: on where it turns a feature on, else off. */
export function switchStatesOf(edition: Pick<Edition, 'isFeatureEnabled'>): FeatureSwitches {
  return FeatureSwitchesSchema.parse(
    Object.fromEntries(
      FeatureSwitchesSchema.keyof().options.map((feature) => [
        feature,
        edition.isFeatureEnabled(feature) ? 'on' : 'off',
      ]),
    ),
  );
}

/** A reader of 1.0.0 on iOS, signed out, with no region: one no targeted Rule matches. */
export const readerFacts = (): ReaderFacts => ({
  appVersion: '1.0.0',
  platform: 'ios',
  region: undefined,
  signedIn: false,
  installId: 'i',
});

/** The Install id of the test device, which the Analytics events carry. */
export const TEST_INSTALL_ID = 'test-install';

/** Analytics into `port` from the test device, with no Rule, so no Variant. */
export const analyticsInto = (port: AnalyticsPort): AnalyticsSink => ({
  port,
  switches: {
    installId: TEST_INSTALL_ID,
    verdicts: evaluateSwitches({
      rules: [],
      states: FeatureSwitchesSchema.parse(
        Object.fromEntries(FeatureSwitchesSchema.keyof().options.map((feature) => [feature, 'on'])),
      ),
      facts: {
        ...readerFacts(),
        installId: TEST_INSTALL_ID,
        clock: { now: () => new Date(0), timeZone: () => 'UTC' },
        clockOffsetMs: 0,
      },
    }),
  },
});
