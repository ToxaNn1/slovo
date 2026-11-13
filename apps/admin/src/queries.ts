import { queryOptions } from '@tanstack/react-query';

import { adminApi } from './api';

/*
 * The reads more than one screen makes. A failed read shows its notice at
 * once (no retries): the backend caches and queues its own upstream reads.
 */

/** The Editions the admin manages. */
export const editionsQuery = queryOptions({
  queryKey: ['editions'],
  queryFn: () => adminApi.editions(),
  retry: false,
});

/** Аналітика of one Edition, or of all of them, over the given days. */
export const analyticsQuery = (editionId: string, days: { from: string; to: string }) =>
  queryOptions({
    queryKey: ['analytics', editionId, days],
    queryFn: () => adminApi.analytics({ editionId, ...days }),
    retry: false,
  });

/** Якість of the filtered Edition over a Quality period. */
export const qualityQuery = (input: Parameters<typeof adminApi.quality>[0]) =>
  queryOptions({
    queryKey: ['quality', input.editionId, input.period],
    queryFn: () => adminApi.quality(input),
    retry: false,
  });
