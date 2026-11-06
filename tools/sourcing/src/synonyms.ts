import {
  SHADE_NOTE_MAX_LENGTH,
  SynonymRowSchema,
  type SynonymRowInput,
  type SynonymRowMember,
} from '@slovo/contracts';
import type { EditionFolder } from '@slovo/language-pack/edition';

import { errorMessage } from './error-message';
import {
  fetchGoroh,
  gorohUrl,
  readArticleBlocks,
  readSynonymArticles,
  type GorohSynonymArticle,
} from './goroh';
import {
  runSourcing,
  type DraftContext,
  type KindDraft,
  type KindOutcome,
  type ParsedLine,
  type PipelineOptions,
  type SourcingKind,
  type SourcingResult,
} from './pipeline';
import type { Flag } from './review-report';
import { matchKey, readStress, squeeze, unstressed } from './text';
import { isCrossReference } from './word-filters';

export type SynonymSourcingOptions = PipelineOptions & {
  /**
   * The Synonym Rows to draft, one per line: `<dominant>[:<sense number>]`,
   * the sense number counting goroh's synonym articles for the dominant from 1
   * (1 when left out); `#` starts a comment.
   */
  readonly list: string;
};

/** Drafts Synonym Rows from goroh's synonym dictionaries for a human to review. */
export function sourceSynonyms(options: SynonymSourcingOptions): Promise<SourcingResult> {
  return runSourcing(options.list, options, synonymsKind);
}

interface RowRequest {
  readonly dominant: string;
  readonly sense: number;
}

const synonymsKind: SourcingKind<RowRequest> = {
  folder: 'synonyms',
  idPrefix: 'r_',
  parseLine: parseRowLine,
  start: (context) => (request) => draftRow(request, context),
};

const MIN_MEMBERS = 5;
const MAX_MEMBERS = 12;
const VOWELS = /[аеєиіїоуюя]/giu;

function parseRowLine(content: string): ParsedLine<RowRequest> {
  const separator = content.lastIndexOf(':');
  const dominant = (separator === -1 ? content : content.slice(0, separator)).normalize('NFC');
  const senseText = separator === -1 ? '1' : content.slice(separator + 1);
  const text = `${dominant}:${senseText}`;
  const errors: string[] = [];
  if (dominant === '' || /\s/.test(dominant)) {
    errors.push('Expected "<dominant>[:<sense number>]"');
  }
  if (dominant !== unstressed(dominant)) {
    errors.push(`Write the dominant "${dominant}" without stress marks`);
  }
  if (!/^[1-9]\d*$/.test(senseText)) {
    errors.push(`Expected a sense number of 1 or more after ":", not "${senseText}"`);
  }
  if (errors.length > 0) return { ok: false, text: dominant === '' ? undefined : text, errors };
  return { ok: true, text, request: { dominant, sense: Number(senseText) } };
}

async function draftRow(request: RowRequest, context: DraftContext): Promise<KindOutcome> {
  const { dominant, sense } = request;
  let page: string | undefined;
  try {
    page = await fetchGoroh(context.client, 'Синонімія', dominant);
  } catch (error) {
    return { drafts: [], flags: [{ kind: 'fetch-failed', message: errorMessage(error) }] };
  }
  const url = gorohUrl('Синонімія', dominant);
  if (page === undefined) {
    return { drafts: [], flags: [{ kind: 'no-entry', message: `goroh has no page ${url}` }] };
  }
  const articles = readSynonymArticles(page, dominant);
  const article = articles[sense - 1];
  if (article === undefined) {
    const message =
      articles.length > 0
        ? `${url} has ${String(articles.length)} synonym articles for "${dominant}", not ${String(sense)}`
        : readArticleBlocks(page).some((block) => block.languageModel)
          ? `${url} has only text a language model wrote, which is never quoted`
          : `${url} has no article from a synonym dictionary for "${dominant}"`;
    return { drafts: [], flags: [{ kind: 'no-entry', message }] };
  }
  return { drafts: [draftOf(article, url, context)], flags: [] };
}

