import { MistakeReportSchema, type MistakeReport, type MistakeType } from '@slovo/contracts';

import type { Edition } from '../edition/edition';
import { createInTurn } from '../in-turn';
import { answerOf } from '../backend';
import type { Backend, Clock, Random, RequestFailure, Schedule } from '../ports';
import { withRetries } from '../retry';
import type { UserState } from '../user-state/user-state';
import { MISTAKE_REPORT_QUEUE_SIZE } from './records';
import { userStateRecords } from '../user-state/user-state-schema';

/** What the reader wrote in the sheet of «Повідомити про помилку». */
export interface MistakeReportDraft {
  /** The id of the Entry of the card, of any of the five kinds. */
  readonly entryId: string;
  readonly type: MistakeType;
  /** The comment as typed; the report carries it trimmed. */
  readonly comment: string;
}

/**
 * What a report comes to, for the sheet: `thanked` when the backend took it
 * or it waits in the queue («Дякуємо! Ми перевіримо.»), `too-many-requests`
 * over the daily limit («Забагато повідомлень сьогодні. Спробуйте завтра.»),
 * `switched-off` while `mistakeReports` is off, and `invalid` for a draft
 * that is no report, such as «Інше» with no comment. Only `thanked` keeps it.
 */
export type MistakeReportAnswer = 'thanked' | 'too-many-requests' | 'switched-off' | 'invalid';

/**
 * Mistake Reports (ADR 0056): the reports a reader sends from an Entry's card,
 * through a `device-only` queue of at most `MISTAKE_REPORT_QUEUE_SIZE` unsent
 * reports, so a report written offline goes out later. The queue sends at
 * launch, on each return to the foreground and after a report the backend
 * took, oldest first, each by the one retry rule (ADR 0037). A report leaves
 * the queue when the backend takes it or refuses it with a 4xx; a queued
 * report that meets too many requests waits for the answer's `Retry-After`,
 * and a new report while it holds is answered `too-many-requests` unsent.
 * Nothing goes out while `mistakeReports` is off in effect, read each time,
 * and the queued reports stay. Nothing it does rejects.
 */
export interface MistakeReports {
  /** Whether the card menu shows «Повідомити про помилку»: `mistakeReports` is on in effect. */
  available(): boolean;
  /**
   * Puts the report of the draft in the queue, a 21st unsent one pushing out
   * the oldest, and sends it at once. It answers once the backend took it,
   * refused it, or every try failed; it leaves the queue unless every try
   * failed in a way that may pass, and over the daily limit too, since the
   * reader is told to try tomorrow.
   */
  report(draft: MistakeReportDraft): Promise<MistakeReportAnswer>;
  /** The app is in the foreground, at launch or on a return: sends the queue. */
  foreground(): void;
}

const { mistakeReportQueue } = userStateRecords;

/**
 * A Mistake Report the backend didn't take, as any request may fail, or
 * because it serves no Mistake Reports for the Edition (404).
 */
export type ReportsApiFailure =
  RequestFailure | { readonly ok: false; readonly reason: 'not-found' };

/** The failures after which a report just written stays in the queue: they may pass by themselves. */
const newStaysFor: ReadonlySet<ReportsApiFailure['reason']> = new Set(['offline', 'server-error']);

/** The failures after which a queued report stays: those, and too many requests, until `Retry-After`. */
const queuedStaysFor: ReadonlySet<ReportsApiFailure['reason']> = new Set([
  ...newStaysFor,
  'too-many-requests',
]);

/**
 * Opens Mistake Reports apart from the composition, like Sync: they need no
 * Language Pack but the content version of the open one, which every report
 * carries with the Edition and the app version.
 */
