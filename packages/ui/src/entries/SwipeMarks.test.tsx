import type { EntryFeedCard, Haptics, KnowledgeMark } from '@slovo/core';
import {
  EditionProvider,
  EntryCard,
  HapticsProvider,
  UndoToastProvider,
  usePageTurnActions,
  VerticalPager,
} from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or', category: 'Category: {category}' },
  idiomCard: {
    idiomTypes: { idiom: 'idiom', placeName: 'place name', proverb: 'proverb' },
    heading: '{expression}, {type}',
    etymology: 'Origin',
    source: 'Source: {source}',
  },
  correctionCard: {
    title: 'Correction',
    correctionType: 'Type: {type}',
    correctionTypes: {
      calque: 'calque',
      anglicism: 'anglicism',
      wrongStress: 'stress',
      paronym: 'paronyms',
    },
    nonStandard: 'Non-standard',
    standard: 'Standard',
    otherEquivalents: 'Also: {equivalents}',
    exampleNonStandard: 'Not: {text}',
    exampleStandard: 'Right: {text}',
    source: 'Source: {source}',
    howToSay: 'How to say it?',
    reveal: 'Show',
    literaryUses: 'How it is really written',
    literaryUseSource: '{author}, {work}',
    literaryUseSourceWithYear: '{author}, {work}, {year}',
  },
  knowledge: {
    known: 'Known',
    unknown: 'Unknown',
    correctionKnownHint: 'I already say it right',
    review: 'Review',
    swipe: {
      edges: { known: 'KNOW', unknown: "DON'T KNOW" },
      stamps: { known: '✓ KNOW', unknown: '✗ NEW', correctionKnown: '✓ I SAY IT RIGHT' },
      toasts: {
        known: 'Marked: known',
        unknown: 'Marked: unknown',
        correctionKnown: 'Marked: I say it right',
      },
      undo: 'Undo',
    },
  },
});

const correction: EntryFeedCard = {
  kind: 'correction',
  entryId: 'c1',
  model: {
    kind: 'correction',
    correctionId: 'c1',
    nonStandardForm: 'take part',
    nonStandardStressedVowels: [],
    mainEquivalent: 'join in',
    mainEquivalentStressedVowels: [],
    otherEquivalents: [],
    correctionType: 'calque',
    categoryId: 'everyday',
    categoryName: 'Everyday speech',
    explanation: 'A long explanation.',
    examplePair: { nonStandard: 'I take part.', standard: 'I join in.' },
    sourceNames: [],
    literaryUses: [],
  },
};

/** A place name, the Idiom card «Черкаси» is in the Ukrainian Edition. */
const placeName: EntryFeedCard = {
  kind: 'idiom',
  entryId: 'c1',
  model: {
    kind: 'idiom',
    idiomId: 'c1',
    expression: 'Berdychiv',
    idiomType: 'placeName',
    primaryDefinition: 'A town in the Zhytomyr region.',
    extraDefinitions: [],
    examples: [],
    etymology: 'Named after the Berdy tribe.',
    sourceNames: [],
  },
};

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** A card whose mark lives in state, as the Knowledge snapshot keeps it. */
function MarkedCard({
  card = correction,
  initial,
  selfCheck = false,
  onMark,
  onUndo,
}: {
  card?: EntryFeedCard;
  initial?: KnowledgeMark | undefined;
  selfCheck?: boolean;
  onMark: (mark: KnowledgeMark) => void;
  onUndo: () => void;
}) {
  const [mark, setMark] = useState(initial);
  return (
    <EntryCard
      card={card}
      selfCheck={selfCheck}
      slots={{
        slot: 'corner',
        corner: undefined,
        swipe: {
          mark,
          onMark: (to) => {
            onMark(to);
            setMark(to);
          },
          onUndo: () => {
            onUndo();
            setMark(initial);
          },
        },
      }}
    />
  );
}

/** The app's providers, under the `GestureHandlerRootView` the app's layout puts at its root. */
function providers(children: React.ReactNode) {
  return (
    <GestureHandlerRootView>
      <EditionProvider edition={{ locale: 'en' }} strings={strings}>
        <HapticsProvider haptics={haptics}>
          <UndoToastProvider>{children}</UndoToastProvider>
        </HapticsProvider>
      </EditionProvider>
    </GestureHandlerRootView>
  );
}

