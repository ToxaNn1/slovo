import { fill, type EditionStrings, type Plural } from '@slovo/contracts';
import { withoutStress, type Collection } from '@slovo/core';

/** A Collection's card on the Collections screen. */
export interface CollectionRowModel {
  readonly id: string;
  readonly name: string;
  /** How many Entries it holds, in the Edition's plural form. */
  readonly count: string;
  /** Whether it holds no Entries, so it has nothing to share. */
  readonly empty: boolean;
  /**
   * What VoiceOver reads for the card: the name, the count and the newest
   * Lemmas, without the Stress mark the voices break a word at.
   */
  readonly accessibilityLabel: string;
  /** What VoiceOver reads for the card's rename action. */
  readonly renameLabel: string;
  /** What VoiceOver reads for the card's delete action. */
  readonly deleteLabel: string;
  /** What VoiceOver reads for the card's menu action. */
  readonly moreLabel: string;
}

/** The Collections screen's cards, in the order of the Collections (newest first). */
export function collectionRows({
  collections,
  strings,
  count,
}: {
  collections: readonly Collection[];
  strings: EditionStrings['collections'];
  count: (forms: Plural, count: number) => string;
}): readonly CollectionRowModel[] {
  const { screen } = strings;
  return collections.map(({ id, name, count: total, newestLemmas }) => {
    const entries = count(strings.count, total);
    return {
      id,
      name,
      count: entries,
      empty: total === 0,
      accessibilityLabel:
        newestLemmas.length === 0
          ? fill(strings.collectionLabel, { name, count: entries })
          : fill(screen.rowLabel, {
              name,
              count: entries,
              lemmas: withoutStress(newestLemmas.join(', ')),
            }),
      renameLabel: fill(screen.renameLabel, { name }),
      deleteLabel: fill(screen.deleteLabel, { name }),
      moreLabel: fill(screen.moreLabel, { name }),
    };
  });
}
