import { z } from 'zod';

import { TextSchema } from '../shared';
import { PluralSchema, templateOf } from './shared';

/** The texts of Collections: the Collections card of the Saved tab and the Add to Collection sheet. The Collections screen and a Collection's screen add their own. */
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
  /** The Collections screen: its rows, its swipe actions, the name fields, the delete confirmation and the empty list. */
  screen: z.strictObject({
    /** The «+» that opens the field for a new Collection, as VoiceOver reads it. */
    add: TextSchema,
    /** The small capitals over the field for a new Collection. */
    newOverline: TextSchema,
    /** The small capitals over the field of a Collection being renamed. */
    renameOverline: TextSchema,
    /** A Collection as VoiceOver reads it, with its newest Lemmas. Takes `{name}`, `{count}` (the Entries in words) and `{lemmas}`. */
    rowLabel: templateOf('name', 'count', 'lemmas'),
    /** The swipe action that renames a Collection in place. */
    rename: TextSchema,
    /** The same action as VoiceOver reads it. Takes `{name}`. */
    renameLabel: templateOf('name'),
    /** The swipe action that deletes a Collection. */
    delete: TextSchema,
    /** The same action as VoiceOver reads it. Takes `{name}`. */
    deleteLabel: templateOf('name'),
    /** The «…» button of a row, as VoiceOver reads it. Takes `{name}`. */
    moreLabel: templateOf('name'),
    /** The menu the «…» button opens: the same two actions as the swipe, and the cancel row. */
    menu: z.strictObject({
      rename: TextSchema,
      delete: TextSchema,
      cancel: TextSchema,
    }),
    /** The SLOVO confirmation dialog that confirms deleting a Collection. */
    confirmDelete: z.strictObject({
      /** Takes `{name}`. */
      title: templateOf('name'),
      /** Says what stays: the Entries of the Collection are kept wherever else they are. */
      message: TextSchema,
      confirm: TextSchema,
      cancel: TextSchema,
    }),
    /** The empty list. */
    empty: z.strictObject({
      title: TextSchema,
      message: TextSchema,
      /** The button that opens the field for a new Collection. */
      create: TextSchema,
    }),
  }),
  /** A Collection's screen: its Entries newest first, the swipe action that takes one out, and the empty Collection. */
  entries: z.strictObject({
    /** The line under the list, on how it is ordered and what a tap does. */
    footer: TextSchema,
    /** The swipe action that takes an Entry out of this Collection only. */
    remove: TextSchema,
    /** The same action as VoiceOver reads it. Takes `{title}`, the Entry's, and `{name}`, the Collection's. */
    removeLabel: templateOf('title', 'name'),
    /** The empty Collection, with a hint on how to fill it. */
    empty: z.strictObject({
      title: TextSchema,
      message: TextSchema,
    }),
  }),
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
