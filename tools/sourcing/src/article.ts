import type { Source } from '@slovo/contracts';

export interface ArticleExample {
  readonly text: string;
  /** The citation in brackets after the Example, e.g. `Михайло Коцюбинський, II, 1955, 244` or `В. Кучер`. */
  readonly citation?: string;
}

export interface ArticleDefinition {
  readonly text: string;
  /** The labels in front of the Definition, by their full names (e.g. `діалектне`). */
  readonly labels: readonly string[];
}

/** One article of an explanatory dictionary: homonyms get one article each. */
export interface DictionaryArticle {
  /** The headword as printed, with its stress mark when the dictionary gives one. */
  readonly headword: string;
  /** Tells homonyms apart: the dictionary's own number, or the article's place on the page. */
  readonly homonymNumber?: number;
  /** The labels after the headword, by their full names (e.g. `жіночий рід`, `застаріле`). */
  readonly labels: readonly string[];
  /** The meanings in order, each followed by its shades. */
  readonly definitions: readonly ArticleDefinition[];
  readonly examples: readonly ArticleExample[];
  /** Some Examples are printed without italics, so Definitions and Examples can't be told apart. */
  readonly unmarkedExamples: boolean;
  /** The dictionary as the page cites it, and where the article was read. */
  readonly source: Source;
}
