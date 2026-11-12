import { useState } from 'react';

import { keep } from '../keep';

/** A Daily Crossword as the Core opened it: its state, and the move that changes it. */
interface Playable<State, Action> {
  readonly state: State;
  play(action: Action): Promise<State>;
}

/** What a Daily Crossword's screen holds of it while it is open. */
export interface OpenCrossword<State, Action, Miss> {
  readonly state: State;
  /** The last release that locked no Word, which the screen shows; `undefined` before one. */
  readonly miss: Miss | undefined;
  /** Whether the reader has traced on this screen: true from the first `extend`. */
  readonly touched: boolean;
  /** Sends a move to the Core; one that fails is logged and changes nothing. */
  readonly play: (action: Action) => void;
}

interface Opened<Crossword, State, Miss> {
  readonly crossword: Crossword;
  readonly state: State;
  readonly miss: Miss | undefined;
  readonly touched: boolean;
}

const fresh = <Crossword extends Playable<State, unknown>, State, Miss>(
  crossword: Crossword,
): Opened<Crossword, State, Miss> => ({
  crossword,
  state: crossword.state,
  miss: undefined,
  touched: false,
});

/**
 * A Daily Crossword open on its screen, as the Core opened it, and afresh for
 * another one opened. Each move goes to the Core in turn and its state is the
 * one drawn; a move that answers after another crossword opened is dropped.
 * After a release, `missOf` tells the miss from the state before and after it,
 * with the next key, or `undefined` when the release locked a Word.
 */
export function useOpenCrossword<
  State,
  Action extends { readonly type: string },
  Miss extends { readonly key: number },
>(
  crossword: Playable<State, Action>,
  subject: string,
  missOf: (before: State, next: State, key: number) => Miss | undefined,
): OpenCrossword<State, Action, Miss> {
  const [opened, setOpened] = useState(() => fresh<typeof crossword, State, Miss>(crossword));
  if (opened.crossword !== crossword) setOpened(fresh(crossword));

  const play = (action: Action) => {
    void keep(subject, crossword.play(action)).then((next) => {
      if (next === undefined) return;
      setOpened((now) => {
        if (now.crossword !== crossword) return now;
        const missed =
          action.type === 'release' ? missOf(now.state, next, (now.miss?.key ?? 0) + 1) : undefined;
        return {
          crossword,
          state: next,
          touched: now.touched || action.type === 'extend',
          miss: missed ?? now.miss,
        };
      });
    });
  };
  return { state: opened.state, miss: opened.miss, touched: opened.touched, play };
}
