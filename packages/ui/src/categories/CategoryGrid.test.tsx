import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CategoryGrid,
  EditionProvider,
  ReduceMotionProvider,
  type CategoryTileBox,
  type GridTile,
} from '@slovo/ui';
import { categoryGrid } from '@slovo/ui/tokens';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const tiles: GridTile[] = [
  { id: 'nature', name: 'Природа' },
  { id: 'feelings', name: 'Почуття' },
  { id: 'home', name: 'Дім' },
  { id: 'war', name: 'Військова справа' },
];

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
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'uk' }} strings={testStrings()}>
        <CategoryGrid
          testID="grid"
          title="Категорії"
          count="16"
          tiles={tiles}
          columns={3}
          box={box}
          shapes={categoryGrid.shapes}
          onOpen={onOpen}
        />
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return onOpen;
}

const groundOf = (id: string) =>
  (
    StyleSheet.flatten(screen.getByTestId(`grid-${id}-face`).props.style) as {
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

    expect(screen.getByRole('header', { name: 'Категорії, 16' })).toBeTruthy();
    expect(screen.getByText('Категорії')).toBeTruthy();
    expect(screen.getByText('16')).toBeTruthy();
  });

  it('renders one tile per Category with its name, a tap opening it', async () => {
    const onOpen = await renderGrid();

    for (const { name } of tiles) expect(screen.getByLabelText(name)).toBeTruthy();
    expect(screen.getByTestId('grid-war-name')).toHaveTextContent('Військова справа');

    await fireEvent.press(screen.getByLabelText('Дім'));

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
