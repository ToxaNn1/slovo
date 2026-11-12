import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

import { useOpenCrossword } from './open-crossword';

interface State {
  readonly trace: readonly number[];
  readonly found: number;
}

type Action =
  | { readonly type: 'extend'; readonly tile: number }
  | { readonly type: 'release' }
  | { readonly type: 'fail' };

interface Miss {
  readonly key: number;
  readonly tiles: readonly number[];
}

/**
 * A crossword whose release locks a Word only when the trace is `[0, 1]`, and
 * whose `fail` move cannot be kept.
 */
function crosswordOf(start: State = { trace: [], found: 0 }) {
  const crossword = {
    state: start,
    play: (action: Action): Promise<State> => {
      if (action.type === 'fail') return Promise.reject(new Error('Not kept'));
      const { state } = crossword;
      crossword.state =
        action.type === 'extend'
          ? { ...state, trace: [...state.trace, action.tile] }
          : {
              trace: [],
              found: state.found + (state.trace.join() === '0,1' ? 1 : 0),
            };
      return Promise.resolve(crossword.state);
    },
  };
  return crossword;
}

const missOf = (before: State, next: State, key: number): Miss | undefined =>
  before.trace.length > 0 && next.found === before.found ? { key, tiles: before.trace } : undefined;

async function renderOpen(crossword = crosswordOf()) {
  const hook = await renderHook(
    ({ opened }: { opened: ReturnType<typeof crosswordOf> }) =>
      useOpenCrossword(opened, 'the test crossword', missOf),
    { initialProps: { opened: crossword } },
  );
  const play = async (...actions: Action[]) => {
    for (const action of actions) {
      await act(async () => {
        hook.result.current.play(action);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  };
  return { hook, play };
}

describe('useOpenCrossword', () => {
  it('opens on the state the Core opened, untouched and with no miss', async () => {
    const { hook } = await renderOpen(crosswordOf({ trace: [2], found: 1 }));

    expect(hook.result.current.state).toEqual({ trace: [2], found: 1 });
    expect(hook.result.current.miss).toBeUndefined();
    expect(hook.result.current.touched).toBe(false);
  });

  it('takes the state each move gives and is touched from the first extend', async () => {
    const { hook, play } = await renderOpen();

    await play({ type: 'extend', tile: 0 });

    expect(hook.result.current.state.trace).toEqual([0]);
    expect(hook.result.current.touched).toBe(true);
  });

  it('makes a release that locks no Word the miss, with a new key each time', async () => {
    const { hook, play } = await renderOpen();

    await play({ type: 'extend', tile: 2 }, { type: 'release' });
    expect(hook.result.current.miss).toEqual({ key: 1, tiles: [2] });

    await play({ type: 'extend', tile: 3 }, { type: 'release' });
    expect(hook.result.current.miss).toEqual({ key: 2, tiles: [3] });
  });

  it('keeps the last miss over a release that locks a Word', async () => {
    const { hook, play } = await renderOpen();

    await play({ type: 'extend', tile: 2 }, { type: 'release' });
    await play({ type: 'extend', tile: 0 }, { type: 'extend', tile: 1 }, { type: 'release' });

    expect(hook.result.current.state.found).toBe(1);
    expect(hook.result.current.miss).toEqual({ key: 1, tiles: [2] });
  });

  it('changes nothing for a move that cannot be kept', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { hook, play } = await renderOpen();
    await play({ type: 'extend', tile: 0 });
    const before = hook.result.current;

    await play({ type: 'fail' });

    expect(hook.result.current.state).toBe(before.state);
    expect(hook.result.current.miss).toBe(before.miss);
  });

  it('opens afresh for another crossword', async () => {
    const { hook, play } = await renderOpen();
    await play({ type: 'extend', tile: 2 }, { type: 'release' });

    const other = crosswordOf({ trace: [], found: 4 });
    await hook.rerender({ opened: other });

    expect(hook.result.current.state).toBe(other.state);
    expect(hook.result.current.miss).toBeUndefined();
    expect(hook.result.current.touched).toBe(false);
  });
});
