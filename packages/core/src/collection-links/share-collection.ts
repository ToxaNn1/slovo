import { COLLECTION_LINK_SIZE, fill, type EditionStrings } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import type { CollectionLinksApi, Random, Schedule } from '../ports';
import { withRetries } from '../retry';
import type { Collections } from '../saved/collections';

/**
 * Why a Collection is not shared, for the shell to say in the Edition's words:
 * `switched-off` while `collectionLinks` is off in effect or the backend has it
 * off for the Edition (404), `empty` for a Collection with no Entries or one
 * that is gone, `too-many-entries` for one of more Entries than a link holds,
 * `offline` after every try met no answer, `too-many-requests` over the daily
 * limit, and `failed` for any other answer of the backend.
 */
export type CollectionShareRefusal =
  'switched-off' | 'empty' | 'too-many-entries' | 'offline' | 'too-many-requests' | 'failed';

/** What sharing a Collection comes to: the link and the message for the system share sheet, or why not. */
export type CollectionShare =
  | { readonly ok: true; readonly url: string; readonly message: string }
  | { readonly ok: false; readonly reason: CollectionShareRefusal };

/**
 * Sharing a Collection by a Collection Link (ADR 0058): «Поділитися
 * посиланням» stores the Collection as it is now on the server, its name and
 * its Entry ids as the Collection's screen orders them, Hidden and Retired
 * ones too, and answers the message the share sheet sends. It needs no
 * Account. The request goes once through the one retry rule (ADR 0037) and is
 * never queued. Nothing it does rejects.
 */
export interface CollectionSharing {
  /** Whether a Collection's menu offers «Поділитися посиланням»: `collectionLinks` is on in effect, read each time. */
  available(): boolean;
  /** Asks the backend for a new link to the Collection as it is now; each call makes a new one. */
  share(collectionId: string): Promise<CollectionShare>;
}

/** Opens the sharing of Collections over the Collections of the composition. */
export function openCollectionSharing({
  collections,
  api,
  edition,
  strings,
  schedule,
  random,
}: {
  collections: Pick<Collections, 'list' | 'entries'>;
  api: CollectionLinksApi;
  /** The Edition as the app runs it, with each Feature Switch at its effective value. */
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  strings: Pick<EditionStrings['collections']['link'], 'message'>;
  /** What the waits between tries wait by. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): CollectionSharing {
  const available = () => edition.isFeatureEnabled('collectionLinks');

  return {
    available,
    async share(collectionId) {
      if (!available()) return { ok: false, reason: 'switched-off' };
      const collection = collections.list.find(({ id }) => id === collectionId);
      const entryIds = collections.entries(collectionId).map(({ entryId }) => entryId);
      if (collection === undefined || entryIds.length === 0) return { ok: false, reason: 'empty' };
      if (entryIds.length > COLLECTION_LINK_SIZE) return { ok: false, reason: 'too-many-entries' };
      const answer = await withRetries(
        () => api.create({ edition: edition.id, name: collection.name, entryIds }),
        { schedule, random },
      );
      if (answer.ok) {
        const message = fill(strings.message, { name: collection.name, url: answer.url });
        return { ok: true, url: answer.url, message };
      }
      switch (answer.reason) {
        case 'offline':
        case 'too-many-requests':
          return { ok: false, reason: answer.reason };
        case 'not-found':
          return { ok: false, reason: 'switched-off' };
        case 'server-error':
        case 'unexpected':
          return { ok: false, reason: 'failed' };
      }
    },
  };
}
