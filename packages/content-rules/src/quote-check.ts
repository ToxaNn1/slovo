/**
 * The quote check's matching: whether a record's quoted text is on its first
 * source's page (ADR 0084). Pure; the caller fetches the page. The Content CLI's
 * `verify` and the backend's quote check job both match through it.
 */
import { STRESS_MARK } from '@slovo/contracts';
import { parse } from 'node-html-parser';

const GOROH_HOST = 'goroh.pp.ua';

/** goroh's name for text a language model wrote; it is never quoted (ADR 0012). */
export const LANGUAGE_MODEL = 'Велика мовна модель';

/** One article block of a goroh page. */
export interface ArticleBlock {
  /** The headword as goroh shows it, with Stress marks. */
  readonly headword: string;
  /** The dictionary the block cites. */
  readonly dictionary: string;
  /** Whether a language model wrote the block rather than a dictionary. */
  readonly languageModel: boolean;
  /** The block's text, whitespace squeezed. */
  readonly text: string;
}

const squeezeSpaces = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Reads every article block of a goroh page, each with the dictionary it cites. */
export function readArticleBlocks(html: string): ArticleBlock[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .map((element) => {
      const dictionary = squeezeSpaces(element.querySelector('.source-info')?.text ?? '');
      return {
        headword: squeezeSpaces(element.querySelector('h2 .uppercase')?.text ?? ''),
        dictionary,
        languageModel: dictionary.startsWith(LANGUAGE_MODEL),
        text: squeezeSpaces(element.text),
      };
    });
}

/**
 * A homonym index is the digit a dictionary sets right after a lower-case
 * word (`склад1`); a digit after a capital letter is part of a name and
 * keeps its number: `СІС2` is the second edition of a dictionary.
 */
const HOMONYM_INDEX = new RegExp(`(?<=[\\p{Script=Cyrillic}&&\\p{Ll}]${STRESS_MARK}?)\\d+`, 'gv');

/**
 * Drops the homonym indexes from dictionary text: a reader of the Edition sees
 * `склад 1`, not `склад1 1`. The meaning number after the word stays.
 */
export function withoutHomonymIndexes(text: string): string {
  return text.replace(HOMONYM_INDEX, '');
}

/**
 * Lower case, without homonym indexes, spaces, quotation marks, apostrophes or
 * dashes: the 06.11 wave's comparison. The Edition drops the indexes a page
 * sets after a word, so `лю́тий` quotes the page's `лю́тий2`.
 */
export function squash(text: string): string {
  return withoutHomonymIndexes(text)
    .toLowerCase()
    .replace(/[\s’ʼ«»"„“”'–—-]/g, '');
}

export const withoutFinalPeriod = (text: string) => text.replace(/\.$/, '');

/** The field's first 40 characters, without a final period, compared squashed. */
export function quoteOf(text: string): string {
  return squash(withoutFinalPeriod(text).slice(0, 40));
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  bdquo: '„',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  shy: '',
};

/** A page's text: no scripts, styles or tags, entities decoded. */
export function plainText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity: string, name: string) => {
      if (name.startsWith('#')) {
        const code =
          name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
        return String.fromCodePoint(code);
      }
      return ENTITIES[name.toLowerCase()] ?? entity;
    });
}

/** A fetched source page. */
export interface SourcePage {
  readonly status: number;
  readonly body: string;
}

/** What the quote check found for one quote on its page. */
export type QuoteOutcome =
  | { readonly outcome: 'ok' }
  | { readonly outcome: 'miss'; readonly quote: string }
  | { readonly outcome: 'llm' }
  | { readonly outcome: 'fetch-failed'; readonly status: number };

/**
 * Whether the quote is on the page: anywhere in its text, and on goroh in an
 * article block a dictionary wrote, not a language model.
 */
export function quoteOnPage(text: string, url: string, page: SourcePage): QuoteOutcome {
  if (page.status !== 200) return { outcome: 'fetch-failed', status: page.status };
  const quote = quoteOf(text);
  const miss = { outcome: 'miss', quote } as const;
  if (new URL(url).host !== GOROH_HOST) {
    return squash(plainText(page.body)).includes(quote) ? { outcome: 'ok' } : miss;
  }
  const holding = readArticleBlocks(page.body).filter((block) =>
    squash(block.text).includes(quote),
  );
  if (holding.some((block) => !block.languageModel)) return { outcome: 'ok' };
  return holding.length > 0 ? { outcome: 'llm' } : miss;
}

/** A record the quote check reads: its first source's address and its quoted field. */
export type QuotedRecord =
  | {
      readonly kind: 'word' | 'idiom';
      readonly fields: QuoteSources & { readonly primaryDefinition: string };
    }
  | {
      readonly kind: 'correction' | 'tip';
      readonly fields: QuoteSources & { readonly explanation: string };
    }
  | { readonly kind: 'synonymRow'; readonly fields: QuoteSources & { readonly meaning: string } };

interface QuoteSources {
  readonly sources: readonly { readonly url?: string | undefined }[];
}

/** The text a record quotes from its first source (ADR 0084). */
export function quotedTextOf(record: QuotedRecord): string {
  switch (record.kind) {
    case 'word':
    case 'idiom':
      return record.fields.primaryDefinition;
    case 'correction':
    case 'tip':
      return record.fields.explanation;
    case 'synonymRow':
      return record.fields.meaning;
  }
}
