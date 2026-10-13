import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of Collections: the Collections card of the Saved tab and the Add to Collection sheet. The Collections screens add theirs in 0.3. */
export const CollectionsStringsSchema = z.strictObject({
  /** The name of Collections: the Saved tab's card. */
  title: TextSchema,
  /** How many Entries a Collection holds, as the sheet and the Collections card says it and VoiceOver reads it. */
  count: PluralSchema,
  /** How many Collections there are, as VoiceOver reads the count of the Saved tab's card. */
  collectionCount: PluralSchema,
  /** What VoiceOver reads for the Collections card of the Saved tab. Takes `{count}`, the count in words. */
  cardLabel: templateOf('count'),
  /** A Collection on the card, as VoiceOver reads it. Takes `{name}` and `{count}`, the Entries in words. */
  collectionLabel: templateOf('name', 'count'),
  /** The action row's Collections button, as VoiceOver reads it: what a tap will do. */
  button: TextSchema,
  /** The «До колекції» sheet. */
  sheet: z.strictObject({
    title: TextSchema,
    /** A Collection's row, as VoiceOver reads it, with its state as a checkbox. Takes `{name}` and `{count}`, the Entries in words. */
    rowLabel: templateOf('name', 'count'),
    /** The text button that opens the name field. */
    newCollection: TextSchema,
    /** The name field's placeholder, which VoiceOver reads as its label. */
    namePlaceholder: TextSchema,
    /** The button that makes the Collection with the Entry in it. */
    create: TextSchema,
    /** The button that closes the sheet; every checkbox has already applied. */
    done: TextSchema,
    /** Why a name is refused, one text for each reason the Core gives. */
    refusal: z.strictObject({
      empty: TextSchema,
      tooLong: TextSchema,
      duplicate: TextSchema,
    }),
  }),
});
