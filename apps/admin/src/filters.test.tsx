import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { Admin } from './router';

test('the Edition filter lists «Усі Editions» and each Edition of the admin API', async () => {
  render(<Admin />);
  const edition = await screen.findByRole('combobox', { name: 'Edition' });
  await within(edition).findByRole('option', { name: 'Рідкісні слова' });
  expect(
    within(edition)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Усі Editions', 'Рідкісні слова']);
});

test('picking an Edition and a period changes the URL, and the choice survives a move to another section', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await within(await screen.findByRole('combobox', { name: 'Edition' })).findByRole('option', {
    name: 'Рідкісні слова',
  });

  await user.selectOptions(screen.getByRole('combobox', { name: 'Edition' }), 'Рідкісні слова');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Період' }), '30 днів');
  expect(new URLSearchParams(window.location.search).get('edition')).toBe('uk');
  expect(new URLSearchParams(window.location.search).get('period')).toBe('30d');

  const sections = within(screen.getByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Якість' }));
  await screen.findByRole('region', { name: 'Якість' });
  expect(window.location.pathname).toBe('/admin/quality');
  expect(new URLSearchParams(window.location.search).get('edition')).toBe('uk');
  expect(new URLSearchParams(window.location.search).get('period')).toBe('30d');
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Edition' }).value).toBe('uk');
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Період' }).value).toBe('30d');

  await user.selectOptions(screen.getByRole('combobox', { name: 'Edition' }), 'Усі Editions');
  expect(new URLSearchParams(window.location.search).has('edition')).toBe(false);
});

test('a link with the filters opens with them chosen', async () => {
  window.history.replaceState(null, '', '/admin/switches?edition=uk&period=1d');
  render(<Admin />);
  await screen.findByRole('region', { name: 'Свічі' });
  expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Період' }).value).toBe('1d');
});
