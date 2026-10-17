import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  WordSchema,
  type EditionConfig,
  type Example,
  type Gender,
  type PartOfSpeech,
  type Register,
  type Source,
  type WordInput,
} from '@slovo/contracts';
import { formatBuildError } from '@slovo/language-pack';
import { EditionFolderError, type EditionFolder } from '@slovo/language-pack/edition';

import {
  fetchGoroh,
  gorohUrl,
  isSameWord,
  parseDefinitions,
  parseEtymologies,
  parseInflections,
  parseSynonymGroups,
  type GorohEtymology,
  type GorohInflection,
  type GorohSynonymGroup,
} from './goroh';
import { errorMessage } from './error-message';
import { PoliteClient, type Clock, type Fetch } from './polite-client';
import { formatReviewReport } from './report';
import type { DraftOutcome, Flag, FlagKind, LemmaOutcome, ReviewReport } from './review-report';
import type { DictionaryArticle } from './article';
import { SumDictionary, type SumAccess } from './sum';
import { matchKey, readStress, SOURCE_LANGUAGE, unstressed } from './text';

export interface SourcingOptions {
  /** The Lemmas to draft, one per line: `<lemma> <category id> <rarity>`; `#` starts a comment. */
  readonly lemmaList: string;
  /** The Edition the drafts are for: its Categories, language traits, id registry and content. */
  readonly edition: EditionFolder;
  /** The review folder: drafts, incomplete drafts and the review report go here. */
  readonly outDir: string;
  /**
   * Where fetched pages and each host's request schedule are kept. Runs that
   * share it never fetch a page twice and share the throttle.
   */
  readonly cacheDir: string;
  readonly fetch: Fetch;
  readonly clock: Clock;
  /** A source of numbers in [0, 1), for new Word ids. */
  readonly random: () => number;
  readonly sumAccess?: SumAccess;
  /** The least time between two requests to one host, across every process sharing the cache. */
  readonly minIntervalMs?: number;
  /** Hears about back-offs and hosts taken out of the run. */
  readonly log?: (message: string) => void;
}

export type SourcingResult =
  | { readonly ok: true; readonly report: ReviewReport }
  | { readonly ok: false; readonly errors: readonly string[] };

export const REPORT_FILE = 'review-report.md';
const DRAFTS_DIR = 'drafts';
const INCOMPLETE_DIR = 'incomplete';
const DEFAULT_MIN_INTERVAL_MS = 2000;

/**
 * Drafts Words for a list of Lemmas from goroh.pp.ua (its explanatory
 * dictionaries, inflection, synonym and etymological dictionaries), with
 * СУМ-11 on sum.in.ua or its Wayback Machine copies as a fallback for
 * Definitions, and writes them with a review report to
 * the review folder. Every field comes from a source; what the sources leave
 * open stays empty and is flagged for a human.
 */
export async function sourceWords(options: SourcingOptions): Promise<SourcingResult> {
  const { edition } = options;
  const takenIds = readTakenIds(edition);
  if (!takenIds.ok) return { ok: false, errors: takenIds.errors };
  const { locale } = edition.config;
  if (new Intl.Locale(locale).language !== SOURCE_LANGUAGE) {
    return {
      ok: false,
      errors: [`The sources are Ukrainian dictionaries, but the Edition is in ${locale}`],
    };
  }
  const list = parseLemmaList(options.lemmaList, edition.config);
  if (!list.ok) return { ok: false, errors: list.errors };

  const client = new PoliteClient(
    options.fetch,
    options.clock,
    options.cacheDir,
    options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    options.log,
  );
  const sum = new SumDictionary(client, options.sumAccess ?? 'auto');
  const newId = idMaker(options.random, takenIds.ids);

  for (const dir of [DRAFTS_DIR, INCOMPLETE_DIR]) {
    rmSync(join(options.outDir, dir), { recursive: true, force: true });
    mkdirSync(join(options.outDir, dir), { recursive: true });
  }

  const lemmas: LemmaOutcome[] = [];
  for (const request of list.requests) {
    const outcome = await draftLemma(request, {
      client,
      sum,
      newId,
      edition,
    });
    for (const draft of outcome.drafts) {
      writeFileSync(
        join(options.outDir, draft.outcome.file),
        `${JSON.stringify(draft.word, null, 2)}\n`,
      );
    }
    lemmas.push({ ...outcome, drafts: outcome.drafts.map((draft) => draft.outcome) });
  }

  const report: ReviewReport = {
    lemmas,
    requests: { ...client.stats, unreachable: { ...client.stats.unreachable } },
  };
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

/** The ids the Edition's id registry lists; none when it has no registry yet. */
function readTakenIds(
  edition: EditionFolder,
): { ok: true; ids: Set<string> } | { ok: false; errors: string[] } {
  try {
    return { ok: true, ids: new Set(edition.readIfPresent('idRegistry')) };
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    return { ok: false, errors: error.errors.map(formatBuildError) };
  }
}

/** New opaque Word ids that the Edition's id registry doesn't list, and no draft of this run has. */
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
  readonly edition: EditionFolder;
}

