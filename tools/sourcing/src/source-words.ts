import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EditionConfigSchema,
  GenderSchema,
  WordSchema,
  type EditionConfig,
  type Example,
  type PartOfSpeech,
  type Register,
  type Source,
} from '@slovo/contracts';

import {
  fetchGoroh,
  gorohUrl,
  isSameWord,
  parseEtymologies,
  parseInflections,
  parseSynonymGroups,
  type GorohEtymology,
  type GorohInflection,
  type GorohSynonymGroup,
} from './goroh';
import { PoliteClient, type Clock, type Fetch, type RequestStats } from './polite-client';
import { formatReviewReport } from './report';
import { SumDictionary, type SumAccess, type SumArticle, type SumPage } from './sum';
import { matchKey, readStress, unstressed } from './text';

export interface SourcingOptions {
  /** The Lemmas to draft, one per line: `<lemma> <category id> <rarity>`; `#` starts a comment. */
  readonly lemmaList: string;
  /** The Edition the drafts are for: its Categories, language traits and taken ids. */
  readonly editionDir: string;
  /** The review folder: drafts, incomplete drafts and the review report go here. */
  readonly outDir: string;
  /** Where fetched pages are kept, so re-runs don't ask the sites again. */
  readonly cacheDir: string;
  readonly fetch: Fetch;
  readonly clock: Clock;
  /** A source of numbers in [0, 1), for new Word ids. */
  readonly random: () => number;
  readonly sumAccess?: SumAccess;
  /** The least time between two network requests. */
  readonly minIntervalMs?: number;
}

export type SourcingResult =
  | { readonly ok: true; readonly report: ReviewReport }
  | { readonly ok: false; readonly errors: readonly string[] };

export interface ReviewReport {
  readonly lemmas: readonly LemmaOutcome[];
  readonly requests: RequestStats;
}

export interface LemmaOutcome {
  readonly lemma: string;
  /** The line of the Lemma list. */
  readonly line: number;
  readonly drafts: readonly DraftOutcome[];
  /** What a human must look at for the Lemma as a whole. */
  readonly flags: readonly Flag[];
}

export interface DraftOutcome {
  readonly id: string;
  /** The draft file, relative to the review folder. */
  readonly file: string;
  /** Whether the draft passes the Word schema and the Edition's checks. */
  readonly ready: boolean;
  /** The СУМ headword it was drafted from, e.g. `КОСА 2`. */
  readonly headword: string;
  /** What stops the draft from being ready, as `field: message`. */
  readonly issues: readonly string[];
  readonly flags: readonly Flag[];
}

export type FlagKind =
  | 'no-entry'
  | 'fetch-failed'
  | 'homonym'
  | 'several-stresses'
  | 'stress-unresolved'
  | 'plural-only'
  | 'sources-disagree'
  | 'missing-data'
  | 'needs-assignment'
  | 'unmarked-examples'
  | 'other-labels'
  | 'spelling-differs'
  | 'check';

export interface Flag {
  readonly kind: FlagKind;
  readonly message: string;
}

export const REPORT_FILE = 'review-report.md';
const DRAFTS_DIR = 'drafts';
const INCOMPLETE_DIR = 'incomplete';
const DEFAULT_MIN_INTERVAL_MS = 2000;

/**
 * Drafts Words for a list of Lemmas from СУМ-11 (sum.in.ua, or its Wayback
 * Machine copies) and goroh.pp.ua, and writes them with a review report to
 * the review folder. Every field comes from a source; what the sources leave
 * open stays empty and is flagged for a human.
 */
export async function sourceWords(options: SourcingOptions): Promise<SourcingResult> {
  const edition = readEdition(options.editionDir);
  if (!edition.ok) return { ok: false, errors: edition.errors };
  const list = parseLemmaList(options.lemmaList, edition.config);
  if (!list.ok) return { ok: false, errors: list.errors };

  const client = new PoliteClient(
    options.fetch,
    options.clock,
    options.cacheDir,
    options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
  );
  const sum = new SumDictionary(client, options.sumAccess ?? 'auto');
  const newId = idMaker(options.random, edition.takenIds);

  for (const dir of [DRAFTS_DIR, INCOMPLETE_DIR]) {
    rmSync(join(options.outDir, dir), { recursive: true, force: true });
    mkdirSync(join(options.outDir, dir), { recursive: true });
  }

  const lemmas: LemmaOutcome[] = [];
  for (const request of list.requests) {
    const outcome = await draftLemma(request, { client, sum, newId, config: edition.config });
    for (const draft of outcome.drafts) {
      writeFileSync(
        join(options.outDir, draft.outcome.file),
        `${JSON.stringify(draft.word, null, 2)}\n`,
      );
    }
    lemmas.push({ ...outcome, drafts: outcome.drafts.map((draft) => draft.outcome) });
  }

  const report: ReviewReport = { lemmas, requests: { ...client.stats } };
  writeFileSync(join(options.outDir, REPORT_FILE), formatReviewReport(report));
  return { ok: true, report };
}

