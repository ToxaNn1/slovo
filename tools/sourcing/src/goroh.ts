/**
 * goroh.pp.ua: Definitions and Examples from the explanatory dictionaries it
 * carries (СУМ-20, and СУМ-11 after П'ЯТЬ), Stress, part of speech and gender from its inflection
 * dictionary, Synonyms from its synonym dictionaries, and etymology from the
 * Etymological Dictionary of the Ukrainian Language (ЕСУМ).
 */
import { HTMLElement, NodeType, parse, type Node } from 'node-html-parser';

import { LANGUAGE_MODEL } from '@slovo/content-rules';

import type { DictionaryArticle } from './article';
import type { PoliteClient } from './polite-client';
import { citedAs, SOURCE_LANGUAGE, squeeze, unstressed } from './text';

const SITE = 'https://goroh.pp.ua/';

export type GorohSection =
  'Тлумачення' | 'Словозміна' | 'Синонімія' | 'Етимологія' | 'Фразеологія' | 'Слововживання';

/** The readable address of a goroh page, as recorded in sources. */
export function gorohUrl(section: GorohSection, lemma: string): string {
  return `${SITE}${section}/${lemma}`;
}

/** Fetches a goroh page; `undefined` when goroh has no such entry. */
export async function fetchGoroh(
  client: PoliteClient,
  section: GorohSection,
  lemma: string,
): Promise<string | undefined> {
  const response = await client.get(
    `${SITE}${encodeURIComponent(section)}/${encodeURIComponent(lemma)}`,
  );
  return response.status === 200 ? response.body : undefined;
}

/**
 * The explanatory dictionaries whose articles become drafts. goroh also shows
 * articles from other dictionaries and text written by a language model; those
 * are only reported.
 */
const EXPLANATORY_DICTIONARY = 'Тлумачний словник української мови';

export { LANGUAGE_MODEL, readArticleBlocks, type ArticleBlock } from '@slovo/content-rules';

function blocksOf(html: string): { element: HTMLElement; headword: string; dictionary: string }[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .map((element) => ({
      element,
      headword: squeeze(element.querySelector('h2 .uppercase')?.text ?? ''),
      dictionary: squeeze(element.querySelector('.source-info')?.text ?? ''),
    }));
}

export interface GorohDefinitions {
  readonly articles: readonly DictionaryArticle[];
  /** Articles for the Lemma from sources that are not drafted from, as `dictionary: headword`. */
  readonly leftOut: readonly string[];
}

/**
 * Whether a «Тлумачення» headword is the Lemma. The explanatory dictionary
 * prints its headwords in capitals, so case tells nothing there; a headword
 * in mixed case keeps it, so a proper name stays apart, as in `isSameWord`.
 */
function isHeadwordOf(headword: string, lemma: string): boolean {
  const inCapitals = headword === headword.toLocaleUpperCase(SOURCE_LANGUAGE);
  return isSameWord(inCapitals ? headword.toLocaleLowerCase(SOURCE_LANGUAGE) : headword, lemma);
}

/** Reads the articles for the Lemma on a «Тлумачення» page, each with the dictionary it cites. */
export function parseDefinitions(html: string, lemma: string): GorohDefinitions {
  const leftOut: string[] = [];
  const matching = blocksOf(html).flatMap(
    ({ element: block, headword, dictionary }): Omit<DictionaryArticle, 'homonymNumber'>[] => {
      if (!isHeadwordOf(headword, lemma)) return [];
      if (!dictionary.startsWith(EXPLANATORY_DICTIONARY)) {
        leftOut.push(`${dictionary === '' ? '(no source)' : dictionary}: ${headword}`);
        return [];
      }
      const senses = block.querySelectorAll('.interpret.list-item');
      return [
        {
          headword,
          labels: labelsIn(block.querySelector('h2 .block-remark'), { plainText: false }),
          definitions: senses
            .map((sense) => ({
              text: squeeze(sense.querySelector('.interpret-formula')?.text ?? ''),
              labels: labelsIn(sense.querySelector('.interpret-remark'), { plainText: true }),
            }))
            .filter((definition) => definition.text !== ''),
          examples: senses.flatMap((sense) =>
            sense.querySelectorAll('.examples li').flatMap(exampleIn),
          ),
          unmarkedExamples: false,
          source: { ...citedAs(dictionary), url: gorohUrl('Тлумачення', lemma) },
        },
      ];
    },
  );
  const articles = matching.map((article, index) =>
    matching.length > 1 ? { ...article, homonymNumber: index + 1 } : article,
  );
  return { articles, leftOut };
}

