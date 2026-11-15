import type { Word } from '@slovo/contracts';
import { getCollection } from 'astro:content';

import { sitePath } from './site-path';
import { slugsById } from './slug';

/** The live Words the content sync read (see content.config.ts), in id order, with their page slugs. */
export interface SiteWords {
  words: Word[];
  slugs: ReadonlyMap<string, string>;
  /** The address of a live Word's page under the site's base, e.g. `/slovo/krakeliur`. */
  pathOf: (word: Pick<Word, 'id'>) => string;
}

export async function siteWords(): Promise<SiteWords> {
  const words = (await getCollection('words'))
    .map((entry) => entry.data)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const slugs = slugsById(words);
  const pathOf = ({ id }: Pick<Word, 'id'>) => {
    const slug = slugs.get(id);
    if (slug === undefined) throw new Error(`No live Word "${id}" has a page.`);
    return wordPagePath(slug);
  };
  return { words, slugs, pathOf };
}

/** The address of a Word page by its slug. */
export function wordPagePath(slug: string): string {
  return sitePath(`slovo/${slug}`);
}