interface WordRequest {
  readonly lemma: string;
  readonly categoryId: string;
  readonly rarity: number;
  readonly line: number;
}

function parseLemmaList(
  text: string,
  config: EditionConfig,
): { ok: true; requests: WordRequest[] } | { ok: false; errors: string[] } {
  const categoryIds = new Set(config.categories.map((category) => category.id));
  const requests: WordRequest[] = [];
  const errors: string[] = [];
  const lineOf = new Map<string, number>();

  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const content = raw.replace(/#.*/, '').trim();
    if (content === '') return;
    const fail = (message: string) => errors.push(`Line ${String(line)}: ${message}`);
    const fields = content.split(/\s+/);
    const [lemma, categoryId, rarityText] = fields;
    if (
      fields.length !== 3 ||
      lemma === undefined ||
      categoryId === undefined ||
      rarityText === undefined
    ) {
      fail('Expected "<lemma> <category id> <rarity>"');
      return;
    }
    if (lemma !== unstressed(lemma)) fail(`Write the Lemma "${lemma}" without stress marks`);
    if (!categoryIds.has(categoryId)) fail(`Unknown Category "${categoryId}"`);
    const rarity = Number(rarityText);
    if (!Number.isInteger(rarity) || rarity < 1 || rarity > 5) {
      fail(`Rarity "${rarityText}" is not a whole number from 1 to 5`);
    }
    const key = matchKey(lemma);
    const firstLine = lineOf.get(key);
    if (firstLine !== undefined) fail(`"${lemma}" is already listed on line ${String(firstLine)}`);
    lineOf.set(key, line);
    requests.push({ lemma: lemma.normalize('NFC'), categoryId, rarity, line });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, requests };
}

function readEdition(
  editionDir: string,
): { ok: true; config: EditionConfig; takenIds: Set<string> } | { ok: false; errors: string[] } {
  const configFile = join(editionDir, 'edition.json');
  if (!existsSync(configFile)) return { ok: false, errors: [`No Edition config at ${configFile}`] };
  const parsed = EditionConfigSchema.safeParse(JSON.parse(readFileSync(configFile, 'utf8')));
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map(
        (issue) => `edition.json › ${issue.path.join('.')}: ${issue.message}`,
      ),
    };
  }
  const takenIds = new Set<string>();
  const wordsDir = join(editionDir, 'content', 'words');
  if (existsSync(wordsDir)) {
    for (const name of readdirSync(wordsDir).filter((file) => file.endsWith('.json'))) {
      const word = JSON.parse(readFileSync(join(wordsDir, name), 'utf8')) as { id?: unknown };
      if (typeof word.id === 'string') takenIds.add(word.id);
    }
  }
  return { ok: true, config: parsed.data, takenIds };
}

/** New opaque Word ids that the Edition hasn't used. */
function idMaker(random: () => number, takenIds: Set<string>): () => string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return () => {
    for (;;) {
      let id = 'w_';
      for (let i = 0; i < 6; i += 1) id += alphabet.charAt(Math.floor(random() * alphabet.length));
      if (!takenIds.has(id)) {
        takenIds.add(id);
        return id;
      }
    }
  };
}

interface Context {
  readonly client: PoliteClient;
  readonly sum: SumDictionary;
  readonly newId: () => string;
  readonly config: EditionConfig;
}

interface Draft {
  readonly word: Record<string, unknown>;
  readonly outcome: DraftOutcome;
}

/** What goroh says about a Lemma; each part is empty when goroh has no page. */
interface GorohEntry {
  readonly inflections: readonly GorohInflection[];
  readonly synonymGroups: readonly GorohSynonymGroup[];
  readonly etymologies: readonly GorohEtymology[];
}

