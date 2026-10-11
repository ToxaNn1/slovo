import { CorrectionTypeSchema, type CorrectionType, type Word } from '@slovo/contracts';

import type { PackContent } from './pack-layout';

/**
 * How much content a pack holds and how complete it is. Word counts leave
 * Retired Words out.
 */
export interface ContentReport {
  readonly words: number;
  readonly retiredWords: number;
  /** Every Category of the Edition, in its order, empty ones included. */
  readonly wordsPerCategory: readonly {
    readonly categoryId: string;
    readonly displayName: string;
    readonly words: number;
  }[];
  /** One bucket per rarity, 1 to 5. */
  readonly rarity: readonly { readonly rarity: number; readonly words: number }[];
  /** How many Words have at least one Example, at least one Synonym, an etymology, a Stress. */
  readonly coverage: {
    readonly examples: number;
    readonly synonyms: number;
    readonly etymology: number;
    readonly stress: number;
  };
  readonly corrections: number;
  /** One bucket per Correction Type, in the order the contracts list them. */
  readonly correctionsPerType: readonly {
    readonly correctionType: CorrectionType;
    readonly corrections: number;
  }[];
}

const RARITIES = [1, 2, 3, 4, 5];

export function contentReport({
  categories,
  words: allWords,
  corrections,
}: PackContent): ContentReport {
  const words = allWords.filter((word) => !word.retired);
  const count = (test: (word: Word) => boolean) => words.filter(test).length;
  return {
    words: words.length,
    retiredWords: allWords.length - words.length,
    wordsPerCategory: categories.map(({ id, displayName }) => ({
      categoryId: id,
      displayName,
      words: count((word) => word.categoryId === id),
    })),
    rarity: RARITIES.map((rarity) => ({ rarity, words: count((word) => word.rarity === rarity) })),
    coverage: {
      examples: count((word) => word.examples.length > 0),
      synonyms: count((word) => word.synonyms.length > 0),
      etymology: count((word) => word.etymology !== undefined),
      stress: count((word) => word.stress.length > 0),
    },
    corrections: corrections.length,
    correctionsPerType: CorrectionTypeSchema.options.map((correctionType) => ({
      correctionType,
      corrections: corrections.filter((correction) => correction.correctionType === correctionType)
        .length,
    })),
  };
}

export function formatContentReport(report: ContentReport): string {
  const {
    words,
    retiredWords,
    wordsPerCategory,
    rarity,
    coverage,
    corrections,
    correctionsPerType,
  } = report;
  const retired = `${String(retiredWords)} Retired Word${retiredWords === 1 ? '' : 's'} left out`;
  const idWidth = Math.max(...wordsPerCategory.map((category) => category.categoryId.length));
  const nameWidth = Math.max(...wordsPerCategory.map((category) => category.displayName.length));
  const mostOfOneRarity = Math.max(1, ...rarity.map((bucket) => bucket.words));
  const typeWidth = Math.max(...correctionsPerType.map((bucket) => bucket.correctionType.length));
  const share = (part: number) =>
    `${String(part)}/${String(words)} (${String(words === 0 ? 0 : Math.floor((part * 100) / words))}%)`;

  return [
    'Content report',
    `  Words: ${String(words)} (${retired})`,
    '  Words per Category:',
    ...wordsPerCategory.map(
      ({ categoryId, displayName, words: inCategory }) =>
        `    ${categoryId.padEnd(idWidth)}  ${displayName.padEnd(nameWidth)}  ${String(inCategory)}`,
    ),
    '  Rarity:',
    ...rarity.map(({ rarity: value, words: ofRarity }) =>
      `    rarity ${String(value)}  ${String(ofRarity).padStart(4)} ${'█'.repeat(Math.round((ofRarity / mostOfOneRarity) * 30))}`.trimEnd(),
    ),
    '  Coverage:',
    `    Examples   ${share(coverage.examples)}`,
    `    Synonyms   ${share(coverage.synonyms)}`,
    `    etymology  ${share(coverage.etymology)}`,
    `    Stress     ${share(coverage.stress)}`,
    `  Corrections: ${String(corrections)}`,
    '  Corrections per Correction Type:',
    ...correctionsPerType.map(
      ({ correctionType, corrections: ofType }) =>
        `    ${correctionType.padEnd(typeWidth)}  ${String(ofType)}`,
    ),
  ].join('\n');
}
