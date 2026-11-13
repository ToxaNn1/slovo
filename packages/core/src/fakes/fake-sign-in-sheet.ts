/** What a fake sign-in sheet answers when shown: an identity token, or why there is none. */
type SheetAnswer =
  | { readonly ok: true; readonly idToken: string }
  | { readonly ok: false; readonly reason: 'cancelled' | 'offline' | 'unexpected' };

/**
 * The part the fake Apple and Google sign-in sheets share: each time it is
 * shown it answers what the test said next, in order, and cancels when the
 * test said nothing.
 */
export interface FakeSignInSheet {
  /** How many times the sheet was shown. */
  readonly shown: number;
  /** The next sheet signs the reader in with the identity token. */
  readonly handsOut: (idToken: string) => void;
  /** The reader dismisses the next sheet. */
  readonly cancels: () => void;
  /** The next sheet fails: it found no network, or something else went wrong. */
  readonly fails: (reason: 'offline' | 'unexpected') => void;
  /**
   * The next sheet stays up until the test calls the release it gives back;
   * then it answers what the test said next.
   */
  readonly holds: () => () => void;
  readonly signIn: () => Promise<SheetAnswer>;
}

export function createFakeSignInSheet(): FakeSignInSheet {
  const answers: SheetAnswer[] = [];
  let shown = 0;
  let held: Promise<void> | undefined;
  return {
    get shown() {
      return shown;
    },
    handsOut(idToken) {
      answers.push({ ok: true, idToken });
    },
    cancels() {
      answers.push({ ok: false, reason: 'cancelled' });
    },
    fails(reason) {
      answers.push({ ok: false, reason });
    },
    holds() {
      let release: () => void = () => undefined;
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
    async signIn() {
      shown += 1;
      const up = held;
      held = undefined;
      await up;
      return answers.shift() ?? { ok: false, reason: 'cancelled' };
    },
  };
}
