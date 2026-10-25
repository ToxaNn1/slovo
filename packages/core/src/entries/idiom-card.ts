import type { Example, Idiom, IdiomType } from '@slovo/contracts';

/**
 * What an Idiom card shows, decided by the Core: the UI draws it and never
 * picks sections itself. It carries data and keys only; the UI turns the
 * Idiom Type key into the Edition's string, the chip «фразеологізм»,
 * «топонім» or «прислів’я» (ADR 0046). A section without data is left out: `undefined` or
 * an empty list.
 */
export interface IdiomCardModel {
  readonly kind: 'idiom';
  readonly idiomId: string;
  /** The fixed expression, as written; an Idiom has no Stress of its own. */
  readonly expression: string;
  readonly idiomType: IdiomType;
  readonly primaryDefinition: string;
  /** The Definitions after the primary one. */
  readonly extraDefinitions: readonly string[];
  readonly examples: readonly Example[];
  /** «Походження»: where the expression comes from; a place name always has it. */
  readonly etymology: string | undefined;
  /** The titles of the Idiom's sources, in their order; the card names them in a line. */
  readonly sourceTitles: readonly string[];
}

/** The Idiom card of an Idiom. */
export function buildIdiomCard(idiom: Idiom): IdiomCardModel {
  return {
    kind: 'idiom',
    idiomId: idiom.id,
    expression: idiom.expression,
    idiomType: idiom.idiomType,
    primaryDefinition: idiom.primaryDefinition,
    extraDefinitions: idiom.extraDefinitions,
    examples: idiom.examples,
    etymology: idiom.etymology,
    sourceTitles: idiom.sources.map((source) => source.title),
  };
}