/** One phraseologism of a «Фразеологія» page. */
export interface GorohPhraseologism {
  /** The expression as printed, with Stress marks. */
  readonly expression: string;
  /** Whether goroh marks it as a proper name: a place name or another name. */
  readonly properName: boolean;
  /** Its meanings in order. */
  readonly definitions: readonly string[];
  readonly examples: readonly { readonly text: string; readonly citation?: string }[];
  /** The dictionary goroh cites for it; empty when it cites none. */
  readonly dictionary: string;
  /**
   * Whether a language model wrote it: goroh cites the language model for it,
   * or marks it the way it marks the language model's blocks, with grammar
   * spelled out in plain words (`чоловічий рід`, `множина`, `фразеологізм`)
   * where a dictionary prints abbreviations.
   */
  readonly languageModel: boolean;
}

/** The plain-word remarks goroh prints on the blocks a language model wrote. */
const MODEL_REMARKS = new Set([
  'чоловічий рід',
  'жіночий рід',
  'середній рід',
  'множина',
  'фразеологізм',
]);

/**
 * Reads the phraseologisms of a «Фразеологія» page. goroh prints a run of
 * article blocks and then one source note for the run, so each block cites the
 * first source note after it.
 */
export function parsePhraseology(html: string): GorohPhraseologism[] {
  const phraseologisms: GorohPhraseologism[] = [];
  let run: (Omit<GorohPhraseologism, 'dictionary' | 'languageModel'> & { modelRemark: boolean })[] =
    [];
  const close = (dictionary: string) => {
    const cited = dictionary.startsWith(LANGUAGE_MODEL);
    phraseologisms.push(
      ...run.map(({ modelRemark, ...block }) => ({
        ...block,
        dictionary,
        languageModel: cited || modelRemark,
      })),
    );
    run = [];
  };
  for (const element of parse(html).querySelectorAll('div.article-block, div.source-info')) {
    if (element.classList.contains('source-info')) {
      close(squeeze(element.text));
      continue;
    }
    const senses = element.querySelectorAll('.interpret.list-item');
    const remarks = (element.querySelector('h2 .block-remark')?.text ?? '').split(',').map(squeeze);
    run.push({
      expression: squeeze(element.querySelector('h2 > span')?.text ?? ''),
      properName: remarks.includes('власна назва'),
      modelRemark: remarks.some((remark) => MODEL_REMARKS.has(remark)),
      definitions: senses
        .map((sense) => squeeze(sense.querySelector('.interpret-formula')?.text ?? ''))
        .filter((text) => text !== ''),
      examples: senses.flatMap((sense) =>
        sense.querySelectorAll('.examples li').flatMap(exampleIn),
      ),
    });
  }
  close('');
  return phraseologisms.filter(({ expression }) => expression !== '');
}

function exampleIn(item: HTMLElement): { text: string; citation?: string }[] {
  const text = squeeze(item.querySelector('.example-text')?.text ?? '').replace(
    EXAMPLE_MARKERS,
    '',
  );
  if (text === '') return [];
  const citation = squeeze(item.querySelector('.example-source')?.text ?? '')
    .replace(/^\(/, '')
    .replace(/\)$/, '');
  return [citation === '' ? { text } : { text, citation }];
}

/**
 * The markers СУМ puts in front of an Example to say how the word is used
 * in it (`* У порівн.` in a comparison, `* Образно.` figuratively); they are
 * not part of the quotation.
 */
const EXAMPLE_MARKERS = /^(?:\*\s*(?:У порівн\.|Образно\.)\s*)+/u;

