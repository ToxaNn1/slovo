'use no memo';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EditionProvider, ScrollToTopButton, useListScroll } from '@slovo/ui';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, FlatList, Text } from 'react-native';
import { scrollTo } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

// Reanimated scrolls a list on the UI thread, which Jest does not have: the
// test watches where the button asks the list to be, frame by frame.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  ...jest.requireActual<object>('react-native-reanimated'),
  scrollTo: jest.fn(),
}));

const rows = Array.from({ length: 100 }, (_, index) => `row ${String(index)}`);

function LongList() {
  const scroll = useListScroll<FlatList<string>>();
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <FlatList
        testID="list"
        ref={scroll.list}
        onScroll={scroll.onScroll}
        data={rows}
        keyExtractor={(row) => row}
        renderItem={({ item }) => <Text>{item}</Text>}
      />
      <ScrollToTopButton scroll={scroll} accessibilityLabel="Back to top" />
    </EditionProvider>
  );
}

async function scrollDownTo(y: number) {
  await fireEvent.scroll(screen.getByTestId('list'), {
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 390, height: 5000 },
      layoutMeasurement: { width: 390, height: 800 },
    },
  });
}

async function passTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

/** Every offset the button has asked the list to scroll to, in order. */
function glidedThrough(): number[] {
  return jest.mocked(scrollTo).mock.calls.map(([, , y]) => y);
}

describe('ScrollToTopButton', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.mocked(scrollTo).mockClear();
  });

  it('shows once the list is scrolled far down and hides near the top', async () => {
    await render(<LongList />);
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull();

    await scrollDownTo(300);
    await passTime(50);
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull();

    await scrollDownTo(1200);
    await passTime(50);
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeTruthy();

    await scrollDownTo(100);
    await passTime(500);
    expect(screen.queryByRole('button', { name: 'Back to top' })).toBeNull();
  });

  it('glides the list back to its top, passing the rows on the way', async () => {
    await render(<LongList />);
    await scrollDownTo(1200);
    await passTime(50);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to top' }));
    await passTime(1000);

    const offsets = glidedThrough();
    expect(offsets.at(-1)).toBe(0);
    expect(offsets.some((y) => y > 0 && y < 1200)).toBe(true);
    expect(jest.mocked(scrollTo)).toHaveBeenLastCalledWith(expect.anything(), 0, 0, false);
  });

  it('jumps straight to the top under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await render(<LongList />);
    await passTime(0);
    await scrollDownTo(1200);
    await passTime(50);

    await fireEvent.press(screen.getByRole('button', { name: 'Back to top' }));
    await passTime(100);

    expect(glidedThrough().filter((y) => y > 0 && y < 1200)).toEqual([]);
    expect(glidedThrough().at(-1)).toBe(0);
  });
});
