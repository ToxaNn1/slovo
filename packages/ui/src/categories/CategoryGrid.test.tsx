import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CategoryGrid,
  coreTokens,
  EditionProvider,
  ReduceMotionProvider,
  TokensProvider,
  type CategoryTileBox,
  type DesignTokens,
  type GridTile,
} from '@slovo/ui';
import { categoryGrid } from '@slovo/ui/tokens';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const tiles: GridTile[] = [
  { id: 'nature', name: 'Nature' },
  { id: 'feelings', name: 'Feelings' },
  { id: 'home', name: 'Home' },
  { id: 'war', name: 'Military affairs' },
];

/** The Core tokens draw the accent as ink; an Edition's red sets the three tones apart. */
const editionTokens: DesignTokens = {
  ...coreTokens,
  colors: {
    light: { ...coreTokens.colors.light, accent: '#D7261E' },
    dark: { ...coreTokens.colors.dark, accent: '#D7261E' },
  },
};

const box: Omit<CategoryTileBox, 'width'> = {
  height: categoryGrid.height,
  radius: categoryGrid.radius,
  padding: categoryGrid.tilePadding,
  big: categoryGrid.big,
  small: categoryGrid.small,
  name: 'gridTileName',
};

async function renderGrid({ reduceMotion = false }: { reduceMotion?: boolean } = {}) {
  const onOpen = jest.fn();
  await render(
    <TokensProvider tokens={editionTokens} colorScheme="light">
      <ReduceMotionProvider reduceMotion={reduceMotion}>
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <CategoryGrid
            testID="grid"
            title="Categories"
            count="16"
            tiles={tiles}
            columns={3}
            box={box}
            shapes={categoryGrid.shapes}
            onOpen={onOpen}
          />
        </EditionProvider>
      </ReduceMotionProvider>
    </TokensProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return onOpen;
}

const groundOf = (id: string) =>
  (
    StyleSheet.flatten(screen.getByTestId(`grid-${id}-face`).props['style']) as {
      backgroundColor?: string;
    }
  ).backgroundColor;

function cascade(id: string) {
  const style = getAnimatedStyle(screen.getByTestId(`grid-${id}-cascade`)) as {
    opacity?: number;
    transform?: { translateY?: number }[];
  };
  return {
    opacity: style.opacity ?? 1,
    rise: style.transform?.find((step) => step.translateY !== undefined)?.translateY ?? 0,
  };
}

async function wait(ms: number) {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

describe('CategoryGrid', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads its title and count as a header', async () => {
    await renderGrid();

    expect(screen.getByRole('header', { name: 'Categories, 16' })).toBeTruthy();
    expect(screen.getByText('Categories')).toBeTruthy();
    expect(screen.getByText('16')).toBeTruthy();
  });

  it('renders one tile per Category with its name, a tap opening it', async () => {
    const onOpen = await renderGrid();

    for (const { name } of tiles) expect(screen.getByLabelText(name)).toBeTruthy();
    expect(screen.getByTestId('grid-war-name')).toHaveTextContent('Military affairs');

    await fireEvent.press(screen.getByLabelText('Home'));

    expect(onOpen).toHaveBeenCalledWith('home');
  });

  it('takes the tones by position: three apart, the fourth as the first', async () => {
    await renderGrid();

    const [first, second, third, fourth] = tiles.map(({ id }) => groundOf(id));
    expect(new Set([first, second, third]).size).toBe(3);
    expect(fourth).toBe(first);
  });

  it('cascades the tiles in, 25 ms apart', async () => {
    await renderGrid();

    expect(cascade('war')).toEqual({ opacity: 0, rise: 16 });

    await wait(60);
    expect(cascade('war').opacity).toBe(0);

    await wait(400);
    expect(cascade('war')).toEqual({ opacity: 1, rise: 0 });
  });

  it('only fades the tiles in under Reduce Motion, without rising', async () => {
    await renderGrid({ reduceMotion: true });

    expect(cascade('war')).toEqual({ opacity: 0, rise: 0 });

    await wait(300);
    expect(cascade('war')).toEqual({ opacity: 1, rise: 0 });
  });
});

describe('CategoryGrid with a header, an empty state and its own tile labels', () => {
  async function renderWith(gridTiles: readonly GridTile[]) {
    await render(
      <TokensProvider tokens={editionTokens} colorScheme="light">
        <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
          <CategoryGrid
            testID="grid"
            title="Collections"
            count={String(gridTiles.length)}
            tiles={gridTiles}
            columns={3}
            box={box}
            shapes={categoryGrid.shapes}
            header={<Text>Back</Text>}
            empty={<Text>Nothing here yet</Text>}
            onOpen={jest.fn()}
          />
        </EditionProvider>
      </TokensProvider>,
    );
  }

  it('draws the header over the title and reads a tile by its own label', async () => {
    await renderWith([{ id: 'autumn', name: 'Autumn', accessibilityLabel: 'Autumn, 3 entries' }]);

    expect(screen.getByText('Back')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Autumn, 3 entries' })).toBeOnTheScreen();
    expect(screen.queryByText('Nothing here yet')).not.toBeOnTheScreen();
  });

  it('shows the empty state with no tiles', async () => {
    await renderWith([]);

    expect(screen.getByText('Nothing here yet')).toBeOnTheScreen();
  });
});