/**
 * Labels goroh prints as plain text, without the full name it gives the same
 * label elsewhere (СУМ-11 articles mostly), by those full names. Grammar is
 * left out: in plain text it comes mixed with endings and government.
 */
const PLAIN_LABELS: Readonly<Record<string, string>> = {
  'заст.': 'застаріле',
  'розм.': 'розмовне',
  'діал.': 'діалектизм',
  'книжн.': 'книжне',
  'рідко.': 'рідковживане',
  'перен.': 'переносне значення',
  'іст.': 'історія; історизм',
  'зневажл.': 'зневажливе',
  'ірон.': 'іронічне',
  'жарт.': 'жартівливо',
  'фам.': 'фамільярне',
  'уроч.': 'урочисте',
  'поет.': 'поетичне слово (вислів)',
  'лайл.': 'лайливе',
  'вульг.': 'вульгарне',
  'спец.': 'спеціальне слово',
  'техн.': 'технічний термін',
  'збірн.': 'збірне значення',
  'рел.-церк.': 'релігійно-церковне слово (вислів)',
  'військ.': 'військова справа',
  'мор.': 'морська справа',
  'архт.': 'архітектура',
  'муз.': 'музика',
  'літ.': 'літературознавство; література',
  'лінгв.': 'лінгвістика',
  'етн.': 'етнографія',
  'фіз.': 'фізика',
  'хім.': 'хімія',
  'мат.': 'математика',
  'астр.': 'астрономія',
  'геол.': 'геологія',
  'біол.': 'біологія',
  'бот.': 'ботаніка',
  'зоол.': 'зоологія',
  'анат.': 'анатомія',
  'мед.': 'медицина',
};

/**
 * The full names of the labels in a remark, e.g. `жіночий рід` for `ж.`:
 * those goroh names in a title, and, when `plainText` is on, the known
 * labels it prints as bare text.
 */
function labelsIn(remark: HTMLElement | null, { plainText }: { plainText: boolean }): string[] {
  if (remark === null) return [];
  const labels: string[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      if (!plainText) return;
      for (const word of node.text.split(/[\s,;]+/)) {
        const label = PLAIN_LABELS[word];
        if (label !== undefined) labels.push(label);
      }
      return;
    }
    const title = node instanceof HTMLElement ? node.getAttribute('title') : undefined;
    if (title === undefined) node.childNodes.forEach(visit);
    else if (squeeze(title) !== '') labels.push(squeeze(title));
  };
  remark.childNodes.forEach(visit);
  return labels;
}

/** One entry of the inflection dictionary. */
export interface GorohInflection {
  /** The word with its stress marks, e.g. `коса́` or `за́вжди́`. */
  readonly headword: string;
  /** The short gloss that tells homonyms apart, e.g. `волосся`. */
  readonly gloss?: string;
  /** Grammatical tags, e.g. `іменник`, `жіночий рід`, `множинний`. */
  readonly tags: readonly string[];
}

export function parseInflections(html: string, lemma: string): GorohInflection[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .flatMap((block): GorohInflection[] => {
      const header = block.querySelector('h2.page__sub-header');
      if (header === null) return [];
      const headword = squeeze(
        header.childNodes
          .filter((node) => node.nodeType === NodeType.TEXT_NODE)
          .map((node) => node.text)
          .join(' '),
      );
      if (!isSameWord(headword, lemma)) return [];
      const gloss = squeeze(header.querySelector('.short-interpret')?.text ?? '');
      return [
        {
          headword,
          ...(gloss === '' ? {} : { gloss }),
          tags: block.querySelectorAll('.taglist a.tag').map((tag) => squeeze(tag.text)),
        },
      ];
    });
}

/** One group of Synonyms for one sense of the word. */
export interface GorohSynonymGroup {
  readonly sense?: string;
  readonly synonyms: readonly string[];
  /** The dictionary goroh took the group from. */
  readonly dictionary?: string;
}

/**
 * The synonym dictionaries goroh draws on. Its other dictionaries list
 * replacements for foreign words or calques, often next to the forms to avoid.
 */
