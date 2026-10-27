import type { EditionStrings } from '@slovo/contracts';
import type { Haptics } from '@slovo/core';
import { DailyLimitCard, EditionProvider, HapticsProvider, VerticalPager } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

const strings = {
  feedNotices: {
    dailyLimit: { message: 'Enough for today. Come back tomorrow', keepGoing: 'Keep going' },
  },
} as unknown as EditionStrings;

/** The Feed's pages: the Daily Limit card, then the next Entry's card behind it. */
const PAGES = ['dailyLimit', 'next'] as const;

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderFeed(onIndexChange: (index: number) => void) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={PAGES}
          onIndexChange={onIndexChange}
          renderPage={(page) => (page === 'dailyLimit' ? <DailyLimitCard /> : <Text>Next</Text>)}
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

describe('the Daily Limit card', () => {
  it('asks the reader to stop for today, with a button to keep going', async () => {
    await renderFeed(jest.fn());

    expect(screen.getByTestId('feed-notice-dailyLimit')).toBeTruthy();
    expect(screen.getByText('Enough for today. Come back tomorrow')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();
  });

  it('turns to the next card on «Keep going», as a swipe would, so it leaves the screen', async () => {
    const onIndexChange = jest.fn();
    await renderFeed(onIndexChange);

    await fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByTestId('feed-notice-dailyLimit')).toBeNull();
  });
});
