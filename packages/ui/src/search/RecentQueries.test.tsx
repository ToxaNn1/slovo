import { EditionProvider, RecentQueries, ReduceMotionProvider } from '@slovo/ui';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

async function renderQueries(
  queries: readonly string[],
  { reduceMotion = false }: { reduceMotion?: boolean } = {},
) {
  const run = jest.fn();
  await render(
    <ReduceMotionProvider reduceMotion={reduceMotion}>
      <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
        <RecentQueries queries={queries} onRun={run} />
      </EditionProvider>
    </ReduceMotionProvider>,
  );
  return run;
}

function entrance(index: number) {
  const style = getAnimatedStyle(screen.getByTestId(`search-recent-${String(index)}-cascade`)) as {
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

describe('RecentQueries', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists the queries in their order and runs one again on a tap', async () => {
    const run = await renderQueries(['gre', 'sum']);

    expect(screen.getByTestId('search-recent-0')).toHaveAccessibleName('gre');
    expect(screen.getByTestId('search-recent-1')).toHaveAccessibleName('sum');

    await fireEvent.press(screen.getByRole('button', { name: 'sum' }));

    expect(run).toHaveBeenCalledWith('sum');
  });

  it('rises each row in by 16 over 300 ms, 50 ms in, 50 ms after the row before it', async () => {
    jest.useFakeTimers();
    await renderQueries(['gre', 'sum']);

    expect(entrance(0)).toEqual({ opacity: 0, rise: 16 });
    expect(entrance(1)).toEqual({ opacity: 0, rise: 16 });

    await wait(350);
    expect(entrance(0)).toEqual({ opacity: 1, rise: 0 });
    expect(entrance(1).opacity).toBeLessThan(1);

    await wait(50);
    expect(entrance(1)).toEqual({ opacity: 1, rise: 0 });
  });

  it('under Reduce Motion only fades the rows in, without rising', async () => {
    jest.useFakeTimers();
    await renderQueries(['gre', 'sum'], { reduceMotion: true });

    expect(entrance(1)).toEqual({ opacity: 0, rise: 0 });

    await wait(300);
    expect(entrance(1)).toEqual({ opacity: 1, rise: 0 });
  });
});
