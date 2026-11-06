import type { Correction } from '@slovo/contracts';
import { CorrectionTypeRow, EditionProvider } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { testStrings } from '../test-strings';

const strings = testStrings({
  correctionCard: {
    correctionTypes: { surzhyk: 'Surzhyk' },
    nonStandard: 'Often said',
    standard: 'Better said',
    otherEquivalents: 'also: {equivalents}',
  },
  dashboard: { correctionTypes: { reveal: 'How to say it?' } },
});

const correction: Correction = {
  kind: 'correction',
  id: 'c_shoby',
  nonStandardForm: 'shóby',
  correctionType: 'surzhyk',
  standardEquivalents: ['shchob', 'aby'],
  explanation: 'A calque of another language.',
  examplePair: { nonStandard: 'Said so.', standard: 'Better so.' },
  categoryId: 'everyday',
  sources: [{ title: 'Dictionary' }],
  literaryUses: [],
  retired: false,
};

async function renderRow(workedThrough: boolean) {
  const onReveal = jest.fn();
  await render(
    <EditionProvider edition={{ locale: 'uk' }} strings={strings}>
      <CorrectionTypeRow
        correction={correction}
        workedThrough={workedThrough}
        onReveal={onReveal}
      />
    </EditionProvider>,
  );
  return onReveal;
}

describe('CorrectionTypeRow', () => {
  it('not worked through, shows the type and the form struck through, with «How to say it?» that reveals', async () => {
    const onReveal = await renderRow(false);

    expect(screen.getByText('Surzhyk')).toBeTruthy();
    expect(screen.getByText('Often said')).toBeTruthy();
    expect(screen.getByLabelText('shoby')).toBeTruthy();
    expect(screen.queryByText('Better said')).toBeNull();
    expect(screen.queryByText('shchob')).toBeNull();
    expect(screen.queryByText('A calque of another language.')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'How to say it?' }));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it('worked through, shows the main standard form, the others and the explanation, and no button', async () => {
    await renderRow(true);

    expect(screen.getByTestId('correction-type-revealed-c_shoby')).toBeTruthy();
    expect(screen.getByText('Better said')).toBeTruthy();
    expect(screen.getByText('shchob')).toBeTruthy();
    expect(screen.getByText('also: aby')).toBeTruthy();
    expect(screen.getByText('A calque of another language.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'How to say it?' })).toBeNull();
  });
});
