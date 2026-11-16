import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { ConfirmDialog } from './components/confirm-dialog';

function renderDialog() {
  const onConfirm = vi.fn(() => Promise.resolve());
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Вимкнути перемикач?"
      onConfirm={onConfirm}
      onClose={onClose}
      refusalText={() => 'Відмова'}
    />,
  );
  return { onConfirm, onClose };
}

test('the confirmation opens as a modal dialog with the reason field in focus', () => {
  renderDialog();

  const dialog = screen.getByRole('dialog', { name: 'Вимкнути перемикач?' });
  expect(dialog).toHaveProperty('open', true);
  expect(document.activeElement).toBe(screen.getByLabelText(/Причина/));
});

test('Esc or the back gesture closes the confirmation without the write', () => {
  const { onConfirm, onClose } = renderDialog();

  const request = new Event('cancel', { cancelable: true });
  fireEvent(screen.getByRole('dialog'), request);

  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  expect(request.defaultPrevented).toBe(true);
});
