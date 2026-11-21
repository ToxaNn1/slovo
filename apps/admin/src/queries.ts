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

/** The reader counts of one Edition, or of all of them, over the given days (ADR 0163). */
export const readerCountsQuery = (editionId: string, days: { from: string; to: string }) =>
  queryOptions({
    queryKey: ['readerCounts', editionId, days],
    queryFn: () => adminApi.readerCounts({ editionId, ...days }),
    retry: false,
  });

/** Якість of the filtered Edition over a Quality period. */
export const qualityQuery = (input: Parameters<typeof adminApi.quality>[0]) =>
  queryOptions({
    queryKey: ['quality', input.editionId, input.period],
    queryFn: () => adminApi.quality(input),
    retry: false,
  });

/** Розробка: GitHub and EAS, read by Розробка and Огляд. */
export const developmentQuery = queryOptions({
  queryKey: ['development'],
  queryFn: () => adminApi.development(),
  retry: false,
});

/** The latest alerts the owner was told of. */
export const latestAlertsQuery = queryOptions({
  queryKey: ['alerts'],
  queryFn: () => adminApi.latestAlerts(),
  retry: false,
});