/**
 * A Word as drafted: the authored shape, except that the sources may leave the
 * part of speech and the primary Definition open. A draft without them fails
 * the schema and goes to the incomplete folder.
 */
type WordDraft = Omit<WordInput, 'partOfSpeech' | 'primaryDefinition'> &
  Partial<Pick<WordInput, 'partOfSpeech' | 'primaryDefinition'>>;

interface Draft {
  readonly word: WordDraft;
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
  let articles: readonly DictionaryArticle[];
  let goroh: GorohEntry;
  try {
    // Definitions: goroh's explanatory dictionaries first, sum.in.ua only as a fallback.
    const definitionsPage = await fetchGoroh(context.client, 'Тлумачення', lemma);
    const definitions =
      definitionsPage === undefined
        ? { articles: [], leftOut: [] }
        : parseDefinitions(definitionsPage, lemma);
    if (definitions.leftOut.length > 0) {
      flags.push({
        kind: 'check',
        message: `goroh articles left out because they don't come from an explanatory dictionary: ${definitions.leftOut.join('; ')}`,
      });
    }
    articles = definitions.articles;
    if (articles.length === 0) {
      const lookup = await context.sum.lookUp(lemma);
      if (!lookup.found) {
        const tried = [gorohUrl('Тлумачення', lemma), ...lookup.tried];
        flags.push({
          kind: 'no-entry',
          message: `No dictionary entry found; tried ${tried.join(', ')}`,
        });
        return { lemma, line, drafts: [], flags };
      }
      articles = lookup.articles.filter((article) => sumKey(article.headword) === sumKey(lemma));
      if (articles.length === 0) {
        flags.push({
          kind: 'no-entry',
          message: `${lookup.articles[0]?.source.url ?? 'sum.in.ua'} has no article for "${lemma}" (it has ${lookup.articles.map((article) => article.headword).join(', ')})`,
        });
        return { lemma, line, drafts: [], flags };
      }
    }

    // The inflection dictionary is only asked when an article lacks Stress or grammar.
    const needsInflections = articles.some((article) => {
      const grammar = grammarOf(article.labels);
      return (
        readStress(article.headword).length === 0 ||
        grammar.partOfSpeech === undefined ||
        (grammar.partOfSpeech === 'noun' && grammar.gender === undefined)
      );
    });
    const inflection = needsInflections
      ? await fetchGoroh(context.client, 'Словозміна', lemma)
      : undefined;
    const synonyms = await fetchGoroh(context.client, 'Синонімія', lemma);
    const etymology = await fetchGoroh(context.client, 'Етимологія', lemma);
    goroh = {
      inflections: inflection === undefined ? [] : parseInflections(inflection, lemma),
      synonymGroups: synonyms === undefined ? [] : parseSynonymGroups(synonyms, lemma),
      etymologies: etymology === undefined ? [] : parseEtymologies(etymology),
    };
    if (needsInflections && goroh.inflections.length === 0) {
      flags.push({
        kind: 'check',
        message:
          'goroh has no inflection entry: Stress and grammar come from the explanatory dictionary only',
      });
    }
  } catch (error) {
    flags.push({ kind: 'fetch-failed', message: errorMessage(error) });
    return { lemma, line, drafts: [], flags };
  }

