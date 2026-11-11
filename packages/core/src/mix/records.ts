import { MixKindWeightSchema, QuickQuestionEverySchema } from '@slovo/contracts';
import { z } from 'zod';

import {
  featureOfKind,
  tableOfMixKinds,
  type KindNames,
  type MixKind,
} from '../entries/entry-kinds';
import {
  declareRecord,
  declareRecords,
  InstantSchema,
  type UserStateRecord,
} from '../user-state/user-state-record';

/**
 * Whether the user has each kind of Entry beside Words, as a whole, in the
 * Mix, one record per kind under `mix.` and the kind's name (`mix.idioms`);
 * without it, the Edition's default Mix. They sync last write wins like the
 * rest of the Mix (ADR 0041, 0051); a further kind's key needs no migration.
 */
export const mixKindRecords = tableOfMixKinds((kind) =>
  declareRecord(`mix.${featureOfKind(kind)}`, z.boolean()),
);

/**
 * The same records by the name the user state keeps each under. A further
 * kind of Entry in the Mix is a row the compiler asks for here.
 */
const mixKindRecordsByName: {
  readonly [Kind in MixKind as `mix${Capitalize<KindNames[Kind]>}`]: UserStateRecord<boolean>;
} = {
  mixCorrections: mixKindRecords.correction,
  mixIdioms: mixKindRecords.idiom,
  mixSynonymRows: mixKindRecords.synonymRow,
  mixTips: mixKindRecords.tip,
};

/** The records of the Mix and the Hidden Entries. */
export const mixRecords = {
  /** The Hidden Entries, one record per Entry, by Entry id: the instant it was hidden. */
  hiddenEntries: declareRecords('hidden.', InstantSchema),
  /**
   * The Categories the user put in the Mix or took out of it, one record per
   * Category, by Category id (which holds no `.`): whether it is in. A
   * Category without one follows the Edition's default Mix (ADR 0019).
   */
  mixCategories: declareRecords('mix.categories.', z.boolean()),
  /**
   * The Categories of Corrections the user put in the Mix or took out of it,
   * one record per Category, by Category id, apart from the Words' Categories,
   * whose ids they may share (ADR 0033): whether it is in. One without a
   * record follows the Edition's default Mix. It syncs last write wins like the
   * rest of the Mix (ADR 0041); a new key needs no migration.
   */
  mixCorrectionCategories: declareRecords('mix.correctionCategories.', z.boolean()),
  ...mixKindRecordsByName,
  /**
   * The Mix kind weight the user chose for Corrections, Idioms, Synonym Rows
   * or Tips, one record per kind; without it, «Звичайно». It syncs last write
   * wins like the rest of the Mix (ADR 0041); a new key needs no migration.
   */
  mixKindWeights: declareRecords('mix.kindWeights.', MixKindWeightSchema),
  /** How often the Feed asks a Quick Question; the Core's default unless the user chose. */
  mixQuickQuestion: declareRecord('mix.quickQuestion', QuickQuestionEverySchema),
};
