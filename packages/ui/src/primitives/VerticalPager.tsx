'use no memo';
// Reanimated or gesture code: the React Compiler skips this module (ADR 0059).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
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
  ReduceMotion,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useHaptics } from '../providers/HapticsProvider';
import { useReduceMotion } from '../providers/useReduceMotion';

/**
 * The Feed swipe from the design: 420 ms, `cubic-bezier(.2, .8, .2, 1)`. With
 * Reduce Motion the pages stay put and cross-fade in 200 ms instead. Both run
 * whatever the system setting, which would otherwise skip the cross-fade too.
 */
const SWIPE = {
  duration: 420,
  easing: Easing.bezier(0.2, 0.8, 0.2, 1),
  reduceMotion: ReduceMotion.Never,
};
const CROSS_FADE = { duration: 200, easing: Easing.linear, reduceMotion: ReduceMotion.Never };

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
  /**
   * Puts the page at `index` on screen at once, without motion, as when pages
   * before the current one left or came back and the page on screen moved
   * with them. Nothing turned, so it doesn't call `onIndexChange`.
   */
  showPage(index: number): void;
}

export interface VerticalPagerProps<Item> {
  /**
   * The pages in order. Pages change or join after the current one; when the
   * current page or one before it changes, `showPage` keeps the page on screen.
   */
  readonly items: readonly Item[];
  readonly renderPage: (item: Item, index: number) => ReactNode;
  /** The page shown first. */
  readonly initialIndex?: number;
  /**
   * Called as soon as a swipe or `turnTo` heads for another page, while that
   * page still moves in, so the next swipe can follow on from it.
   */
  readonly onIndexChange: (index: number) => void;
  /**
   * The names of the VoiceOver actions that turn to the next and the previous
   * page, in the Edition's language. Pages offer them through
   * `usePageTurnActions`.
   */
  readonly turnActionLabels?: { readonly next: string; readonly previous: string };
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

/** The props that give an accessible element the page-turn actions. */
interface TurnActions {
  readonly accessibilityActions: readonly AccessibilityActionInfo[];
  readonly onAccessibilityAction: (event: AccessibilityActionEvent) => void;
}

const PagerContext = createContext<PagerContextValue | undefined>(undefined);
const PageIndexContext = createContext(0);
/**
 * Whether the page is on screen: the one before the reader, or one still
 * moving off screen; true outside a pager.
 */
const PageOnScreenContext = createContext(true);
/**
 * The VoiceOver actions of the page, which turn it as a swipe would; none
 * on a page that isn't current. Each page has its own, so a turn re-renders
 * the cards of the pages it makes current or not current, and no others.
 */
const PageTurnActionsContext = createContext<TurnActions | undefined>(undefined);

/**
 * Full-screen pages stacked vertically: swipe up for the next page, down for
 * the one before. It snaps one page per swipe and draws only the pages next
 * to the current one and those a swipe passes. A page taller than the screen puts its content in a
 * `PagerScrollView`: a swipe then scrolls it, and turns the page only once the
 * content is scrolled to its end in that direction.
 */
export function VerticalPager<Item>({
  items,
  renderPage,
  initialIndex = 0,
  onIndexChange,
  turnActionLabels,
  testID,
  ref,
}: VerticalPagerProps<Item>) {
  const reduceMotion = useReduceMotion();
  const haptics = useHaptics();
  const motion = reduceMotion ? CROSS_FADE : SWIPE;
  /** The page the last swipe went to, which may still be moving in. */
  const [index, setIndex] = useState(initialIndex);
  /** The page nearest to the screen's position, while a swipe moves. */
  const [nearest, setNearest] = useState(initialIndex);
  /** The page the screen last came to rest on, alone on screen. */
  const [settled, setSettled] = useState(initialIndex);
  const [height, setHeight] = useState(0);
  /** The page on screen, in pages; fractional while a swipe moves. */
  const position = useSharedValue(initialIndex);
  /** `index` for the gestures, which read it on the UI thread. */
  const turnedTo = useSharedValue(initialIndex);
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

  useAnimatedReaction(
    () => Math.round(position.value),
    (near, previous) => {
      if (near !== previous) scheduleOnRN(setNearest, near);
    },
  );
  // On a whole page the screen shows that page alone: the others are off it,
  // or invisible with Reduce Motion.
  useAnimatedReaction(
    () => (Number.isInteger(position.value) ? position.value : undefined),
    (rest, previous) => {
      if (rest !== undefined && rest !== previous) scheduleOnRN(setSettled, rest);
    },
  );

  const turn = useCallback(
    (target: number) => {
      setIndex(target);
      onIndexChange(target);
    },
    [onIndexChange],
  );

  const turnTo = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(target, 0), items.length - 1);
      if (clamped === index) return;
      turnedTo.value = clamped;
      turn(clamped);
      position.value = withTiming(clamped, motion);
    },
    [index, items.length, motion, position, turn, turnedTo],
  );

  const showPage = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(target, 0), items.length - 1);
      if (clamped === index) return;
      turnedTo.value = clamped;
      setIndex(clamped);
      setNearest(clamped);
      position.value = clamped;
    },
    [index, items.length, position, turnedTo],
  );

  useImperativeHandle(ref, () => ({ turnTo, showPage }));

  // The current page and those after it left, and the owner showed none
  // in its place: the last page left is shown, rather than none.
  useEffect(() => {
    if (items.length > 0 && index >= items.length) showPage(items.length - 1);
  }, [index, items.length, showPage]);

  // The current page's cards read them, so they change only with the current
  // page, not each time a swipe passes a page or the pager's owner re-renders.
  const turnActions = useMemo((): TurnActions | undefined => {
    const actions = [
      ...(turnActionLabels !== undefined && index < items.length - 1
        ? [{ name: 'next', label: turnActionLabels.next }]
        : []),
      ...(turnActionLabels !== undefined && index > 0
        ? [{ name: 'previous', label: turnActionLabels.previous }]
        : []),
    ];
    if (actions.length === 0) return undefined;
    return {
      accessibilityActions: actions,
      onAccessibilityAction({ nativeEvent }) {
        if (nativeEvent.actionName === 'next') turnTo(index + 1);
        else if (nativeEvent.actionName === 'previous') turnTo(index - 1);
      },
    };
  }, [index, items.length, turnActionLabels, turnTo]);
  const pager = useMemo(() => ({ panRef, scrolls, turning }), [scrolls, turning]);

  // Gesture Handler asks for a memoised gesture: a new one on each render
  // sends its worklets to the UI thread again.
  const pan = useMemo(() => {
    /** A swipe turned the page: the page turns, with the light tick of a selection. */
    function swipeTo(target: number) {
      haptics.selection();
      turn(target);
    }

    const gesture = Gesture.Pan()
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
          const scroll = scrolls.value[turnedTo.value] ?? { y: 0, max: 0 };
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
        // A swipe during the last one's motion turns on from the page that one went to.
        const start = turnedTo.value;
        const turned = translationY - turnFrom.value;
        const share = pageHeight.value === 0 ? 0 : turned / pageHeight.value;
        let target = start;
        if (velocityY < -TURN_VELOCITY || share < -TURN_DISTANCE) target = start + 1;
        else if (velocityY > TURN_VELOCITY || share > TURN_DISTANCE) target = start - 1;
        target = Math.min(Math.max(target, 0), lastIndex.value);
        if (target !== start) {
          turnedTo.value = target;
          scheduleOnRN(swipeTo, target);
        }
        position.value = withTiming(target, motion);
      })
      .onFinalize(() => {
        turning.value = false;
      });
    // How a component test finds the swipe; Gesture Handler reads it in Jest only.
    if (testID !== undefined) gesture.withTestId(`${testID}-swipe`);
    return gesture;
  }, [
    drag,
    dragStart,
    haptics,
    lastIndex,
    motion,
    pageHeight,
    position,
    scrolls,
    testID,
    turn,
    turnFrom,
    turnedTo,
    turning,
  ]);

  function onLayout(event: LayoutChangeEvent) {
    const measured = event.nativeEvent.layout.height;
    pageHeight.value = measured;
    setHeight(measured);
  }

  // The current page and its neighbours, ready to move in, and while a swipe
  // moves, the pages it passes on its way.
  const first = Math.max(Math.min(index, nearest) - 1, 0);
  const visible = items.slice(first, Math.max(index, nearest) + 2);

  return (
    <PagerContext value={pager}>
      <GestureHandlerRootView style={styles.fill}>
        <GestureDetector gesture={pan}>
          <View testID={testID} style={styles.fill} onLayout={onLayout}>
            {height > 0 &&
              visible.map((item, offset) => (
                <Page
                  key={first + offset}
                  index={first + offset}
                  current={first + offset === index}
                  onScreen={first + offset === index || first + offset === settled}
                  turnActions={first + offset === index ? turnActions : undefined}
                  position={position}
                  height={height}
                  crossFade={reduceMotion}
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
  onScreen,
  turnActions,
  position,
  height,
  crossFade,
  children,
}: {
  index: number;
  current: boolean;
  /** Current, or still moving off screen after a turn. */
  onScreen: boolean;
  turnActions: TurnActions | undefined;
  position: SharedValue<number>;
  height: number;
  /** Reduce Motion: the page stays in place and fades in and out instead of moving. */
  crossFade: boolean;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() =>
    crossFade
      ? { opacity: Math.max(1 - Math.abs(index - position.value), 0), transform: [] }
      : { opacity: 1, transform: [{ translateY: (index - position.value) * height }] },
  );
  return (
    // Only the current page is there for VoiceOver and touches; its neighbours
    // wait off screen, or invisible under it with Reduce Motion.
    <Animated.View
      accessibilityElementsHidden={!current}
      importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
      pointerEvents={current ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { height }, style]}
    >
      <PageIndexContext value={index}>
        <PageOnScreenContext value={onScreen}>
          <PageTurnActionsContext value={turnActions}>{children}</PageTurnActionsContext>
        </PageOnScreenContext>
      </PageIndexContext>
    </Animated.View>
  );
}

/**
 * The VoiceOver actions that turn the page as a swipe would ("next",
 * "previous"), as props for an accessible element on the current page of a
 * `VerticalPager`. Nothing outside a pager or on a page that isn't current.
 */
export function usePageTurnActions(): Partial<TurnActions> {
  return useContext(PageTurnActionsContext) ?? {};
}

/**
 * Whether the page is on screen: the one before the reader, or the one a
 * turn takes away until its motion ends, rather than a neighbour waiting off
 * screen. Always true outside a `VerticalPager`.
 */
export function useIsPageOnScreen(): boolean {
  return useContext(PageOnScreenContext);
}

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// The pages' scrolls change on the UI thread only, where the scroll handler
// changes them too. A change from the JS thread reaches the UI thread later,
// so the next page to read the scrolls in the same frame would miss it and
// write it back over: a page that grew too tall to fit, or shrank to fit, as
// a new font size does to every page at once, would keep its old scroll and
// stop the swipe from turning it.

/** Keeps the furthest `index`'s page can scroll, after its content or viewport changed. */
function keepMax(scrolls: SharedValue<Record<number, PageScroll>>, index: number, max: number) {
  'worklet';
  const y = Math.min(scrolls.value[index]?.y ?? 0, max);
  scrolls.value = { ...scrolls.value, [index]: { y, max } };
}

/** Forgets the scroll of `index`'s page, once that page is no longer drawn. */
function forget(scrolls: SharedValue<Record<number, PageScroll>>, index: number) {
  'worklet';
  const others = { ...scrolls.value };
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- keyed by page index
  delete others[index];
  scrolls.value = others;
}

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
    scheduleOnUI(keepMax, scrolls, index, Math.max(content.current - viewport.current, 0));
  }

  useEffect(
    () => () => {
      scheduleOnUI(forget, scrolls, index);
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
      // A sheet opened from the card is a child in React's tree (it is a Modal), and a
      // scroll view that persists no taps would swallow the first tap in the sheet's
      // name field to put the keyboard away.
      keyboardShouldPersistTaps="handled"
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
