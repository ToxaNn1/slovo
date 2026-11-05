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
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { getAnimatedStyle } from 'react-native-reanimated';

import { testStrings } from '../test-strings';

const strings = testStrings({
  wordCard: { stress: 'stress on {vowels}', stressOr: 'or', category: 'Category: {category}' },
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
      next: 'Next ↑',
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

const haptics: Haptics = {
  selection: jest.fn(),
  impactLight: jest.fn(),
  impactMedium: jest.fn(),
  success: jest.fn(),
  warning: jest.fn(),
};

/** A card whose mark lives in state, as the Knowledge snapshot keeps it. */
function MarkedCard({
  initial,
  selfCheck = false,
  onMark,
  onUndo,
}: {
  initial?: KnowledgeMark | undefined;
  selfCheck?: boolean;
  onMark: (mark: KnowledgeMark) => void;
  onUndo: () => void;
}) {
  const [mark, setMark] = useState(initial);
  return (
    <EntryCard
      card={correction}
      selfCheck={selfCheck}
      swipe={{
        mark,
        onMark: (to) => {
          onMark(to);
          setMark(to);
        },
        onUndo: () => {
          onUndo();
          setMark(initial);
        },
      }}
    />
  );
}

function providers(children: React.ReactNode) {
  return (
    <EditionProvider edition={{ locale: 'en' }} strings={strings}>
      <HapticsProvider haptics={haptics}>
        <UndoToastProvider>{children}</UndoToastProvider>
      </HapticsProvider>
    </EditionProvider>
  );
}

async function show(props: Partial<Parameters<typeof MarkedCard>[0]> = {}) {
  const onMark = jest.fn<(mark: KnowledgeMark) => void>();
  const onUndo = jest.fn();
  await render(providers(<MarkedCard onMark={onMark} onUndo={onUndo} {...props} />));
  return { onMark, onUndo };
}

/**
 * A side drag by `distance` points (right is positive), let go at `velocity` points per second.
 * The gesture test utilities always end the drag; `settle: false` reads the styles one frame
 * after release, before the card settles.
 */
async function sideSwipe(distance: number, velocity = 0, { settle = true } = {}) {
  await act(() => {
    fireGestureHandler(getByGestureTestId('entry-card-side-swipe'), [
      { state: State.BEGAN, translationX: 0, velocityX: 0 },
      { state: State.ACTIVE, translationX: Math.sign(distance) * 8, velocityX: velocity },
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

  it('marks the Entry Known on a swipe right past 90 points, with its stamp and undo toast', async () => {
    const { onMark } = await show();

    await sideSwipe(120);

    expect(onMark.mock.calls).toEqual([['known']]);
    // A Correction's Known says the reader already says it right.
    expect(screen.getByText('✓ I SAY IT RIGHT')).toBeTruthy();
    expect(screen.getByText('Marked: I say it right')).toBeTruthy();
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('marks the Entry Unknown on a swipe left', async () => {
    const { onMark } = await show();

    await sideSwipe(-120);

    expect(onMark.mock.calls).toEqual([['unknown']]);
    expect(screen.getByText('✗ NEW')).toBeTruthy();
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
  });

  it('springs back with no mark under 90 points', async () => {
    const { onMark } = await show();

    await sideSwipe(60);

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByTestId('swipe-stamp')).toBeNull();
    expect(screen.queryByText('Marked: I say it right')).toBeNull();
  });

  it('marks on a fling from a short distance', async () => {
    const { onMark } = await show();

    await sideSwipe(-30, -1200);

    expect(onMark.mock.calls).toEqual([['unknown']]);
  });

  it('shows the edge label of the side the card leaves as it is let go', async () => {
    await show();

    await sideSwipe(90, 0, { settle: false });

    expect(opacityOf('swipe-edge-known')).toBeGreaterThan(0.9);
    expect(opacityOf('swipe-edge-unknown')).toBe(0);
  });

  it('changes nothing and shows no toast on a swipe to the mark already shown', async () => {
    const { onMark } = await show({ initial: 'unknown' });

    await sideSwipe(-120);

    expect(onMark).not.toHaveBeenCalled();
    expect(screen.queryByText('Marked: unknown')).toBeNull();
    expect(screen.getByText('✗ NEW')).toBeTruthy();
  });

  it('undoes the mark from the toast', async () => {
    const { onUndo } = await show();
    await sideSwipe(120);

    await fireEvent.press(screen.getByText('Undo'));

    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('swipe-stamp')).toBeNull();
  });

  it('replaces the toast of the last mark with the new one', async () => {
    await show();
    await sideSwipe(120);

    await sideSwipe(-120);

    expect(screen.queryByText('Marked: I say it right')).toBeNull();
    expect(screen.getByText('Marked: unknown')).toBeTruthy();
  });

  it('takes no side swipe while Self-check conceals the card', async () => {
    const { onMark } = await show({ selfCheck: true });

    await sideSwipe(120);

    expect(onMark).not.toHaveBeenCalled();
  });

  it('lands the stamp in 0.45 s', async () => {
    await show();

    await sideSwipe(120, 0, { settle: false });
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
    await render(providers(<EntryCard card={correction} swipe={{ ...swipe, mark: undefined }} />));

    await screen.rerender(
      providers(<EntryCard card={correction} swipe={{ ...swipe, mark: 'unknown' }} />),
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

    await sideSwipe(120, 0, { settle: false });
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

/** A page whose card names its VoiceOver actions and takes them. */
function PagedCard({ onMark }: { onMark: (mark: KnowledgeMark) => void }) {
  return <EntryCard card={correction} swipe={{ mark: undefined, onMark, onUndo: jest.fn() }} />;
}

function Actions() {
  const { accessibilityActions = [] } = usePageTurnActions();
  return (
    <Text testID="actions">{accessibilityActions.map((action) => action.name).join(',')}</Text>
  );
}

/** The card on the first of two pages of a `VerticalPager`, laid out. */
async function renderPaged(onMark: (mark: KnowledgeMark) => void) {
  await render(
    providers(
      <VerticalPager
        testID="pager"
        items={['c1', 'c2']}
        onIndexChange={jest.fn()}
        turnActionLabels={{ next: 'Next card', previous: 'Previous card' }}
        renderPage={(page) => (page === 'c1' ? <PagedCard onMark={onMark} /> : <Actions />)}
      />,
    ),
  );
  await fireEvent(screen.getByTestId('pager'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 800 } },
  });
}

describe('SwipeMarks in a VerticalPager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fades the undo toast and the next chip in under Reduce Motion', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    await renderPaged(jest.fn());

    await fireEvent(screen.getByTestId('correction-non-standard'), 'accessibilityAction', {
      nativeEvent: { actionName: 'known' },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(48);
    });
    const early = { toast: opacityOf('undo-toast'), chip: opacityOf('swipe-next-chip-fade') };
    await act(async () => {
      await jest.advanceTimersByTimeAsync(500);
    });

    expect(early.toast).toBeGreaterThan(0);
    expect(early.toast).toBeLessThan(1);
    expect(early.chip).toBeGreaterThan(0);
    expect(early.chip).toBeLessThan(1);
    expect(opacityOf('undo-toast')).toBe(1);
    expect(opacityOf('swipe-next-chip-fade')).toBe(1);
  });

  it('gives VoiceOver the marks beside the page turns, and points to the next Entry after a mark', async () => {
    const onMark = jest.fn<(mark: KnowledgeMark) => void>();
    await renderPaged(onMark);

    const form = screen.getByTestId('correction-non-standard');
    expect(form.props['accessibilityActions']).toEqual([
      expect.objectContaining({ name: 'known' }),
      expect.objectContaining({ name: 'unknown' }),
      expect.objectContaining({ name: 'next' }),
    ]);
    await fireEvent(form, 'accessibilityAction', {
      nativeEvent: { actionName: 'unknown' },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(onMark.mock.calls).toEqual([['unknown']]);
    expect(screen.getByTestId('swipe-next-chip')).toBeTruthy();
  });
});