function draftOf(article: GorohSynonymArticle, url: string, context: DraftContext): KindDraft {
  const flags: Flag[] = [];
  const dominant = rowWord(article.headword, flags);
  const lemmas = lemmaIds(context.edition);
  const seen = new Set([matchKey(dominant.text)]);
  const members: SynonymRowMember[] = [];
  for (const { headword, note } of article.members) {
    const word = rowWord(headword, flags);
    const key = matchKey(word.text);
    if (seen.has(key)) continue;
    seen.add(key);
    const shadeNote = shadeNoteOf(note, dominant.text);
    members.push({
      ...word,
      ...wordIdOf(lemmas, word.text),
      ...(shadeNote === undefined ? {} : { shadeNote }),
    });
  }
  if (members.length < MIN_MEMBERS || members.length > MAX_MEMBERS) {
    flags.push({
      kind: 'missing-data',
      message: `The article has ${String(members.length)} members; a Synonym Row takes ${String(MIN_MEMBERS)} to ${String(MAX_MEMBERS)}`,
    });
  }
  const meaning = sentence(article.sense);
  if (meaning === '') {
    flags.push({ kind: 'missing-data', message: 'The article names no sense for the dominant' });
  }
  const row: SynonymRowInput = {
    id: context.newId(),
    dominant: { ...dominant, ...wordIdOf(lemmas, dominant.text) },
    meaning,
    members,
    sources: [{ title: `Горох: синонімія (${article.dictionary}), «${dominant.text}»`, url }],
  };
  return {
    entry: row,
    headword: article.headword,
    issues: issuesOf(row, context.edition),
    flags,
    summary: { text: dominant.text, group: '—', examples: 0, definition: meaning },
  };
}

/** A word of the row from its marked headword; Stress goes on the only vowel when goroh marks none. */
function rowWord(headword: string, flags: Flag[]): { text: string; stress: number[] } {
  const marked = squeeze(headword).replace(/[’ʼ`]/g, "'").normalize('NFC');
  const text = unstressed(marked);
  const stress = readStress(marked);
  if (stress.length > 0) return { text, stress };
  const vowels = [...text.matchAll(VOWELS)];
  const [only] = vowels;
  if (vowels.length === 1 && only !== undefined) return { text, stress: [only.index] };
  flags.push({ kind: 'stress-unresolved', message: `goroh marks no Stress on "${text}"` });
  return { text, stress: [] };
}

/** The Edition's Words that are not Retired, by Lemma; a Lemma of several Words links none. */
function lemmaIds(edition: EditionFolder): Map<string, string | undefined> {
  const ids = new Map<string, string | undefined>();
  for (const entry of edition.entryTexts()) {
    if (entry.kind !== 'word' || entry.retired) continue;
    ids.set(entry.text, ids.has(entry.text) ? undefined : entry.id);
  }
  return ids;
}

function wordIdOf(lemmas: Map<string, string | undefined>, text: string): { wordId?: string } {
  const wordId = lemmas.get(text);
  return wordId === undefined ? {} : { wordId };
}

/** A member's gloss as a shade note: none when it only points to another word or names the dominant. */
function shadeNoteOf(note: string, dominant: string): string | undefined {
  const trimmed = withoutTrailingPunctuation(note);
  if (trimmed === '' || isCrossReference(trimmed) || matchKey(trimmed) === matchKey(dominant)) {
    return undefined;
  }
  if (trimmed.length <= SHADE_NOTE_MAX_LENGTH) return trimmed;
  const cut = trimmed.slice(0, SHADE_NOTE_MAX_LENGTH + 1);
  const space = cut.lastIndexOf(' ');
  return withoutTrailingPunctuation(space > 0 ? cut.slice(0, space) : cut.slice(0, -1));
}

function withoutTrailingPunctuation(text: string): string {
  return text.replace(/[\s.;,:]+$/u, '');
}

/** A sense line as a sentence: a capital first letter and a full stop. */
function sentence(sense: string): string {
  const text = withoutTrailingPunctuation(unstressed(sense));
  return text === '' ? '' : `${text.charAt(0).toLocaleUpperCase('uk')}${text.slice(1)}.`;
}

function issuesOf(row: SynonymRowInput, edition: EditionFolder): string[] {
  const result = SynonymRowSchema.safeParse(row);
  const issues = result.success
    ? edition
        .checkNewSynonymRows([result.data])
        .map(({ field, message }) => `${field ?? '(row)'}: ${message}`)
    : result.error.issues.map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`);
  return [...new Set(issues)];
}
