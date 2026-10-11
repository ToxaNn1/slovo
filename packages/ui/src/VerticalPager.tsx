import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** The Feed swipe from the design: 420 ms, `cubic-bezier(.2, .8, .2, 1)`. */
const SWIPE = { duration: 420, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };

/** How far, as a share of the page, a slow drag must go to turn the page. */
const TURN_DISTANCE = 0.2;

/** How fast, in points per second, a flick turns the page whatever its length. */
const TURN_VELOCITY = 500;

/** How much of a drag past the first or last page still moves it. */
const EDGE_RESISTANCE = 0.3;

export interface VerticalPagerProps<Item> {
  /** The pages in order. The pager only ever adds pages at the end. */
  readonly items: readonly Item[];
  readonly renderPage: (item: Item, index: number) => ReactNode;
  /** The page shown first. */
  readonly initialIndex?: number;
  /** Called once a swipe settles on another page. */
  readonly onIndexChange: (index: number) => void;
  readonly testID?: string;
}

/**
 * Full-screen pages stacked vertically: swipe up for the next page, down for
 * the one before. It snaps one page per swipe and draws only the pages next
 * to the current one.
 */
export function VerticalPager<Item>({
  items,
  renderPage,
  initialIndex = 0,
  onIndexChange,
  testID,
}: VerticalPagerProps<Item>) {
  const [index, setIndex] = useState(initialIndex);
  const [height, setHeight] = useState(0);
  /** The page on screen, in pages; fractional while a swipe moves. */
  const position = useSharedValue(initialIndex);
  const pageHeight = useSharedValue(0);
  const lastIndex = useSharedValue(items.length - 1);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    lastIndex.value = items.length - 1;
  }, [items.length, lastIndex]);

  function settle(target: number) {
    setIndex(target);
    onIndexChange(target);
  }

  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStart.value = position.value;
    })
    .onUpdate(({ translationY }) => {
      if (pageHeight.value === 0) return;
      const dragged = dragStart.value - translationY / pageHeight.value;
      const clamped = Math.min(Math.max(dragged, 0), lastIndex.value);
      position.value = clamped + (dragged - clamped) * EDGE_RESISTANCE;
    })
    .onEnd(({ translationY, velocityY }) => {
      const start = Math.round(dragStart.value);
      const share = pageHeight.value === 0 ? 0 : translationY / pageHeight.value;
      let target = start;
      if (velocityY < -TURN_VELOCITY || share < -TURN_DISTANCE) target = start + 1;
      else if (velocityY > TURN_VELOCITY || share > TURN_DISTANCE) target = start - 1;
      target = Math.min(Math.max(target, 0), lastIndex.value);
      position.value = withTiming(target, SWIPE, (finished) => {
        if (finished === true && target !== start) scheduleOnRN(settle, target);
      });
    });

  function onLayout(event: LayoutChangeEvent) {
    const measured = event.nativeEvent.layout.height;
    pageHeight.value = measured;
    setHeight(measured);
  }

  // The current page and its neighbours, ready to move in.
  const first = Math.max(index - 1, 0);
  const visible = items.slice(first, index + 2);

  return (
    <GestureHandlerRootView style={styles.fill}>
      <GestureDetector gesture={pan}>
        <View testID={testID} style={styles.fill} onLayout={onLayout}>
          {height > 0 &&
            visible.map((item, offset) => (
              <Page
                key={first + offset}
                index={first + offset}
                current={first + offset === index}
                position={position}
                height={height}
              >
                {renderPage(item, first + offset)}
              </Page>
            ))}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

function Page({
  index,
  current,
  position,
  height,
  children,
}: {
  index: number;
  current: boolean;
  position: SharedValue<number>;
  height: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: (index - position.value) * height }],
  }));
  return (
    // Only the current page is there for VoiceOver; its neighbours wait off screen.
    <Animated.View
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
      style={[StyleSheet.absoluteFill, { height }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
