/**
 * Picks Word candidates for a content wave from a dictionary headword list,
 * with no language model: the Lemmas a wave's lists are written from
 * (`pnpm source:lemmas`, ADR 0196).
 *
 * The headword list has one line per Lemma form, `<lemma>\t<tags>`, the tags
 * as the dict_uk tagset writes them (`noun:inanim:f:v_naz`). A candidate is a
 * common noun, verb, adjective or adverb of the Edition's alphabet whose
 * rarity, from its Zipf in `wordfreq` on the bands of ADR 0146 (one higher,
 * at most 5, for an archaic Lemma), is 2 to 5, that the Edition does not have
 * yet and no exclude list names.
 *
 * Productive derivatives are left out before they reach a writer (verbal
 * nouns, `-ість` nouns and `-о` adverbs, `-ся` verbs whose base is a Word or
 * at least as frequent, prefix compounds, adjectives of place names), and so
 * is an archaic Lemma that is a live Lemma in an old spelling. The rest are
 * ranked by evidence within each part of speech and rarity: tagged archaic,
 * labelled by Wiktionary, listed by ЕСУМ (ADR 0196); ties are random.
 */
import { matchKey } from './text';

export const CANDIDATE_POS = ['noun', 'verb', 'adj', 'adv'] as const;
export type CandidatePos = (typeof CANDIDATE_POS)[number];

/** The rarities a candidate may have: rarity 1 is too common for the collection. */
export const CANDIDATE_RARITIES = [2, 3, 4, 5] as const;
export type CandidateRarity = (typeof CANDIDATE_RARITIES)[number];
export type Rarity = 1 | CandidateRarity;

/** The Category every line gets: the writer fills it in before `source:words` runs. */
const CATEGORY_PLACEHOLDER = '?';

const DEFAULT_COUNT = 100;
const DEFAULT_POS_SHARES = 'noun:55,adj:20,verb:20,adv:5';
const DEFAULT_RARITY_SHARES = '2:1,3:1,4:1,5:1';

/**
 * Tags that keep a Lemma form out: proper names, abbreviations, participles,
 * pronouns and numerals, dialect words, non-standard, erroneous and obscene
 * forms. Rare (`rare`) and archaic (`arch`) words stay: a wave wants them.
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
  'dial',
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

/** The tag of an archaic Lemma form, which adds 1 to the rarity (ADR 0146). */
const ARCHAIC_TAG = 'arch';

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
  /** The Lemmas Wiktionary labels dated, rare, archaic or dialectal. */
  readonly labelled: ReadonlySet<string>;
  /**
   * Whether ЕСУМ lists the Lemma; asked only about each cell's shortlist.
   * Undefined, ЕСУМ is not asked and archaic and Wiktionary alone rank.
   */
  readonly inEsum: ((lemma: string) => Promise<boolean>) | undefined;
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
      /** How many Lemmas were left out as productive derivatives or old spellings. */
      readonly derivatives: number;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

/** What speaks for a candidate being a rare Word rather than a generated form. */
type Evidence = 'arch' | 'Wiktionary' | 'ЕСУМ';

interface Candidate {
  readonly lemma: string;
  readonly pos: CandidatePos;
  readonly zipf: number;
  readonly rarity: CandidateRarity;
  readonly evidence: readonly Evidence[];
}

/** How many candidates of a cell ЕСУМ is asked about, per line the cell gives. */
const ESUM_SHORTLIST_FACTOR = 2;

