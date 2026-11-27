import type { Word } from '@slovo/contracts';

/**
 * The Definition a Word shows where several Definitions share a screen (the
 * Word Meaning question, the Yesterday quiz, the Due Quiz): its Short
 * Definition, or its primary Definition when it has none (ADR 0211).
 */
export const definitionAmongSeveral = (word: Word): string =>
  word.shortDefinition ?? word.primaryDefinition;
