import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

async function openDevelopment() {
  window.history.replaceState(null, '', '/admin/development');
  render(<Admin />);
  return within(await screen.findByRole('region', { name: 'Розробка' }));
}

test('Розробка shows the pull requests, CI on main, versions, releases and EAS builds', async () => {
  const section = await openDevelopment();
  const { github, eas } = FIXTURES.development;
  if (github.state !== 'ok' || eas.state !== 'ok') throw new Error('the fixture reads both');

  const pulls = within(await section.findByRole('region', { name: 'Pull requests' }));
  expect(pulls.getByRole('link', { name: 'feat(admin): Розробка' })).toBeDefined();
  expect(
    within(section.getByRole('region', { name: 'CI на main' })).getByText('успішно'),
  ).toBeDefined();
  const versions = within(section.getByRole('region', { name: 'Прогрес версій' }));
  expect(versions.getByText('0.9')).toBeDefined();
  expect(versions.getByText('12 з 16')).toBeDefined();
  expect(within(section.getByRole('region', { name: 'Релізи' })).getByText('v0.8.0')).toBeDefined();
  const builds = within(section.getByRole('region', { name: 'Збірки EAS' }));
  expect(builds.getByText('production')).toBeDefined();
  expect(builds.getByText('0.8.0 (42)')).toBeDefined();
  // 09:30 UTC is 11:30 in Kyiv in November.
  expect(section.getAllByText('Останні дані за 11:30')).toHaveLength(2);
});

test('a failing GitHub or EAS shows its own unavailable state, the same in both themes', async () => {
  server.use(
    http.get('*/admin/development', () =>
      HttpResponse.json({ github: { state: 'unavailable' }, eas: { state: 'unavailable' } }),
    ),
  );
  const user = userEvent.setup();
  const section = await openDevelopment();

  expect(await section.findByText('GitHub недоступний')).toBeDefined();
  expect(section.getByText('EAS недоступний')).toBeDefined();
  const light = screen.getByRole('region', { name: 'Розробка' }).textContent;
  await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Розробка' }).textContent).toBe(light);
});

test('Розробка reads neither filter, so the bar is switched off and says so', async () => {
  await openDevelopment();
  expect(screen.getByText('Фільтри тут не діють')).toBeDefined();
  expect(screen.getByRole('combobox', { name: 'Edition' }).matches(':disabled')).toBe(true);
  const period = within(screen.getByRole('group', { name: 'Період' }));
  expect(period.getByRole('button', { name: '7 днів' }).matches(':disabled')).toBe(true);
});
