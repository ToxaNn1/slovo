/**
 * Drafts Corrections from goroh.pp.ua «Слововживання»: a usage article's own
 * words as the explanation, the standard forms it names, the example pair it
 * prints and the citation it gives.
 */
import {
  CorrectionSchema,
  CorrectionTypeSchema,
  type CorrectionInput,
  type CorrectionType,
} from '@slovo/contracts';
import type { EditionFolder } from '@slovo/language-pack/edition';
import { parse, type HTMLElement } from 'node-html-parser';

import { errorMessage } from './error-message';
import { fetchGoroh, gorohUrl, LANGUAGE_MODEL } from './goroh';
import {
  draftIssues,
  runSourcing,
  type DraftContext,
  type KindDraft,
  type KindOutcome,
  type ParsedLine,
  type PipelineOptions,
  type SourcingResult,
} from './pipeline';
import type { Flag } from './review-report';
import { squeeze, unstressed } from './text';

export type CorrectionSourcingOptions = PipelineOptions & {
  /** One form per line: `<non-standard form> <correction type> <category id>`; `#` starts a comment. */
  readonly formList: string;
};

/**
 * Drafts Corrections for a list of non-standard forms and writes them with a
 * review report to the `corrections` folder of the review folder. A draft the
 * page leaves without an example pair or a standard equivalent, or with no
 * article about the form, is incomplete and flagged `missing-data`.
 */
export function sourceCorrections(options: CorrectionSourcingOptions): Promise<SourcingResult> {
  return runSourcing(options.formList, options, {
    entryKind: 'correction',
    folder: 'corrections',
    idPrefix: 'c_',
    parseLine: parseFormLine,
    start: (context) => (request) => draftCorrection(request, context),
  });
}

interface CorrectionRequest {
  readonly form: string;
  readonly correctionType: CorrectionType;
  readonly categoryId: string;
}

const LINE_SHAPE = 'Expected "<non-standard form> <correction type> <category id>"';

/** Reads `<non-standard form> <correction type> <category id>`; the form may be several words. */
function parseFormLine(content: string, edition: EditionFolder): ParsedLine<CorrectionRequest> {
  const fields = content.split(/\s+/);
  const categoryId = fields.pop();
  const typeText = fields.pop();
  if (fields.length === 0 || categoryId === undefined || typeText === undefined) {
    return { ok: false, text: undefined, errors: [LINE_SHAPE] };
  }
  const form = fields.join(' ').normalize('NFC');
  const errors: string[] = [];
  const correctionType = CorrectionTypeSchema.safeParse(typeText);
  if (!correctionType.success) errors.push(`Unknown Correction Type "${typeText}"`);
  if (!edition.config.correctionCategories.some((category) => category.id === categoryId)) {
    errors.push(`Unknown Category "${categoryId}"`);
  }
  if (!correctionType.success || errors.length > 0) return { ok: false, text: form, errors };
  return {
    ok: true,
    text: form,
    request: { form, correctionType: correctionType.data, categoryId },
  };
}

/** One usage article of a goroh «Слововживання» page, as the draft takes it. */
interface UsageArticle {
  readonly headword: string;
  readonly citation: string;
  readonly languageModel: boolean;
  readonly explanation: string;
  readonly standardEquivalents: readonly string[];
  readonly examplePair?: { readonly nonStandard: string; readonly standard: string };
}

