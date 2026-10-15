/**
 * СУМ-11, the 11-volume academic dictionary, as published on sum.in.ua:
 * finding a Lemma's page, directly or through the Wayback Machine, and
 * reading its articles.
 */
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';

import type { ArticleDefinition, ArticleExample, DictionaryArticle } from './article';
import { HostUnreachableError, type PoliteClient } from './polite-client';
import { matchKey, squeeze } from './text';

/** How to reach sum.in.ua: try the site and fall back to the archive, use one of them only, or neither. */
export type SumAccess = 'auto' | 'direct' | 'wayback' | 'off';

export type SumLookup =
  | { readonly found: true; readonly articles: readonly DictionaryArticle[] }
  | { readonly found: false; readonly tried: readonly string[] };

const SITE = 'https://sum.in.ua/s/';
const WAYBACK = 'https://web.archive.org/web/';
const CDX = 'https://web.archive.org/cdx/search/cdx';

/**
 * Reaches sum.in.ua or its Wayback Machine copies, as a fallback only: one
 * quick try each, and a host that fails is left alone for the rest of the run.
 */
export class SumDictionary {
  constructor(
    private readonly client: PoliteClient,
    private readonly access: SumAccess,
  ) {}

  async lookUp(lemma: string): Promise<SumLookup> {
    const tried: string[] = [];
    if (this.access === 'off') return { found: false, tried };
    for (const slug of sumSlugs(lemma)) {
      const url = SITE + slug;
      // A page found in the archive on an earlier run is read from the cache again.
      const archived = this.access === 'auto' && this.client.isCached(cdxQuery(slug));
      if (this.access !== 'wayback' && !archived) {
        const articles = await this.reach(() => this.fromSite(url));
        if (articles !== 'unreachable') {
          if (articles !== undefined) return { found: true, articles };
          tried.push(url);
          continue;
        }
        if (this.access === 'direct') {
          tried.push(`${url} (unreachable)`);
          continue;
        }
      }
      const articles = await this.reach(() => this.fromWayback(slug, url));
      if (articles !== undefined && articles !== 'unreachable') return { found: true, articles };
      tried.push(`${url} (Wayback Machine${articles === 'unreachable' ? ', unreachable' : ''})`);
    }
    return { found: false, tried };
  }

  /** Runs a lookup that a skipped host turns into `unreachable`. */
  private async reach(
    lookUp: () => Promise<DictionaryArticle[] | undefined>,
  ): Promise<DictionaryArticle[] | undefined | 'unreachable'> {
    try {
      return await lookUp();
    } catch (error) {
      if (error instanceof HostUnreachableError) return 'unreachable';
      throw error;
    }
  }

  private async fromSite(url: string): Promise<DictionaryArticle[] | undefined> {
    const response = await this.client.get(url, { fallback: true });
    if (response.status !== 200) return undefined;
    const articles = parseSumPage(response.body, { url });
    return articles.length === 0 ? undefined : articles;
  }

  /** The newest archived copy of the page, if the Wayback Machine has one. */
  private async fromWayback(slug: string, url: string): Promise<DictionaryArticle[] | undefined> {
    const listing = await this.client.get(cdxQuery(slug), { fallback: true });
    if (listing.status !== 200) return undefined;
    const latest = listing.body
      .split('\n')
      .map((line) => line.trim().split(' '))
      .filter(
        (row): row is [string, string] =>
          row.length === 2 && isPageOf(row[1] ?? '', slug) && /^\d{14}$/.test(row[0] ?? ''),
      )
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .at(-1);
    if (latest === undefined) return undefined;

    const [timestamp, original] = latest;
    const snapshot = await this.client.get(`${WAYBACK}${timestamp}id_/${original}`, {
      accept: (body) => !body.includes('<title>Wayback Machine</title>'),
      fallback: true,
    });
    if (snapshot.status !== 200) return undefined;
    const articles = parseSumPage(snapshot.body, {
      url,
      archivedUrl: `${WAYBACK}${timestamp}/${original}`,
    });
    return articles.length === 0 ? undefined : articles;
  }
}

