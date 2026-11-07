import type { ExamplePair, LiteraryUse } from '@slovo/contracts';
import type { CorrectionCardModel, Example, WordCardModel } from '@slovo/core';

/**
 * One tab of a Word's Entry card (ADR 0088), with what it shows: «Суть» the
 * primary Definition and how many other meanings «Історія» holds, «Приклад»
 * the Examples, «Зв’язки» the Synonyms and antonyms, «Історія» the other
 * meanings, the etymology and the Word History.
 */
export type WordTab =
  | { readonly key: 'essence'; readonly definition: string; readonly moreMeanings: number }
  | { readonly key: 'example'; readonly examples: readonly [Example, ...Example[]] }
  | {
      readonly key: 'links';
      readonly synonyms: readonly string[];
      readonly antonyms: readonly string[];
    }
  | {
      readonly key: 'history';
      readonly meanings: readonly string[];
      readonly etymology: string | undefined;
      readonly history: string | undefined;
    };

/** The names of the tabs, which the Edition's strings give. */
export type WordTabKey = WordTab['key'];

/**
 * The tabs of a Word's card, in order, without the ones that would be empty.
 * «Суть» is always there and comes first, so it is the tab selected on
 * opening; a card left with it alone draws no tab bar.
 */
export function wordTabsOf(card: WordCardModel): readonly [WordTab, ...WordTab[]] {
  const meanings = card.details?.extraDefinitions ?? [];
  const etymology = card.details?.etymology;
  const examples = [
    ...(card.example === undefined ? [] : [card.example]),
    ...(card.details?.examples ?? []),
  ];
  const [first, ...rest] = examples;
  const tabs: WordTab[] = [];
  if (first !== undefined) tabs.push({ key: 'example', examples: [first, ...rest] });
  if (card.synonyms.length > 0 || card.antonyms.length > 0)
    tabs.push({ key: 'links', synonyms: card.synonyms, antonyms: card.antonyms });
  if (meanings.length > 0 || etymology !== undefined || card.history !== undefined)
    tabs.push({ key: 'history', meanings, etymology, history: card.history });
  return [
    { key: 'essence', definition: card.primaryDefinition, moreMeanings: meanings.length },
    ...tabs,
  ];
}

/**
 * One tab of a Correction's Entry card (ADR 0088), under its struck
 * non-standard form: «Як краще» the standard equivalents and the Category,
 * «Чому» the explanation and its sources, «Приклади» the example pair and the
 * literary uses.
 */
export type CorrectionTab =
  | { readonly key: 'better' }
  | {
      readonly key: 'why';
      readonly explanation: string;
      readonly sourceNames: readonly string[];
    }
  | {
      readonly key: 'examples';
      readonly examplePair: ExamplePair;
      readonly literaryUses: readonly LiteraryUse[];
    };

/** The names of a Correction card's tabs, which the Edition's strings give. */
export type CorrectionTabKey = CorrectionTab['key'];

/**
 * The tabs of a Correction's card, in order, without «Чому» when there is no
 * reason to give. «Як краще» is always there and comes first, so it is the
 * tab selected on opening.
 */
export function correctionTabsOf(
  card: CorrectionCardModel,
): readonly [CorrectionTab, ...CorrectionTab[]] {
  const why: CorrectionTab[] =
    card.explanation === ''
      ? []
      : [{ key: 'why', explanation: card.explanation, sourceNames: card.sourceNames }];
  return [
    { key: 'better' },
    ...why,
    { key: 'examples', examplePair: card.examplePair, literaryUses: card.literaryUses },
  ];
}
