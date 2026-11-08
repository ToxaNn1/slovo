import { loadDecor, type Decor } from '@slovo/core';
import type { MascotState } from '@slovo/contracts';
import { coreTokens, DecorProvider, EditionProvider, Mascot, TokensProvider } from '@slovo/ui';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { getAnimatedStyle } from 'react-native-reanimated';
import { testStrings } from '../test-strings';

const states: readonly MascotState[] = [
  'sleeps',
  'waits',
  'shouts',
  'happy',
  'surprised',
  'cringes',
  'sad',
  'celebrates',
  'hatOff',
];

const names: string[] = [];
/** The path that tells a part apart: a rectangle as wide as the part's number. */
const pathOf = (name: string) => {
  if (!names.includes(name)) names.push(name);
  return `M0 0h${String(names.indexOf(name) + 1)}v1H0z`;
};
/** One shape of a part, told apart by its path. */
const part = (name: string, fill = 'body') => [{ path: pathOf(name), fill }];

const mascot = {
  width: 150,
  height: 112,
  pivot: [30, 56],
  figure: part('figure'),
  shine: part('shine', '#FFFFFF'),
  eyes: Object.fromEntries(states.map((state) => [state, part(`eyes-${state}`, 'ink')])),
  hat: part('hat', 'accent'),
  hatOnGround: part('ground'),
  rays: part('rays', 'ink'),
  confetti: part('confetti'),
  sleepMarks: part('z', 'ink'),
};

const accessory = (replacesHat: boolean) => ({ shapes: part('accessory'), replacesHat });

const withMascot: Decor = loadDecor({ mascot });

const { light } = coreTokens.colors;

/** A `#RRGGBB` colour as react-native-svg hands it to the native side. */
const argb = (hex: string) => parseInt(`FF${hex.slice(1)}`, 16);

async function renderMascot(
  state: MascotState,
  { decor = withMascot, onRed = false }: { decor?: Decor; onRed?: boolean } = {},
) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
      <DecorProvider decor={decor}>
        <Mascot state={state} line="A line" onRed={onRed} />
      </DecorProvider>
    </EditionProvider>,
  );
}

/** The paths of a drawn part, or `undefined` when the state leaves it out. */
function drawn(part: string): { d: string; fill: number }[] | undefined {
  const paths = screen.queryAllByTestId(new RegExp(`^mascot-${part}-\\d+$`), {
    includeHiddenElements: true,
  });
  if (paths.length === 0) return undefined;
  return paths.map((path) => ({
    d: path.props['d'] as string,
    fill: (path.props['fill'] as { payload: number }).payload,
  }));
}

/** The figure's motion now: how far up and how opaque. */
function figureNow(): { up: number; opacity: number; moving: boolean } {
  const style = getAnimatedStyle(
    screen.getByTestId('mascot-figure', { includeHiddenElements: true }),
  ) as unknown as {
    transform?: Record<string, number | string>[];
    opacity?: number;
  };
  const transform = Object.assign({}, ...(style.transform ?? [])) as Record<string, unknown>;
  const translateY = typeof transform['translateY'] === 'number' ? transform['translateY'] : 0;
  return {
    up: translateY === 0 ? 0 : -translateY,
    opacity: style.opacity ?? 1,
    moving: (style.transform ?? []).length > 0,
  };
}

