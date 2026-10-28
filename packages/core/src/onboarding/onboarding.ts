import type { AccountState } from '../account/account';
import type { Entries } from '../entries/entries';
import { createSubscribers } from '../in-turn';
import { formatTimeOfDay, todayKey } from '../local-date';
import type { MorningNotification } from '../notifications/notification-plan';
import type { Notifications } from '../notifications/notifications';
import type { Clock } from '../ports';
import type { RarityTest, RarityTestWord } from '../rarity-test/rarity-test';
import type { UserState } from '../user-state/user-state';
import { userStateRecords } from '../user-state/user-state-schema';
import { buildWordCard, type WordCardModel } from '../entries/word-card';
import type { WordOfTheDay } from '../feed/word-of-the-day';

/**
 * The steps of the onboarding, in order: the one place that has them, so a
 * step that joins changes the count everywhere. The Rarity Test step comes
 * only with the Rarity Test on, the SLOVO ID step last, only with the Account on.
 */
const STEPS = ['welcome', 'mix', 'rarityTest', 'notifications', 'account'] as const;

type StepKind = (typeof STEPS)[number];

/** Where a step stands among the steps, for the progress the UI draws. */
interface StepPlace {
  /** The step's number, from 1. */
  readonly number: number;
  /** How many steps the onboarding has. */
  readonly total: number;
}

/** The notification the last step shows as a sample of the real one. */
export interface SampleNotification {
  /** The Word's card: the sample shows its Lemma with Stress. */
  readonly wordCard: WordCardModel;
  /** The body the notification has: the primary Definition, cut when long. */
  readonly body: string;
  /** When it comes, the earliest Notification time `HH:MM`; nothing with no time left. */
  readonly time: string | undefined;
}

/**
 * The step on screen, with what it shows. The Edition's strings and the
 * look stay with the UI: the step gives data only.
 */
export type OnboardingStep =
  | (StepPlace & {
      readonly kind: 'welcome';
      /** Today's Word of the Day, which the welcome shows large; nothing when there is none. */
      readonly hero: WordCardModel | undefined;
    })
  /** The Mix, which the step changes through the composition's Mix. */
  | (StepPlace & { readonly kind: 'mix' })
  /**
   * The Rarity Test, offered after the Mix and skippable: the Words to ask
   * about, drawn when the step opens from the Mix the reader just chose. The
   * shell applies the answers through the composition's Rarity Test.
   */
  | (StepPlace & { readonly kind: 'rarityTest'; readonly words: readonly RarityTestWord[] })
  | (StepPlace & {
      readonly kind: 'notifications';
      /**
       * The morning notification the plan would hold if the reader allowed
       * notifications now, the Word of the Day's: this morning's while its
       * time is ahead, else the next day's (see `Notifications`). It follows
       * the Notification times the step changes. Nothing without a Word for it.
       */
      readonly sample: SampleNotification | undefined;
    })
  /** SLOVO ID, which the step offers to sign in to, through the SLOVO ID screen. */
  | (StepPlace & { readonly kind: 'account' });

/** Where the onboarding stands. */
export interface OnboardingState {
  /** When the reader finished or skipped it; nothing while it still opens on launch. */
  readonly finishedAt: Date | undefined;
  /** The step on screen while it is open; nothing once it is finished. */
  readonly step: OnboardingStep | undefined;
}

/**
 * The onboarding: its steps in order (the welcome, the Mix, with the Rarity
 * Test on the Rarity Test, the notifications and, with the Account on, SLOVO ID), and whether the reader
 * finished it, which is also when they skipped it. It opens on launch until
 * then, at the welcome, and never again after. The step on screen is not kept: closing the app halfway
 * starts over at the welcome. Read from the user state once, when it opens,
 * like the Cycle, so open one per app session (the Core composition does).
 * A change is made in memory only once it is written.
 *
 * One tap ends a step: from the moment a call starts to end the step (going
 * on, finishing, or asking for permission) until the next step is on screen,
 * every other call does nothing, so a second tap, also on another button
 * while the prompt of iOS is up, neither skips a step nor asks twice. After
 * a call that fails, the step takes a tap again.
 */
