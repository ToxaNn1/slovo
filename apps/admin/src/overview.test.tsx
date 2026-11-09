import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { Admin } from './router';

/** Every block of Огляд, in order. */
const BLOCKS = [
  'Активні люди',
  'Відвідини',
  'Збої',
  'Помилки',
  'p95 бекенду',
  'CI на main',
  'Відкриті пачки',
  'Останні сповіщення',
];

/** The screen as wide as `width` in CSS pixels: `matchMedia` answers its min-width queries. */
function screenOf(width: number) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => {
      const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query)?.[1];
      return {
        matches: minWidth !== undefined && width >= Number(minWidth),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
    },
  });
}

// jsdom has no matchMedia: every other test reads a screen that can't tell.
afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

async function openOverview(url = '/admin/') {
  window.history.replaceState(null, '', url);
  render(<Admin />);
  const region = await screen.findByRole('region', { name: 'Огляд' });
  const overview = within(region);
  await overview.findByText('успішно');
  return overview;
}

const block = (
  overview: { getByRole: (role: 'region', options: { name: string }) => HTMLElement },
  title: string,
) => within(overview.getByRole('region', { name: title }));

test('Огляд reads every block of the picked Edition and period, each with the time of its data', async () => {
  const requests: string[] = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(decodeURIComponent(request.url));
  });
  const overview = await openOverview('/admin/?edition=uk&period=30d');
  await overview.findByText('Kill switch: game');

  expect(
    overview.getAllByRole('region').map((region) => region.getAttribute('aria-label')),
  ).toEqual(BLOCKS);
  // The newest day's active people; the visits of the period summed.
  expect(block(overview, 'Активні люди').getByText('135')).toBeDefined();
  expect(block(overview, 'Активні люди').getByText('за 07.11')).toBeDefined();
  expect(block(overview, 'Відвідини').getByText('652')).toBeDefined();
  expect(block(overview, 'Збої').getByText('3')).toBeDefined();
  expect(block(overview, 'Помилки').getByText('42')).toBeDefined();
  expect(block(overview, 'p95 бекенду').getByText('Немає даних')).toBeDefined();
  expect(block(overview, 'Відкриті пачки').getByText('1')).toBeDefined();
  expect(
    block(overview, 'Відкриті пачки').getByText('claude-content: +3, змінено 2'),
  ).toBeDefined();
  const alerts = block(overview, 'Останні сповіщення');
  expect(alerts.getByText('Kill switch: game')).toBeDefined();
  expect(alerts.getByText('the Game loses scores')).toBeDefined();
  // PostHog at 11:58 UTC, Sentry at 10:00, GitHub at 09:30: 13:58, 12:00 and 11:30 in Kyiv.
  expect(block(overview, 'Відвідини').getByText('Останні дані за 13:58')).toBeDefined();
  expect(block(overview, 'Збої').getByText('Останні дані за 12:00')).toBeDefined();
  expect(block(overview, 'CI на main').getByText('Останні дані за 11:30')).toBeDefined();

  expect(requests.some((url) => url.includes('/admin/editions/uk/analytics?'))).toBe(true);
  expect(requests.some((url) => /\/admin\/quality\?.*editionId=uk/.test(url))).toBe(true);
  expect(requests.some((url) => /\/admin\/quality\?.*period=30d/.test(url))).toBe(true);
  expect(requests.some((url) => /\/batches\?.*editionId=uk/.test(url))).toBe(true);
  expect(requests.some((url) => /\/admin\/actions\?.*editionId=uk/.test(url))).toBe(true);
  server.events.removeAllListeners();
});

test('a failing source shows its own unavailable state in its blocks', async () => {
  server.use(
    http.get('*/admin/editions/:editionId/analytics', () =>
      HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR' }, { status: 500 }),
    ),
    http.get('*/admin/quality', () =>
      HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR' }, { status: 500 }),
    ),
    http.get('*/admin/development', () =>
      HttpResponse.json({ github: { state: 'unavailable' }, eas: { state: 'unavailable' } }),
    ),
  );
  window.history.replaceState(null, '', '/admin/');
  render(<Admin />);
  const overview = within(await screen.findByRole('region', { name: 'Огляд' }));

  expect(await block(overview, 'Активні люди').findByText('PostHog недоступний')).toBeDefined();
  expect(block(overview, 'Відвідини').getByText('PostHog недоступний')).toBeDefined();
  expect(await block(overview, 'Збої').findByText('Sentry недоступний')).toBeDefined();
  expect(block(overview, 'p95 бекенду').getByText('Sentry недоступний')).toBeDefined();
  expect(await block(overview, 'CI на main').findByText('GitHub недоступний')).toBeDefined();
  expect(await block(overview, 'Відкриті пачки').findByText('1')).toBeDefined();
});

test('an empty queue and no alerts read as such', async () => {
  server.use(
    http.get('*/admin/content-queue/batches', () => HttpResponse.json({ batches: [] })),
    http.get('*/admin/actions', () => HttpResponse.json({ actions: [] })),
  );
  const overview = await openOverview();
  expect(await block(overview, 'Відкриті пачки').findByText('0')).toBeDefined();
  expect(await block(overview, 'Останні сповіщення').findByText('Сповіщень немає')).toBeDefined();
});

test('Огляд renders the same texts in both themes', async () => {
  const user = userEvent.setup();
  const overview = await openOverview();
  await overview.findByText('Kill switch: game');
  const light = screen.getByRole('region', { name: 'Огляд' }).textContent;

  await user.click(screen.getByRole('button', { name: 'Темна тема' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Огляд' }).textContent).toBe(light);
});

test('at a phone width the sidebar collapses, Огляд stacks every block and the kill switch takes its reason', async () => {
  screenOf(390);
  const user = userEvent.setup();
  const overview = await openOverview();

  expect(screen.queryByRole('navigation', { name: 'Розділи' })).toBeNull();
  expect(overview.getByRole('list', { name: 'Блоки' }).dataset['layout']).toBe('stack');
  for (const title of BLOCKS) expect(overview.getByRole('region', { name: title })).toBeDefined();

  const menu = screen.getByRole('button', { name: 'Меню' });
  expect(menu.getAttribute('aria-expanded')).toBe('false');
  await user.click(menu);
  const sections = within(screen.getByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Свічі' }));
  expect(await screen.findByRole('region', { name: 'Свічі' })).toBeDefined();
  expect(screen.queryByRole('navigation', { name: 'Розділи' })).toBeNull();

  const kill = within(screen.getByRole('region', { name: 'Kill switch' }));
  await user.click(kill.getByRole('button', { name: 'Вимкнути для всіх' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByRole('textbox', { name: 'Причина' })).toBeDefined();
  expect(dialog.getByRole('button', { name: 'Підтвердити' })).toHaveProperty('disabled', true);
});

test('at a wide width the sidebar is shown and Огляд lays its blocks in a grid', async () => {
  screenOf(1280);
  const overview = await openOverview();

  expect(screen.getByRole('navigation', { name: 'Розділи' })).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Меню' })).toBeNull();
  expect(overview.getByRole('list', { name: 'Блоки' }).dataset['layout']).toBe('grid');
});