async function draftLemma(
  request: WordRequest,
  context: Context,
): Promise<{ lemma: string; line: number; drafts: Draft[]; flags: Flag[] }> {
  const { lemma, line } = request;
  const flags: Flag[] = [];
  let page: SumPage;
  let goroh: GorohEntry;
  try {
    const lookup = await context.sum.lookUp(lemma);
    if (!lookup.found) {
      flags.push({
        kind: 'no-entry',
        message: `No СУМ-11 entry found; tried ${lookup.tried.join(', ')}`,
      });
      return { lemma, line, drafts: [], flags };
    }
    page = lookup.page;
    const [inflection, synonyms, etymology] = [
      await fetchGoroh(context.client, 'Словозміна', lemma),
      await fetchGoroh(context.client, 'Синонімія', lemma),
      await fetchGoroh(context.client, 'Етимологія', lemma),
    ];
    goroh = {
      inflections: inflection === undefined ? [] : parseInflections(inflection, lemma),
      synonymGroups: synonyms === undefined ? [] : parseSynonymGroups(synonyms, lemma),
      etymologies: etymology === undefined ? [] : parseEtymologies(etymology),
    };
  } catch (error) {
    flags.push({ kind: 'fetch-failed', message: (error as Error).message });
    return { lemma, line, drafts: [], flags };
  }

  const articles = page.articles.filter((article) => sumKey(article.headword) === sumKey(lemma));
  if (articles.length === 0) {
    flags.push({
      kind: 'no-entry',
      message: `${page.archivedUrl ?? page.url} has no article for "${lemma}" (it has ${page.articles.map((article) => article.headword).join(', ')})`,
    });
    return { lemma, line, drafts: [], flags };
  }
  if (goroh.inflections.length === 0) {
    flags.push({
      kind: 'check',
      message: 'goroh has no inflection entry: Stress and grammar come from СУМ only',
    });
  }

  const isHomonym = articles.length > 1;
  if (isHomonym) {
    flags.push({
      kind: 'homonym',
      message: `СУМ has ${String(articles.length)} homonyms, drafted as separate Words; check each one is worth keeping`,
    });
    if (goroh.synonymGroups.length > 0) {
      flags.push({
        kind: 'needs-assignment',
        message: `goroh Synonyms are per sense; assign them by hand: ${goroh.synonymGroups
          .map((group) => `${group.sense ?? '(no gloss)'}: ${group.synonyms.join(', ')}`)
          .join('; ')}`,
      });
    }
    const etymologies = matchingEtymologies(goroh.etymologies, lemma).entries;
    if (etymologies.length > 0) {
      flags.push({
        kind: 'needs-assignment',
        message: `ЕСУМ articles to assign by hand: ${etymologies.map(describeEtymology).join('; ')}`,
      });
    }
  }

  const drafts = articles.map((article) =>
    draftArticle(article, { request, page, goroh, isHomonym, context }),
  );
  return { lemma, line, drafts, flags };
}

