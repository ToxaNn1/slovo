import type { Correction, Word } from '@slovo/contracts';

import type { Clock, Random } from './ports';

// Helpers the Core's tests share. They are not part of the public `index.ts`.

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
