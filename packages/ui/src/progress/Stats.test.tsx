import type { EditionStrings } from '@slovo/contracts';
import type { ProgressState } from '@slovo/core';
import { EditionProvider, StatsPill, StatsSheet } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const plural = (text: string) => ({ one: text, few: text, many: text, other: text });
/** A count whose every form names itself, so a test reads which form the language picked. */
const forms = (noun: string) => ({
  one: `{count} ${noun} (one)`,
  few: `{count} ${noun} (few)`,
  many: `{count} ${noun} (many)`,
  other: `{count} ${noun} (other)`,
});

const strings = {
  game: { round: { progress: '{passed} of {total}' } },
  stats: {
    title: 'Stats',
    pillLabel: plural('Stats: streak {count}'),
    pillLabelWithoutStreak: 'Stats',
    streak: plural('days in a row'),
    bestStreak: 'best streak {count}',
    seenToday: plural('seen today'),
    favorites: 'favorites',
    inCollections: plural('in collections'),
    gameBest: plural('best game'),
    gameBestLabel: plural('best game'),
    known: 'know {words} · {corrections}',
    knownWithoutCorrections: 'know {words}',
    knownWithIdioms: 'know {words} · {corrections} · {idioms}',
    knownWithoutCorrectionsWithIdioms: 'know {words} · {idioms}',
    knownWords: forms('word'),
    knownCorrections: forms('correction'),
    knownIdioms: forms('idiom'),
    dueToday: 'due today: {count}',
  },
} as unknown as EditionStrings;

const progress: ProgressState = {
  streak: 12,
  bestStreak: 30,
  seenToday: 4,
  favorites: 7,
  inCollections: 3,
  bestResult: undefined,
  knownWords: 0,
  knownCorrections: 0,
  knownIdioms: 0,
  dueToday: 0,
};

const wordsAndCorrections = { corrections: true, idioms: false } as const;

async function renderInEdition(children: ReactNode, locale = 'en') {
  await render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: zeroInsets }}
    >
      <EditionProvider edition={{ locale }} strings={strings}>
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

  it('stays as the flame alone while the Streak is hidden, and opens the sheet', async () => {
    const onPress = jest.fn();
    await renderInEdition(<StatsPill streak={12} hideStreak onPress={onPress} />);

    expect(screen.queryByText('12')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Stats: streak 12' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Stats' }));
    expect(onPress).toHaveBeenCalledTimes(1);
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

  // Spec #461, ADR 0043: the knowledge rows, in the plural forms of Ukrainian.
  it.each([
    [1, 'one'],
    [2, 'few'],
    [5, 'many'],
    [11, 'many'],
    [21, 'one'],
  ])('draws the Known Words, Corrections and Idioms and today’s Review for %i', async (n, form) => {
    await renderInEdition(
      <StatsSheet
        visible
        stats={{ ...progress, knownWords: n, knownCorrections: n, knownIdioms: n, dueToday: n }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(
      screen.getByText(
        `know ${String(n)} word (${form}) · ${String(n)} correction (${form}) · ${String(n)} idiom (${form})`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText(`due today: ${String(n)}`)).toBeOnTheScreen();
  });

  it('draws different Word and Correction counts in their own forms, and 0 due', async () => {
    await renderInEdition(
      <StatsSheet
        visible
        knowledge={wordsAndCorrections}
        stats={{ ...progress, knownWords: 12, knownCorrections: 3, knownIdioms: 8, dueToday: 0 }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(screen.getByTestId('stats-known')).toHaveTextContent(
      'know 12 word (many) · 3 correction (few)',
    );
    expect(screen.queryByText(/idiom/)).not.toBeOnTheScreen();
    expect(screen.getByText('due today: 0')).toBeOnTheScreen();
  });

  // Spec #549, #565: the Known Idioms after the Known Corrections while the reader sees Idioms.
  it('draws the Known Idioms after the Known Corrections', async () => {
    await renderInEdition(
      <StatsSheet
        visible
        knowledge={{ corrections: true, idioms: true }}
        stats={{ ...progress, knownWords: 120, knownCorrections: 12, knownIdioms: 8 }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(screen.getByTestId('stats-known')).toHaveTextContent(
      'know 120 word (many) · 12 correction (many) · 8 idiom (many)',
    );
  });

  it('draws the Known Idioms after the Known Words while Corrections are left out', async () => {
    await renderInEdition(
      <StatsSheet
        visible
        knowledge={{ corrections: false, idioms: true }}
        stats={{ ...progress, knownWords: 12, knownCorrections: 3, knownIdioms: 1 }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(screen.getByTestId('stats-known')).toHaveTextContent(
      'know 12 word (many) · 1 idiom (one)',
    );
    expect(screen.queryByText(/correction/)).not.toBeOnTheScreen();
  });

  // Owner decision 19.10, #478: no count of Known Corrections while the reader sees none.
  it('draws the Known Words alone while Corrections and Idioms are left out', async () => {
    await renderInEdition(
      <StatsSheet
        visible
        knowledge={{ corrections: false, idioms: false }}
        stats={{ ...progress, knownWords: 12, knownCorrections: 3, knownIdioms: 8, dueToday: 2 }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(screen.getByTestId('stats-known')).toHaveTextContent('know 12 word (many)');
    expect(screen.queryByText(/correction|idiom/)).not.toBeOnTheScreen();
    expect(screen.getByText('due today: 2')).toBeOnTheScreen();
  });

  it('draws neither knowledge row while the knowledge counts are hidden', async () => {
    await renderInEdition(
      <StatsSheet
        visible
        knowledge="none"
        stats={{ ...progress, knownWords: 4, knownCorrections: 2, dueToday: 1 }}
        onClose={() => undefined}
      />,
      'uk',
    );

    expect(screen.queryByTestId('stats-known')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('stats-due-today')).not.toBeOnTheScreen();
    expect(screen.getByTestId('stats-favorites')).toBeOnTheScreen();
  });
});
