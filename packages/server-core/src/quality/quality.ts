import type { CiRun, CiRunStore, Clock, SentryRead, SentryReader, SourceRead } from '../ports';
import { cachedRead, type FreshRead } from '../sources/cached-source';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Sentry keeps its data this long, so Якість reads no further back. */
export const SENTRY_RETENTION_DAYS = 30;
/** How long a Sentry number stays fresh before Якість reads it again. */
const FRESH_MS = 5 * 60 * 1000;

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
  const reads = new Map<string, () => Promise<FreshRead<number | null>>>();
  let limitedUntil = 0;

  /** One Sentry number over the `days` before now, shifted back by `shiftMs`, cached by its key. */
  function number(read: SentryRead, editionId: string | undefined, days: number, shiftMs: number) {
    const key = `${read}|${editionId ?? '*'}|${String(days)}|${String(shiftMs)}`;
    let cached = reads.get(key);
    if (cached === undefined) {
      cached = cachedRead(clock, FRESH_MS, async (): Promise<SourceRead<number | null>> => {
        const now = clock.now().getTime();
        if (now < limitedUntil) return { ok: false, reason: 'unavailable' };
        const to = new Date(now - shiftMs);
        const from = new Date(to.getTime() - days * DAY_MS);
        const answer = await sentry.read(read, { editionId, from, to });
        if (answer.ok) return answer;
        if (answer.reason === 'rate-limited') limitedUntil = answer.retryAt.getTime();
        return { ok: false, reason: 'unavailable' };
      });
      reads.set(key, cached);
    }
    return cached();
  }

  async function kpi(read: SentryRead, editionId: string | undefined, days: number) {
    const value = await number(read, editionId, days, 0);
    const yesterday = await number(read, editionId, days, DAY_MS);
    if (!value.ok) return { state: 'unavailable' } as const;
    return {
      state: 'ok',
      value: value.value,
      yesterday: yesterday.ok ? yesterday.value : null,
      fetchedAt: value.fetchedAt,
    } as const;
  }

  return {
    async read({ editionId, days }) {
      const capped = days > SENTRY_RETENTION_DAYS;
      const cut = Math.min(days, SENTRY_RETENTION_DAYS);
      const to = clock.now();
      const read = (sentryRead: SentryRead) => kpi(sentryRead, editionId, cut);
      const [crashFree, crashes, errors, newIssues, backendP95, appStart] = await Promise.all([
        read('crashFree'),
        read('crashes'),
        read('errors'),
        read('newIssues'),
        read('backendP95'),
        read('appStart'),
      ]);
      const kpis: Record<SentryRead, QualityKpi> = {
        crashFree,
        crashes,
        errors,
        newIssues,
        backendP95,
        appStart,
      };
      return { capped, from: new Date(to.getTime() - cut * DAY_MS), to, kpis };
    },

    pushCiRun: (run) => ciRuns.add(run),

    async ciHistory(days) {
      const to = clock.now();
      const runs = await ciRuns.between(new Date(to.getTime() - days * DAY_MS), to);
      return runs.map((run) => ({
        ...run,
        flakyTests: run.failedTests.filter((test) =>
          // Only a re-run of the same commit that passes the test makes it flaky; a later commit may have fixed it.
          runs.some(
            (other) => other !== run && other.sha === run.sha && !other.failedTests.includes(test),
          ),
        ),
      }));
    },
  };
}
