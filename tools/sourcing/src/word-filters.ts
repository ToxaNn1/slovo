import type { Register } from '@slovo/contracts';

import type { Flag } from './review-report';

/**
 * The markers СУМ starts a Definition with to point at another article
 * instead of explaining the word. The next one is one more line.
 */
export const REFERENCE_MARKERS: readonly string[] = [
  'Те саме, що',
  'Див.',
  'Зменш. до',
  'Зменш.-пестл. до',
  'Пестл. до',
  'Збільш. до',
  'Згруб. до',
  'Дія за знач.',
  'Стан за знач.',
  'Прикм. до',
  'Присл. до',
  'Абстр. ім. до',
  'Жін. до',
  'Однокр. до',
];

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A marker at the start, after any abbreviated labels such as `розм.`, case-insensitive. */
const CROSS_REFERENCE = new RegExp(
  `^(?:[\\p{L}-]+\\.,?\\s*)*?(?:${REFERENCE_MARKERS.map(escaped).join('|')})(?!\\p{L})`,
  'iu',
);

/** Whether a Definition only points at another article, e.g. «Зменш. до вікно.». */
export function isCrossReference(definition: string): boolean {
  return CROSS_REFERENCE.test(definition.trim());
}

/** What a filter of `source:words` found: the flags for a human, and the issues that keep the draft out of `drafts/`. */
export interface Filtered {
  readonly flags: readonly Flag[];
  readonly issues: readonly string[];
}

/**
 * The drafts a human would refuse though they pass the build: a primary
 * Definition that is a cross-reference, and a dialect Word with no Region.
 */
export function filterWord(word: {
  readonly primaryDefinition?: string | undefined;
  readonly registers?: readonly Register[] | undefined;
  readonly region?: string | undefined;
}): Filtered {
  const flags: Flag[] = [];
  const issues: string[] = [];
  const definition = word.primaryDefinition;
  if (definition !== undefined && isCrossReference(definition)) {
    flags.push({
      kind: 'cross-reference',
      message: `The primary Definition points at another article: «${definition}»`,
    });
    issues.push(
      'primaryDefinition: a cross-reference to another article, which explains nothing on an Entry card',
    );
  }
  if (word.registers?.includes('dialectal') === true && word.region === undefined) {
    flags.push({
      kind: 'region-missing',
      message: 'A dialect Word with no Region: add where it is said from a cited source',
    });
    issues.push('region: a dialect Word needs a Region, which the tool does not source');
  }
  return { flags, issues };
}