/** Picks the candidates and writes them as a Lemma list. */
export async function sourceLemmas(input: LemmaSourcingInput): Promise<LemmaSourcingResult> {
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

  const headwords = readHeadwords(input.headwords);
  const isDerivative = derivativeTest(headwords, input.zipf, (lemma) => known.has(matchKey(lemma)));
  const cells = new Map<string, Candidate[]>();
  const pool = emptyPool();
  let derivatives = 0;
  for (const { lemma, pos, archaic } of headwords.lemmas) {
    if (!letterSequence(lemma).every((letter) => alphabet.has(letter) || letter === "'")) continue;
    if (letters !== undefined && !letters.has(lemma[0] ?? '')) continue;
    if (isKnown(lemma)) continue;
    if (isDerivative(lemma, pos, archaic)) {
      derivatives += 1;
      continue;
    }
    const zipf = input.zipf(lemma);
    const rarity = archaic ? raised(rarityBand(zipf)) : rarityBand(zipf);
    if (rarity === 1) continue;
    pool[rarity][pos] += 1;
    if ((rarityShares.get(String(rarity)) ?? 0) === 0) continue;
    const key = `${pos} ${String(rarity)}`;
    const cell = cells.get(key) ?? [];
    const evidence: Evidence[] = [];
    if (archaic) evidence.push('arch');
    if (input.labelled.has(lemma)) evidence.push('Wiktionary');
    cell.push({ lemma, pos, zipf, rarity, evidence });
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
  for (const [index, pos] of CANDIDATE_POS.entries()) {
    const rarityCounts = allocate(
      posCounts[index] ?? 0,
      CANDIDATE_RARITIES.map((rarity) => rarityShares.get(String(rarity)) ?? 0),
      CANDIDATE_RARITIES.map((rarity) => cellOf(pos, rarity).length),
    );
    for (const [at, rarity] of CANDIDATE_RARITIES.entries()) {
      picked.push(...(await best(cellOf(pos, rarity), rarityCounts[at] ?? 0, input)));
    }
  }

  picked.sort((a, b) => a.lemma.localeCompare(b.lemma, 'uk'));
  const list = [
    `# Word candidates from source:lemmas: fill in each Category in place of "${CATEGORY_PLACEHOLDER}" before source:words.`,
    '# <lemma> <category> <rarity>  # part of speech, Zipf in wordfreq (uk), evidence',
    ...picked.map(({ lemma, pos, zipf, rarity, evidence }) =>
      [
        `${lemma} ${CATEGORY_PLACEHOLDER} ${String(rarity)} # ${pos}`,
        `Zipf ${zipf.toFixed(2)}`,
        ...evidence,
      ].join(', '),
    ),
  ].join('\n');
  return { ok: true, list: `${list}\n`, pool, shortfall: count - picked.length, derivatives };
}

/**
 * The `count` candidates of a cell with the most evidence, ties at random:
 * archaic and Wiktionary rank first, then ЕСУМ is asked about the shortlist
 * of the best `ESUM_SHORTLIST_FACTOR × count` and ranks it once more, unless
 * there is no ЕСУМ to ask.
 */
async function best(
  cell: readonly Candidate[],
  count: number,
  { inEsum, random }: Pick<LemmaSourcingInput, 'inEsum' | 'random'>,
): Promise<Candidate[]> {
  if (count === 0) return [];
  const byEvidence = (a: Candidate, b: Candidate) => b.evidence.length - a.evidence.length;
  const ranked = sample(cell, cell.length, random).sort(byEvidence);
  if (inEsum === undefined) return ranked.slice(0, count);
  const shortlist: Candidate[] = [];
  for (const candidate of ranked.slice(0, count * ESUM_SHORTLIST_FACTOR)) {
    const listed = await inEsum(candidate.lemma);
    shortlist.push(
      listed ? { ...candidate, evidence: [...candidate.evidence, 'ЕСУМ'] } : candidate,
    );
  }
  return shortlist.sort(byEvidence).slice(0, count);
}

/** The rarity one step higher, at most 5: what `archaic` adds (ADR 0146). */
function raised(rarity: Rarity): CandidateRarity {
  switch (rarity) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 4;
    case 4:
    case 5:
      return 5;
  }
}

interface HeadwordLemma {
  readonly lemma: string;
  readonly pos: CandidatePos;
  /** Every clean Lemma form of it is tagged archaic. */
  readonly archaic: boolean;
}

interface Headwords {
  /** The distinct (Lemma, part of speech) pairs with at least one clean Lemma form. */
  readonly lemmas: readonly HeadwordLemma[];
  /** Every Lemma form of the part of speech, clean or not: the bases a derivative may come from. */
  readonly bases: Readonly<Record<CandidatePos, ReadonlySet<string>>>;
  /** The live spellings: the Lemmas with a clean form that is not archaic. */
  readonly live: ReadonlySet<string>;
  /** Place names in lower case, each also cut by one and two letters, for their adjectives. */
  readonly placeStems: ReadonlySet<string>;
}

function readHeadwords(headwords: string): Headwords {
  const lemmas = new Map<string, HeadwordLemma>();
  const bases: Record<CandidatePos, Set<string>> = {
    noun: new Set(),
    verb: new Set(),
    adj: new Set(),
    adv: new Set(),
  };
  const placeStems = new Set<string>();
  for (const line of headwords.split('\n')) {
    const [rawLemma, tagText] = line.split('\t');
    if (rawLemma === undefined || tagText === undefined) continue;
    const lemma = rawLemma.normalize('NFC');
    const [posTag, ...tags] = tagText.trim().split(':');
    const pos = CANDIDATE_POS.find((candidate) => candidate === posTag);
    if (pos === undefined || !isLemmaForm(pos, tags)) continue;
    if (tags.includes('geo')) {
      const place = lemma.toLocaleLowerCase('uk');
      for (const cut of [0, 1, 2]) placeStems.add(place.slice(0, place.length - cut));
    }
    if (!tags.includes('prop')) bases[pos].add(lemma);
    if (tags.some((tag) => EXCLUDING_TAGS.has(tag))) continue;
    const key = `${lemma}\t${pos}`;
    const archaic = tags.includes(ARCHAIC_TAG) && (lemmas.get(key)?.archaic ?? true);
    lemmas.set(key, { lemma, pos, archaic });
  }
  const live = new Set(
    [...lemmas.values()].filter(({ archaic }) => !archaic).map(({ lemma }) => lemma),
  );
  return { lemmas: [...lemmas.values()], bases, live, placeStems };
}

