import type { EditionStrings } from '@slovo/contracts';
import type { ProgressState } from '@slovo/core';
import { EditionProvider, StatsPill, StatsSheet } from '@slovo/ui';
import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const plural = (text: string) => ({ one: text, few: text, many: text, other: text });

const strings = {
  game: { round: { progress: '{passed} of {total}' } },
  stats: {
    title: 'Stats',
    pillLabel: plural('Stats: streak {count}'),
    streak: plural('days in a row'),
    bestStreak: 'best streak {count}',
    seenToday: plural('seen today'),
    favorites: 'favorites',
    inCollections: plural('in collections'),
    gameBest: plural('best game'),
    gameBestLabel: plural('best game'),
  },
} as unknown as EditionStrings;

const progress: ProgressState = {
  streak: 12,
  bestStreak: 30,
  seenToday: 4,
  favorites: 7,
  inCollections: 3,
  bestResult: undefined,
};

async function renderInEdition(children: ReactNode) {
  await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: zeroInsets }}
    >
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        {children}
      </EditionProvider>
    </SafeAreaProvider>,
  );
}

const zeroInsets = { top: 0, left: 0, right: 0, bottom: 0 };

describe('StatsPill', () => {
  it('draws the Streak', async () => {
    await renderInEdition(<StatsPill streak={12} onPress={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Stats: streak 12' })).toBeOnTheScreen();
    expect(screen.getByText('12')).toBeOnTheScreen();
  });

  it('draws nothing while the Streak is hidden', async () => {
    await renderInEdition(<StatsPill streak={12} hideStreak onPress={() => undefined} />);

    expect(screen.queryByTestId('stats-pill')).not.toBeOnTheScreen();
    expect(screen.queryByText('12')).not.toBeOnTheScreen();
  });
});

describe('StatsSheet', () => {
  it('draws the Streak and the counts', async () => {
    await renderInEdition(<StatsSheet visible stats={progress} onClose={() => undefined} />);

    expect(screen.getByTestId('stats-streak')).toBeOnTheScreen();
    expect(screen.getByText('best streak 30')).toBeOnTheScreen();
    expect(screen.getByTestId('stats-favorites')).toBeOnTheScreen();
  });

  it('keeps the counts but draws neither the Streak nor the Best Streak while the Streak is hidden', async () => {
    await renderInEdition(
      <StatsSheet visible hideStreak stats={progress} onClose={() => undefined} />,
    );

    expect(screen.queryByTestId('stats-streak')).not.toBeOnTheScreen();
    expect(screen.queryByText('best streak 30')).not.toBeOnTheScreen();
    expect(screen.getByTestId('stats-favorites')).toBeOnTheScreen();
  });
});
