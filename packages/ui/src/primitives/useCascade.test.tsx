import { CascadeList, ReduceMotionProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import Animated, { getAnimatedStyle } from 'react-native-reanimated';

import { useCascade } from './useCascade';

const CASCADE = { variant: 'fade', stagger: 60, duration: 100 } as const;

function Item({ index }: { index: number }) {
  return <Animated.View testID={`item-${String(index)}`} style={useCascade(index, CASCADE)} />;
}

/** A list in a `CascadeList` whose items come once it has read them. */
function list(items: number) {
  return (
    <ReduceMotionProvider reduceMotion={false}>
      <CascadeList>
        {Array.from({ length: items }, (_, index) => (
          <Item key={index} index={index} />
        ))}
      </CascadeList>
    </ReduceMotionProvider>
  );
}

const opacityOf = (testID: string) =>
  (getAnimatedStyle(screen.getByTestId(testID)) as { opacity?: number }).opacity ?? 1;

describe('CascadeList', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cascades items that come after a read, counting their turns from the first of them', async () => {
    await render(list(0));
    // The list reads its items for 400 ms.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(400);
    });
    await screen.rerender(list(7));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(100);
    });

    expect(opacityOf('item-0')).toBe(1);
    expect(opacityOf('item-6')).toBe(0);
  });
});
