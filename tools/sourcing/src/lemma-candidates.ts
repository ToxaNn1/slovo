/**
 * Picks Word candidates for a content wave from a dictionary headword list,
 * with no language model: the Lemmas a wave's lists are written from
 * (`pnpm source:lemmas`, ADR 0196).
 *
 * The headword list has one line per Lemma form, `<lemma>\t<tags>`, the tags
 * as the dict_uk tagset writes them (`noun:inanim:f:v_naz`). A candidate is a
 * common noun, verb, adjective or adverb of the Edition's alphabet whose
 * rarity, from its Zipf in `wordfreq` on the bands of ADR 0146, is 2 to 5,
 * that the Edition does not have yet and no exclude list names.
 */
import { matchKey } from './text';

export const CANDIDATE_POS = ['noun', 'verb', 'adj', 'adv'] as const;
export type CandidatePos = (typeof CANDIDATE_POS)[number];

/** The rarities a candidate may have: rarity 1 is too common for the collection. */
export const CANDIDATE_RARITIES = [2, 3, 4, 5] as const;
export type CandidateRarity = (typeof CANDIDATE_RARITIES)[number];
export type Rarity = 1 | CandidateRarity;

/** The Category every line gets: the writer fills it in before `source:words` runs. */
export const CATEGORY_PLACEHOLDER = '?';

const DEFAULT_COUNT = 100;
const DEFAULT_POS_SHARES = 'noun:55,adj:20,verb:20,adv:5';
const DEFAULT_RARITY_SHARES = '2:1,3:1,4:1,5:1';

/**
 * Tags that keep a Lemma form out: proper names, abbreviations, participles,
 * pronouns and numerals, rare, dialect or archaic words, non-standard,
 * erroneous and obscene forms.
 */
const EXCLUDING_TAGS = new Set([
  'prop',
  'fname',
  'lname',
  'patr',
  'pname',
  'geo',
  'abbr',
  'adjp',
  '&adjp',
  '&_adjp',
  'pron',
  '&pron',
  'numr',
  '&numr',
  '&_numr',
  'rare',
  'arch',
  'alt',
  'bad',
  'err',
  'obsc',
  'vulg',
  'short',
  'foreign',
]);

/** The tags that mark a Lemma's own form, by part of speech. */
function isLemmaForm(pos: CandidatePos, tags: readonly string[]): boolean {
  switch (pos) {
    case 'noun':
      return tags.includes('v_naz');
    case 'adj':
      return (
        tags.includes('v_naz') && tags.includes('m') && !tags.some((t) => t.startsWith('comp'))
      );
    case 'verb':
      return tags.includes('inf');
    case 'adv':
      return !tags.some((t) => t.startsWith('comp'));
  }
}

/** The rarity ADR 0146 gives a Zipf frequency: 2.5 / 1.93 / 1.48 / above 0 / absent. */
export function rarityBand(zipf: number): Rarity {
  if (zipf >= 2.5) return 1;
  if (zipf >= 1.93) return 2;
  if (zipf >= 1.48) return 3;
  if (zipf > 0) return 4;
  return 5;
}

export interface LemmaOptions {
  /** How many lines to write; 100 by default. */
  readonly count?: string | undefined;
  /** The letters a Lemma may start with, e.g. `абв` or `а,б,в`; all by default. */
  readonly letters?: string | undefined;
  /** Shares of the parts of speech, e.g. `noun:55,adj:20,verb:20,adv:5`. */
  readonly pos?: string | undefined;
  /** Shares of the rarities, e.g. `2:1,3:1,4:1,5:1` (the default, even). */
  readonly rarity?: string | undefined;
}

export interface LemmaSourcingInput {
  /** The headword list, `<lemma>\t<tags>` per line. */
  readonly headwords: string;
  /** The Zipf frequency of a Lemma in `wordfreq` (`uk`), 0 when absent. */
  readonly zipf: (lemma: string) => number;
  /** The lowercase letters of the Edition's alphabet. */
  readonly alphabet: readonly string[];
  /** The Lemmas of the Edition's Words, Retired ones too. */
  readonly existingLemmas: readonly string[];
  /** Lemma lists whose first field is a Lemma to leave out, e.g. earlier waves' lists. */
  readonly excludeLists: readonly string[];
  readonly options: LemmaOptions;
  readonly random: () => number;
}

export type Pool = Record<CandidateRarity, Record<CandidatePos, number>>;

