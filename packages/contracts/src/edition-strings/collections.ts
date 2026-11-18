import { z } from 'zod';

import { TextSchema } from '../shared';
import { pluralOf, PluralSchema, templateOf } from './shared';

/** The texts of Collections: the Collections card of the Saved tab and the Add to Collection sheet. The Collections screen, a Collection's screen and Collection Links add their own. */
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
  /** The Entry card's Collections button, as VoiceOver reads it: what a tap will do. */
  button: TextSchema,
  /** The label under the bookmark of the Entry card's Collections tile: `add` while the Entry is in no Collection, «До колекції», `filed` once it is in one, «У колекції». */
  tile: z.strictObject({ add: TextSchema, filed: TextSchema }),
  /** The Collections screen: its cards, their menu, the delete confirmation and the empty list. */
  screen: z.strictObject({
    /** The kicker of a Collection's screen in the board style, «КОЛЕКЦІЯ · {count}» (ADR 0082). Takes `{count}`, the `wordCount` phrase. */
    kicker: templateOf('count'),
    /** How many Entries the kicker of a Collection's screen counts, «{count} слів». */
    wordCount: PluralSchema,
    /** The «+» that opens the field for a new Collection, as VoiceOver reads it. */
    add: TextSchema,
    /** A Collection as VoiceOver reads it, with its newest Lemmas. Takes `{name}`, `{count}` (the Entries in words) and `{lemmas}`. */
    rowLabel: templateOf('name', 'count', 'lemmas'),
    /** The «…» button of a row, as VoiceOver reads it. Takes `{name}`. */
    moreLabel: templateOf('name'),
    /** The menu the «…» button opens: rename, delete and the cancel row; the share row is `link.share` (ADR 0132). */
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
  /** A Collection's screen: the action that takes an Entry out, and the empty Collection. */
  entries: z.strictObject({
    /** The action that takes an Entry out of this Collection only. */
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
    /** Shown and announced under a name field when keeping the name fails, such as on a storage error: the name stays to try again. */
    nameFailed: TextSchema,
    /** Why a name is refused, one text for each reason the Core gives. */
    refusal: z.strictObject({
      empty: TextSchema,
      tooLong: TextSchema,
      duplicate: TextSchema,
    }),
  }),
  /** The bottom sheet that names a new Collection or renames one (ADR 0132); its field takes `sheet.namePlaceholder` and its refusals `sheet.refusal`. */
  nameSheet: z.strictObject({
    /** The sheet's title for a new Collection. */
    newTitle: TextSchema,
    /** The sheet's title for a rename. */
    renameTitle: TextSchema,
    /** The counter under the field. Takes `{count}`, the name's characters, and `{max}`, the most a name holds. */
    counter: templateOf('count', 'max'),
    /** The button that makes the new Collection. */
    create: TextSchema,
    /** The button that keeps the new name. */
    save: TextSchema,
    /** The button that closes the sheet. */
    cancel: TextSchema,
  }),
  /** The bottom sheet that shares a Collection Link (ADR 0132). */
  shareSheet: z.strictObject({
    /** The sheet's title. */
    title: TextSchema,
    /** The line on what the link holds. */
    snapshot: TextSchema,
    /** The button that copies the link. */
    copy: TextSchema,
    /** The button that opens the system share sheet. */
    share: TextSchema,
    /** The button that closes the sheet. */
    cancel: TextSchema,
  }),
  /** The toasts after a Collection action (ADR 0132). */
  toasts: z.strictObject({
    /** Takes `{name}`, the new Collection's. */
    created: templateOf('name'),
    renamed: TextSchema,
    deleted: TextSchema,
    /** The action of the `deleted` toast that brings the Collection back. */
    undo: TextSchema,
    /** The link is on the clipboard. */
    copied: TextSchema,
  }),
  /** Collection Links: sharing a Collection and the recipient's sheet that copies it (ADR 0058). */
  link: z.strictObject({
    /** The Collection menu's action that shares a link. */
    share: TextSchema,
    /** The message the share sheet sends. Takes `{name}`, the Collection's, and `{url}`, the link. */
    message: templateOf('name', 'url'),
    /** The toast, and the recipient's sheet, when there is no connection. */
    offline: TextSchema,
    /** The toast when the Collection holds more Entries than a link does. */
    tooManyEntries: TextSchema,
    /** The toast when the backend makes no link for any other reason, such as the day's limit. */
    failed: TextSchema,
    /** The recipient's button that makes their own copy of the Collection. */
    add: TextSchema,
    /** The toast when the recipient's copy could not be written. */
    addFailed: TextSchema,
    /** How many Entries of the link the reader's pack lacks, so the copy skipped them, `{count}`. */
    unavailable: pluralOf(),
    /** What the recipient's sheet, and the link's web page, say when the link no longer exists. */
    notFound: TextSchema,
    /** The web page a browser gets for the link, `https://<domain>/<edition>/c/<id>` (ADR 0058). */
    page: z.strictObject({
      /** The page's title. Takes `{name}`, the Collection's. */
      title: templateOf('name'),
      /** The line that the page shows the Collection as it was when it was shared. */
      snapshot: TextSchema,
      /** The link that opens the Collection in the app. */
      open: TextSchema,
      /** The line on how to get the app while it is in TestFlight only. */
      testFlight: TextSchema,
      /** The heading of each kind of Entry the page lists. */
      kinds: z.strictObject({
        word: TextSchema,
        correction: TextSchema,
        idiom: TextSchema,
        synonymRow: TextSchema,
        tip: TextSchema,
      }),
    }),
  }),
});
