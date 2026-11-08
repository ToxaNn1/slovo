import { FeatureSwitchesSchema, type FeatureSwitch, type FeatureSwitches } from '@slovo/contracts';

import { answerOf } from '../backend';
import { createSubscribers } from '../in-turn';
import type { Backend, Clock, Random, Schedule } from '../ports';
import { withRetries } from '../retry';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state-schema';
import type { Edition } from './edition';
import { editionRecords } from './records';
import {
  evaluateSwitches,
  type SwitchFacts,
  type SwitchVerdict,
  type SwitchVerdicts,
} from './switch-evaluator';

const everyFeature = FeatureSwitchesSchema.keyof().options;

/** How often the app asks for the switches while it runs, besides launch and foreground (ADR 0089). */
export const SWITCHES_REFRESH_MS = 2 * 60 * 1000;

/**
 * The last answer of the backend's remote Feature Switches the device keeps:
 * the Rules and force-update minimums, the ETag that names them, and how far
 * the backend's clock was ahead of the device's when it answered.
 */
export type RemoteSwitchesAnswer = NonNullable<
  ReturnType<typeof editionRecords.remoteSwitches.decode>
>;

/** The facts of the reader the Rules target, but the clock, which the switches keep. */
export type ReaderFacts = Omit<SwitchFacts, 'clock' | 'clockOffsetMs'>;

/**
 * The remote Feature Switches of the running Edition (ADR 0089): the Rules
 * and force-update minimums the owner sets on the backend, which the app asks
 * for at launch, on each return to the foreground and every two minutes. The
 * effective value of each Feature Switch is what `evaluateSwitches` gives for
 * the reader: the first matching Rule, else the Edition's state, and never on
 * while a switch it depends on is off.
 */
export interface RemoteSwitches<E extends Pick<Edition, 'id'>> {
  /**
   * The Edition as the app runs it: the Edition with each Feature Switch at
   * its effective value, by the last answer known. A change of an effective
   * value makes a new one and tells the subscribers, so it stays the same
   * object until one changes. Each of them, one kept from before too, reads
   * the last verdicts whenever it is asked, so a module that keeps it acts on
   * the effective value each time.
   */
  readonly edition: E & Pick<Edition, 'isFeatureEnabled'>;
  /** The effective value of every Feature Switch, with the Variant a Rule picked. */
  readonly verdicts: SwitchVerdicts;
  /** The Install id the Rules' shares and Variants are picked by, and the Analytics distinct id. */
  readonly installId: string;
  /** The force-update minimums of the last answer known, by platform. */
  readonly minimums: RemoteSwitchesAnswer['minimums'];
  /** Calls `listener` after each change of the Edition as the app runs it. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Asks the backend for the switches, naming the ETag of the answer kept, and
   * keeps a new answer on the device for the next launch. A failure, after
   * the retries of `withRetries`, keeps the answer the app has. The verdicts
   * are worked out again each time, so a Rule's schedule takes effect. It
   * resolves whether an effective value changed, so the shell reopens what
   * read the old ones. It never rejects; a call while one is under way joins it.
   */
  ask(): Promise<boolean>;
  /**
   * Asks every two minutes from now on and tells `onChange` after an ask
   * that changes an effective value. Returns the call that stops it.
   */
  start(onChange: () => void): () => void;
}

/**
 * Opens the remote Feature Switches over the Edition, at launch before
 * anything reads a Feature Switch: with the answer the device kept, or,
 * without one or when it can't be read, with none, so the Edition's own
 * states hold, offline too.
 */
export async function openRemoteSwitches<E extends Pick<Edition, 'id'>>({
  edition,
  states,
  facts,
  backend,
  userState,
  schedule,
  random,
  clock,
}: {
  edition: E;
  /** The Edition's own Feature Switch states, which hold where no Rule matches. */
  states: FeatureSwitches;
  /** The reader the Rules target, read each time the verdicts are worked out. */
  facts: () => ReaderFacts;
  backend: Pick<Backend, 'edition'>;
  userState: Pick<UserState, 'read' | 'write'>;
  /** What failed requests and the two-minute asks wait by. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
  clock: Clock;
}): Promise<RemoteSwitches<E>> {
  const record = userStateRecords.remoteSwitches;
  const subscribers = createSubscribers();
  let kept: RemoteSwitchesAnswer | undefined = await userState.read(record).catch(() => undefined);

  const evaluate = () =>
    evaluateSwitches({
      rules: kept?.rules ?? [],
      states,
      facts: { ...facts(), clock, clockOffsetMs: kept?.clockOffsetMs ?? 0 },
    });
  let verdicts = evaluate();
  const verdictOf = (feature: FeatureSwitch): SwitchVerdict => verdicts[feature];
  const isFeatureEnabled = (feature: FeatureSwitch) => verdictOf(feature).on;
  /** The verdicts, by feature, as one text to compare. */
  const effective = () => JSON.stringify(everyFeature.map(verdictOf));
  const inEffect = () => ({ ...edition, isFeatureEnabled });
  let current = inEffect();

  /**
   * The remote Feature Switches, or `unchanged` when `etag`, the ETag of the
   * answer the app keeps, still names them. `edition.switches` needs no
   * Account; an Edition the backend doesn't serve is `unexpected`, as any
   * other refusal.
   */
  async function switches(etag: string | undefined) {
    const answer = await answerOf(
      backend.edition.switches({
        params: { editionId: edition.id },
        headers: etag === undefined ? {} : { 'if-none-match': etag },
      }),
    );
    if (!answer.ok) return answer;
    const { output } = answer;
    if (output.status === 304) return { ok: true, answer: 'unchanged' } as const;
    const answered = Date.parse(output.headers.date);
    const fresh: RemoteSwitchesAnswer = {
      rules: output.body.rules,
      minimums: output.body.minimums,
      etag: output.headers.etag,
      clockOffsetMs: Number.isNaN(answered) ? 0 : answered - clock.now().getTime(),
    };
    return { ok: true, answer: fresh } as const;
  }

  async function askOnce(): Promise<boolean> {
    try {
      const reply = await withRetries(() => switches(kept?.etag), { schedule, random });
      if (reply.ok && reply.answer !== 'unchanged') {
        kept = reply.answer;
        // Kept for the next launch; one that fails to be kept is asked again then.
        await userState.write(record.change(kept)).catch(() => undefined);
      }
    } catch {
      // Silent: the app keeps the switches it has.
    }
    const before = effective();
    verdicts = evaluate();
    if (effective() === before) return false;
    current = inEffect();
    subscribers.tell();
    return true;
  }

  let underWay: Promise<boolean> | undefined;
  const ask = () => {
    underWay ??= askOnce().finally(() => {
      underWay = undefined;
    });
    return underWay;
  };

  return {
    get edition() {
      return current;
    },
    get verdicts() {
      return verdicts;
    },
    get installId() {
      return facts().installId;
    },
    get minimums() {
      return kept?.minimums ?? {};
    },
    subscribe: subscribers.subscribe,
    ask,
    start(onChange) {
      let cancel: () => void = () => undefined;
      const next = () => {
        cancel = schedule(() => {
          void ask().then((changed) => {
            if (changed) onChange();
          });
          next();
        }, SWITCHES_REFRESH_MS);
      };
      next();
      return () => {
        cancel();
      };
    },
  };
}
