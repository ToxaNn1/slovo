import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { expect, test } from 'vitest';

import { periodDays } from './filters';
import { server } from './mock/server';
import { Admin } from './router';

async function openAnalytics() {
  const user = userEvent.setup();
  render(<Admin />);
  const sections = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Аналітика' }));
  const section = await screen.findByRole('region', { name: 'Аналітика' });
  await within(section).findByText('Останні дані за 13:58');
  return { user, section: within(section) };
}

test('Аналітика draws the fixtures, the Counters and the Variant result, with the same texts in both themes', async () => {
  const { user, section } = await openAnalytics();

  const active = within(section.getByRole('figure', { name: 'Активні за днями' }));
  expect(active.getByText('07.11')).toBeDefined();
  expect(active.getByText('135')).toBeDefined();
  expect(section.getByText('Медіана відвідин: 4 хв 5 с')).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Пристрої' })).getByText('iPhone 15'),
  ).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Версії застосунку' })).getByText('1.0.0'),
  ).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Країни' })).getByText('Немає даних'),
  ).toBeDefined();

  const counters = within(section.getByRole('list', { name: 'Лічильники' }));
  expect(counters.getByText('Знаю: 1200')).toBeDefined();
  expect(counters.getByText('Не знаю: 340')).toBeDefined();
  expect(counters.getByText('Збережено: 95')).toBeDefined();

  const variants = within(await section.findByRole('figure', { name: 'Варіанти gameTimed' }));
  expect(variants.getByText('a')).toBeDefined();
  expect(variants.getByText('61')).toBeDefined();

  const light = screen.getByRole('region', { name: 'Аналітика' }).textContent;
  await user.click(screen.getByRole('button', { name: 'Темна тема' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Аналітика' }).textContent).toBe(light);
});

test('Аналітика says PostHog is down when its read fails', async () => {
  server.use(
    http.get('*/admin/editions/:editionId/analytics', () =>
      HttpResponse.json(
        {
          defined: true,
          code: 'ANALYTICS_UNAVAILABLE',
          status: 503,
          message: 'PostHog недоступний',
        },
        { status: 503 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const sections = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Аналітика' }));

  expect(await screen.findByText('PostHog недоступний')).toBeDefined();
});

test('a period reads its days up to today, in Kyiv', () => {
  const now = new Date('2026-11-08T23:30:00.000Z');
  expect(periodDays('7d', now)).toEqual({ from: '2026-11-03', to: '2026-11-09' });
  expect(periodDays('1d', now)).toEqual({ from: '2026-11-09', to: '2026-11-09' });
});