async function draftCorrection(
  request: CorrectionRequest,
  context: DraftContext,
): Promise<KindOutcome> {
  const { form } = request;
  let page: string | undefined;
  try {
    page = await fetchGoroh(context.client, 'Слововживання', form);
  } catch (error) {
    return { drafts: [], flags: [{ kind: 'fetch-failed', message: errorMessage(error) }] };
  }
  if (page === undefined) {
    return {
      drafts: [],
      flags: [{ kind: 'no-entry', message: `goroh has no «Слововживання» article for "${form}"` }],
    };
  }

  const about = readUsageArticles(page, form).filter((article) =>
    namesForm(article.headword, form),
  );
  const flags: Flag[] = [];
  const byModel = about.filter((article) => article.languageModel);
  if (byModel.length > 0) {
    flags.push({
      kind: 'check',
      message: `goroh articles left out because «${LANGUAGE_MODEL}» wrote them: ${byModel.map((article) => article.headword).join('; ')}`,
    });
  }
  const usable = about.filter((article) => !article.languageModel);
  const article = usable.find((candidate) => candidate.examplePair !== undefined) ?? usable[0];
  return { drafts: [draftFrom(request, article, context)], flags };
}

function draftFrom(
  request: CorrectionRequest,
  article: UsageArticle | undefined,
  context: DraftContext,
): KindDraft {
  const { form } = request;
  const url = gorohUrl('Слововживання', form);
  const [mainEquivalent, ...otherEquivalents] = article?.standardEquivalents ?? [];
  const standardEquivalents: CorrectionInput['standardEquivalents'] | undefined =
    mainEquivalent === undefined ? undefined : [mainEquivalent, ...otherEquivalents];
  const examplePair =
    article?.examplePair === undefined ? undefined : withStandardFormMarked(article.examplePair);
  const draft = {
    id: context.newId(),
    nonStandardForm: form,
    correctionType: request.correctionType,
    ...(standardEquivalents === undefined ? {} : { standardEquivalents }),
    ...(article === undefined || article.explanation === ''
      ? {}
      : { explanation: article.explanation }),
    ...(examplePair === undefined ? {} : { examplePair }),
    categoryId: request.categoryId,
    sources: [
      article === undefined
        ? { title: 'Горох. Слововживання', url }
        : { title: article.citation, url },
    ],
  };
  const missing =
    article === undefined
      ? [`goroh has no article about "${form}" on its page`]
      : [
          ...(article.examplePair === undefined
            ? ['the article prints no example pair']
            : examplePair === undefined
              ? ['the example pair changes no word']
              : []),
          ...(article.standardEquivalents.length === 0
            ? ['the article names no standard equivalent']
            : []),
        ];
  return {
    entry: draft,
    headword: article?.headword ?? form,
    issues: checkDraft(draft, context.edition),
    flags: missing.map((message) => ({ kind: 'missing-data', message })),
    summary: {
      text: form,
      group: request.correctionType,
      examples: draft.examplePair === undefined ? 0 : 1,
      definition: draft.explanation ?? '',
    },
  };
}

/** The schema's verdict, then the build's own checks against the Edition, as `field: message`. */
function checkDraft(draft: Partial<CorrectionInput>, edition: EditionFolder): string[] {
  return draftIssues(
    CorrectionSchema,
    (valid) => edition.checkNewCorrections([valid]),
    '(correction)',
    draft,
  );
}

/** The mark goroh puts in front of the standard forms in a short usage article. */
const STANDARD_MARK = 'Правильніше:';

/** Reads every usage article of a «Слововживання» page. */
function readUsageArticles(html: string, form: string): UsageArticle[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .map((block): UsageArticle => {
      const citation = squeeze(block.querySelector('.source-info')?.text ?? '');
      const body = block.querySelector('.article-block__body');
      const pair = block
        .querySelectorAll('tbody tr')
        .map((row) => row.querySelectorAll('td').map((cell) => squeeze(cell.text)))
        .find((cells) => cells.length >= 2 && cells.every((cell) => cell !== ''));
      return {
        headword: squeeze(block.querySelector('h2')?.text ?? ''),
        citation,
        languageModel: citation.startsWith(LANGUAGE_MODEL),
        explanation: body === null ? '' : proseOf(body),
        standardEquivalents: body === null ? [] : standardFormsIn(body, form),
        ...(pair?.[0] === undefined || pair[1] === undefined
          ? {}
          : { examplePair: { nonStandard: pair[0], standard: pair[1] } }),
      };
    });
}