export interface Onboarding {
  /**
   * Where the onboarding stands. A change never edits it: it makes a new one
   * and tells the subscribers, so it stays the same object until something
   * changes.
   */
  readonly state: OnboardingState;
  /**
   * Goes on to the next step, for the welcome's and the Mix step's button,
   * the Rarity Test step's way past it or on from its result, the
   * notifications step's quiet "later" and the SLOVO ID step's «continue
   * without an Account». Past the last step it finishes.
   */
  next(): Promise<void>;
  /**
   * Finishes the onboarding as of now without asking for anything, for the
   * skip on every step. Closing the app before this leaves the onboarding
   * unfinished.
   */
  finish(): Promise<void>;
  /**
   * The notifications step's main button: asks the reader for permission to
   * notify, which plans by the answer, then goes on as `next` does whatever
   * the answer, also when nothing can ask or asking fails: the reader chose
   * to go on, and the times stay for the notification settings. When asking
   * fails, it rejects with the failure once the onboarding has gone on.
   */
  allowNotifications(): Promise<void>;
  /**
   * The reader came back from the SLOVO ID screen, which the SLOVO ID step
   * opens, with the Account as it stands: signed in, the onboarding finishes;
   * signed out, the step stays. Signing in never waits for the onboarding,
   * and the merge of the reader's words is the Sync's.
   */
  backFromAccount(account: Pick<AccountState, 'status'>): Promise<void>;
  /** Calls `listener` after each change of the state. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

const { onboardingFinished, firstWeekFrom } = userStateRecords;

const noSample = (): undefined => undefined;

/**
 * Opens the onboarding over the user state, for the Core composition, once
 * today's Word of the Day is chosen. `nextMorning` is the plan's next morning
 * notification, which the sample shows. `account` says whether the Edition
 * has the Account, which brings the SLOVO ID step. `rarityTest` is the
 * composition's Rarity Test while the Edition turns it on, which brings the
 * Rarity Test step while its draw has a Word.
 */
export async function openOnboarding({
  userState,
  clock,
  entries,
  wordOfTheDay,
  notifications,
  nextMorning,
  account,
  rarityTest,
}: {
  userState: UserState;
  clock: Clock;
  entries: Pick<
    Entries,
    'get' | 'getMany' | 'linkedCorrections' | 'categories' | 'linkingSynonymRow' | 'illustrationOf'
  >;
  wordOfTheDay: Pick<WordOfTheDay, 'chosen'>;
  notifications: Pick<Notifications, 'askPermission' | 'subscribe'>;
  nextMorning: () => Promise<MorningNotification | undefined>;
  account: boolean;
  rarityTest: Pick<RarityTest, 'draw'> | undefined;
}): Promise<Onboarding> {
  const subscribers = createSubscribers();
  /** The Rarity Test's Words, or none while it is off; a draw that fails asks about none. */
  const drawn = async () => (await rarityTest?.draw().catch(() => [])) ?? [];
  const finished = await userState.read(onboardingFinished);
  /**
   * The steps the onboarding has now. The Rarity Test step is left out from
   * the start when its draw has no Word, and from the moment it would open
   * when the Mix chosen leaves it none, so the count follows.
   */
  let steps: readonly StepKind[] = STEPS.filter(
    (kind) => (kind !== 'account' || account) && kind !== 'rarityTest',
  );
  if (finished === undefined && (await drawn()).length > 0) {
    steps = STEPS.filter((kind) => kind !== 'account' || account);
  }

  async function wordCardOf(wordId: string | undefined): Promise<WordCardModel | undefined> {
    const word = wordId === undefined ? undefined : await entries.get(wordId);
    return word?.kind === 'word' ? buildWordCard({ word, entries }) : undefined;
  }

  async function sampleNotification(): Promise<SampleNotification | undefined> {
    const morning = await nextMorning();
    const wordCard = await wordCardOf(morning?.wordId);
    return morning === undefined || wordCard === undefined
      ? undefined
      : {
          wordCard,
          body: morning.body,
          time: morning.time === undefined ? undefined : formatTimeOfDay(morning.time),
        };
  }

  /**
   * The step at `index` in the order, with what it shows; the Rarity Test step
   * leaves the steps when it has nothing to show, and the next takes its
   * place. Nothing past the last step.
   */
  async function stepAt(index: number): Promise<OnboardingStep | undefined> {
    const place = { number: index + 1, total: steps.length };
    const kind = steps[index];
    if (kind === undefined) return undefined;
    if (kind === 'welcome') {
      return { kind, ...place, hero: await wordCardOf(wordOfTheDay.chosen()?.wordId) };
    }
    if (kind === 'mix' || kind === 'account') return { kind, ...place };
    if (kind === 'rarityTest') {
      const words = await drawn();
      if (words.length > 0) return { kind, ...place, words };
      steps = steps.filter((each) => each !== 'rarityTest');
      return stepAt(index);
    }
    // The step comes without a sample rather than not at all when it can't be read.
    return { kind: 'notifications', ...place, sample: await sampleNotification().catch(noSample) };
  }

  let state: OnboardingState =
    finished === undefined
      ? { finishedAt: undefined, step: await stepAt(0) }
      : { finishedAt: new Date(finished), step: undefined };

  function change(changed: OnboardingState): void {
    state = changed;
    subscribers.tell();
  }

  /** Whether a call is ending the step on screen, so every other call does nothing. */
  let ending = false;
  /** Ends the step on screen with `end`, unless another call is ending it or it is finished. */
  async function endStep(end: (step: OnboardingStep) => Promise<void>): Promise<void> {
    if (ending || state.step === undefined) return;
    ending = true;
    try {
      await end(state.step);
    } finally {
      ending = false;
    }
  }

  async function keepFinished(): Promise<void> {
    const finishedAt = clock.now();
    // The first week counts from this day (ADR 0054).
    await userState.write(
      new Map([
        ...onboardingFinished.change(finishedAt.toISOString()),
        ...firstWeekFrom.change(todayKey(clock)),
      ]),
    );
    change({ finishedAt, step: undefined });
  }

  /** Goes on from the step of `kind` to the next one, or finishes past the last. */
  async function goOn(kind: StepKind): Promise<void> {
    const step = await stepAt(steps.indexOf(kind) + 1);
    if (step === undefined) {
      await keepFinished();
      return;
    }
    change({ ...state, step });
  }

  /** Counts the samples asked for, so only the latest one reaches the step. */
  let samplesAsked = 0;
  notifications.subscribe(() => {
    if (state.step?.kind !== 'notifications') return;
    samplesAsked += 1;
    const asked = samplesAsked;
    // A sample that can't be read leaves the one before it.
    sampleNotification().then((sample) => {
      if (asked !== samplesAsked || state.step?.kind !== 'notifications') return;
      change({ ...state, step: { ...state.step, sample } });
    }, noSample);
  });

  return {
    get state() {
      return state;
    },
    next: () => endStep(({ kind }) => goOn(kind)),
    finish: () => endStep(keepFinished),
    allowNotifications: () =>
      endStep(async ({ kind }) => {
        let failed: { readonly error: unknown } | undefined;
        try {
          await notifications.askPermission();
        } catch (error) {
          failed = { error };
        }
        await goOn(kind);
        if (failed !== undefined) throw failed.error;
      }),
    backFromAccount: ({ status }) =>
      endStep(async () => {
        if (status === 'signed-in') await keepFinished();
      }),
    subscribe: subscribers.subscribe,
  };
}
