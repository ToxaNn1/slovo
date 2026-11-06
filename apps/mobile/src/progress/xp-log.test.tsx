import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ShellProvider } from '../shell-value';
import { opened, testShell } from '../shell/test-support';
import { useSetDailyGoal, useXpLogState } from './xp-log';

/**
 * The XP log hooks over the composition of a test Shell. Gives back the
 * composition, so a test awards XP as the Game does.
 */
async function renderXpLog() {
  const composition = await testShell().composition.opened();
  const shell = testShell({ composition: opened(composition) });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ShellProvider shell={shell}>{children}</ShellProvider>
  );
  const hook = await renderHook(
    () => ({ state: useXpLogState(), setDailyGoal: useSetDailyGoal() }),
    {
      wrapper,
    },
  );
  return { composition, hook };
}

describe('the XP log hooks', () => {
  it('give the XP earned, kept up to date as the Game awards XP', async () => {
    const { composition, hook } = await renderXpLog();
    expect(hook.result.current.state.total).toBe(0);

    await act(async () => {
      composition.xpLog
        .award({ source: 'game-round', mode: 'guess-word', rarity: undefined })
        .commit();
      await Promise.resolve();
    });

    expect(hook.result.current.state.total).toBe(1);
    expect(hook.result.current.state.today).toBe(1);
  });

  it('set the Daily Goal and clear it again', async () => {
    const { hook } = await renderXpLog();
    expect(hook.result.current.state.dailyGoal).toBeNull();

    await act(async () => {
      hook.result.current.setDailyGoal(10);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(hook.result.current.state.dailyGoal?.goal).toBe(10);

    await act(async () => {
      hook.result.current.setDailyGoal(null);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(hook.result.current.state.dailyGoal).toBeNull();
  });
});
