import type { Clock, SourceRead } from '../ports';

/** A value read from an outside service, with the time it was read. */
export type FreshRead<Value> =
  | { readonly ok: true; readonly value: Value; readonly fetchedAt: Date }
  | { readonly ok: false; readonly reason: 'unavailable' };

/**
 * Wraps the read of an outside service in a cache of `ttlMs`. Within the ttl
 * the kept answer comes back and the service is not called. After it, the
 * service is read again; when that read fails, the last good answer comes back
 * with the time it was read, and `unavailable` only while none is kept. A
 * failure is never kept, so the next call reads again.
 */
export function cachedRead<Value>(
  clock: Clock,
  ttlMs: number,
  read: () => Promise<SourceRead<Value>>,
): () => Promise<FreshRead<Value>> {
  let kept: { value: Value; fetchedAt: Date } | undefined;
  return async () => {
    const now = clock.now();
    if (kept !== undefined && now.getTime() - kept.fetchedAt.getTime() < ttlMs) {
      return { ok: true, ...kept };
    }
    const answer = await read();
    if (answer.ok) kept = { value: answer.value, fetchedAt: now };
    return kept === undefined ? { ok: false, reason: 'unavailable' } : { ok: true, ...kept };
  };
}
