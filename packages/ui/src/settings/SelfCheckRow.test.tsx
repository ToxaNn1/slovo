import type { EditionStrings } from '@slovo/contracts';
import { EditionProvider, SelfCheckRow } from '@slovo/ui';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

async function renderInEdition(row: ReactElement) {
  await render(
    <EditionProvider edition={{ locale: 'en' }} strings={{} as EditionStrings}>
      {row}
    </EditionProvider>,
  );
}

describe('SelfCheckRow', () => {
  it('shows Self-check as it is set', async () => {
    await renderInEdition(
      <SelfCheckRow label="Self-check" shown value onChange={() => undefined} />,
    );

    expect(screen.getByLabelText('Self-check')).toHaveProp('value', true);
  });

  it('turns Self-check on and off with a tap on the switch', async () => {
    const onChange = jest.fn();
    await renderInEdition(
      <SelfCheckRow label="Self-check" shown value={false} onChange={onChange} />,
    );

    await fireEvent(screen.getByTestId('settings-self-check'), 'valueChange', true);

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('is not drawn while the selfCheck switch is off', async () => {
    await renderInEdition(
      <SelfCheckRow label="Self-check" shown={false} value onChange={() => undefined} />,
    );

    expect(screen.queryByTestId('settings-self-check')).toBeNull();
    expect(screen.queryByText('Self-check')).toBeNull();
  });
});
