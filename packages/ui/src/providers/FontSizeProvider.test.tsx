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
import { textSizeSteps, typeRoles } from '../tokens';

const idiom = typeRoles.idiomExpression.size;
const tip = typeRoles.tipTitle.size;

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
      await renderAt('system', { fontScale });

      expect(sizeOf('lemma')).toBe(44);
      expect(sizeOf('idiom')).toBe(idiom);
      expect(sizeOf('tip')).toBe(tip);
      // iOS multiplies the reading text by the OS text size when it draws it.
      expect(sizeOf('definition') * fontScale).toBeCloseTo(textSizeSteps.system.definition * 1.5);
      expect(sizeOf('example') * fontScale).toBeCloseTo(textSizeSteps.system.example * 1.5);
    },
  );

  it.each([
    ['system', 44],
    ['larger', 51],
    ['largest', 57],
  ] satisfies [TextSizeStep, number][])(
    'grows every title by the Lemma’s own step at %j',
    async (size, lemma) => {
      await renderAt(size);

      expect(sizeOf('lemma')).toBe(lemma);
      expect(sizeOf('idiom')).toBeCloseTo((idiom * lemma) / 44);
      expect(sizeOf('tip')).toBeCloseTo((tip * lemma) / 44);
    },
  );

  it('takes the compact layout’s smaller titles in a window narrower than 390', async () => {
    await renderAt('system', { width: 375 });

    expect(sizeOf('lemma')).toBeCloseTo((44 * 44) / 48);
    expect(sizeOf('idiom')).toBeCloseTo((idiom * 44) / 48);
    expect(sizeOf('tip')).toBeCloseTo((tip * 44) / 48);
  });
});