export type LemmaSourcingResult =
  | {
      readonly ok: true;
      /** The list, in the format `source:words` reads. */
      readonly list: string;
      /** The candidates there were to pick from, per rarity and part of speech. */
      readonly pool: Pool;
      /** How many lines short of the count the list is, for want of candidates. */
      readonly shortfall: number;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

interface Candidate {
  readonly lemma: string;
  readonly pos: CandidatePos;
  readonly zipf: number;
  readonly rarity: CandidateRarity;
}

/** Picks the candidates and writes them as a Lemma list. */
export function sourceLemmas(input: LemmaSourcingInput): LemmaSourcingResult {
  const alphabet = new Set(input.alphabet);
  const errors: string[] = [];
  const count = parseCount(input.options.count, errors);
  const letters = parseLetters(input.options.letters, alphabet, errors);
  const posShares = parseShares(
    '--pos',
    input.options.pos ?? DEFAULT_POS_SHARES,
    CANDIDATE_POS,
    errors,
  );
  const rarityShares = parseShares(
    '--rarity',
    input.options.rarity ?? DEFAULT_RARITY_SHARES,
    CANDIDATE_RARITIES.map(String),
    errors,
  );
  if (
    errors.length > 0 ||
    count === undefined ||
    posShares === undefined ||
    rarityShares === undefined
  )
    return { ok: false, errors };

  const known = new Set(
    [...input.existingLemmas, ...input.excludeLists.flatMap(listLemmas)].map(matchKey),
  );
  const isKnown = (lemma: string) => {
    const key = matchKey(lemma);
    return known.has(key) || (/с[яь]$/.test(key) && known.has(key.slice(0, -2)));
  };

  const cells = new Map<string, Candidate[]>();
  const pool = emptyPool();
  for (const { lemma, pos } of headwordLemmas(input.headwords)) {
    if (!letterSequence(lemma).every((letter) => alphabet.has(letter) || letter === "'")) continue;
    if (letters !== undefined && !letters.has(lemma[0] ?? '')) continue;
    if (isKnown(lemma)) continue;
    const zipf = input.zipf(lemma);
    const rarity = rarityBand(zipf);
    if (rarity === 1) continue;
    pool[rarity][pos] += 1;
    if ((rarityShares.get(String(rarity)) ?? 0) === 0) continue;
    const key = `${pos} ${String(rarity)}`;
    const cell = cells.get(key) ?? [];
    cell.push({ lemma, pos, zipf, rarity });
    cells.set(key, cell);
  }

  const cellOf = (pos: CandidatePos, rarity: CandidateRarity) =>
    cells.get(`${pos} ${String(rarity)}`) ?? [];
  const posCounts = allocate(
    count,
    CANDIDATE_POS.map((pos) => posShares.get(pos) ?? 0),
    CANDIDATE_POS.map((pos) =>
      CANDIDATE_RARITIES.reduce((sum, rarity) => sum + cellOf(pos, rarity).length, 0),
    ),
  );
  const picked: Candidate[] = [];
  CANDIDATE_POS.forEach((pos, index) => {
    const rarityCounts = allocate(
      posCounts[index] ?? 0,
      CANDIDATE_RARITIES.map((rarity) => rarityShares.get(String(rarity)) ?? 0),
      CANDIDATE_RARITIES.map((rarity) => cellOf(pos, rarity).length),
    );
    CANDIDATE_RARITIES.forEach((rarity, at) => {
      picked.push(...sample(cellOf(pos, rarity), rarityCounts[at] ?? 0, input.random));
    });
  });

  picked.sort((a, b) => a.lemma.localeCompare(b.lemma, 'uk'));
  const list = [
    `# Word candidates from source:lemmas: fill in each Category in place of "${CATEGORY_PLACEHOLDER}" before source:words.`,
    '# <lemma> <category> <rarity>  # part of speech, Zipf in wordfreq (uk)',
    ...picked.map(
      ({ lemma, pos, zipf, rarity }) =>
        `${lemma} ${CATEGORY_PLACEHOLDER} ${String(rarity)} # ${pos}, Zipf ${zipf.toFixed(2)}`,
    ),
  ].join('\n');
  return { ok: true, list: `${list}\n`, pool, shortfall: count - picked.length };
}

/** The distinct (Lemma, part of speech) pairs with at least one clean Lemma form. */
function headwordLemmas(headwords: string): { lemma: string; pos: CandidatePos }[] {
  const seen = new Set<string>();
  const lemmas: { lemma: string; pos: CandidatePos }[] = [];
  for (const line of headwords.split('\n')) {
    const [rawLemma, tagText] = line.split('\t');
    if (rawLemma === undefined || tagText === undefined) continue;
    const lemma = rawLemma.normalize('NFC');
    const [posTag, ...tags] = tagText.trim().split(':');
    const pos = CANDIDATE_POS.find((candidate) => candidate === posTag);
    if (pos === undefined || !isLemmaForm(pos, tags)) continue;
    if (tags.some((tag) => EXCLUDING_TAGS.has(tag))) continue;
    const key = `${lemma}\t${pos}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lemmas.push({ lemma, pos });
  }
  return lemmas;
}

/** The first field of every line of a Lemma list, `#` comments left out. */
function listLemmas(list: string): string[] {
  return list
    .split('\n')
    .map((line) => line.replace(/#.*/, '').trim().split(/\s+/)[0] ?? '')
    .filter((lemma) => lemma !== '');
}

/**
 * Splits `total` over cells in proportion to their weights, never giving a
 * cell more than its cap; what a full cell cannot take goes to the others,
 * the largest remainders first.
 */
function allocate(total: number, weights: readonly number[], caps: readonly number[]): number[] {
  const counts = weights.map(() => 0);
  let left = total;
  for (;;) {
    const open = weights.flatMap((weight, index) =>
      weight > 0 && (counts[index] ?? 0) < (caps[index] ?? 0) ? [index] : [],
    );
    if (left === 0 || open.length === 0) return counts;
    const weightSum = open.reduce((sum, index) => sum + (weights[index] ?? 0), 0);
    const shares = open.map((index) => {
      const exact = (left * (weights[index] ?? 0)) / weightSum;
      const room = (caps[index] ?? 0) - (counts[index] ?? 0);
      return {
        index,
        whole: Math.min(Math.floor(exact), room),
        rest: exact - Math.floor(exact),
        room,
      };
    });
    let given = 0;
    for (const share of shares) {
      counts[share.index] = (counts[share.index] ?? 0) + share.whole;
      given += share.whole;
    }
    const byRest = shares
      .filter((share) => share.whole < share.room)
      .sort((a, b) => b.rest - a.rest);
    for (const share of byRest) {
      if (given >= left || share.rest === 0) break;
      counts[share.index] = (counts[share.index] ?? 0) + 1;
      given += 1;
    }
    if (given === 0) {
      // Every open cell's exact share is below one: give the heaviest a line.
      const first = byRest[0] ?? shares[0];
      if (first === undefined) return counts;
      counts[first.index] = (counts[first.index] ?? 0) + 1;
      given = 1;
    }
    left -= given;
  }
}

/** `count` items of `items` drawn at random, without repeats. */
function sample<T>(items: readonly T[], count: number, random: () => number): T[] {
  const copy = [...items];
  const n = Math.min(count, copy.length);
  for (let i = 0; i < n; i += 1) {
    const j = i + Math.floor(random() * (copy.length - i));
    const swap = copy[i];
    const other = copy[j];
    if (swap === undefined || other === undefined) break;
    copy[i] = other;
    copy[j] = swap;
  }
  return copy.slice(0, n);
}

function parseCount(text: string | undefined, errors: string[]): number | undefined {
  if (text === undefined) return DEFAULT_COUNT;
  const count = Number(text);
  if (Number.isInteger(count) && count > 0) return count;
  errors.push(`--count must be a whole number above 0, not "${text}"`);
  return undefined;
}

function parseLetters(
  text: string | undefined,
  alphabet: ReadonlySet<string>,
  errors: string[],
): ReadonlySet<string> | undefined {
  if (text === undefined) return undefined;
  const letters = letterSequence(text.toLocaleLowerCase('uk').replace(/[\s,]/g, ''));
  const foreign = letters.filter((letter) => !alphabet.has(letter));
  if (letters.length === 0 || foreign.length > 0) {
    errors.push(
      `--letters takes letters of the Edition's alphabet, not "${foreign.join('') || text}"`,
    );
    return undefined;
  }
  return new Set(letters);
}

/** Reads `<name>:<weight>,…` whose names are all in `names`. */
function parseShares(
  option: string,
  text: string,
  names: readonly string[],
  errors: string[],
): ReadonlyMap<string, number> | undefined {
  const shares = new Map<string, number>();
  for (const part of text.split(',')) {
    const [name, weightText, ...extra] = part.trim().split(':');
    const weight = Number(weightText);
    if (name === undefined || !names.includes(name) || extra.length > 0 || !(weight >= 0)) {
      errors.push(
        `${option} takes <${names.join('|')}>:<share>, comma-separated; "${part}" is not one`,
      );
      return undefined;
    }
    shares.set(name, weight);
  }
  if ([...shares.values()].every((weight) => weight === 0)) {
    errors.push(`${option} needs a share above 0`);
    return undefined;
  }
  return shares;
}

/** The letters of a text, each with its combining marks, after NFC. */
function letterSequence(text: string): string[] {
  return text.normalize('NFC').match(/\P{M}\p{M}*/gu) ?? [];
}

function emptyPool(): Pool {
  const row = (): Record<CandidatePos, number> => ({ noun: 0, verb: 0, adj: 0, adv: 0 });
  return { 2: row(), 3: row(), 4: row(), 5: row() };
}

/** A repeatable random number source from a seed (mulberry32), for `--seed`. */
export function randomFromSeed(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
