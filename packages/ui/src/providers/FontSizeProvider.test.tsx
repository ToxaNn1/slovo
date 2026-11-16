import { afterEach, describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { Dimensions, Text } from 'react-native';

import {
  FontSizeProvider,
  useLemmaSize,
  useTitleSize,
  useWordTextSizes,
  type TextSizeStep,
} from './FontSizeProvider';

/** Shows the sizes the provider gives, each in a text of its own. */
function Probe() {
  const lemma = useLemmaSize();
  const idiom = useTitleSize('idiomExpression');
  const tip = useTitleSize('tipTitle');
  const { definition, example } = useWordTextSizes();
  return (
    <>
      <Text testID="lemma">{lemma.fontSize}</Text>
      <Text testID="idiom">{idiom.fontSize}</Text>
      <Text testID="tip">{tip.fontSize}</Text>
      <Text testID="definition">{definition.fontSize}</Text>
      <Text testID="example">{example.fontSize}</Text>
    </>
  );
}

const window = Dimensions.get('window');

/** The size a probe's text shows. */
function sizeOf(testID: string): number {
  return Number(screen.getByTestId(testID).props['children']);
}

async function renderAt(size: TextSizeStep, { width = 430, fontScale = 1 } = {}) {
  Dimensions.set({ window: { ...window, width, fontScale } });
  await render(
    <FontSizeProvider size={size}>
      <Probe />
    </FontSizeProvider>,
  );
}

afterEach(() => {
  Dimensions.set({ window });
});

describe('FontSizeProvider', () => {
  it.each([1.5, 2])(
    'leaves the big titles at their size at an OS text size of %s, the reading text grown at most 1.5 times',
    async (fontScale) => {
      await renderAt({ scale: 'ladder', step: 'system' }, { fontScale });

      expect(sizeOf('lemma')).toBe(50);
      expect(sizeOf('idiom')).toBe(36);
      expect(sizeOf('tip')).toBe(36);
      // iOS multiplies the reading text by the OS text size when it draws it.
      expect(sizeOf('definition') * fontScale).toBeCloseTo(19 * 1.5);
      expect(sizeOf('example') * fontScale).toBeCloseTo(17 * 1.5);
    },
  );

  it.each([
    [{ scale: 'fontSize', step: 'S' }, 50],
    [{ scale: 'fontSize', step: 'M' }, 50],
    [{ scale: 'fontSize', step: 'L' }, 58],
    [{ scale: 'fontSize', step: 'XL' }, 65],
    [{ scale: 'ladder', step: 'system' }, 50],
    [{ scale: 'ladder', step: 'larger' }, 58],
    [{ scale: 'ladder', step: 'largest' }, 65],
  ] satisfies [TextSizeStep, number][])(
    'grows every title by the Lemma’s own step at %j',
    async (size, lemma) => {
      await renderAt(size);

      expect(sizeOf('lemma')).toBe(lemma);
      expect(sizeOf('idiom')).toBeCloseTo((36 * lemma) / 50);
      expect(sizeOf('tip')).toBeCloseTo((36 * lemma) / 50);
    },
  );

  it('takes the compact layout’s smaller titles in a window narrower than 390', async () => {
    await renderAt({ scale: 'ladder', step: 'system' }, { width: 375 });

    expect(sizeOf('lemma')).toBeCloseTo((50 * 44) / 48);
    expect(sizeOf('idiom')).toBeCloseTo((36 * 44) / 48);
    expect(sizeOf('tip')).toBeCloseTo((36 * 44) / 48);
  });
});