function draftArticle(
  article: SumArticle,
  {
    request,
    page,
    goroh,
    isHomonym,
    context,
  }: {
    request: WordRequest;
    page: SumPage;
    goroh: GorohEntry;
    isHomonym: boolean;
    context: Context;
  },
): Draft {
  const { lemma } = request;
  const flags: Flag[] = [];
  const flag = (kind: FlagKind, message: string) => flags.push({ kind, message });
  const headword = [article.headword, article.homonymNumber]
    .filter((part) => part !== undefined)
    .join(' ');
  let usedInflections = false;

  if (isHomonym)
    flag(
      'homonym',
      `One of the homonyms: ${headword} — ${article.definitions[0]?.text ?? '(no Definition)'}`,
    );
  if (matchKey(article.headword) !== matchKey(lemma)) {
    flag('spelling-differs', `СУМ spells the headword ${unstressed(article.headword)}`);
  }

  // Stress: goroh is the reference; СУМ marks it on some headwords only.
  const sumStress = readStress(article.headword);
  const candidates = uniqueStresses(goroh.inflections);
  let stress: number[] | undefined;
  if (sumStress.length > 0) {
    if (candidates.length === 0) {
      stress = sumStress;
      flag('check', 'Only СУМ marks the Stress; goroh has no entry to check it against');
    } else if (candidates.some((candidate) => sameNumbers(candidate.stress, sumStress))) {
      stress = sumStress;
      usedInflections = true;
    } else {
      flag(
        'sources-disagree',
        `Stress: СУМ has ${article.headword}, goroh has ${candidates.map((candidate) => candidate.headword).join(', ')}`,
      );
    }
  } else if (candidates.length === 1) {
    stress = candidates[0]?.stress;
    usedInflections = true;
  } else if (candidates.length === 0) {
    flag('stress-unresolved', 'No source marks the Stress');
  } else {
    flag(
      'stress-unresolved',
      `goroh lists different Stresses for "${lemma}": ${candidates
        .map((candidate) => [candidate.headword, candidate.gloss].filter(Boolean).join(' '))
        .join(', ')}`,
    );
  }
  if (stress !== undefined && stress.length > 1) {
    flag(
      'several-stresses',
      `Several valid Stresses: ${goroh.inflections[0]?.headword ?? article.headword}`,
    );
  }

  // Part of speech and gender: СУМ's own labels first, goroh when they agree.
  const sumGrammar = grammarOf(article.labels);
  const gorohParts = unique(
    goroh.inflections.flatMap((entry) => tagValues(entry.tags, PARTS_OF_SPEECH)),
  );
  let partOfSpeech = sumGrammar.partOfSpeech;
  if (partOfSpeech === undefined && gorohParts.length === 1) {
    partOfSpeech = gorohParts[0];
    usedInflections = true;
  } else if (partOfSpeech === undefined) {
    flag(
      'missing-data',
      gorohParts.length === 0
        ? 'No source names the part of speech'
        : `goroh names several parts of speech: ${gorohParts.join(', ')}`,
    );
  } else if (!isHomonym && gorohParts.length === 1 && gorohParts[0] !== partOfSpeech) {
    flag('sources-disagree', `Part of speech: СУМ ${partOfSpeech}, goroh ${String(gorohParts[0])}`);
  }

  let gender: string | undefined;
  if (partOfSpeech === 'noun') {
    const gorohGenders = unique(
      goroh.inflections
        .filter((entry) => entry.tags.includes('іменник'))
        .flatMap((entry) => tagValues(entry.tags, GENDERS)),
    );
    gender = sumGrammar.gender;
    if (gender === undefined && gorohGenders.length === 1) {
      gender = gorohGenders[0];
      usedInflections = true;
    } else if (gender === undefined) {
      flag('missing-data', 'No source names the gender');
    } else if (!isHomonym && gorohGenders.length === 1 && gorohGenders[0] !== gender) {
      flag('sources-disagree', `Gender: СУМ ${gender}, goroh ${String(gorohGenders[0])}`);
    }
  }

  const [primary, ...extra] = article.definitions;
  const registers = unique(
    [...article.labels, ...(primary?.labels ?? [])].flatMap((label) => {
      const register = REGISTERS[label];
      return register === undefined ? [] : [register];
    }),
  );
  const otherLabels = unique(
    [...article.labels, ...(primary?.labels ?? [])].filter((label) => !KNOWN_LABELS.has(label)),
  );
  if (otherLabels.length > 0)
    flag('other-labels', `СУМ labels not carried over: ${otherLabels.join(', ')}`);
  if (article.unmarkedExamples) {
    flag(
      'unmarked-examples',
      'СУМ prints some Examples without italics; they are left out, and the Definition is cut at its first sentence',
    );
  }

  const sources: Source[] = [
    {
      title:
        article.sourceTitle === '' ? 'Словник української мови: в 11 томах' : article.sourceTitle,
      url: page.url,
      ...(page.archivedUrl === undefined ? {} : { archivedUrl: page.archivedUrl }),
    },
  ];
  if (usedInflections)
    sources.push({ title: 'Горох: словозміна', url: gorohUrl('Словозміна', lemma) });

  let synonyms: string[] = [];
  if (!isHomonym && goroh.synonymGroups.length > 0) {
    const taken = goroh.synonymGroups.filter((group) => isSynonymDictionary(group.dictionary));
    const leftOut = goroh.synonymGroups.filter((group) => !isSynonymDictionary(group.dictionary));
    synonyms = unique(taken.flatMap((group) => group.synonyms)).filter(
      (synonym) => synonym !== lemma,
    );
    if (synonyms.length > 0) {
      const dictionaries = unique(
        taken.flatMap((group) => (group.dictionary === undefined ? [] : [group.dictionary])),
      );
      sources.push({
        title: `Горох: синонімія (${dictionaries.join('; ')})`,
        url: gorohUrl('Синонімія', lemma),
      });
    }
    if (leftOut.length > 0) {
      flag(
        'check',
        `goroh words left out because they don't come from a synonym dictionary: ${leftOut
          .map((group) => `${group.dictionary ?? '(no dictionary)'}: ${group.synonyms.join(', ')}`)
          .join('; ')}`,
      );
    }
  }

  let etymology: string | undefined;
  if (!isHomonym) {
    const { entries, underOtherHeadword } = matchingEtymologies(goroh.etymologies, lemma);
    const [chosen] = entries;
    if (entries.length === 1 && chosen !== undefined && chosen.text !== '') {
      etymology = chosen.text.replace(/;$/, '.');
      sources.push({
        title: 'Горох: етимологія (Етимологічний словник української мови)',
        url: gorohUrl('Етимологія', lemma),
      });
      if (underOtherHeadword) {
        flag(
          'check',
          `The etymology is that of the ЕСУМ article ${describeEtymology(chosen)}, which lists "${lemma}"`,
        );
      }
    } else if (entries.length > 1) {
      flag(
        'needs-assignment',
        `Several ЕСУМ articles fit: ${entries.map(describeEtymology).join('; ')}`,
      );
    }
  }

  const examples: Example[] = article.examples.map((example) => {
    const author = authorOf(example.citation);
    return { text: asSentence(example.text), ...(author === undefined ? {} : { author }) };
  });

  const word = compact({
    id: context.newId(),
    lemma,
    stress,
    partOfSpeech,
    gender,
    primaryDefinition: primary?.text,
    extraDefinitions: extra.map((definition) => definition.text),
    examples,
    synonyms,
    etymology,
    registers,
    categoryId: request.categoryId,
    rarity: request.rarity,
    sources,
  });

  const issues = checkDraft(word, context.config);
  if (gender === 'plural-only') {
    flag(
      'plural-only',
      GenderSchema.safeParse('plural-only').success
        ? 'A plural-only noun'
        : 'A plural-only noun; the Word schema on this branch does not know `plural-only` yet (ticket #9 adds it), so that check was skipped',
    );
  }
  const id = String(word['id']);
  const ready = issues.length === 0;
  return {
    word,
    outcome: {
      id,
      file: `${ready ? DRAFTS_DIR : INCOMPLETE_DIR}/${id}.json`,
      ready,
      headword,
      issues,
      flags,
    },
  };
}

