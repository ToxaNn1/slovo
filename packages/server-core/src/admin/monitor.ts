import type { CiRunStore, Clock, PostHogPort, SentryReader } from '../ports';
import type { Alert, AlertSettings, AlertStore, Digest, OwnerChat } from './alerts';

/** Whether the backend answers its health check. */
export interface HealthProbe {
  up(): Promise<boolean>;
}

/** An open batch of the content queue: added or changed records waiting for review. */
export interface OpenBatch {
  readonly id: string;
  readonly editionId: string;
  readonly records: number;
}

/** The open batches of the content queue. */
export interface OpenBatches {
  open(): Promise<readonly OpenBatch[]>;
}

/** One Cron run: the alert checks, the digest after 09:00 Kyiv, then the messages. */
export interface Monitor {
  run(): Promise<void>;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** The digest goes out from 09:00 Kyiv, once a Kyiv day. */
const DIGEST_MINUTES = 9 * 60;

const KYIV = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Kyiv',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The Kyiv day `YYYY-MM-DD` of the time, and its minutes since Kyiv midnight. */
function kyiv(at: Date): { day: string; minutes: number } {
  const part = (type: string) => KYIV.formatToParts(at).find((p) => p.type === type)?.value ?? '';
  return {
    day: `${part('year')}-${part('month')}-${part('day')}`,
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

/** The day `days` after the day (before, when negative). */
function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

export function createMonitor({
  settings,
  store,
  chat,
  sentry,
  posthog,
  ciRuns,
  health,
  batches,
  editionIds,
  clock,
}: {
  settings: Pick<AlertSettings, 'thresholds'>;
  store: AlertStore;
  chat: OwnerChat;
  sentry: SentryReader;
  posthog: PostHogPort;
  ciRuns: Pick<CiRunStore, 'between'>;
  health: HealthProbe;
  batches: OpenBatches;
  /** The Editions served: activity is summed over them. */
  editionIds: readonly string[];
  clock: Clock;
}): Monitor {
  /** The number Sentry answers for the window ending now, or `null`. */
  async function sentryNumber(read: Parameters<SentryReader['read']>[0], ms: number, now: Date) {
    const answer = await sentry.read(read, { from: new Date(now.getTime() - ms), to: now });
    return answer.ok ? answer.value : null;
  }

  /** People active on each Kyiv day of the period, summed over the Editions. */
  async function activeByDay(from: string, to: string): Promise<Map<string, number> | null> {
    const answer = await posthog.query({ kind: 'activeByDay', editionIds, period: { from, to } });
    if (!answer.ok) return null;
    const days = new Map<string, number>();
    for (const { key, count } of answer.rows) days.set(key, (days.get(key) ?? 0) + count);
    return days;
  }

  /** The alerts of this run, each with the key that fires it once. */
  async function check(now: Date): Promise<[Alert, string][]> {
    const t = await settings.thresholds();
    const fired: [Alert, string][] = [];
    const { day } = kyiv(now);
    const hour = now.toISOString().slice(0, 13);

    const crashFree = await sentryNumber('crashFree', DAY, now);
    if (crashFree !== null && crashFree < t.crashFree) {
      fired.push([
        { kind: 'crash-free', percent: crashFree, threshold: t.crashFree },
        `crash-free:${day}`,
      ]);
    }
    const events = await sentryNumber('newIssueEvents', HOUR, now);
    if (events !== null && events >= t.issueEvents) {
      fired.push([
        { kind: 'sentry-issue', events, threshold: t.issueEvents },
        `sentry-issue:${hour}`,
      ]);
    }
    for (const run of await ciRuns.between(new Date(now.getTime() - DAY), now)) {
      if (run.failedTests.length === 0) continue;
      const { runId, sha, failedTests } = run;
      fired.push([{ kind: 'ci-red', runId, sha, failedTests }, `ci-red:${String(runId)}`]);
    }
    const errors = await sentryNumber('backendErrorRate', 15 * MINUTE, now);
    if (errors !== null && errors > t.apiErrors) {
      const slot = Math.floor(now.getTime() / (15 * MINUTE));
      fired.push([
        { kind: 'api-errors', percent: errors, threshold: t.apiErrors },
        `api-errors:${String(slot)}`,
      ]);
    }
    const yesterday = shiftDay(day, -1);
    const active = await activeByDay(shiftDay(yesterday, -7), yesterday);
    if (active !== null) {
      const before = [...active].filter(([key]) => key !== yesterday).map(([, count]) => count);
      const average = before.reduce((sum, count) => sum + count, 0) / 7;
      const people = active.get(yesterday) ?? 0;
      if (before.length > 0 && people < (average * (100 - t.activityDrop)) / 100) {
        fired.push([
          {
            kind: 'activity-drop',
            day: yesterday,
            active: people,
            average,
            threshold: t.activityDrop,
          },
          `activity-drop:${yesterday}`,
        ]);
      }
    }
    if (!(await health.up())) fired.push([{ kind: 'backend-down' }, `backend-down:${hour}`]);
    for (const { id, editionId, records } of await batches.open()) {
      if (records <= t.batchRecords) continue;
      fired.push([
        { kind: 'batch-size', batchId: id, editionId, records, threshold: t.batchRecords },
        `batch:${id}`,
      ]);
    }
    return fired;
  }

  async function digestOf(now: Date, yesterday: string): Promise<Digest> {
    const visits = await posthog.query({
      kind: 'visitsByDay',
      editionIds,
      period: { from: yesterday, to: yesterday },
    });
    const active = await activeByDay(yesterday, yesterday);
    const runs = await ciRuns.between(new Date(now.getTime() - 7 * DAY), now);
    const last = runs.at(-1);
    const open = await batches.open();
    return {
      day: yesterday,
      active: active === null ? null : (active.get(yesterday) ?? 0),
      visits: visits.ok ? visits.rows.reduce((sum, { count }) => sum + count, 0) : null,
      crashes: await sentryNumber('crashes', DAY, now),
      lastCi:
        last === undefined
          ? null
          : { sha: last.sha, at: last.at, failedTests: last.failedTests.length },
      openBatches: open.length,
      openRecords: open.reduce((sum, { records }) => sum + records, 0),
    };
  }

  return {
    async run() {
      const now = clock.now();
      for (const [alert, key] of await check(now)) await store.keep(alert, now, key);
      const { day, minutes } = kyiv(now);
      if (minutes >= DIGEST_MINUTES && !(await store.digestSent(day))) {
        const digest = await digestOf(now, shiftDay(day, -1));
        if (await chat.send({ kind: 'digest', digest })) await store.keepDigest(day, now);
      }
      for (const kept of await store.unsent(new Date(now.getTime() - DAY))) {
        if (await chat.send({ kind: 'alert', alert: kept.alert })) {
          await store.markSent(kept.id, now);
        }
      }
    },
  };
}
