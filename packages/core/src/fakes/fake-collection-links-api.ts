import { CollectionLinkSchema, type CollectionLink } from '@slovo/contracts';

import type { CollectionLinksApi, CollectionLinksApiFailure } from '../ports';

/**
 * A Collection Link API for tests that keeps the links it makes in memory, by
 * the backend's rules (ADR 0058): it refuses a link of the wrong shape (400)
 * and answers any other with the next id, `link000001` on, and its URL on the
 * link domain. It reads a link it made back as it was stored, and answers an
 * unknown id `not-found`.
 */
export interface FakeCollectionLinksApi extends CollectionLinksApi {
  /** The links the backend made, in order. */
  readonly made: readonly CollectionLink[];
  /** How many calls reached the API, the failed ones included. */
  readonly calls: number;
  /** Whether the backend can be reached; while it can't, every call answers `offline`. */
  online: boolean;
  /** Makes the next call fail with the reason, before it keeps anything. */
  failNext(reason: CollectionLinksApiFailure['reason']): void;
}

/** Makes a fake Collection Link API on the link domain, online. */
export function createFakeCollectionLinksApi({
  linkDomain = 'links.example',
}: { linkDomain?: string } = {}): FakeCollectionLinksApi {
  const made: CollectionLink[] = [];
  const byId = new Map<string, CollectionLink>();
  const failures: CollectionLinksApiFailure[] = [];
  let calls = 0;

  const api: FakeCollectionLinksApi = {
    made,
    get calls() {
      return calls;
    },
    online: true,
    failNext(reason) {
      failures.push({ ok: false, reason });
    },
    create(link) {
      calls += 1;
      if (!api.online) return Promise.resolve({ ok: false, reason: 'offline' });
      const failure = failures.shift();
      if (failure !== undefined) return Promise.resolve(failure);
      const parsed = CollectionLinkSchema.safeParse(link);
      if (!parsed.success) return Promise.resolve({ ok: false, reason: 'unexpected' });
      made.push(parsed.data);
      const id = `link${String(made.length).padStart(6, '0')}`;
      byId.set(id, parsed.data);
      return Promise.resolve({ ok: true, id, url: `https://${linkDomain}/c/${id}` });
    },
    read(id) {
      calls += 1;
      if (!api.online) return Promise.resolve({ ok: false, reason: 'offline' });
      const failure = failures.shift();
      if (failure !== undefined) return Promise.resolve(failure);
      const link = byId.get(id);
      return Promise.resolve(
        link === undefined ? { ok: false, reason: 'not-found' } : { ok: true, link },
      );
    },
  };
  return api;
}