async function show(props: Partial<Parameters<typeof MarkedCard>[0]> = {}) {
  const onMark = jest.fn<(mark: KnowledgeMark) => void>();
  const onUndo = jest.fn();
  await render(providers(<MarkedCard onMark={onMark} onUndo={onUndo} {...props} />));
  // A 360-point card: a release sets the mark from 144 points, 40% of its width.
  await fireEvent(screen.getByTestId('swipe-card', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 600 } },
  });
  return { onMark, onUndo };
}

/**
 * A side drag by `distance` points (right is positive), let go at `velocity` points per second.
 * The gesture test utilities always end the drag; `settle: false` reads the styles one frame
 * after release, before the card settles.
 */
async function sideSwipe(
  distance: number,
  velocity = 0,
  { settle = true, via = [] }: { settle?: boolean; via?: readonly number[] } = {},
) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('entry-card-side-swipe'), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, translationX: Math.sign(distance) * 8, velocityX: velocity },
      ...via.map((translationX) => ({ state: State.ACTIVE, translationX, velocityX: 0 })),
      { state: State.ACTIVE, translationX: distance, velocityX: velocity },
      { state: State.END, translationX: distance, velocityX: velocity },
    ]);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(settle ? 500 : 16);
  });
}

function scaleOf(testID: string): number | undefined {
  const { transform = [] } = getAnimatedStyle(
    screen.getByTestId(testID, { includeHiddenElements: true }),
  ) as { transform?: { scale?: number }[] };
  return transform.find((step) => step.scale !== undefined)?.scale;
}

function opacityOf(testID: string): number {
  const style = getAnimatedStyle(screen.getByTestId(testID, { includeHiddenElements: true })) as {
    opacity?: number;
  };
  return style.opacity ?? 1;
}

