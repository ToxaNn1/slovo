import type { Correction, Idiom, Word } from '@slovo/contracts';

import type { KnownCounts } from './knowledge/knowledge';
import type { Clock, ContentReadPort, Random } from './ports';

// Helpers the Core's tests share. They are not part of the public `index.ts`.

/** The Known counts by kind of Entry: those named, and 0 for every other kind. */
export const knownCounts = (counts: Partial<KnownCounts> = {}): KnownCounts => ({
  word: 0,
  correction: 0,
  idiom: 0,
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
