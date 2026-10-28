/** A landing asked for: a new object each time, so the same ask twice lands twice. */
export interface LandingAsked {
  readonly asked: true;
}

/**
 * Where the «Слово дня» App Intent asks the Feed to land on today's Word of
 * the Day card (ADR 0057). The ask waits until the Feed has that card, such as
 * on a cold start or a return on a new local day, and the Feed lands once.
 */
export interface WordOfTheDayLanding {
  /** Asks the Feed to land on today's Word of the Day card. */
  readonly ask: () => void;
  /** The ask the Feed hasn't landed yet, if any. */
  readonly asked: () => LandingAsked | undefined;
  /** Tells that the Feed landed the ask. */
  readonly landed: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createWordOfTheDayLanding(): WordOfTheDayLanding {
  let pending: LandingAsked | undefined;
  const listeners = new Set<() => void>();
  function change(to: LandingAsked | undefined) {
    pending = to;
    for (const listener of listeners) listener();
  }
  return {
    ask: () => {
      change({ asked: true });
    },
    asked: () => pending,
    landed: () => {
      if (pending !== undefined) change(undefined);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's one landing, which the outside links ask for and the Feed lands. */
export const wordOfTheDayLanding = createWordOfTheDayLanding();