describe('SwipeMarks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('marks the Entry Known on a swipe right past 40% of the card, with its stamp and undo toast', async () => {
    const { onMark } = await show();

    await sideSwipe(160);

    expect(onMark.mock.calls).toEqual([['known']]);
    // A Correction's Known says the reader already says it right.
    expect(screen.getByText('✓ I SAY IT RIGHT')).toBeTruthy();
    expect(screen.getByText('Marked: I say it right')).toBeTruthy();
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('marks the Entry Unknown on a swipe left', async () => {
    const { onMark } = await show();

    await sideSwipe(-160);

    expect(onMark.mock.calls).toEqual([['unknown']]);
    expect(screen.getByText('✗ NEW')).toBeTruthy();
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
  });

  it('springs back with no mark after a drag that only looks at the edge label', async () => {
    const { onMark } = await show();

    // 120 points of a 360-point card shows «ЗНАЮ» most of the way in; it is not a mark yet.
    await sideSwipe(120);

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByTestId('swipe-stamp')).toBeNull();
    expect(screen.queryByText('Marked: I say it right')).toBeNull();
  });

  it('sets no mark when the finger brings the card back under the threshold', async () => {
    const { onMark } = await show();

    await sideSwipe(60, 0, { via: [200] });

    expect(onMark).not.toHaveBeenCalled();
  });

  it('sets no mark on a flick back towards the middle', async () => {
    const { onMark } = await show();

    // Dragged right, then let go moving left fast: neither Known nor Unknown.
    await sideSwipe(100, -1200, { via: [130] });

    expect(onMark).not.toHaveBeenCalled();
  });

  it('marks on a fling from a short distance', async () => {
    const { onMark } = await show();

    await sideSwipe(-30, -1200);

    expect(onMark.mock.calls).toEqual([['unknown']]);
  });

  it('shows the edge label of the side the card leaves as it is let go', async () => {
    await show();

    await sideSwipe(110, 0, { settle: false });
    const lookingAt = opacityOf('swipe-edge-known');
    await sideSwipe(144, 0, { settle: false });

    // The label is fully in exactly when a release would set the mark.
    expect(lookingAt).toBeLessThan(0.8);
    expect(opacityOf('swipe-edge-known')).toBeGreaterThan(0.9);
    expect(opacityOf('swipe-edge-unknown')).toBe(0);
  });

  it('slides the edge label in from the edge, inside the card that moves', async () => {
    await show();
    const wedge = screen.getByTestId('swipe-edge-unknown', { includeHiddenElements: true });
    await fireEvent(wedge, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 54 } },
    });

    await sideSwipe(-72, 0, { settle: false });
    const { transform } = getAnimatedStyle(wedge) as { transform: { translateX?: number }[] };

    // Half way to the threshold, the 200-point wedge is about half way in from the right edge.
    const shift = transform[0]?.translateX ?? 0;
    expect(shift).toBeGreaterThan(90);
    expect(shift).toBeLessThan(130);
    expect(
      within(screen.getByTestId('swipe-card')).getByTestId('swipe-edge-unknown', {
        includeHiddenElements: true,
      }),
    ).toBeTruthy();
  });

  it('changes nothing and shows no toast on a swipe to the mark already shown', async () => {
    const { onMark } = await show({ initial: 'unknown' });

    await sideSwipe(-160);

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByText('Marked: unknown')).toBeNull();
    expect(screen.getByText('✗ NEW')).toBeTruthy();
  });

  it('undoes the mark from the toast', async () => {
    const { onUndo } = await show();
    await sideSwipe(160);

    await fireEvent.press(screen.getByText('Undo'));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('swipe-stamp')).toBeNull();
  });

  it('replaces the toast of the last mark with the new one', async () => {
    await show();
    await sideSwipe(160);

    await sideSwipe(-160);

    expect(screen.queryByText('Marked: I say it right')).toBeNull();
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
  });

  it('takes no side swipe while Self-check conceals the card', async () => {
    const { onMark } = await show({ selfCheck: true });

    await sideSwipe(160);

    expect(onMark).not.toHaveBeenCalled();
  });

  it('lands the stamp in 0.45 s', async () => {
    await show();

    await sideSwipe(160, 0, { settle: false });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(300);
    });
    const landing = scaleOf('swipe-stamp');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });

    expect(landing).not.toBe(1);
    expect(scaleOf('swipe-stamp')).toBe(1);
  });

  it("shows the stamp of a mark set from the card's menu", async () => {
    const swipe = { onMark: jest.fn(), onUndo: jest.fn() };
    await render(
      providers(
        <EntryCard
          card={correction}
          slots={{ slot: 'corner', corner: undefined, swipe: { ...swipe, mark: undefined } }}
        />,
      ),
    );

    await screen.rerender(
      providers(
        <EntryCard
          card={correction}
          slots={{ slot: 'corner', corner: undefined, swipe: { ...swipe, mark: 'unknown' } }}
        />,
      ),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });

    expect(screen.getByText('✗ NEW')).toBeTruthy();
    expect(opacityOf('swipe-stamp')).toBe(1);
  });

  it('fades the stamp in place under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { onMark } = await show();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    await sideSwipe(160, 0, { settle: false });
    const { transform } = getAnimatedStyle(screen.getByTestId('swipe-card')) as {
      transform: { translateX?: number }[];
    };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });

    expect(transform).toContainEqual({ translateX: 0 });
    expect(onMark.mock.calls).toEqual([['known']]);
    expect(opacityOf('swipe-stamp')).toBe(1);
  });
});

/** A page whose card names its VoiceOver actions and takes them, with its mark in state. */
function PagedCard({
  card,
  onMark,
  onUndo,
}: {
  card: EntryFeedCard;
  onMark: (mark: KnowledgeMark) => void;
  onUndo: () => void;
}) {
  return <MarkedCard card={card} onMark={onMark} onUndo={onUndo} />;
}

function Actions() {
  const { accessibilityActions = [] } = usePageTurnActions();
  return (
    <Text testID="actions">{accessibilityActions.map((action) => action.name).join(',')}</Text>
  );
}

/** The card on the first of `pages` pages of a `VerticalPager`, laid out. */
async function renderPaged({
  pages = ['c1', 'c2'],
  card = correction,
}: { pages?: string[]; card?: EntryFeedCard } = {}) {
  const onMark = jest.fn<(mark: KnowledgeMark) => void>();
  const onUndo = jest.fn();
  const onIndexChange = jest.fn<(index: number) => void>();
  await render(
    providers(
      <VerticalPager
        testID="pager"
        items={pages}
        onIndexChange={onIndexChange}
        turnActionLabels={{ next: 'Next card', previous: 'Previous card' }}
        renderPage={(page) =>
          page === 'c1' ? <PagedCard card={card} onMark={onMark} onUndo={onUndo} /> : <Actions />
        }
      />,
    ),
  );
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
  return { onMark, onUndo, onIndexChange };
}

