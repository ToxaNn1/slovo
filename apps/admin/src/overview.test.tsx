import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
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

/** The texts of the latest alerts, newest first. */
const [NEWEST = '', OLDER = ''] = FIXTURES.latestAlerts.alerts.map(({ text }) => text);

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
  await overview.findByText(NEWEST);

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
  // The latest alerts newest first, the one still to be sent marked so, at 13:45 in Kyiv.
  const alerts = within(block(overview, 'Останні сповіщення').getByRole('list'));
  const [newest, older, ...rest] = alerts.getAllByRole('listitem').map((item) => item.textContent);
  expect(rest).toEqual([]);
  expect(newest).toContain(NEWEST);
  expect(newest).toMatch(/13:45 · не надіслано$/);
  expect(older).toContain(OLDER);
  expect(older).toMatch(/12:15$/);
  // PostHog at 11:58 UTC, Sentry at 10:00, GitHub at 09:30: 13:58, 12:00 and 11:30 in Kyiv.
  expect(block(overview, 'Відвідини').getByText('Останні дані за 13:58')).toBeDefined();
  expect(block(overview, 'Збої').getByText('Останні дані за 12:00')).toBeDefined();
  expect(block(overview, 'CI на main').getByText('Останні дані за 11:30')).toBeDefined();

  expect(requests.some((url) => url.includes('/admin/editions/uk/analytics?'))).toBe(true);
  expect(requests.some((url) => /\/admin\/quality\?.*editionId=uk/.test(url))).toBe(true);
  expect(requests.some((url) => /\/admin\/quality\?.*period=30d/.test(url))).toBe(true);
  expect(requests.some((url) => /\/batches\?.*editionId=uk/.test(url))).toBe(true);
  expect(requests.some((url) => url.endsWith('/admin/alerts'))).toBe(true);
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
    http.get('*/admin/alerts', () => HttpResponse.json({ alerts: [] })),
  );
  const overview = await openOverview();
  expect(await block(overview, 'Відкриті пачки').findByText('0')).toBeDefined();
  expect(await block(overview, 'Останні сповіщення').findByText('Сповіщень немає')).toBeDefined();
});

test('Огляд renders the same texts in both themes', async () => {
  const user = userEvent.setup();
  const overview = await openOverview();
  await overview.findByText(NEWEST);
  const light = screen.getByRole('region', { name: 'Огляд' }).textContent;

  await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Огляд' }).textContent).toBe(light);
});

test('at a phone width bottom tabs open Огляд, the kill switch and Ще instead of the sidebar', async () => {
  screenOf(390);
  const user = userEvent.setup();
  const overview = await openOverview();

  expect(screen.queryByRole('navigation', { name: 'Розділи' })).toBeNull();
  expect(overview.getByRole('list', { name: 'Блоки' }).dataset['layout']).toBe('stack');
  for (const title of BLOCKS) expect(overview.getByRole('region', { name: title })).toBeDefined();

  const tabs = within(screen.getByRole('navigation', { name: 'Вкладки' }));
  expect(tabs.getByRole('link', { name: 'Огляд' }).getAttribute('aria-current')).toBe('page');
  await user.click(tabs.getByRole('link', { name: 'Вимикач' }));
  const kill = within(await screen.findByRole('region', { name: 'Аварійний вимикач' }));
  expect(screen.queryByRole('navigation', { name: 'Свічі' })).toBeNull();
  await user.click(kill.getByRole('button', { name: 'Вимкнути зараз' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByRole('textbox', { name: 'Причина' })).toBeDefined();
  expect(dialog.getByRole('button', { name: 'Вимкнути зараз' })).toHaveProperty('disabled', true);
  await user.click(dialog.getByRole('button', { name: 'Скасувати' }));

  await user.click(tabs.getByRole('button', { name: 'Ще' }));
  expect(screen.getByText('Відкрийте на комп’ютері')).toBeDefined();
  // Only Ще is drawn as the open tab, though the route is still Огляд's.
  expect(tabs.getByRole('button', { name: 'Ще' }).dataset['current']).toBe('');
  expect(tabs.getByRole('link', { name: 'Огляд' }).dataset['current']).toBeUndefined();
  await user.click(screen.getByRole('link', { name: 'До Огляду' }));
  expect(await screen.findByRole('region', { name: 'Огляд' })).toBeDefined();
});

test('at a phone width Огляд picks the Edition and the period from rows of chips', async () => {
  screenOf(390);
  const user = userEvent.setup();
  await openOverview();

  const editions = within(screen.getByRole('group', { name: 'Edition' }));
  await user.click(await editions.findByRole('button', { name: 'Рідкісні слова' }));
  await user.click(
    within(screen.getByRole('group', { name: 'Період' })).getByRole('button', { name: '30 днів' }),
  );

  expect(new URLSearchParams(window.location.search).get('edition')).toBe('uk');
  expect(new URLSearchParams(window.location.search).get('period')).toBe('30d');
  const pressed = editions
    .getAllByRole('button')
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true');
  expect(pressed.map((chip) => chip.textContent)).toEqual(['Рідкісні слова']);
  expect(screen.queryByRole('combobox', { name: 'Edition' })).toBeNull();
});

test('at a phone width a section of the big screen says to open a computer', async () => {
  screenOf(390);
  window.history.replaceState(null, '', '/admin/analytics');
  render(<Admin />);

  expect(await screen.findByText('Відкрийте на комп’ютері')).toBeDefined();
  expect(screen.queryByRole('region', { name: 'Аналітика' })).toBeNull();
});

test('at a wide width the sidebar is shown and Огляд lays its blocks in a grid', async () => {
  screenOf(1280);
  const overview = await openOverview();

  expect(screen.getByRole('navigation', { name: 'Розділи' })).toBeDefined();
  expect(screen.queryByRole('navigation', { name: 'Вкладки' })).toBeNull();
  expect(overview.getByRole('list', { name: 'Блоки' }).dataset['layout']).toBe('grid');
});
