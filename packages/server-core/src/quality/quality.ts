import type { CiRun, CiRunStore, Clock, SentryRead, SentryReader } from '../ports';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sentry keeps its data this long, so Якість reads no further back. */
export const SENTRY_RETENTION_DAYS = 30;
/** How long a Sentry number stays fresh before Якість reads it again. */
const FRESH_MS = 5 * 60 * 1000;

export const SENTRY_READS: readonly SentryRead[] = [
  'crashFree',
  'crashes',
  'errors',
  'newIssues',
  'backendP95',
  'appStart',
];

/** One Sentry number of Якість: the period's, the same a day earlier, and when it was read. */
export type QualityKpi =
  | {
      readonly state: 'ok';
      readonly value: number | null;
      readonly yesterday: number | null;
      readonly fetchedAt: Date;
    }
  | { readonly state: 'unavailable' };

/** What Якість answers of Sentry for a period. */
export interface QualityAnswer {
  /** The period asked was longer than Sentry keeps, and was cut to it. */
  readonly capped: boolean;
  readonly from: Date;
  readonly to: Date;
  readonly kpis: Readonly<Record<SentryRead, QualityKpi>>;
}

/** A CI run in the history, with its failed tests that passed in another run of the period. */
export interface CiHistoryRun extends CiRun {
  readonly flakyTests: readonly string[];
}

export interface Quality {
  /** Sentry's numbers for the last `days`, cut to 30 days. */
  read(query: {
    readonly editionId?: string | undefined;
    readonly days: number;
  }): Promise<QualityAnswer>;
  /** Keeps a CI run CI pushed. */
  pushCiRun(run: CiRun): Promise<void>;
  /** The CI runs of the last `days`, oldest first. */
  ciHistory(days: number): Promise<readonly CiHistoryRun[]>;
}

interface Kept {
  readonly value: number | null;
  readonly fetchedAt: Date;
}

/**
 * Якість (#1728): Sentry's numbers, kept fresh for 5 minutes in memory, and
 * the CI history. While Sentry limits the reads, the numbers kept are served
 * and Sentry is not asked again before it allows.
 */
export function createQuality({
  sentry,
  ciRuns,
  clock,
}: {
  readonly sentry: SentryReader;
  readonly ciRuns: CiRunStore;
  readonly clock: Clock;
}): Quality {
  const kept = new Map<string, Kept>();
  let limitedUntil = 0;

  async function number(
    read: SentryRead,
    editionId: string | undefined,
    from: Date,
    to: Date,
    key: string,
  ): Promise<Kept | undefined> {
    const now = clock.now();
    const before = kept.get(key);
    if (before !== undefined && now.getTime() - before.fetchedAt.getTime() < FRESH_MS)
      return before;
    if (now.getTime() < limitedUntil) return before;
    const answer = await sentry.read(read, { editionId, from, to });
    if (answer.ok) {
      const fresh = { value: answer.value, fetchedAt: now };
      kept.set(key, fresh);
      return fresh;
    }
    if (answer.reason === 'rate-limited') limitedUntil = answer.retryAt.getTime();
    return before;
  }

  async function kpi(read: SentryRead, editionId: string | undefined, days: number, to: Date) {
    const key = `${read}|${editionId ?? '*'}|${String(days)}`;
    const shift = (date: Date, by: number) => new Date(date.getTime() - by);
    const from = shift(to, days * DAY_MS);
    const value = await number(read, editionId, from, to, `${key}|now`);
    const yesterday = await number(
      read,
      editionId,
      shift(from, DAY_MS),
      shift(to, DAY_MS),
      `${key}|yesterday`,
    );
    if (value === undefined) return { state: 'unavailable' } as const;
    return {
      state: 'ok',
      value: value.value,
      yesterday: yesterday?.value ?? null,
      fetchedAt: value.fetchedAt,
    } as const;
  }

  return {
    async read({ editionId, days }) {
      const capped = days > SENTRY_RETENTION_DAYS;
      const cut = Math.min(days, SENTRY_RETENTION_DAYS);
      const to = clock.now();
      const entries = await Promise.all(
        SENTRY_READS.map(async (read) => [read, await kpi(read, editionId, cut, to)] as const),
      );
      return {
        capped,
        from: new Date(to.getTime() - cut * DAY_MS),
        to,
        kpis: Object.fromEntries(entries) as Record<SentryRead, QualityKpi>,
      };
    },

    pushCiRun: (run) => ciRuns.add(run),

    async ciHistory(days) {
      const to = clock.now();
      const runs = await ciRuns.between(new Date(to.getTime() - days * DAY_MS), to);
      return runs.map((run) => ({
        ...run,
        flakyTests: run.failedTests.filter((test) =>
          runs.some((other) => other !== run && !other.failedTests.includes(test)),
        ),
      }));
    },
  };
}
