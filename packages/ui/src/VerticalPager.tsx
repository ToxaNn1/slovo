import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
  type GestureType,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
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

/** Turns a `VerticalPager` from code. */
export interface VerticalPagerHandle {
  /** Moves to the page at `index` with the swipe's motion, as if the reader swiped there. */
  turnTo(index: number): void;
}

export interface VerticalPagerProps<Item> {
  /** The pages in order. Pages change or join only after the current one. */
  readonly items: readonly Item[];
  readonly renderPage: (item: Item, index: number) => ReactNode;
  /** The page shown first. */
  readonly initialIndex?: number;
  /** Called once a swipe settles on another page. */
  readonly onIndexChange: (index: number) => void;
  readonly testID?: string;
  readonly ref?: Ref<VerticalPagerHandle>;
}

/** Where a page's scroll stands: its offset and the furthest it can go. */
interface PageScroll {
  readonly y: number;
  readonly max: number;
}

/** What a drag does: nothing decided yet, turn the page, or scroll the page's content. */
const DRAG = { undecided: 0, page: 1, scroll: 2 } as const;

/** How close to an end of its scroll, in points, a page counts as at that end. */
const SCROLL_EDGE = 1;

interface PagerContextValue {
  readonly panRef: RefObject<GestureType | undefined>;
  /** Each drawn page's scroll, by page index; a page without a scroll view has none. */
  readonly scrolls: SharedValue<Record<number, PageScroll>>;
  /** Whether a drag is turning the page now, so the page's content holds still. */
  readonly turning: SharedValue<boolean>;
}

const PagerContext = createContext<PagerContextValue | undefined>(undefined);
const PageIndexContext = createContext(0);

/**
 * Full-screen pages stacked vertically: swipe up for the next page, down for
 * the one before. It snaps one page per swipe and draws only the pages next
 * to the current one. A page taller than the screen puts its content in a
 * `PagerScrollView`: a swipe then scrolls it, and turns the page only once the
 * content is scrolled to its end in that direction.
 */
export function VerticalPager<Item>({
  items,
  renderPage,
  initialIndex = 0,
  onIndexChange,
  testID,
  ref,
}: VerticalPagerProps<Item>) {
  const [index, setIndex] = useState(initialIndex);
  const [height, setHeight] = useState(0);
  /** The page on screen, in pages; fractional while a swipe moves. */
  const position = useSharedValue(initialIndex);
  const pageHeight = useSharedValue(0);
  const lastIndex = useSharedValue(items.length - 1);
  const dragStart = useSharedValue(0);
  const drag = useSharedValue<number>(DRAG.undecided);
  /** The drag's translation when it started to turn the page. */
  const turnFrom = useSharedValue(0);
  const scrolls = useSharedValue<Record<number, PageScroll>>({});
  const turning = useSharedValue(false);
  const panRef = useRef<GestureType | undefined>(undefined);

  useEffect(() => {
    lastIndex.value = items.length - 1;
  }, [items.length, lastIndex]);

  function settle(target: number) {
    setIndex(target);
    onIndexChange(target);
  }

  useImperativeHandle(ref, () => ({
    turnTo(target) {
      const clamped = Math.min(Math.max(target, 0), items.length - 1);
      if (clamped === index) return;
      position.value = withTiming(clamped, SWIPE, (finished) => {
        if (finished === true) scheduleOnRN(settle, clamped);
      });
    },
  }));

  const pan = Gesture.Pan()
    .withRef(panRef)
    .activeOffsetY([-12, 12])
    .failOffsetX([-24, 24])
    .onStart(() => {
      dragStart.value = position.value;
      drag.value = DRAG.undecided;
    })
    .onUpdate(({ translationY }) => {
      if (pageHeight.value === 0) return;
      if (drag.value === DRAG.undecided) {
        // The page turns only from the end of its scroll in the swipe's direction.
        const scroll = scrolls.value[Math.round(dragStart.value)] ?? { y: 0, max: 0 };
        const atEnd =
          translationY < 0 ? scroll.y >= scroll.max - SCROLL_EDGE : scroll.y <= SCROLL_EDGE;
        drag.value = atEnd ? DRAG.page : DRAG.scroll;
        turnFrom.value = translationY;
        turning.value = atEnd;
      }
      if (drag.value !== DRAG.page) return;
      const dragged = dragStart.value - (translationY - turnFrom.value) / pageHeight.value;
      const clamped = Math.min(Math.max(dragged, 0), lastIndex.value);
      position.value = clamped + (dragged - clamped) * EDGE_RESISTANCE;
    })
    .onEnd(({ translationY, velocityY }) => {
      if (drag.value !== DRAG.page) return;
      const start = Math.round(dragStart.value);
      const turned = translationY - turnFrom.value;
      const share = pageHeight.value === 0 ? 0 : turned / pageHeight.value;
      let target = start;
      if (velocityY < -TURN_VELOCITY || share < -TURN_DISTANCE) target = start + 1;
      else if (velocityY > TURN_VELOCITY || share > TURN_DISTANCE) target = start - 1;
      target = Math.min(Math.max(target, 0), lastIndex.value);
      position.value = withTiming(target, SWIPE, (finished) => {
        if (finished === true && target !== start) scheduleOnRN(settle, target);
      });
    })
    .onFinalize(() => {
      turning.value = false;
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
    <PagerContext value={{ panRef, scrolls, turning }}>
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
    </PagerContext>
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
      <PageIndexContext value={index}>{children}</PageIndexContext>
    </Animated.View>
  );
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

/**
 * The scrolling content of a `VerticalPager` page, for a page that may be
 * taller than the screen. It scrolls with the same swipe that turns pages,
 * and holds still while the swipe turns the page.
 */
export function PagerScrollView({
  contentContainerStyle,
  children,
  testID,
}: {
  contentContainerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
  testID?: string;
}) {
  const pager = useContext(PagerContext);
  if (pager === undefined) throw new Error('PagerScrollView must be inside a VerticalPager');
  const { panRef, scrolls, turning } = pager;
  const index = useContext(PageIndexContext);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const viewport = useRef(0);
  const content = useRef(0);
  /** Where the content holds while a swipe turns the page. */
  const heldAt = useSharedValue(0);

  function measure() {
    const max = Math.max(content.current - viewport.current, 0);
    const y = Math.min(scrolls.value[index]?.y ?? 0, max);
    scrolls.value = { ...scrolls.value, [index]: { y, max } };
  }

  useEffect(
    () => () => {
      const others = { ...scrolls.value };
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed by page index
      delete others[index];
      scrolls.value = others;
    },
    [index, scrolls],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    if (turning.value) {
      scrollTo(scrollRef, 0, heldAt.value, false);
      return;
    }
    heldAt.value = y;
    const max = Math.max(event.contentSize.height - event.layoutMeasurement.height, 0);
    scrolls.value = { ...scrolls.value, [index]: { y, max } };
  });

  return (
    <AnimatedScrollView
      ref={scrollRef}
      testID={testID}
      simultaneousHandlers={panRef}
      // The page turns at the ends, so the content never bounces past them.
      bounces={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onLayout={(event: LayoutChangeEvent) => {
        viewport.current = event.nativeEvent.layout.height;
        measure();
      }}
      onContentSizeChange={(_width: number, height: number) => {
        content.current = height;
        measure();
      }}
      contentContainerStyle={contentContainerStyle}
    >
      {children}
    </AnimatedScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