  const isHomonym = articles.length > 1;
  if (isHomonym) {
    flags.push({
      kind: 'homonym',
      message: `The dictionary has ${String(articles.length)} homonyms, drafted as separate Words; check each one is worth keeping`,
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
    draftArticle(article, { request, goroh, isHomonym, context }),
  );
  return { lemma, line, drafts, flags };
}

function draftArticle(
  article: DictionaryArticle,
  {
    request,
    goroh,
    isHomonym,
    context,
  }: {
    request: WordRequest;
    goroh: GorohEntry;
    isHomonym: boolean;
    context: Context;
  },
): Draft {
  const { lemma } = request;
  const headword = [article.headword, article.homonymNumber]
    .filter((part) => part !== undefined)
    .join(' ');
  const stress = draftStress(article, goroh, lemma);
  const grammar = draftGrammar(article, goroh, isHomonym);
  const definitions = draftDefinitions(article);
  const examples = draftExamples(article);
  const synonyms = draftSynonyms(goroh, lemma, isHomonym);
  const etymology = draftEtymology(goroh, lemma, isHomonym);

  const sources: Source[] = [article.source];
  if (stress.usedInflections || grammar.usedInflections)
    sources.push({ title: 'Горох: словозміна', url: gorohUrl('Словозміна', lemma) });
  sources.push(...synonyms.sources, ...etymology.sources);

  const word = compact<WordDraft>({
    id: context.newId(),
    lemma,
    stress: stress.stress,
    partOfSpeech: grammar.partOfSpeech,
    gender: grammar.gender,
    primaryDefinition: definitions.primaryDefinition,
    extraDefinitions: definitions.extraDefinitions,
    examples: examples.examples,
    synonyms: synonyms.synonyms,
    etymology: etymology.etymology,
    registers: definitions.registers,
    categoryId: request.categoryId,
    rarity: request.rarity,
    sources,
  });

  const flags: Flag[] = [
    ...headwordFlags(article, headword, lemma, isHomonym),
    ...stress.flags,
    ...grammar.flags,
    ...definitions.flags,
    ...examples.flags,
    ...synonyms.flags,
    ...etymology.flags,
  ];
  if (grammar.gender === 'plural-only') {
    flags.push({ kind: 'plural-only', message: 'A plural-only noun' });
  }
  const issues = checkDraft(word, context.edition);
  const ready = issues.length === 0;
  return {
    word,
    outcome: {
      id: word.id,
      file: `${ready ? DRAFTS_DIR : INCOMPLETE_DIR}/${word.id}.json`,
      ready,
      headword,
      issues,
      flags,
    },
  };
}

/** What a drafting step found, with what a human must look at. */
type Step<T> = T & { readonly flags: readonly Flag[] };

/** A step's result with the sources it drew on, which the draft cites. */
type Cited<T> = Step<T> & { readonly sources: readonly Source[] };

function flagOf(kind: FlagKind, message: string): Flag {
  return { kind, message };
}

function headwordFlags(
  article: DictionaryArticle,
  headword: string,
  lemma: string,
  isHomonym: boolean,
): Flag[] {
  const flags: Flag[] = [];
  if (isHomonym) {
    flags.push(
      flagOf(
        'homonym',
        `One of the homonyms: ${headword} — ${article.definitions[0]?.text ?? '(no Definition)'}`,
      ),
    );
  }
  if (matchKey(article.headword) !== matchKey(lemma)) {
    flags.push(
      flagOf(
        'spelling-differs',
        `The dictionary spells the headword ${unstressed(article.headword)}`,
      ),
    );
  }
  return flags;
}

/** Stress: the article's own mark, checked against the inflection dictionary. */
function draftStress(
  article: DictionaryArticle,
  goroh: GorohEntry,
  lemma: string,
): Step<{ stress: number[] | undefined; usedInflections: boolean }> {
  const flags: Flag[] = [];
  const articleStress = readStress(article.headword);
  const candidates = uniqueStresses(goroh.inflections);
  let stress: number[] | undefined;
  let usedInflections = false;
  if (articleStress.length > 0) {
    stress = articleStress;
    if (candidates.some((candidate) => sameNumbers(candidate.stress, articleStress))) {
      usedInflections = true;
    } else if (candidates.length > 0) {
      flags.push(
        flagOf(
          'sources-disagree',
          `Stress: the explanatory dictionary has ${article.headword}, goroh's inflection dictionary has ${candidates.map((candidate) => candidate.headword).join(', ')}; the draft keeps ${article.headword}`,
        ),
      );
    }
  } else if (candidates.length === 1) {
    stress = candidates[0]?.stress;
    usedInflections = true;
  } else if (candidates.length === 0) {
    flags.push(flagOf('stress-unresolved', 'No source marks the Stress'));
  } else {
    flags.push(
      flagOf(
        'stress-unresolved',
        `goroh lists different Stresses for "${lemma}": ${candidates
          .map((candidate) => [candidate.headword, candidate.gloss].filter(Boolean).join(' '))
          .join(', ')}`,
      ),
    );
  }
  if (stress !== undefined && stress.length > 1) {
    flags.push(
      flagOf(
        'several-stresses',
        `Several valid Stresses: ${articleStress.length > 0 ? article.headword : (goroh.inflections[0]?.headword ?? lemma)}`,
      ),
    );
  }
  return { stress, usedInflections, flags };
}

/**
 * Part of speech and gender: the article's own labels first, then goroh's
 * entries for the same word (same Stress, when the article marks it).
 */
function draftGrammar(
  article: DictionaryArticle,
  goroh: GorohEntry,
  isHomonym: boolean,
): Step<{
  partOfSpeech: PartOfSpeech | undefined;
  gender: Gender | undefined;
  usedInflections: boolean;
}> {
  const flags: Flag[] = [];
  let usedInflections = false;
  const articleStress = readStress(article.headword);
  const sumGrammar = grammarOf(article.labels);
  const sameWord =
    articleStress.length > 0
      ? goroh.inflections.filter((entry) => sameNumbers(readStress(entry.headword), articleStress))
      : goroh.inflections;
  const gorohParts = unique(sameWord.flatMap((entry) => tagValues(entry.tags, PARTS_OF_SPEECH)));
  let partOfSpeech = sumGrammar.partOfSpeech;
  if (partOfSpeech === undefined && gorohParts.length === 1) {
    partOfSpeech = gorohParts[0];
    usedInflections = true;
  } else if (partOfSpeech === undefined) {
    flags.push(
      flagOf(
        'missing-data',
        gorohParts.length === 0
          ? 'No source names the part of speech'
          : `goroh names several parts of speech: ${gorohParts.join(', ')}`,
      ),
    );
  } else if (!isHomonym && gorohParts.length === 1 && gorohParts[0] !== partOfSpeech) {
    flags.push(
      flagOf(
        'sources-disagree',
        `Part of speech: the explanatory dictionary has ${partOfSpeech}, goroh ${String(gorohParts[0])}`,
      ),
    );
  }

  let gender: Gender | undefined;
  if (partOfSpeech === 'noun') {
    const gorohGenders = unique(
      sameWord
        .filter((entry) => entry.tags.includes('іменник'))
        .flatMap((entry) => tagValues(entry.tags, GENDERS)),
    );
    gender = sumGrammar.gender;
    if (gender === undefined && gorohGenders.length === 1) {
      gender = gorohGenders[0];
      usedInflections = true;
    } else if (gender === undefined) {
      flags.push(flagOf('missing-data', 'No source names the gender'));
    } else if (!isHomonym && gorohGenders.length === 1 && gorohGenders[0] !== gender) {
      flags.push(
        flagOf(
          'sources-disagree',
          `Gender: the explanatory dictionary has ${gender}, goroh ${String(gorohGenders[0])}`,
        ),
      );
    }
  }
  return { partOfSpeech, gender, usedInflections, flags };
}

/** The Definitions, and the Registers among the labels of the article and its primary Definition. */
function draftDefinitions(article: DictionaryArticle): Step<{
  primaryDefinition: string | undefined;
  extraDefinitions: string[];
  registers: Register[];
}> {
  const flags: Flag[] = [];
  const [primary, ...extra] = article.definitions;
  const labels = [...article.labels, ...(primary?.labels ?? [])];
  const registers = unique(
    labels.flatMap((label) => {
      const register = REGISTERS[label];
      return register === undefined ? [] : [register];
    }),
  );
  const otherLabels = unique(labels.filter((label) => !KNOWN_LABELS.has(label)));
  if (otherLabels.length > 0) {
    flags.push(
      flagOf('other-labels', `Dictionary labels not carried over: ${otherLabels.join(', ')}`),
    );
  }
  const labelledMeanings = extra.filter((definition) => definition.labels.length > 0);
  if (labelledMeanings.length > 0) {
    flags.push(
      flagOf(
        'other-labels',
        `Labels of other meanings, not carried over: ${labelledMeanings
          .map((definition) => `«${definition.text}» ${unique(definition.labels).join(', ')}`)
          .join('; ')}`,
      ),
    );
  }
  return {
    primaryDefinition: primary?.text,
    extraDefinitions: extra.map((definition) => definition.text),
    registers,
    flags,
  };
}

function draftExamples(article: DictionaryArticle): Step<{ examples: Example[] }> {
  const flags: Flag[] = [];
  if (article.unmarkedExamples) {
    flags.push(
      flagOf(
        'unmarked-examples',
        'sum.in.ua prints some Examples without italics; they are left out, and the Definition is cut at its first sentence',
      ),
    );
  }
  const examples = article.examples.map((example): Example => {
    const author = authorOf(example.citation);
    return { text: asSentence(example.text), ...(author === undefined ? {} : { author }) };
  });
  return { examples, flags };
}

/** goroh's Synonyms from its synonym dictionaries; a homonym's are assigned by hand. */
function draftSynonyms(
  goroh: GorohEntry,
  lemma: string,
  isHomonym: boolean,
): Cited<{ synonyms: string[] }> {
  if (isHomonym || goroh.synonymGroups.length === 0)
    return { synonyms: [], sources: [], flags: [] };
  const flags: Flag[] = [];
  const sources: Source[] = [];
  const taken = goroh.synonymGroups.filter((group) => isSynonymDictionary(group.dictionary));
  const leftOut = goroh.synonymGroups.filter((group) => !isSynonymDictionary(group.dictionary));
  const synonyms = unique(taken.flatMap((group) => group.synonyms)).filter(
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
    flags.push(
      flagOf(
        'check',
        `goroh words left out because they don't come from a synonym dictionary: ${leftOut
          .map((group) => `${group.dictionary ?? '(no dictionary)'}: ${group.synonyms.join(', ')}`)
          .join('; ')}`,
      ),
    );
  }
  return { synonyms, sources, flags };
}

/** The etymology of the one ЕСУМ article about the Lemma; a homonym's is assigned by hand. */
function draftEtymology(
  goroh: GorohEntry,
  lemma: string,
  isHomonym: boolean,
): Cited<{ etymology: string | undefined }> {
  if (isHomonym) return { etymology: undefined, sources: [], flags: [] };
  const { entries, underOtherHeadword } = matchingEtymologies(goroh.etymologies, lemma);
  const [chosen] = entries;
  if (entries.length === 1 && chosen !== undefined && chosen.text !== '') {
    return {
      etymology: chosen.text.replace(/;$/, '.'),
      sources: [
        {
          title: underOtherHeadword
            ? `Горох: етимологія (Етимологічний словник української мови, стаття «${chosen.headword}»)`
            : 'Горох: етимологія (Етимологічний словник української мови)',
          url: gorohUrl('Етимологія', lemma),
        },
      ],
      flags: underOtherHeadword
        ? [
            flagOf(
              'check',
              `The etymology is that of the ЕСУМ article ${describeEtymology(chosen)}, which lists "${lemma}"`,
            ),
          ]
        : [],
    };
  }
  return {
    etymology: undefined,
    sources: [],
    flags:
      entries.length > 1
        ? [
            flagOf(
              'needs-assignment',
              `Several ЕСУМ articles fit: ${entries.map(describeEtymology).join('; ')}`,
            ),
          ]
        : [],
  };
}

/**
 * The schema's verdict, then the build's own checks against the Edition's
 * content, as `field: message`. The build checks need a Word that passed the
 * schema, so they run once it does.
 */
function checkDraft(word: WordDraft, edition: EditionFolder): string[] {
  const result = WordSchema.safeParse(word);
  const issues = result.success
    ? edition
        .checkNewWords([result.data])
        .map(({ field, message }) => `${field ?? '(word)'}: ${message}`)
    : result.error.issues.map((issue) => `${issue.path.join('.') || '(word)'}: ${issue.message}`);
  return unique(issues);
}

/** A draft's fields as they are gathered: an optional one may still be missing. */
type Gathered<T> = { [K in keyof T]: object extends Pick<T, K> ? T[K] | undefined : T[K] };

/**
 * Drops empty lists and missing values, so drafts read like authored content.
 * The draft keeps a required field only when its source gave one.
 */
function compact<T extends object>(fields: Gathered<T>): T {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0),
    ),
  ) as T;
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