/** Lists the archived copies of a sum.in.ua page. */
function cdxQuery(slug: string): string {
  return `${CDX}?url=sum.in.ua/s/${slug.replaceAll("'", '%27')}&filter=statuscode:200&fl=timestamp,original`;
}

/** Whether an archived address is the page `/s/<slug>` (the archive ignores letter case). */
function isPageOf(address: string, slug: string): boolean {
  try {
    const { hostname, pathname } = new URL(address);
    const path = decodeURIComponent(pathname).replace(/\/$/, '').toLowerCase();
    return hostname === 'sum.in.ua' && path === `/s/${slug}`.toLowerCase();
  } catch {
    return false;
  }
}

const TRANSLITERATION: Readonly<Record<string, readonly string[]>> = {
  а: ['a'],
  б: ['b'],
  в: ['v'],
  г: ['gh'],
  // СУМ-11 predates the return of ґ, so its words may be spelt with г.
  ґ: ['g', 'gh'],
  д: ['d'],
  е: ['e'],
  є: ['je'],
  ж: ['zh'],
  з: ['z'],
  и: ['y'],
  і: ['i'],
  ї: ['ji'],
  й: ['j'],
  к: ['k'],
  л: ['l'],
  м: ['m'],
  н: ['n'],
  о: ['o'],
  п: ['p'],
  р: ['r'],
  с: ['s'],
  т: ['t'],
  у: ['u'],
  ф: ['f'],
  х: ['kh'],
  ц: ['c'],
  ч: ['ch'],
  ш: ['sh'],
  щ: ['shh'],
  ь: ['j'],
  ю: ['ju'],
  я: ['ja'],
  // Older pages wrote the apostrophe as a dot.
  "'": ["'", '.'],
  '-': ['-'],
  ' ': ['_'],
};

/** The addresses sum.in.ua may use for a Lemma, most likely first. */
function sumSlugs(lemma: string): string[] {
  let slugs = [''];
  for (const letter of matchKey(lemma)) {
    const options = TRANSLITERATION[letter] ?? [letter];
    slugs = slugs.flatMap((slug) => options.map((option) => slug + option));
  }
  return slugs;
}

/** Reads every article on a sum.in.ua page. */
function parseSumPage(
  html: string,
  address: { url: string; archivedUrl?: string },
): DictionaryArticle[] {
  const root = parse(html);
  return root.querySelectorAll('[itemprop="articleBody"]').flatMap((body) => {
    const article = parseArticle(body, address);
    return article === undefined ? [] : [article];
  });
}

function parseArticle(
  body: HTMLElement,
  address: { url: string; archivedUrl?: string },
): DictionaryArticle | undefined {
  const paragraphs = body.querySelectorAll(':scope > p');
  const [head, ...rest] = paragraphs;
  const headline = head?.querySelector('[itemprop="headline"]');
  if (head === undefined || headline == null) return undefined;

  const labels: string[] = [];
  let homonymNumber: number | undefined;
  let definitionStart: { text: string; nodes: Node[] } | undefined;
  const after = head.childNodes.slice(head.childNodes.indexOf(headline) + 1);

  // The grammar zone (endings, gender, labels) runs until the first capital
  // letter, which opens the Definition.
  for (const [index, node] of after.entries()) {
    if (node instanceof HTMLElement) {
      if (isLabel(node)) labels.push(labelName(node));
      else if (node.classList.contains('illus') || node.classList.contains('s')) {
        definitionStart = { text: '', nodes: after.slice(index) };
        break;
      }
      continue;
    }
    if (node.nodeType !== NodeType.TEXT_NODE) continue;
    const text = node.text;
    if (homonymNumber === undefined && labels.length === 0) {
      const number = /^\s*(\d+)/.exec(text)?.[1];
      if (number !== undefined) homonymNumber = Number(number);
    }
    const capital = text.search(/\p{Lu}/u);
    if (capital >= 0) {
      definitionStart = { text: text.slice(capital), nodes: after.slice(index + 1) };
      break;
    }
  }

  const senses: Sense[] = [];
  if (definitionStart !== undefined) {
    senses.push(readSense(definitionStart.nodes, definitionStart.text));
  }
  for (const paragraph of rest) senses.push(readSense(paragraph.childNodes));

  const definitions = senses.flatMap((sense) => sense.definitions);
  const tom = body.nextElementSibling;
  return {
    headword: squeeze(headline.text),
    ...(homonymNumber === undefined ? {} : { homonymNumber }),
    labels,
    definitions: definitions.filter((definition) => definition.text !== ''),
    examples: senses.flatMap((sense) => sense.examples),
    unmarkedExamples: senses.some((sense) => sense.unmarkedExamples),
    source: {
      title:
        tom?.classList.contains('tom') === true
          ? squeeze(tom.text)
          : 'Словник української мови: в 11 томах',
      ...address,
    },
  };
}

