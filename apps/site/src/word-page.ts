import { STRESS_MARK, type Word } from '@slovo/contracts';

import type { LandingEdition } from './edition';

/** A run of a Lemma's letters, the stressed vowel with its mark on its own. */
export interface LemmaPart {
  text: string;
  stressed: boolean;
}

/** The Lemma in runs, so a page can colour each stressed vowel. */
export function lemmaParts({ lemma, stress }: Pick<Word, 'lemma' | 'stress'>): LemmaPart[] {
  const stressed = new Set(stress);
  const parts: LemmaPart[] = [];
  Array.from(lemma).forEach((letter, position) => {
    if (stressed.has(position)) parts.push({ text: `${letter}${STRESS_MARK}`, stressed: true });
    else {
      const last = parts.at(-1);
      if (last !== undefined && !last.stressed) last.text += letter;
      else parts.push({ text: letter, stressed: false });
    }
  });
  return parts;
}

/** The part of speech with a noun's gender, as the Edition writes it: «іменник, чоловічий рід». */
export function grammarLine(
  { partOfSpeech, gender }: Pick<Word, 'partOfSpeech' | 'gender'>,
  labels: LandingEdition['wordCard'],
): string {
  const part = labels.partsOfSpeech[partOfSpeech].full;
  if (gender === undefined) return part;
  return labels.partOfSpeechWithGender
    .replace('{partOfSpeech}', part)
    .replace('{gender}', labels.genders[gender].full);
}

/** The five rarity bars, the lit ones first. */
export function rarityBars(rarity: Word['rarity']): boolean[] {
  return [1, 2, 3, 4, 5].map((step) => step <= rarity);
}

/**
 * Up to `count` other Words of the Word's Category for «Схожі слова»: the
 * ones after it in id order, wrapping round, so each page shows its own.
 */
export function similarWords<T extends Pick<Word, 'id' | 'categoryId'>>(
  word: T,
  words: readonly T[],
  count = 6,
): T[] {
  const sameCategory = words
    .filter((other) => other.categoryId === word.categoryId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const at = sameCategory.findIndex((other) => other.id === word.id);
  return [...sameCategory.slice(at + 1), ...sameCategory.slice(0, Math.max(at, 0))].slice(0, count);
}

/** How a Synonym or a Lemma is matched to a page: no Stress marks, lower case. */
const plain = (text: string) => text.replaceAll(STRESS_MARK, '').toLowerCase().trim();

/**
 * Each Synonym with the slug of the Word page it names, or none when no live
 * Word has that Lemma. Of two Words with one Lemma, the first by id wins.
 */
export function synonymLinks(
  synonyms: readonly string[],
  words: readonly Pick<Word, 'id' | 'lemma'>[],
  slugs: ReadonlyMap<string, string>,
): { text: string; slug: string | undefined }[] {
  const byLemma = new Map<string, string>();
  for (const word of [...words].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const slug = slugs.get(word.id);
    if (slug !== undefined && !byLemma.has(plain(word.lemma))) byLemma.set(plain(word.lemma), slug);
  }
  return synonyms.map((text) => ({ text, slug: byLemma.get(plain(text)) }));
}

/** The page's meta description: the primary definition, cut at a word near 155 characters. */
export function metaDescription({
  lemma,
  primaryDefinition,
}: Pick<Word, 'lemma' | 'primaryDefinition'>): string {
  const text = `${lemma} — ${primaryDefinition}`;
  if (text.length <= 155) return text;
  const cut = text.slice(0, 154);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:.—-]+$/, '')}…`;
}