function cardX(): number | undefined {
  const { transform = [] } = getAnimatedStyle(
    screen.getByTestId('swipe-card', { includeHiddenElements: true }),
  ) as { transform?: { translateX?: number }[] };
  return transform.find((step) => step.translateX !== undefined)?.translateX;
}

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('SwipeMarks in a VerticalPager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('flies the marked card off its side in 0.3 s and turns to the next Entry', async () => {
    const { onMark, onIndexChange } = await renderPaged();

    await sideSwipe(-160, 0, { settle: false });
    const flying = cardX();
    await pass(400);

    expect(onMark.mock.calls).toEqual([['unknown']]);
    expect(flying).toBeLessThan(-160);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    // The toast comes with the next Entry.
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
    expect(screen.queryByTestId('swipe-next-chip')).toBeNull();
  });

  it('flies a fast fling off at the speed of the finger, sooner than 0.3 s', async () => {
    await renderPaged();

    // 2400 points a second over the 360 points left: off screen in 0.15 s, not slowing down first.
    await sideSwipe(-160, -2400, { settle: false });
    await pass(184);

    expect(cardX()).toBe(-520);
  });

  it('turns to the next Entry as the card starts to fly, not after it flew', async () => {
    const { onIndexChange } = await renderPaged();

    await sideSwipe(160, 0, { settle: false });
    await pass(84);
    const flying = cardX();

    // The next Entry comes in under the card still flying off, with no blank screen between.
    expect(onIndexChange.mock.calls).toEqual([[1]]);
    expect(flying).toBeLessThan(400);
    expect(screen.queryByText('Marked: I say it right')).toBeNull();
    await pass(300);
    expect(screen.getByText('Marked: I say it right')).toBeTruthy();
  });

  it('springs back and stays on the card short of the threshold', async () => {
    const { onIndexChange } = await renderPaged();

    await sideSwipe(60);

    expect(cardX()).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it('springs back on the last Entry, with nothing to turn to', async () => {
    const { onMark, onIndexChange } = await renderPaged({ pages: ['c1'] });

    await sideSwipe(160);

    expect(onMark.mock.calls).toEqual([['known']]);
    expect(cardX()).toBe(0);
    expect(onIndexChange).not.toHaveBeenCalled();
    expect(screen.getByText('Marked: I say it right')).toBeTruthy();
  });

  it('turns back to the card on undo and brings it in from its side', async () => {
    const { onUndo, onIndexChange } = await renderPaged();
    await sideSwipe(160);
    await pass(400);

    await fireEvent.press(screen.getByText('Undo'));
    await pass(48);
    const coming = cardX();
    await pass(600);

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onIndexChange.mock.calls).toEqual([[1], [0]]);
    expect(coming).toBeGreaterThan(0);
    expect(cardX()).toBe(0);
    expect(screen.queryByTestId('swipe-stamp')).toBeNull();
  });

  it("brings a place name's expression back in sight on undo", async () => {
    await renderPaged({ card: placeName });
    await pass(1000);
    expect(opacityOf('idiom-expression-flying')).toBe(1);

    await sideSwipe(160);
    await pass(400);
    await fireEvent.press(screen.getByText('Undo'));
    await pass(2000);

    expect(opacityOf('idiom-expression-flying')).toBe(1);
  });

  it('turns to the next Entry at once under Reduce Motion, the card still', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { onIndexChange } = await renderPaged();
    await pass(0);

    await sideSwipe(160, 0, { settle: false });

    expect(cardX()).toBe(0);
    expect(onIndexChange.mock.calls).toEqual([[1]]);
  });

  it('fades the undo toast in under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    await renderPaged();

    await fireEvent(screen.getByTestId('correction-non-standard'), 'accessibilityAction', {
      nativeEvent: { actionName: 'known' },
    });
    await pass(48);
    const early = opacityOf('undo-toast');
    await pass(500);

    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(1);
    expect(opacityOf('undo-toast')).toBe(1);
  });

  it('gives VoiceOver the marks beside the page turns', async () => {
    const { onMark } = await renderPaged();

    const form = screen.getByTestId('correction-non-standard');
    expect(form.props['accessibilityActions']).toEqual([
      expect.objectContaining({ name: 'known' }),
      expect.objectContaining({ name: 'unknown' }),
      expect.objectContaining({ name: 'next' }),
    ]);
    await fireEvent(form, 'accessibilityAction', {
      nativeEvent: { actionName: 'unknown' },
    });
    await pass(0);

    expect(onMark.mock.calls).toEqual([['unknown']]);
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
  });
});