/** The schema's verdict plus the Edition's Stress rules, as `field: message`. */
function checkDraft(word: Record<string, unknown>, config: EditionConfig): string[] {
  const result = WordSchema.safeParse(word);
  const knowsPluralOnly = GenderSchema.safeParse('plural-only').success;
  const issues = result.success
    ? []
    : result.error.issues
        .filter(
          (issue) =>
            knowsPluralOnly || word['gender'] !== 'plural-only' || issue.path[0] !== 'gender',
        )
        .map((issue) => `${issue.path.join('.') || '(word)'}: ${issue.message}`);

  const { marksStress, vowels } = config.languageTraits;
  const stress = Array.isArray(word['stress']) ? (word['stress'] as number[]) : [];
  if (marksStress && stress.length === 0) issues.push('stress: Required: the Edition marks Stress');
  const letters = Array.from(String(word['lemma']));
  for (const position of stress) {
    const letter = letters[position];
    if (
      letter === undefined ||
      (vowels !== undefined && !vowels.includes(letter.toLocaleLowerCase('uk')))
    ) {
      issues.push(
        `stress: Position ${String(position)} is not a vowel of "${String(word['lemma'])}"`,
      );
    }
  }
  return unique(issues);
}

/** Drops empty lists and missing values, so drafts read like authored content. */
function compact(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  );
}

/** СУМ-11 spells ґ as г, so its headwords are matched with the two letters merged. */
function sumKey(text: string): string {
  return matchKey(text).replaceAll('ґ', 'г');
}

/**
 * The ЕСУМ articles about the Lemma: those headed by it, or else those that
 * list it among their related words.
 */
function matchingEtymologies(
  entries: readonly GorohEtymology[],
  lemma: string,
): { entries: GorohEtymology[]; underOtherHeadword: boolean } {
  const headed = entries.filter((entry) => isSameWord(entry.headword, lemma));
  if (headed.length > 0) return { entries: headed, underOtherHeadword: false };
  return {
    entries: entries.filter((entry) =>
      entry.variants.some((variant) => isSameWord(variant, lemma)),
    ),
    underOtherHeadword: true,
  };
}

function describeEtymology(entry: GorohEtymology): string {
  return [entry.headword, entry.gloss].filter(Boolean).join(' ');
}

