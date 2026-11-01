import { MixKindWeightSchema, QuickQuestionEverySchema, RaritySchema } from '@slovo/contracts';
import { z } from 'zod';

import { declareRecord, declareRecords, InstantSchema } from '../user-state/user-state-record';

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
  /** Whether the user has Corrections, as a whole, in the Mix; without it, the Edition's default Mix. */
  mixCorrections: declareRecord('mix.corrections', z.boolean()),
  /**
   * Whether the user has Idioms, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041); a new key needs no migration.
   */
  mixIdioms: declareRecord('mix.idioms', z.boolean()),
  /**
   * Whether the user has Synonym Rows, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041, 0051).
   */
  mixSynonymRows: declareRecord('mix.synonymRows', z.boolean()),
  /**
   * Whether the user has Tips, as a whole, in the Mix; without it, the
   * Edition's default Mix. It syncs last write wins like the rest of the Mix
   * (ADR 0041, 0051).
   */
  mixTips: declareRecord('mix.tips', z.boolean()),
  /**
   * The Mix kind weight the user chose for Corrections, Idioms, Synonym Rows
   * or Tips, one record per kind; without it, «Звичайно». It syncs last write
   * wins like the rest of the Mix (ADR 0041); a new key needs no migration.
   */
  mixKindWeights: declareRecords('mix.kindWeights.', MixKindWeightSchema),
  /**
   * The Rarity Floor the user chose, 1 to 5; without it, the Edition's
   * default. It syncs last write wins like the rest of the Mix (ADR 0041).
   */
  mixRarityFloor: declareRecord('mix.rarityFloor', RaritySchema),
  /**
   * The Rarity Ceiling the user chose, 1 to 5; without it, the Edition's
   * default. Never below the Rarity Floor when read. It syncs last write wins
   * like the rest of the Mix (ADR 0041).
   */
  mixRarityCeiling: declareRecord('mix.rarityCeiling', RaritySchema),
  /** How often the Feed asks a Quick Question; the Core's default unless the user chose. */
  mixQuickQuestion: declareRecord('mix.quickQuestion', QuickQuestionEverySchema),
};
