import type { Entry, EntryKind } from '@slovo/contracts';

/**
 * The name of each kind of Entry as a whole: the key of its list in
 * `EntryIds` and in the Search results and, for every kind but the Word, its
 * Feature Switch, the key of its Edition strings and the first word of its
 * Game refusal.
 */
export interface KindNames {
  readonly word: 'words';
  readonly correction: 'corrections';
  readonly idiom: 'idioms';
  readonly synonymRow: 'synonymRows';
  readonly tip: 'tips';
}

/**
 * A kind of Entry that is in or out of the Mix as a whole, which its Feature
 * Switch turns on: every kind but the Word, whose Categories are in or out
 * one by one (ADR 0019, 0051).
 */
export type MixKind = Exclude<EntryKind, 'word'>;

/** The name of a kind of Entry in the Mix as a whole, which is also its Feature Switch. */
export type MixKindName = KindNames[MixKind];

/**
 * A kind of Entry with Categories of its own: Words and Corrections each have
 * the Edition's list, in or out of the Mix one by one (ADR 0019, 0050). The
 * other kinds have none.
 */
export type CategoryKind = Extract<EntryKind, 'word' | 'correction'>;

/**
 * A kind of Entry every screen shows: every kind but the Synonym Row and the
 * Tip, which only the Feed, the lists and the Entry screen a list opens show
 * yet (spec #730).
 */
export type ShownKind = Exclude<EntryKind, 'synonymRow' | 'tip'>;

/** An Entry of the kind. */
export type EntryOfKind<Kind extends EntryKind> = Extract<Entry, { kind: Kind }>;

/** What the kind table says of one kind of Entry. Every kind states every trait. */
export interface EntryKindTraits<Kind extends EntryKind> {
  /**
   * The prefix of its ids, a letter and `_`, which tells the kind of an id
   * apart (ADR 0010, 0046, 0051).
   */
  readonly idPrefix: `${string}_`;
  /** Its name as a whole. */
  readonly name: KindNames[Kind];
  /**
   * Every how many cards of the Feed it takes a turn, counted from its last
   * card, while the Cycle has unseen Entries of it; the Word has no turn and
   * takes the cards between the turns (ADR 0046, 0051).
   */
  readonly feedTurn: Kind extends MixKind ? number : undefined;
  /** Whether every screen shows it (spec #730). */
  readonly shown: Kind extends ShownKind ? true : false;
}

/**
 * The kind table: every kind of Entry with every trait, in the Mix screen's
 * order, which is also the order the kinds take a card their Feed turns fall
 * on together. The Entries module owns it (ADR 0015): the Feed's turns,
 * Search and the Game Review read it instead of telling the kinds apart
 * themselves. A further kind is one more row here, and the compiler names
 * every table over the kinds that needs a row for it.
 */
export const ENTRY_KINDS: { readonly [Kind in EntryKind]: EntryKindTraits<Kind> } = {
  word: { idPrefix: 'w_', name: 'words', feedTurn: undefined, shown: true },
  correction: { idPrefix: 'c_', name: 'corrections', feedTurn: 5, shown: true },
  idiom: { idPrefix: 'i_', name: 'idioms', feedTurn: 7, shown: true },
  synonymRow: { idPrefix: 'r_', name: 'synonymRows', feedTurn: 9, shown: false },
  tip: { idPrefix: 't_', name: 'tips', feedTurn: 11, shown: false },
};

/** A table over every kind of Entry, each row what `of` gives for the kind. */
export function tableOfKinds<Row>(of: (kind: EntryKind) => Row): Readonly<Record<EntryKind, Row>> {
  return {
    word: of('word'),
    correction: of('correction'),
    idiom: of('idiom'),
    synonymRow: of('synonymRow'),
    tip: of('tip'),
  };
}

/** Every kind of Entry, in the kind table's order. */
export const ALL_KINDS: readonly EntryKind[] = Object.keys(ENTRY_KINDS) as EntryKind[];

/** Every kind of Entry in the Mix as a whole, in the Mix screen's order. */
export const MIX_KINDS: readonly MixKind[] = ALL_KINDS.filter(
  (kind): kind is MixKind => kind !== 'word',
);

/** The Feature Switch that turns the kind of Entry on, which also names the kind as a whole. */
export const featureOfKind = <Kind extends MixKind>(kind: Kind): KindNames[Kind] =>
  ENTRY_KINDS[kind].name;

/** A table over every kind of Entry: what to make of an Entry of each kind. */
export type ByKind<Result> = {
  readonly [Kind in EntryKind]: (entry: EntryOfKind<Kind>) => Result;
};

/**
 * Applies the row of the Entry's kind, from a table over every kind, to the
 * Entry. A module that reads an Entry's kind-specific fields fills such a
 * table, so a further kind is a row the compiler asks for in each, never a
 * switch arm to copy.
 */
export function byKind<Result>(entry: Entry, table: ByKind<Result>): Result {
  switch (entry.kind) {
    case 'word':
      return table.word(entry);
    case 'correction':
      return table.correction(entry);
    case 'idiom':
      return table.idiom(entry);
    case 'synonymRow':
      return table.synonymRow(entry);
    case 'tip':
      return table.tip(entry);
  }
}
