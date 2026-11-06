import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CorrectionCategoryGrid,
  coreTokens,
  EditionProvider,
  ReduceMotionProvider,
  TokensProvider,
  type DesignTokens,
  type GridTile,
} from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const tiles: GridTile[] = [
  { id: 'talk', name: 'In conversation' },
  { id: 'home', name: 'At home' },
  { id: 'work', name: 'At work' },
];

const accent = '#D7261E';
const sunken = '#F5E4CF';

/** An Edition's red and sunken surface, so the tones tell apart. */
const editionTokens: DesignTokens = {
  ...coreTokens,
  colors: {
    light: { ...coreTokens.colors.light, accent, surfaceSunken: sunken },
    dark: { ...coreTokens.colors.dark, accent, surfaceSunken: sunken },
  },
};

async function renderGrid({ reduceMotion = false }: { reduceMotion?: boolean } = {}) {
  const onOpen = jest.fn();
  await render(
    <TokensProvider tokens={editionTokens} colorScheme="light">
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <CorrectionCategoryGrid testID="grid" title="Corrections" tiles={tiles} onOpen={onOpen} />
        </EditionProvider>
      </ReduceMotionProvider>
    </TokensProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return onOpen;
}

const flat = (id: string) =>
  StyleSheet.flatten(screen.getByTestId(id).props['style']) as {
    backgroundColor?: string;
    width?: string;
  };

const opacityOf = (id: string) =>
  (getAnimatedStyle(screen.getByTestId(`grid-${id}-cascade`)) as { opacity?: number }).opacity ?? 1;

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('CorrectionCategoryGrid', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads its title with the number of Categories of Corrections as a header', async () => {
    await renderGrid();

    expect(screen.getByRole('header', { name: 'Corrections, 3' })).toBeTruthy();
  });

  it('renders one tile per Category in two columns, a tap opening it', async () => {
    const onOpen = await renderGrid();

    for (const { id, name } of tiles) {
      expect(screen.getByLabelText(name)).toBeTruthy();
      expect(flat(`grid-${id}-cascade`).width).toBe('50%');
    }

    await fireEvent.press(screen.getByLabelText('At work'));

    expect(onOpen).toHaveBeenCalledWith('work');
  });

  it('paints the first tile red and the others the sunken surface', async () => {
    await renderGrid();

    expect(tiles.map(({ id }) => flat(`grid-${id}-face`).backgroundColor)).toEqual([
      accent,
      sunken,
      sunken,
    ]);
  });

  it('cascades the tiles in, 40 ms apart', async () => {
    await renderGrid();

    expect(opacityOf('work')).toBe(0);

    await wait(70);
    expect(opacityOf('work')).toBe(0);
    expect(opacityOf('home')).toBeGreaterThan(0);

    await wait(400);
    expect(opacityOf('work')).toBe(1);
  });

  it('fades every tile in at once under Reduce Motion', async () => {
    await renderGrid({ reduceMotion: true });

    await wait(320);

    for (const { id } of tiles) expect(opacityOf(id)).toBe(1);
  });
});
