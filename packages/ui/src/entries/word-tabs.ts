import type { Example, IdiomCardModel, WordCardModel } from '@slovo/core';

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
 * One tab of an Idiom's Entry card (ADR 0088), with what it shows: «Суть» the
 * Definitions and the sources, «Звідки» where the expression comes from,
 * «Приклад» the Examples.
 */
export type IdiomTab =
  | {
      readonly key: 'essence';
      readonly definition: string;
      readonly meanings: readonly string[];
      readonly sourceNames: readonly string[];
    }
  | { readonly key: 'origin'; readonly etymology: string }
  | { readonly key: 'example'; readonly examples: readonly [Example, ...Example[]] };

/** The names of an Idiom card's tabs, which the Edition's strings give. */
export type IdiomTabKey = IdiomTab['key'];

/**
 * The tabs of an Idiom's card, in order, without the ones that would be
 * empty: «Суть» always first, so it is selected on opening, then «Звідки» and
 * «Приклад».
 */
export function idiomTabsOf(card: IdiomCardModel): readonly [IdiomTab, ...IdiomTab[]] {
  const [first, ...rest] = card.examples;
  const tabs: IdiomTab[] = [];
  if (card.etymology !== undefined) tabs.push({ key: 'origin', etymology: card.etymology });
  if (first !== undefined) tabs.push({ key: 'example', examples: [first, ...rest] });
  return [
    {
      key: 'essence',
      definition: card.primaryDefinition,
      meanings: card.extraDefinitions,
      sourceNames: card.sourceNames,
    },
    ...tabs,
  ];
}