interface Sense {
  definitions: ArticleDefinition[];
  examples: ArticleExample[];
  unmarkedExamples: boolean;
}

/**
 * Reads one meaning: its Definition, its shades (each after `//`) and their
 * Examples. Set phrases and terms (after ♦, ▲ or a bold phrase) are skipped.
 */
function readSense(nodes: readonly Node[], leadingText = ''): Sense {
  const sense: Sense = { definitions: [], examples: [], unmarkedExamples: false };
  // `runsIntoExamples`: a citation came before any italic Example, so the
  // text read as the Definition also holds Examples.
  let current = { text: leadingText, labels: [] as string[], runsIntoExamples: false };
  let inDefinition = true;

  const finish = () => {
    let text = squeeze(current.text).replace(/^[,;:—\s]+/, '');
    if (current.runsIntoExamples) text = firstSentence(text);
    if (text !== '' || current.labels.length > 0) {
      sense.definitions.push({ text, labels: current.labels });
    }
  };

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      if (inDefinition && node.nodeType === NodeType.TEXT_NODE) current.text += node.text;
      continue;
    }
    const classes = node.classList;
    if (classes.contains('zn') || node.tagName === 'BR') continue;
    if (classes.contains('tinok')) {
      finish();
      current = { text: '', labels: [], runsIntoExamples: false };
      inDefinition = true;
      continue;
    }
    if (classes.contains('diam') || classes.contains('tria') || classes.contains('z')) break;
    if (classes.contains('illus')) {
      sense.examples.push({ text: squeeze(node.text) });
      inDefinition = false;
      continue;
    }
    if (classes.contains('s')) {
      const last = sense.examples.at(-1);
      if (inDefinition || last === undefined || last.citation !== undefined) {
        sense.unmarkedExamples = true;
        if (inDefinition) current.runsIntoExamples = true;
      } else {
        sense.examples[sense.examples.length - 1] = { ...last, citation: citationOf(node) };
      }
      inDefinition = false;
      continue;
    }
    if (!inDefinition || node.tagName === 'I') continue;
    if (isLabel(node) && squeeze(current.text) === '') current.labels.push(labelName(node));
    else current.text += node.text;
  }
  finish();
  return sense;
}

/** The text up to the first full stop that is followed by a capital letter. */
function firstSentence(text: string): string {
  const end = /[.!?](?=\s+\p{Lu})/u.exec(text);
  return end === null ? text : text.slice(0, end.index + 1);
}

function citationOf(node: HTMLElement): string {
  return squeeze(node.text).replace(/^\(/, '').replace(/\)$/, '');
}

function isLabel(node: HTMLElement): boolean {
  return node.tagName === 'ABBR' && node.classList.contains('mark');
}

function labelName(node: HTMLElement): string {
  return node.getAttribute('title') ?? squeeze(node.text);
}