const SYNONYM_DICTIONARIES = new Set([
  'Словник синонімів Караванського',
  'Цифрові лексикографічні системи української мови',
]);

export function isSynonymDictionary(dictionary: string | undefined): boolean {
  return dictionary !== undefined && SYNONYM_DICTIONARIES.has(dictionary);
}

export function parseSynonymGroups(html: string, lemma: string): GorohSynonymGroup[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .flatMap((block): GorohSynonymGroup[] => {
      const headword = block.querySelector('h2 b');
      if (headword === null || !isSameWord(headword.text, lemma)) return [];
      const sense = squeeze(block.querySelector('h2 .short-interpret')?.text ?? '');
      const dictionary = squeeze(block.querySelector('.source-info')?.text ?? '');
      const synonyms = block
        .querySelectorAll('.article-block__body .list-item')
        .map((item) => squeeze(unstressed(item.querySelector('a')?.text ?? '')))
        .filter((synonym) => synonym !== '');
      return [
        {
          ...(sense === '' ? {} : { sense }),
          synonyms,
          ...(dictionary === '' ? {} : { dictionary }),
        },
      ];
    });
}

/** One member of a goroh synonym article: its headword with Stress marks and its gloss, if any. */
export interface GorohSynonymMember {
  readonly headword: string;
  readonly note: string;
}

/** One goroh synonym article: a sense of its headword and the synonyms listed under it. */
export interface GorohSynonymArticle {
  /** The headword with Stress marks, as goroh shows it. */
  readonly headword: string;
  readonly sense: string;
  readonly dictionary: string;
  readonly members: readonly GorohSynonymMember[];
}

/** The synonym articles of a «Синонімія» page whose headword is the lemma, from goroh's synonym dictionaries, in page order. */
export function readSynonymArticles(html: string, lemma: string): GorohSynonymArticle[] {
  return parse(html)
    .querySelectorAll('div.article-block')
    .flatMap((block): GorohSynonymArticle[] => {
      // A related word's articles show its headword as a link rather than in bold.
      const heading = block.querySelector('h2 b') ?? block.querySelector('h2 a');
      const headword = squeeze(heading?.text ?? '');
      const dictionary = squeeze(block.querySelector('.source-info')?.text ?? '');
      if (!isSameWord(headword, lemma) || !isSynonymDictionary(dictionary)) return [];
      const members = block
        .querySelectorAll('.article-block__body .list-item')
        .map((item) => ({
          headword: squeeze(item.querySelector('a')?.text ?? ''),
          note: squeeze(unstressed(item.querySelector('.short-interpret')?.text ?? '')),
        }))
        .filter((member) => member.headword !== '');
      return [
        {
          headword,
          sense: squeeze(block.querySelector('h2 .short-interpret')?.text ?? ''),
          dictionary,
          members,
        },
      ];
    });
}

/** One ЕСУМ article: its headword, gloss, the etymology and the related words listed under it. */
export interface GorohEtymology {
  readonly headword: string;
  readonly gloss?: string;
  readonly text: string;
  readonly variants: readonly string[];
}

export function parseEtymologies(html: string): GorohEtymology[] {
  return parse(html)
    .querySelectorAll('div.card.etymology-root')
    .map((card) => {
      const gloss = squeeze(card.querySelector('h2 .short-interpret')?.text ?? '');
      return {
        headword: squeeze(card.querySelector('h2 .uppercase')?.text ?? ''),
        ...(gloss === '' ? {} : { gloss }),
        text: card
          .querySelectorAll('.list-item.circle')
          .map((item) => squeeze(item.text))
          .join(' '),
        variants: card.querySelectorAll('.section-content .word').map((word) => squeeze(word.text)),
      };
    });
}

/** Same spelling, ignoring stress marks; letter case counts, so proper names stay apart. */
export function isSameWord(marked: string, lemma: string): boolean {
  return squeeze(unstressed(marked)).replace(/[’ʼ`]/g, "'") === lemma.replace(/[’ʼ`]/g, "'");
}