export function openMistakeReports({
  userState,
  backend,
  edition,
  appVersion,
  contentVersion,
  clock,
  schedule,
  random,
}: {
  userState: Pick<UserState, 'read' | 'write'>;
  backend: Pick<Backend, 'reports'>;
  /** The Edition as the app runs it, with each Feature Switch at its effective value. */
  edition: Pick<Edition, 'id' | 'isFeatureEnabled'>;
  /** The app version, the release it belongs to (ADR 0044). */
  appVersion: string;
  /** The content version of the open Language Pack. */
  contentVersion: number;
  clock: Clock;
  /** What the waits between tries wait by. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): MistakeReports {
  // One change of the queue at a time, a send included, so no report goes out twice.
  const inTurn = createInTurn();
  const available = () => edition.isFeatureEnabled('mistakeReports');
  /** Until when, in milliseconds, no queued report goes out, by a 429's `Retry-After`. */
  let heldUntil: number | undefined;
  let draining = false;
  let again = false;

  const queue = async () => (await userState.read(mistakeReportQueue)) ?? [];

  /** Sends the report, with no Session (ADR 0056); the backend answers 202 when it keeps it. */
  async function sendOnce(
    report: MistakeReport,
  ): Promise<{ readonly ok: true } | ReportsApiFailure> {
    const answer = await answerOf(backend.reports.send(report), ({ code }) =>
      code === 'NOT_FOUND' ? ({ ok: false, reason: 'not-found' } as const) : undefined,
    );
    return answer.ok ? { ok: true } : answer;
  }

  /** Takes the oldest report equal to `report` off the queue, if it is still there. */
  async function remove(report: MistakeReport): Promise<void> {
    const reports = await queue();
    const text = JSON.stringify(report);
    const at = reports.findIndex((queued) => JSON.stringify(queued) === text);
    if (at === -1) return;
    await userState.write(mistakeReportQueue.change(reports.filter((_, index) => index !== at)));
  }

  /**
   * Sends the report by the one rule, and takes it off the queue unless it
   * failed for one of the reasons it `staysFor`. Answers what the backend answered.
   */
  async function send(
    report: MistakeReport,
    staysFor: ReadonlySet<ReportsApiFailure['reason']>,
  ): Promise<{ readonly ok: true } | ReportsApiFailure> {
    const answer = await withRetries(() => sendOnce(report), { schedule, random });
    if (answer.ok) heldUntil = undefined;
    if (!answer.ok && answer.reason === 'too-many-requests' && answer.retryAfter !== undefined) {
      heldUntil = clock.now().getTime() + answer.retryAfter * 1000;
    }
    if (answer.ok || !staysFor.has(answer.reason)) await remove(report);
    return answer;
  }

  const held = () => heldUntil !== undefined && clock.now().getTime() < heldUntil;

  /** Sends the oldest queued report; answers whether it left the queue, so the next may follow. */
  function sendOldest(): Promise<boolean> {
    return inTurn(async () => {
      if (!available() || held()) return false;
      const [oldest] = await queue();
      if (oldest === undefined) return false;
      const answer = await send(oldest, queuedStaysFor);
      return answer.ok || !queuedStaysFor.has(answer.reason);
    });
  }

  /** Whether a call during the drain asked for one more. */
  const askedAgain = () => again;

  /** Sends the queue, one drain at a time; a call during one drains once more after it. */
  async function drain(): Promise<void> {
    if (draining) {
      again = true;
      return;
    }
    draining = true;
    try {
      do {
        again = false;
        while (await sendOldest());
      } while (askedAgain());
    } catch {
      // Silent: the user state failed to be read or written, and the next return tries again.
    } finally {
      draining = false;
    }
  }

  return {
    available,
    async report(draft) {
      if (!available()) return 'switched-off';
      const parsed = MistakeReportSchema.safeParse({
        ...draft,
        editionId: edition.id,
        appVersion,
        contentVersion,
      });
      if (!parsed.success) return 'invalid';
      // Still over the limit by an earlier `Retry-After`: the backend would refuse it too.
      if (held()) return 'too-many-requests';
      const report = parsed.data;
      const answer = await inTurn(async () => {
        try {
          const reports = [...(await queue()), report].slice(-MISTAKE_REPORT_QUEUE_SIZE);
          await userState.write(mistakeReportQueue.change(reports));
        } catch {
          // Silent: a queue that fails to be kept still lets the report go out now.
        }
        return send(report, newStaysFor);
      }).catch(() => undefined);
      if (answer?.ok === false && answer.reason === 'too-many-requests') {
        return 'too-many-requests';
      }
      if (answer?.ok === true) void drain();
      return 'thanked';
    },
    foreground() {
      void drain();
    },
  };
}