function uniqueStresses(
  entries: readonly GorohInflection[],
): { stress: number[]; headword: string; gloss?: string }[] {
  const seen = new Map<string, { stress: number[]; headword: string; gloss?: string }>();
  for (const entry of entries) {
    const stress = readStress(entry.headword);
    if (stress.length === 0) continue;
    const key = stress.join(',');
    if (!seen.has(key)) {
      seen.set(key, {
        stress,
        headword: entry.headword,
        ...(entry.gloss === undefined ? {} : { gloss: entry.gloss }),
      });
    }
  }
  return [...seen.values()];
}

/**
 * The synonym dictionaries goroh draws on. Its other dictionaries list
 * replacements for foreign words or calques, often next to the forms to avoid.
 */
const SYNONYM_DICTIONARIES = new Set([
  'Словник синонімів Караванського',
  'Цифрові лексикографічні системи української мови',
]);

function isSynonymDictionary(dictionary: string | undefined): boolean {
  return dictionary !== undefined && SYNONYM_DICTIONARIES.has(dictionary);
}

const PARTS_OF_SPEECH: Readonly<Record<string, PartOfSpeech>> = {
  іменник: 'noun',
  дієслово: 'verb',
  прикметник: 'adjective',
  прислівник: 'adverb',
  займенник: 'pronoun',
  числівник: 'numeral',
  прийменник: 'preposition',
  сполучник: 'conjunction',
  частка: 'particle',
  вигук: 'interjection',
};

const GENDERS: Readonly<Record<string, string>> = {
  'чоловічий рід': 'masculine',
  'жіночий рід': 'feminine',
  'середній рід': 'neuter',
  'спільний рід': 'common',
  множинний: 'plural-only',
};

/** СУМ labels by their full names. A gender label marks a noun; `множина` after the headword marks a plural-only noun. */
const SUM_GENDERS: Readonly<Record<string, string>> = {
  'чоловічий рід': 'masculine',
  'жіночий рід': 'feminine',
  'середній рід': 'neuter',
  'спільний рід': 'common',
  множина: 'plural-only',
};

const SUM_PARTS_OF_SPEECH: Readonly<Record<string, PartOfSpeech>> = {
  прислівник: 'adverb',
  займенник: 'pronoun',
  числівник: 'numeral',
  прийменник: 'preposition',
  сполучник: 'conjunction',
  частка: 'particle',
  вигук: 'interjection',
  'доконаний вид': 'verb',
  'недоконаний вид': 'verb',
};

const REGISTERS: Readonly<Record<string, Register>> = {
  застаріле: 'archaic',
  діалектне: 'dialectal',
  книжне: 'bookish',
  розмовне: 'colloquial',
};

const KNOWN_LABELS = new Set([
  ...Object.keys(SUM_GENDERS),
  ...Object.keys(SUM_PARTS_OF_SPEECH),
  ...Object.keys(REGISTERS),
]);

function grammarOf(labels: readonly string[]): { partOfSpeech?: PartOfSpeech; gender?: string } {
  const genders = labels.flatMap((label) => {
    const gender = SUM_GENDERS[label];
    return gender === undefined ? [] : [gender];
  });
  // A gender wins over `множина`, which may just note a usual plural.
  const gender = genders.find((value) => value !== 'plural-only') ?? genders[0];
  if (gender !== undefined) return { partOfSpeech: 'noun', gender };
  for (const label of labels) {
    const partOfSpeech = SUM_PARTS_OF_SPEECH[label];
    if (partOfSpeech !== undefined) return { partOfSpeech };
  }
  return {};
}

function tagValues<T>(tags: readonly string[], values: Readonly<Record<string, T>>): T[] {
  return tags.flatMap((tag) => {
    const value = values[tag];
    return value === undefined ? [] : [value];
  });
}

/**
 * The author from a СУМ citation such as `Михайло Коцюбинський, II, 1955, 244`:
 * its first part when that reads as a person's name, not a book or a paper.
 */
function authorOf(citation: string | undefined): string | undefined {
  const first = citation?.split(',')[0]?.trim();
  if (first === undefined || first === '' || first.includes('.')) return undefined;
  const words = first.split(/[\s-]+/);
  return words.length <= 3 && words.every((word) => /^\p{Lu}/u.test(word)) ? first : undefined;
}

/** СУМ prints Examples without their final full stop. */
function asSentence(text: string): string {
  return /[.!?…»"”)\]]$/.test(text) ? text : `${text}.`;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
