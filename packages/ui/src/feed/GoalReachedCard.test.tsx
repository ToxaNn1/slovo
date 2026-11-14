import type { Haptics } from '@slovo/core';
import { EditionProvider, GoalReachedCard, HapticsProvider, VerticalPager } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

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
) {
  await render(
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
    </EditionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

// Owner 14.11, ADR 0128, board XFeed f4: the goal-reached card.
describe('the goal-reached card', () => {
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
});
