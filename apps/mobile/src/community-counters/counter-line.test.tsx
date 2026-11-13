import { describe, expect, it } from '@jest/globals';
import type { CounterLine, CounterReads } from '@slovo/core';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { useCounterLine } from './counter-line';

const lineOf = (known: number): CounterLine => ({ known, total: 10, saved: 1 });

/** Counter reads whose answers come only when `answer` is called, one per read. */
function heldReads() {
  const waiting: (() => void)[] = [];
  const reads: CounterReads = {
    lines: (entryIds) =>
      new Promise((resolve) => {
        waiting.push(() => {
          resolve(new Map(entryIds.map((id) => [id, lineOf(id === 'w_0001' ? 1 : 2)])));
        });
      }),
  };
  return {
    reads,
    answer: async () => {
      const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
      await act(async () => {
        await flush();
        for (const answer of waiting.splice(0)) answer();
        await flush();
      });
    },
  };
}

describe('useCounterLine', () => {
  it('shows no line of the Entry before it until the new Entry’s line is read', async () => {
    const { reads, answer } = heldReads();
    const shell = testShell({ counterReads: opened(reads) });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ShellProvider shell={shell}>{children}</ShellProvider>
    );
    const own = { mark: undefined, inFavorites: false };
    const { result, rerender } = await renderHook(
      ({ entryId }: { entryId: string }) => useCounterLine(entryId, true, own),
      { wrapper, initialProps: { entryId: 'w_0001' } },
    );
    await answer();
    expect(result.current).toEqual(lineOf(1));

    await rerender({ entryId: 'w_0002' });
    expect(result.current).toBeUndefined();

    await answer();
    expect(result.current).toEqual(lineOf(2));
  });
});