/** Prefixes of compounds a writer never keeps, when the rest is a Lemma of its own. */
const COMPOUND_PREFIXES = [
  'взаємо',
  'енерго',
  'макро',
  'мікро',
  'міні',
  'мега',
  'соц',
  'псевдо',
  'квазі',
  'ультра',
  'електро',
  'гідро',
  'напів',
];

/** The letters an old spelling has where today's has another: ґ, е/є and і/ї/и. */
const SPELLING_SWAPS: Readonly<Record<string, readonly string[]>> = {
  ґ: ['г'],
  е: ['є', 'і'],
  є: ['е'],
  і: ['и', 'ї', 'е'],
  ї: ['і'],
  и: ['і'],
};

/**
 * Whether a Lemma is a productive derivative a writer would strike, or an
 * archaic Lemma that is a live one in an old spelling.
 */
function derivativeTest(
  { bases, live, placeStems }: Headwords,
  zipf: (lemma: string) => number,
  isWord: (lemma: string) => boolean,
): (lemma: string, pos: CandidatePos, archaic: boolean) => boolean {
  const isLemma = (text: string) =>
    CANDIDATE_POS.some((pos) => bases[pos].has(text)) || isWord(text);
  // A suffix derivative goes when its base is a Word or at least as frequent.
  const hasBase = (lemma: string, pos: CandidatePos, candidates: readonly string[]) =>
    candidates.some(
      (base) =>
        base !== lemma && (isWord(base) || (bases[pos].has(base) && zipf(base) >= zipf(lemma))),
    );
  return (lemma, pos, archaic) => {
    if (archaic && oldSpellings(lemma).some((spelling) => live.has(spelling) || isWord(spelling)))
      return true;
    const compound = COMPOUND_PREFIXES.find((prefix) => lemma.startsWith(prefix));
    if (compound !== undefined) {
      const rest = lemma.slice(compound.length).replace(/^-/, '');
      if (rest.length >= 3 && isLemma(rest)) return true;
    }
    switch (pos) {
      case 'noun': {
        const verbal = /(?:ння|ття)$/.exec(lemma);
        if (verbal !== null) {
          const stem = lemma.slice(0, -3);
          const verbs = [`${stem}ти`, ...(/[еі]$/.test(stem) ? [`${stem.slice(0, -1)}ити`] : [])];
          if (hasBase(lemma, 'verb', [...verbs, ...verbs.map((verb) => `${verb}ся`)])) return true;
        }
        if (lemma.endsWith('ість')) {
          const stem = lemma.slice(0, -4);
          if (hasBase(lemma, 'adj', [`${stem}ий`, `${stem}ій`])) return true;
        }
        return false;
      }
      case 'adv':
        return lemma.endsWith('о') && hasBase(lemma, 'adj', adjectivesOf(lemma.slice(0, -1)));
      case 'verb':
        return /с[яь]$/.test(lemma) && hasBase(lemma, 'verb', [lemma.slice(0, -2)]);
      case 'adj': {
        const place = /(?:ськ|цьк|зьк)ий$/.exec(lemma);
        if (place === null) return false;
        const stem = lemma.slice(0, place.index);
        return stem.length >= 3 && placeStems.has(stem) && !bases.noun.has(stem);
      }
    }
  };
}

function adjectivesOf(stem: string): string[] {
  return [`${stem}ий`, `${stem}ій`];
}

/** The spellings today's orthography would give an old one: one letter swapped, ґ as г, or a г before a first vowel. */
function oldSpellings(lemma: string): string[] {
  const withG = lemma.replaceAll('ґ', 'г');
  const spellings = new Set<string>([withG]);
  if (/^[оу]/.test(withG)) spellings.add(`г${withG}`);
  const letters = Array.from(withG);
  letters.forEach((letter, at) => {
    for (const swap of SPELLING_SWAPS[letter] ?? []) {
      spellings.add([...letters.slice(0, at), swap, ...letters.slice(at + 1)].join(''));
    }
  });
  spellings.delete(lemma);
  return [...spellings];
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
