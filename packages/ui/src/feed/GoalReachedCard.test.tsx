import type { Haptics } from '@slovo/core';
import {
  EditionProvider,
  GoalReachedCard,
  HapticsProvider,
  ReduceMotionProvider,
  VerticalPager,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';

import { testStrings } from '../test-strings';

const strings = testStrings({
  feedNotices: {
    goalReached: {
      label: 'DAILY GOAL',
      plate: { one: '{count} / {count} WORD', other: '{count} / {count} WORDS' },
      title: 'Goal reached!',
      message: 'A new one tomorrow.',
      collected: 'TODAY YOU GOT',
      more: { one: '+ {count} more word', other: '+ {count} more words' },
      streak: { one: 'DAY IN A ROW', other: 'DAYS IN A ROW' },
      next: 'SCROLL ON',
    },
  },
});

/** The Feed's pages: the goal-reached card, then the next Entry's card behind it. */
const PAGES = ['notice', 'next'] as const;

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderFeed(
  props: { goal: number; words: readonly string[]; streak: number | undefined },
  onIndexChange: (index: number) => void = jest.fn(),
  reduceMotion = false,
) {
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <VerticalPager
            testID="pager"
            items={PAGES}
            onIndexChange={onIndexChange}
            renderPage={(page) =>
              page === 'notice' ? <GoalReachedCard {...props} /> : <Text>Next</Text>
            }
          />
        </HapticsProvider>
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  // The system answers on Reduce Motion.
  await act(async () => {
    await Promise.resolve();
  });
}

interface Style {
  opacity?: number;
  transform?: Record<string, number | string>[];
}

/** How far the part stands from its place and how much of it shows. */
function pose(testID: string) {
  const style = getAnimatedStyle(screen.getByTestId(testID)) as Style;
  const step = (name: string) => {
    const value = style.transform?.find((one) => one[name] !== undefined)?.[name];
    return typeof value === 'number' ? value : 0;
  };
  return {
    opacity: style.opacity ?? 1,
    x: step('translateX'),
    y: step('translateY'),
    scale: style.transform?.some((one) => one['scale'] !== undefined) ? step('scale') : 1,
  };
}

const AT_REST = { opacity: 1, x: 0, y: 0, scale: 1 };

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

// Owner 14.11, ADR 0129, board XFeed f4: the goal-reached card.
describe('the goal-reached card', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('names the goal on its plate in the plural form of the number, the title, the line and the Streak', async () => {
    await renderFeed({ goal: 3, words: ['dawn', 'spark', 'skyline'], streak: 24 });
    expect(screen.getByText('DAILY GOAL')).toBeTruthy();
    expect(screen.getByText('3 / 3 WORDS')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Goal reached!' })).toBeTruthy();
    expect(screen.getByText('A new one tomorrow.')).toBeTruthy();
    expect(screen.getByText('24')).toBeTruthy();
    expect(screen.getByText('DAYS IN A ROW')).toBeTruthy();
    expect(screen.getByTestId('mascot-celebrates')).toBeTruthy();
  });

  it('shows each Word Seen of a goal up to three', async () => {
    await renderFeed({ goal: 1, words: ['dawn'], streak: 1 });
    expect(screen.getByText('1 / 1 WORD')).toBeTruthy();
    expect(screen.getByText('TODAY YOU GOT')).toBeTruthy();
    expect(screen.getByText('dawn')).toBeTruthy();
    expect(screen.getByText('DAY IN A ROW')).toBeTruthy();
  });

  it('shows two Words and the rest as a count over a goal of three', async () => {
    await renderFeed({ goal: 25, words: ['dawn', 'spark', 'skyline'], streak: 5 });
    expect(screen.getByText('25 / 25 WORDS')).toBeTruthy();
    expect(screen.getByText('dawn')).toBeTruthy();
    expect(screen.getByText('spark')).toBeTruthy();
    expect(screen.queryByText('skyline')).toBeNull();
    expect(screen.getByText('+ 23 more words')).toBeTruthy();

    await renderFeed({ goal: 50, words: ['dawn', 'spark', 'skyline'], streak: 5 });
    expect(screen.getByText('50 / 50 WORDS')).toBeTruthy();
    expect(screen.getByText('+ 48 more words')).toBeTruthy();
  });

  it('names no Streak while the reader doesn’t see it', async () => {
    await renderFeed({ goal: 3, words: ['dawn'], streak: undefined });
    expect(screen.queryByTestId('goal-reached-streak')).toBeNull();
  });

  it('turns to the next card on its button, as a swipe would, so it leaves the screen', async () => {
    const onIndexChange = jest.fn();
    await renderFeed({ goal: 3, words: ['dawn'], streak: 2 }, onIndexChange);
    await fireEvent.press(screen.getByRole('button', { name: 'SCROLL ON' }));
    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByTestId('goal-reached')).toBeNull();
  });

  it('enters as the board draws it: the card rises in, then its title, each Word after the one before and the Mascot', async () => {
    await renderFeed({ goal: 3, words: ['dawn', 'spark', 'skyline'], streak: 4 });
    // Each plate slides in from its own width to its left.
    await fireEvent(screen.getByTestId('goal-reached-word-2'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 120, height: 40 } },
    });
    expect(pose('goal-reached-enter').y).toBeGreaterThan(0);
    expect(pose('goal-reached-title').opacity).toBe(0);
    expect(pose('goal-reached-word-0').opacity).toBe(0);
    expect(pose('goal-reached-mascot').opacity).toBe(0);
    expect(pose('goal-reached-button').opacity).toBe(0);

    await wait(700);
    expect(pose('goal-reached-enter')).toEqual(AT_REST);
    expect(pose('goal-reached-word-0').opacity).toBe(0);

    await wait(500);
    expect(pose('goal-reached-title')).toEqual(AT_REST);
    expect(pose('goal-reached-word-0').opacity).toBe(1);
    expect(pose('goal-reached-word-2').x).toBeLessThan(0);
    expect(pose('goal-reached-mascot').y).toBeGreaterThan(0);

    await wait(800);
    for (const part of ['word-2', 'mascot', 'streak', 'button']) {
      expect(pose(`goal-reached-${part}`)).toEqual(AT_REST);
    }
  });

  it('throws shards out from its middle that fade away', async () => {
    await renderFeed({ goal: 3, words: ['dawn'], streak: 4 });
    expect(pose('goal-reached-shard-0').opacity).toBe(0);

    await wait(800);
    const flying = pose('goal-reached-shard-0');
    expect(flying.opacity).toBeGreaterThan(0);
    expect(flying.x).toBeLessThan(0);
    expect(flying.y).toBeLessThan(0);

    await wait(1200);
    expect(pose('goal-reached-shard-0').opacity).toBe(0);
  });

  it('only fades in under Reduce Motion, its parts in place and no shards (ADR 0055)', async () => {
    await renderFeed({ goal: 3, words: ['dawn', 'spark'], streak: 4 }, jest.fn(), true);
    const start = pose('goal-reached-enter');
    expect(start.opacity).toBeLessThan(1);
    expect(start.y).toBe(0);
    for (const part of ['title', 'word-1', 'mascot', 'button']) {
      expect(pose(`goal-reached-${part}`)).toEqual(AT_REST);
    }
    expect(screen.queryByTestId('goal-reached-shard-0')).toBeNull();

    await wait(300);
    expect(pose('goal-reached-enter')).toEqual(AT_REST);
  });
});