async function pass(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function reduceMotion(on: boolean) {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(on);
}

describe('Mascot', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    reduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each(states)('draws the figure with the eyes of the %s state and its line', async (state) => {
    await renderMascot(state);

    expect(screen.getByTestId(`mascot-${state}`)).toBeOnTheScreen();
    expect(drawn('eyes')?.map(({ d }) => d)).toEqual([pathOf(`eyes-${state}`)]);
    expect(drawn('body')).toHaveLength(1);
    expect(screen.getByText('A line')).toBeOnTheScreen();
  });

  it('adds rays to the shouts and celebrates states, confetti to celebrates, marks to sleeps', async () => {
    const extras = async (state: MascotState) => {
      await renderMascot(state);
      return ['rays', 'confetti', 'sleep-marks'].filter((name) => drawn(name) !== undefined);
    };

    expect(await extras('shouts')).toEqual(['rays']);
    expect(await extras('celebrates')).toEqual(['rays', 'confetti']);
    expect(await extras('sleeps')).toEqual(['sleep-marks']);
    expect(await extras('waits')).toEqual([]);
  });

  it('paints the figure red with the ink, and cream on red with black in the on-red variant', async () => {
    await renderMascot('waits');
    expect(drawn('body')?.[0]?.fill).toBe(argb(light.accent));
    expect(drawn('eyes')?.[0]?.fill).toBe(argb(light.ink));

    await renderMascot('waits', { onRed: true });
    expect(drawn('body')?.[0]?.fill).toBe(argb(light.onAccent));
    expect(drawn('hat')?.[0]?.fill).toBe(argb(light.ink));
  });

  it('takes the hat off in the hat-off state: on the ground, no shine, no accessory, muted', async () => {
    const decor = { ...withMascot, mascotAccessory: accessory(false) };
    await renderMascot('hatOff', { decor });

    expect(drawn('hat')).toBeUndefined();
    expect(drawn('shine')).toBeUndefined();
    expect(drawn('accessory')).toBeUndefined();
    expect(drawn('hat-on-ground')).toHaveLength(1);
    expect(drawn('body')?.[0]?.fill).toBe(argb(light.muted));
  });

  it('wears the Decor accessory over the hat, or instead of it', async () => {
    await renderMascot('waits', { decor: { ...withMascot, mascotAccessory: accessory(false) } });
    expect(drawn('accessory')).toHaveLength(1);
    expect(drawn('hat')).toHaveLength(1);

    await renderMascot('waits', { decor: { ...withMascot, mascotAccessory: accessory(true) } });
    expect(drawn('accessory')).toHaveLength(1);
    expect(drawn('hat')).toBeUndefined();
  });

  it('wears no accessory without one in the Decor', async () => {
    await renderMascot('happy');

    expect(drawn('accessory')).toBeUndefined();
    expect(drawn('hat')).toHaveLength(1);
  });

  it('is its line alone for an Edition without a vector', async () => {
    await renderMascot('waits', { decor: loadDecor({}) });

    expect(screen.queryByTestId('mascot-figure', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText('A line')).toBeOnTheScreen();
  });

  it('bobs while it waits', async () => {
    await renderMascot('waits');
    await pass(1200);

    expect(figureNow().up).toBeCloseTo(5, 0);
  });

  it('stays still in the hat-off state', async () => {
    await renderMascot('hatOff');
    await pass(1200);

    expect(figureNow()).toEqual({ up: 0, opacity: 1, moving: false });
  });

  it('only fades in, without moving, under Reduce Motion', async () => {
    reduceMotion(true);
    await renderMascot('waits');
    await pass(0);
    await pass(100);
    const fading = figureNow();
    await pass(1100);

    expect(fading.opacity).toBeLessThan(1);
    expect(figureNow()).toEqual({ up: 0, opacity: 1, moving: false });
  });
});

// Owner bug 07.11: a celebration's line floats over any screen, so it stands on a plate.
describe('the Mascot over a screen', () => {
  const styleOf = (testID: string) =>
    (StyleSheet.flatten(screen.getByTestId(testID).props['style']) ?? {}) as {
      backgroundColor?: string;
      color?: string;
    };

  it.each(['light', 'dark'] as const)(
    'sets its line on an ink plate in the surface colour in the %s theme',
    async (scheme) => {
      await render(
        <TokensProvider tokens={coreTokens} colorScheme={scheme}>
          <EditionProvider edition={{ locale: 'en' }} strings={testStrings({})}>
            <DecorProvider decor={withMascot}>
              <Mascot state="celebrates" line="A line" plate />
            </DecorProvider>
          </EditionProvider>
        </TokensProvider>,
      );

      const colors = coreTokens.colors[scheme];
      expect(styleOf('mascot-celebrates-line').backgroundColor).toBe(colors.ink);
      expect(styleOf('mascot-celebrates-line-text').color).toBe(colors.surface);
    },
  );

  it('leaves the line on the screen ground with no plate', async () => {
    await renderMascot('happy');

    expect(styleOf('mascot-happy-line').backgroundColor).toBeUndefined();
    expect(styleOf('mascot-happy-line-text').color).toBe(light.muted);
  });
});
