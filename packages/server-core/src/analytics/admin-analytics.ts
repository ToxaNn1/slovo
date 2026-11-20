import type {
  AnalyticsPeriod,
  AnalyticsQuery,
  AnalyticsRow,
  AnswerCount,
  Authenticator,
  Clock,
  CounterStore,
  CounterTotals,
  PostHogPort,
  TopWords,
  UserRecords,
} from '../ports';
import { createQueryQueue, type Wait } from './query-queue';
import { createSourceCache } from './source-cache';

/** How long a PostHog answer is kept before it is read again (spec #1709). */
export const POSTHOG_FRESH_FOR_MS = 10 * 60_000;
/** PostHog's query API takes 3 queries at once and 240 a minute; the backend stays under. */
const POSTHOG_CONCURRENCY = 3;
const POSTHOG_PER_MINUTE = 239;

/** The Аналітика of some Editions over a period: aggregates only. */
export interface AnalyticsOverview {
  readonly activeByDay: readonly AnalyticsRow[];
  readonly visitsByDay: readonly AnalyticsRow[];
  /** The median length of a Відвідини, in whole seconds; 0 when none. */
  readonly medianVisitSeconds: number;
  readonly devices: readonly AnalyticsRow[];
  readonly appVersions: readonly AnalyticsRow[];
}

/** A read from PostHog, with when its oldest part was read, or that PostHog can't answer. */
export type PostHogRead<T> =
  { readonly ok: true; readonly value: T; readonly fetchedAt: Date } | { readonly ok: false };

/** How many Words of each mark the Лічильники name. */
const TOP_WORDS = 10;

/** The Community Counters sums, top Words and questionnaire counts of some Editions. */
export interface CountersSummary {
  readonly totals: CounterTotals;
  readonly top: TopWords;
  readonly answers: readonly AnswerCount[];
}

/**
 * How many people read the Editions (ADR 0163): the Accounts, of every
 * Edition; the people active on the newest day of the period beyond them, a
 * lower estimate, none while PostHog can't answer; the switch-offs of
 * anonymous statistics over the period.
 */
export interface ReaderCounts {
  readonly registered: number;
  readonly unregisteredAtLeast: number | null;
  readonly statisticsOff: number;
  /** The Accounts with Sync records in the Editions, which follows the Edition filter. */
  readonly syncing: number;
}

/** The admin's Аналітика reads (ADR 0088): PostHog through a cache and a queue, the Counters from the store. */
export interface AdminAnalytics {
  overview(
    editionIds: readonly string[],
    period: AnalyticsPeriod,
  ): Promise<PostHogRead<AnalyticsOverview>>;
  /** People active in each Variant of an A/B Feature Switch. */
  variants(
    editionIds: readonly string[],
    feature: string,
  ): Promise<PostHogRead<readonly AnalyticsRow[]>>;
  counters(editionIds: readonly string[]): Promise<CountersSummary>;
  readers(editionIds: readonly string[], period: AnalyticsPeriod): Promise<ReaderCounts>;
}

/** PostHog answered that it can't answer now. */
class Unavailable extends Error {}

export function createAdminAnalytics({
  posthog,
  counters,
  accounts,
  records,
  clock,
  wait,
}: {
  posthog: PostHogPort;
  counters: CounterStore;
  accounts: Pick<Authenticator, 'accountCount'>;
  records: Pick<UserRecords, 'accountsWithRecords'>;
  clock: Clock;
  /** How the queue waits out PostHog's minute budget. */
  wait: Wait;
}): AdminAnalytics {
  const queue = createQueryQueue({
    clock,
    wait,
    concurrency: POSTHOG_CONCURRENCY,
    perMinute: POSTHOG_PER_MINUTE,
  });
  const cache = createSourceCache<readonly AnalyticsRow[]>({
    clock,
    freshForMs: POSTHOG_FRESH_FOR_MS,
  });

  const read = (query: AnalyticsQuery) =>
    cache.read(JSON.stringify({ ...query, editionIds: [...query.editionIds].sort() }), async () => {
      const answer = await queue.run(() => posthog.query(query));
      if (!answer.ok) throw new Unavailable();
      return answer.rows;
    });

  /**
   * Answers what the body builds from its reads, with when the oldest of them
   * was read, or that PostHog can't answer when one of them can't.
   */
  async function guarded<T>(
    body: (rows: (query: AnalyticsQuery) => Promise<readonly AnalyticsRow[]>) => Promise<T>,
  ): Promise<PostHogRead<T>> {
    const times: number[] = [];
    const rows = async (query: AnalyticsQuery) => {
      const { value, fetchedAt } = await read(query);
      times.push(fetchedAt.getTime());
      return value;
    };
    try {
      const value = await body(rows);
      return { ok: true, value, fetchedAt: new Date(Math.min(...times)) };
    } catch (error) {
      if (error instanceof Unavailable) return { ok: false };
      throw error;
    }
  }

  return {
    overview: (editionIds, period) =>
      guarded(async (rows) => {
        const [activeByDay, visitsByDay, visitSeconds, devices, appVersions] = await Promise.all([
          rows({ kind: 'activeByDay', editionIds, period }),
          rows({ kind: 'visitsByDay', editionIds, period }),
          rows({ kind: 'visitSeconds', editionIds, period }),
          rows({ kind: 'devices', editionIds, period }),
          rows({ kind: 'appVersions', editionIds, period }),
        ]);
        const median = visitSeconds.find(({ key }) => key === 'median')?.count ?? 0;
        return {
          activeByDay,
          visitsByDay,
          medianVisitSeconds: Math.round(median),
          devices,
          appVersions,
        };
      }),

    variants: (editionIds, feature) =>
      guarded((rows) => rows({ kind: 'variants', editionIds, feature })),

    async counters(editionIds) {
      const [totals, top, answers] = await Promise.all([
        counters.totals(editionIds),
        counters.topWords(editionIds, TOP_WORDS),
        counters.answers(editionIds),
      ]);
      return { totals, top, answers };
    },

    async readers(editionIds, period) {
      const [registered, active, statisticsOff, syncing] = await Promise.all([
        accounts.accountCount(),
        // The same query as the overview's, so the cache answers it. The
        // period's newest day is its `to`; a day with no row had no one active.
        guarded(async (rows) => {
          const days = await rows({ kind: 'activeByDay', editionIds, period });
          return days.find(({ key }) => key === period.to)?.count ?? 0;
        }),
        counters.statisticsOffs(editionIds, period),
        records.accountsWithRecords(editionIds),
      ]);
      return {
        registered,
        unregisteredAtLeast: active.ok ? Math.max(0, active.value - registered) : null,
        statisticsOff,
        syncing,
      };
    },
  };
}
