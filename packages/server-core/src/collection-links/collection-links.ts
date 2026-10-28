import type { CollectionLink } from '@slovo/contracts';

import type { EditionRegistry, NotServing } from '../edition/edition-registry';
import type { Clock, CollectionLinkStore, Random } from '../ports';

/** The characters of a Collection Link's id: letters and digits (ADR 0058). */
const ID_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** How many characters a Collection Link's id has. */
const ID_LENGTH = 10;

/**
 * How many ids a new link draws before it gives up. Two links meet on one id
 * once in some 10^17 draws, so a second draw already means broken randomness.
 */
const ID_DRAWS = 5;

/** What a request for a link the backend doesn't keep gets. */
interface UnknownLink {
  readonly ok: false;
  readonly reason: 'unknown-link';
}

/** The Collection Links readers share and open, with no Account on either side (ADR 0058). */
export interface CollectionLinks {
  /**
   * Keeps the Collection as it is now under a new random id, when its Edition
   * serves Collection Links, and answers the id and the link's URL,
   * `https://<linkDomain>/c/<id>`. Its shape is checked where it enters;
   * whether its Entries are in a pack is not.
   */
  create(
    link: CollectionLink,
  ): Promise<{ readonly ok: true; readonly id: string; readonly url: string } | NotServing>;
  /**
   * The Collection as it was kept under the id, when its Edition serves
   * Collection Links now.
   */
  read(
    id: string,
  ): Promise<{ readonly ok: true; readonly link: CollectionLink } | NotServing | UnknownLink>;
}

export function createCollectionLinks({
  editions,
  store,
  clock,
  random,
}: {
  editions: EditionRegistry;
  store: CollectionLinkStore;
  clock: Clock;
  random: Random;
}): CollectionLinks {
  const newId = () =>
    Array.from({ length: ID_LENGTH }, () =>
      ID_CHARACTERS.charAt(random.int(ID_CHARACTERS.length)),
    ).join('');

  return {
    async create(link) {
      const serving = await editions.serving(link.edition, 'collectionLinks');
      if (!serving.ok) return serving;
      const kept = { ...link, createdAt: clock.now() };
      for (let draw = 0; draw < ID_DRAWS; draw += 1) {
        const id = newId();
        if (await store.keep(id, kept)) {
          return { ok: true, id, url: `https://${serving.edition.config.linkDomain}/c/${id}` };
        }
      }
      throw new Error(`no free Collection Link id in ${String(ID_DRAWS)} draws`);
    },
    async read(id) {
      const kept = await store.find(id);
      if (kept === undefined) return { ok: false, reason: 'unknown-link' };
      const serving = await editions.serving(kept.edition, 'collectionLinks');
      if (!serving.ok) return serving;
      const { edition, name, entryIds } = kept;
      return { ok: true, link: { edition, name, entryIds } };
    },
  };
}
