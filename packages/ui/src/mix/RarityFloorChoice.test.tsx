import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, RarityFloorChoice } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

async function renderInEdition(choice: ReactElement) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
      {choice}
    </EditionProvider>,
  );
}

const options = [1, 2, 3, 4, 5].map((floor) => ({ floor, label: `from ${String(floor)}` }));

function choice(overrides: Partial<Parameters<typeof RarityFloorChoice>[0]> = {}) {
  return (
    <RarityFloorChoice
      shown
      title="Rarity"
      subtitle="Only Words this rare or rarer"
      options={options}
      floor={1}
      onChange={() => undefined}
      {...overrides}
    />
  );
}

describe('RarityFloorChoice', () => {
  it('offers every floor and marks the one in the Mix', async () => {
    await renderInEdition(choice({ floor: 3 }));

    expect(screen.getByText('Rarity')).toBeTruthy();
    for (const { floor, label } of options) {
      expect(
        screen.getByRole('button', { name: label, selected: floor === 3, disabled: false }),
      ).toBeTruthy();
    }
  });

  it('asks for the floor the reader taps', async () => {
    const onChange = jest.fn();
    await renderInEdition(choice({ onChange }));

    await fireEvent.press(screen.getByTestId('mix-rarity-4'));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('is not drawn while the rarityFloor switch is off', async () => {
    await renderInEdition(choice({ shown: false }));

    expect(screen.queryByText('Rarity')).toBeNull();
    expect(screen.queryByTestId('mix-rarity-1')).toBeNull();
  });
});