const GENDERS: Readonly<Record<string, Gender>> = {
  'чоловічий рід': 'masculine',
  'жіночий рід': 'feminine',
  'середній рід': 'neuter',
  'спільний рід': 'common',
  множинний: 'plural-only',
};

/** СУМ labels by their full names. A gender label marks a noun; `множина` after the headword marks a plural-only noun. */
const SUM_GENDERS: Readonly<Record<string, Gender>> = {
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

/** Register labels by their full names: sum.in.ua says `діалектне`, goroh `діалектизм`. */
const REGISTERS: Readonly<Record<string, Register>> = {
  застаріле: 'archaic',
  діалектне: 'dialectal',
  діалектизм: 'dialectal',
  книжне: 'bookish',
  розмовне: 'colloquial',
};

const KNOWN_LABELS = new Set([
  ...Object.keys(SUM_GENDERS),
  ...Object.keys(SUM_PARTS_OF_SPEECH),
  ...Object.keys(REGISTERS),
]);

function grammarOf(labels: readonly string[]): { partOfSpeech?: PartOfSpeech; gender?: Gender } {
  const genders = labels.flatMap((label) => {
    const gender = SUM_GENDERS[label];
    return gender === undefined ? [] : [gender];
  });
  // After a verb's endings, `множина` introduces its plural form (`мн. гарка́влять`).
  const isVerb = labels.some((label) => SUM_PARTS_OF_SPEECH[label] === 'verb');
  if (isVerb && genders.every((gender) => gender === 'plural-only'))
    return { partOfSpeech: 'verb' };
  if (genders.length > 0) {
    // A gender wins over `множина`, which may just note a usual plural; two
    // genders (`ч. і ж.`) leave the choice to a human.
    const proper = unique(genders.filter((value) => value !== 'plural-only'));
    if (proper.length > 1) return { partOfSpeech: 'noun' };
    return { partOfSpeech: 'noun', gender: proper[0] ?? 'plural-only' };
  }
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
 * The author from a citation such as `Михайло Коцюбинський, II, 1955, 244`,
 * `В. Кучер`, `Іван Ле` or `Б.-І. Антонич`: its first part when that reads as
 * a person's name (initials allowed), not a book, a paper or `із журналу`.
 */
function authorOf(citation: string | undefined): string | undefined {
  const first = citation?.split(',')[0]?.trim();
  if (first === undefined || first === '') return undefined;
  const words = first.split(/\s+/);
  const surname = words.at(-1) ?? '';
  const isName =
    words.length <= 4 &&
    words.every((word) => /^\p{Lu}/u.test(word)) &&
    !surname.endsWith('.') &&
    Array.from(surname).length >= 2 &&
    words
      .slice(0, -1)
      .every((word) => !word.endsWith('.') || /^\p{Lu}\.(?:-\p{Lu}\.)*$/u.test(word));
  return isName ? first : undefined;
}

/** sum.in.ua prints Examples without their final full stop. */
function asSentence(text: string): string {
  return /[.!?…»"”)\]]$/.test(text) ? text : `${text}.`;
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
