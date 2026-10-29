import { z } from 'zod';

import { CollectionLinkIdSchema, CollectionLinkSchema } from '../collection-link';
import { procedure } from './procedure';

/** A procedure of Collection Links. */
const ofCollectionLinks = procedure.errors({
  /** An unknown link, an Edition the backend doesn't serve, or one with Collection Links switched off. */
  NOT_FOUND: { message: 'Not found' },
});

/**
 * The Collection Link procedures (ADR 0058). They need no Account and send no
 * Session, even when the reader is signed in.
 */
export const collectionLinksContract = {
  create: ofCollectionLinks
    .route({
      method: 'POST',
      path: '/collection-links',
      summary: 'Share a Collection behind a link',
      description:
        "Stores the Collection as it is now and answers the link's id and its URL, `https://<linkDomain>/c/<id>`. The backend checks the shape, not whether the Entries are in a pack: a name of 1 to 60 characters once trimmed, 1 to 200 Entries, each once. A link never changes and never expires; it is kept with its Edition, name, Entry ids and the time it was made only: no Account, no device id, no IP address (ADR 0058).",
      tags: ['collection-links'],
    })
    .errors({
      /**
       * Over the limit of 20 links from one IP address in a day;
       * `Retry-After` says, in seconds, when to try again.
       */
      TOO_MANY_REQUESTS: { message: 'Too many requests' },
    })
    .input(CollectionLinkSchema)
    .output(z.object({ id: CollectionLinkIdSchema, url: z.url({ protocol: /^https$/ }) })),

  read: ofCollectionLinks
    .route({
      method: 'GET',
      path: '/collection-links/{id}',
      summary: 'A shared Collection',
      description:
        'The Collection as it was stored when it was shared: its Edition, its name and its Entry ids in its order. An unknown id answers 404 and a malformed id answers 400. Reading a link is not limited (ADR 0058).',
      tags: ['collection-links'],
    })
    .input(z.strictObject({ id: CollectionLinkIdSchema }))
    .output(CollectionLinkSchema),
};
