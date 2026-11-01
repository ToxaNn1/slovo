import type { Haptics } from '@slovo/core';
import {
  EnoughForTodayCard,
  EditionProvider,
  FirstWeekCard,
  HapticsProvider,
  LevelMilestoneCard,
  VerticalPager,
} from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  feedNotices: {
    enoughForToday: { message: 'Maybe enough for today?', keepGoing: 'Keep going' },
    levelMilestone: {
      title: 'Level {level}: {name}',
      message: 'Try rarer words or a new Category in the Mix.',
    },
    firstWeek: {
      close: 'Got it',
      lastDayTitle: 'A week with us',
      days: [
        { title: 'Know it or not?', text: 'Tap Know or Don’t know.' },
        { title: 'Time for a Game', text: 'The Game tab waits.' },
        { title: 'Save the best', text: 'Tap the heart.' },
        { title: 'Your Mix', text: 'Choose what the Feed shows.' },
        { title: 'Always near', text: 'Add the widget.' },
        { title: 'Check yourself', text: 'Turn Self-check on.' },
      ],
      lastDayText: {
        one: 'Thanks for staying! Your streak is {count} day.',
        other: 'Thanks for staying! Your streak is {count} days.',
      },
      lastDayTextNoStreak: 'Thanks for staying! Come back for new words.',
    },
  },
});

/** The Feed's pages: a Feed Notice's card, then the next Entry's card behind it. */
const PAGES = ['notice', 'next'] as const;

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

async function renderFeed(notice: ReactNode, onIndexChange: (index: number) => void = jest.fn()) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <VerticalPager
          testID="pager"
          items={PAGES}
          onIndexChange={onIndexChange}
          renderPage={(page) => (page === 'notice' ? notice : <Text>Next</Text>)}
        />
      </HapticsProvider>
    </EditionProvider>,
  );
  // The pages are drawn once the pager knows its height.
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

// Ticket #1368, ADR 0066: the level milestone suggests and forces nothing.
describe('the level-milestone card', () => {
  it('names the Level and its Edition name and suggests a wider rarity or a new Category, with no button', async () => {
    await renderFeed(<LevelMilestoneCard level={5} name="Sprout" />);

    expect(screen.getByTestId('feed-notice-levelMilestone')).toBeTruthy();
    expect(screen.getByText('Level 5: Sprout')).toBeTruthy();
    expect(screen.getByText('Try rarer words or a new Category in the Mix.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the «enough for today» card', () => {
  it('asks the reader to stop for today, with a button to keep going', async () => {
    await renderFeed(<EnoughForTodayCard />);

    expect(screen.getByTestId('feed-notice-enoughForToday')).toBeTruthy();
    expect(screen.getByText('Maybe enough for today?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();
  });

  it('reads its text to VoiceOver as one element, then the button', async () => {
    await renderFeed(<EnoughForTodayCard />);

    expect(screen.getByLabelText('Maybe enough for today?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep going' })).toBeTruthy();
  });

  it('turns to the next card on «Keep going», as a swipe would, so it leaves the screen', async () => {
    const onIndexChange = jest.fn();
    await renderFeed(<EnoughForTodayCard />, onIndexChange);

    await fireEvent.press(screen.getByRole('button', { name: 'Keep going' }));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByTestId('feed-notice-enoughForToday')).toBeNull();
  });
});

describe('the first-week card', () => {
  it('shows what the app offers on day 1, with «Got it»', async () => {
    await renderFeed(<FirstWeekCard day={1} streak={undefined} />);

    expect(screen.getByTestId('feed-notice-firstWeek')).toBeTruthy();
    expect(screen.getByText('Know it or not?')).toBeTruthy();
    expect(screen.getByText('Tap Know or Don’t know.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });

  it('reads its title and text to VoiceOver as one element, with no stop after a question mark', async () => {
    await renderFeed(<FirstWeekCard day={1} streak={undefined} />);

    expect(screen.getByLabelText('Know it or not? Tap Know or Don’t know.')).toBeTruthy();
  });

  it('puts a stop between a title and its text where the title has none', async () => {
    await renderFeed(<FirstWeekCard day={7} streak={undefined} />);

    expect(
      screen.getByLabelText('A week with us. Thanks for staying! Come back for new words.'),
    ).toBeTruthy();
  });

  it('shows the card of its own day', async () => {
    await renderFeed(<FirstWeekCard day={6} streak={undefined} />);

    expect(screen.getByText('Check yourself')).toBeTruthy();
    expect(screen.queryByText('Know it or not?')).toBeNull();
  });

  it('shows the Streak on day 7', async () => {
    await renderFeed(<FirstWeekCard day={7} streak={7} />);

    expect(screen.getByText('A week with us')).toBeTruthy();
    expect(screen.getByText('Thanks for staying! Your streak is 7 days.')).toBeTruthy();
  });

  it('names no Streak on day 7 while the Streak is hidden', async () => {
    await renderFeed(<FirstWeekCard day={7} streak={undefined} />);

    expect(screen.getByText('A week with us')).toBeTruthy();
    expect(screen.getByText('Thanks for staying! Come back for new words.')).toBeTruthy();
    expect(screen.queryByText(/streak/)).toBeNull();
  });

  it('turns to the next card on «Got it», as a swipe would, so it closes', async () => {
    const onIndexChange = jest.fn();
    await renderFeed(<FirstWeekCard day={1} streak={undefined} />, onIndexChange);

    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));

    expect(onIndexChange).toHaveBeenCalledWith(1);
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByTestId('feed-notice-firstWeek')).toBeNull();
  });
});