/** The article's own text: its body without the example table and the citation. */
function proseOf(body: HTMLElement): string {
  return squeeze(textPart(body).text);
}

/** A copy of an article's body without the example table and the citation. */
function textPart(body: HTMLElement): HTMLElement {
  const copy = parse(body.outerHTML);
  for (const part of copy.querySelectorAll('.table-container, table, .source-info')) part.remove();
  return copy;
}

/**
 * The standard forms an article names: those after «Правильніше:», or else
 * the emphasised forms of its text other than the non-standard one.
 */
function standardFormsIn(body: HTMLElement, form: string): string[] {
  const prose = proseOf(body);
  const marked = prose.indexOf(STANDARD_MARK);
  if (marked !== -1) {
    return unique(
      prose
        .slice(marked + STANDARD_MARK.length)
        .split(/[;,]/)
        .map(bareForm),
    );
  }
  const emphasised = textPart(body)
    .querySelectorAll('em')
    .map((element) => bareForm(element.text));
  return unique(emphasised.filter((emphasis) => !namesForm(emphasis, form)));
}

function bareForm(text: string): string {
  return squeeze(text).replace(/[.:;,]+$/, '');
}

function unique(forms: readonly string[]): string[] {
  return [...new Set(forms.filter((form) => form !== ''))];
}

/** Whether an article's headword names the form: its words, in order, ignoring case and Stress. */
function namesForm(headword: string, form: string): boolean {
  const words = (text: string) =>
    ` ${squeeze(
      unstressed(text)
        .toLocaleLowerCase('uk')
        .replace(/[^\p{L}'’ʼ-]+/gu, ' '),
    )} `;
  return words(headword).includes(words(form));
}

/**
 * Marks the words the standard sentence changes, the draft's guess at its
 * standard form (ADR 0117): words compared without case, Stress and
 * punctuation, each run of changed words marked on its own, its punctuation
 * left outside the marks. The author widens the marks to the whole phrase.
 * Undefined when the sentences change no word.
 */
function withStandardFormMarked(pair: {
  readonly nonStandard: string;
  readonly standard: string;
}): { readonly nonStandard: string; readonly standard: string } | undefined {
  const words = pair.standard.split(' ');
  const kept = keptWords(words.map(wordKey), pair.nonStandard.split(' ').map(wordKey));
  if (kept.every(Boolean)) return undefined;
  const parts: string[] = [];
  for (let start = 0; start < words.length;) {
    let end = start + 1;
    while (end < words.length && kept[end] === kept[start]) end += 1;
    const run = words.slice(start, end).join(' ');
    parts.push(kept[start] === true ? run : run.replace(/^(\P{L}*)(.*?)(\P{L}*)$/u, '$1**$2**$3'));
    start = end;
  }
  return { nonStandard: pair.nonStandard, standard: parts.join(' ') };
}

/** A word as compared: lowercase, without Stress and punctuation. */
function wordKey(word: string): string {
  return unstressed(word)
    .toLocaleLowerCase('uk')
    .replace(/[^\p{L}'’ʼ-]+/gu, '');
}

/**
 * Whether each word of `words` is kept from `said`: in a longest common
 * subsequence of the two, or has no letter to change.
 */
function keptWords(words: readonly string[], said: readonly string[]): boolean[] {
  const width = said.length + 1;
  const longest = Array.from({ length: (words.length + 1) * width }, () => 0);
  const at = (i: number, j: number) => longest[i * width + j] ?? 0;
  for (let i = words.length - 1; i >= 0; i -= 1) {
    for (let j = said.length - 1; j >= 0; j -= 1) {
      longest[i * width + j] =
        words[i] === said[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const kept = words.map((word) => !/\p{L}/u.test(word));
  for (let i = 0, j = 0; i < words.length && j < said.length;) {
    if (words[i] === said[j]) {
      kept[i] = true;
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) i += 1;
    else j += 1;
  }
  return kept;
}
