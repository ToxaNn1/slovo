import { CollectionLinkIdSchema } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { EntryRowModel, EntryRows } from '../entries/entry-row';
import type { CollectionLinksApi, CollectionLinksApiFailure, Random, Schedule } from '../ports';
import { withRetries } from '../retry';
import type { Collection, Collections } from '../saved/collections';

/** How many Entries the recipient sheet shows of a Collection Link. */
const PREVIEW_SIZE = 5;

/**
 * What a Collection Link opens as on the recipient sheet: its preview and
 * «Додати собі», or why not. `offline` when the backend could not be reached
 * or failed («Немає з'єднання»); `unavailable` for an unknown link, a link of
 * another Edition, or while `collectionLinks` is off in effect.
 */
export type CollectionLinkPreview =
  | {
      readonly ok: true;
      /** The name it was shared with. */
      readonly name: string;
      /** How many Entries it holds, those missing from the Language Pack included. */
      readonly count: number;
      /** The rows of its first 5 Entries the Language Pack has, Hidden ones too, in its order. */
      readonly firstEntries: readonly EntryRowModel[];
      /** How many of its Entries the Language Pack doesn't have, for the Edition's plural forms. */
      readonly skipped: number;
      /**
       * «Додати собі»: makes the reader's own copy of it, a new Collection on
       * every call, and answers it; none when the Language Pack has none of
       * its Entries, so there is never an empty copy.
       */
      readonly add: (() => Promise<Collection>) | undefined;
    }
  | { readonly ok: false; readonly reason: 'offline' | 'unavailable' };

/** The Core's side of a Collection Link opened by its recipient (ADR 0058). */
export interface CollectionLinkCopy {
  /** Reads the link of the id, through the one retry rule (ADR 0037), and previews it. */
  preview(linkId: string): Promise<CollectionLinkPreview>;
}

/** The failures after which the sheet says there is no connection: they may pass by themselves. */
const offlineFor: ReadonlySet<CollectionLinksApiFailure['reason']> = new Set([
  'offline',
  'server-error',
  'too-many-requests',
]);

const UNAVAILABLE = { ok: false, reason: 'unavailable' } as const;

/**
 * Makes the copies of Collection Links for the Core composition. Without
 * `api`, as in tests of other features, every link is unavailable; without
 * `schedule` a read is tried once.
 */
export function createCollectionLinkCopy({
  api,
  edition,
  rows,
  collections,
  schedule,
  random,
}: {
  api: CollectionLinksApi | undefined;
  /** The Edition as the app runs it, with each Feature Switch at its effective value. */
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  rows: EntryRows;
  collections: Pick<Collections, 'createCopy'>;
  schedule: Schedule | undefined;
  random: Random;
}): CollectionLinkCopy {
  return {
    async preview(linkId) {
      const id = CollectionLinkIdSchema.safeParse(linkId);
      if (api === undefined || !id.success || !edition.isFeatureEnabled('collectionLinks')) {
        return UNAVAILABLE;
      }
      const read = () => api.read(id.data);
      const answer = await (schedule === undefined
        ? read()
        : withRetries(read, { schedule, random }));
      if (!answer.ok)
        return offlineFor.has(answer.reason) ? { ok: false, reason: 'offline' } : UNAVAILABLE;
      const { link } = answer;
      if (link.edition !== edition.id) return UNAVAILABLE;
      const rowOf = await rows.rows(link.entryIds);
      const available = link.entryIds.flatMap((entryId) => rowOf.get(entryId) ?? []);
      return {
        ok: true,
        name: link.name,
        count: link.entryIds.length,
        firstEntries: available.slice(0, PREVIEW_SIZE),
        skipped: link.entryIds.length - available.length,
        add:
          available.length === 0
            ? undefined
            : () => collections.createCopy(link.name, link.entryIds),
      };
    },
  };
}
