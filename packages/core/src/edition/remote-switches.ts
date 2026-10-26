import { FeatureSwitchesSchema, type FeatureSwitch } from '@slovo/contracts';

import { createSubscribers } from '../in-turn';
import type { Random, RemoteSwitchesAnswer, Schedule, SwitchesApi } from '../ports';
import { withRetries } from '../retry';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { switchedOn, type Edition } from './edition';

const everyFeature = FeatureSwitchesSchema.keyof().options;

/**
 * The remote Feature Switches of the running Edition (ADR 0040): the
 * features the owner turned off on the backend, which the app asks for at
 * launch and on each return to the foreground. A remote switch only turns a
 * feature off: the effective value of a Feature Switch is the Edition's value
 * and not off remotely, and a Game Mode's or the Daily Crossword's only while
 * `game`'s is on too (ADR 0052).
 */
export interface RemoteSwitches<E extends Pick<Edition, 'isFeatureEnabled'>> {
  /**
   * The Edition as the app runs it: the Edition with each Feature Switch at
   * its effective value, by the last answer known. A change of an effective
   * value makes a new one and tells the subscribers, so it stays the same
   * object until one changes. Each of them, one kept from before too, reads
   * the last answer whenever it is asked, so a module that keeps it acts on
   * the effective value each time.
   */
  readonly edition: E;
  /** Calls `listener` after each change of the Edition as the app runs it. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
  /**
   * Asks the backend for the switches, naming the ETag of the answer kept, and
   * keeps a new answer on the device for the next launch. A failure, after
   * the retries of `withRetries`, keeps the answer the app has. Resolves
   * whether an effective value changed, so the shell reopens what read the
   * old ones. It never rejects; a call while one is under way joins it.
   */
  ask(): Promise<boolean>;
}

/**
 * Opens the remote Feature Switches over the Edition, at launch before
 * anything reads a Feature Switch: with the answer the device kept, or,
 * without one or when it can't be read, with none, so the Edition's own
 * values hold, offline too.
 */
export async function openRemoteSwitches<E extends Pick<Edition, 'isFeatureEnabled'>>({
  edition,
  api,
  userState,
  schedule,
  random,
}: {
  edition: E;
  api: SwitchesApi;
  userState: Pick<UserState, 'read' | 'write'>;
  /** What failed requests wait by before they are tried again. */
  schedule: Schedule;
  /** What the waits between tries are jittered by. */
  random: Random;
}): Promise<RemoteSwitches<E>> {
  const record = userStateRecords.remoteSwitches;
  const subscribers = createSubscribers();
  let kept: RemoteSwitchesAnswer | undefined = await userState.read(record).catch(() => undefined);
  let remotelyOff = new Set(kept?.off);

  const isFeatureEnabled = switchedOn(
    (feature: FeatureSwitch) => edition.isFeatureEnabled(feature) && !remotelyOff.has(feature),
  );
  /** The effective values, by feature, as one text to compare. */
  const effective = () => everyFeature.map((feature) => isFeatureEnabled(feature)).join();
  const inEffect = (): E => ({ ...edition, isFeatureEnabled });
  let current = inEffect();

  async function askOnce(): Promise<boolean> {
    try {
      const reply = await withRetries(() => api.switches(kept?.etag), { schedule, random });
      if (!reply.ok || reply.answer === 'unchanged') return false;
      const before = effective();
      kept = reply.answer;
      remotelyOff = new Set(kept.off);
      // Kept for the next launch; one that fails to be kept is asked again then.
      await userState
        .write(record.change({ off: [...kept.off], etag: kept.etag }))
        .catch(() => undefined);
      if (effective() === before) return false;
      current = inEffect();
      subscribers.tell();
      return true;
    } catch {
      // Silent: the app keeps the switches it has.
      return false;
    }
  }

  let underWay: Promise<boolean> | undefined;

  return {
    get edition() {
      return current;
    },
    subscribe: subscribers.subscribe,
    ask() {
      underWay ??= askOnce().finally(() => {
        underWay = undefined;
      });
      return underWay;
    },
  };
}
