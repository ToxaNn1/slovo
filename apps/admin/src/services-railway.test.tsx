import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { SERVICE_COSTS, SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

const ALERTS_ID = '00000000-0000-4000-8000-000000000021';
const QUOTE_CHECK_ID = '00000000-0000-4000-8000-000000000022';

/** A Cron the Власник added as a Service. */
const cron = (id: string, name: string, x: number) => ({
  id,
  name,
  kind: 'cron' as const,
  plan: null,
  monthlyPriceUsdCents: null,
  billingDay: null,
  limits: [],
  position: { x, y: 600 },
  links: [{ to: SERVICE_IDS.Railway, kind: 'scheduled' as const }],
});

/** A fresh reading of the port, read now. */
const read = (reading: unknown) => ({
  state: 'read',
  reading,
  readAt: new Date().toISOString(),
  stale: false,
});

/** Railway's ports read: the backend in the state, the alerts Cron fine, the quote check failed. */
function railwayAnswers(state: 'online' | 'offline') {
  const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  server.use(
    http.get('*/admin/services', () =>
      HttpResponse.json({
        services: [
          ...SERVICES,
          cron(ALERTS_ID, 'alerts', 640),
          cron(QUOTE_CHECK_ID, 'quote-check', 340),
        ],
        costs: SERVICE_COSTS,
      }),
    ),
    http.get('*/admin/services/usage', () =>
      HttpResponse.json({
        usage: [
          {
            serviceId: SERVICE_IDS.Railway,
            read: read({
              kind: 'railway',
              state,
              usage: [{ name: 'spend', unit: 'USD', used: 1.8, limit: 5 }],
              spendParts: [
                { part: 'cpu', usd: 0.56 },
                { part: 'memory', usd: 1.15 },
                { part: 'egress', usd: 0.09 },
                { part: 'disk', usd: 0 },
              ],
            }),
          },
          {
            serviceId: ALERTS_ID,
            read: read({
              kind: 'cron',
              lastRun: { at: inMinutes(-1), succeeded: true },
              nextRunAt: inMinutes(14.5),
            }),
          },
          {
            serviceId: QUOTE_CHECK_ID,
            read: read({
              kind: 'cron',
              lastRun: { at: inMinutes(-30), succeeded: false },
              nextRunAt: null,
            }),
          },
        ],
      }),
    ),
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

async function canvas() {
  return within(await screen.findByRole('group', { name: 'Полотно Сервісів' }));
}

test('the Railway block shows Online and its spend, each Cron its last run and the next', async () => {
  railwayAnswers('online');
  render(<Admin />);
  const blocks = await canvas();

  const railway = within(blocks.getByRole('button', { name: 'Railway' }));
  expect(await railway.findByText('Online')).toBeDefined();
  expect(railway.getByRole('meter', { name: 'Витрати' }).getAttribute('aria-valuenow')).toBe('1.8');

  const alerts = within(blocks.getByRole('button', { name: 'alerts' }));
  expect(alerts.getByText('Останній запуск успішний')).toBeDefined();
  expect(alerts.getByText('Наступний через 15 хв')).toBeDefined();
  expect(alerts.queryByRole('meter')).toBeNull();

  const quoteCheck = within(blocks.getByRole('button', { name: 'quote-check' }));
  expect(quoteCheck.getByText('Останній запуск невдалий')).toBeDefined();
  expect(quoteCheck.queryByText(/Наступний/)).toBeNull();
});

test('the Railway block shows Offline, and its window the state, the spend and its parts', async () => {
  railwayAnswers('offline');
  const user = userEvent.setup();
  render(<Admin />);
  const blocks = await canvas();
  expect(
    await within(blocks.getByRole('button', { name: 'Railway' })).findByText('Offline'),
  ).toBeDefined();

  await user.click(blocks.getByRole('button', { name: 'Railway' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Railway' }));

  expect(panel.getByText('Offline')).toBeDefined();
  expect(panel.getByText('$1.80 з $5')).toBeDefined();
  const parts = within(panel.getByRole('list', { name: 'З чого складаються витрати' }));
  expect(parts.getAllByRole('listitem').map((part) => part.textContent)).toEqual([
    'Процесор$0.56',
    "Пам'ять$1.15",
    'Вихідний трафік$0.09',
    'Диск$0',
  ]);
});

test('a Cron’s window says when its last run ended and how, and when the next starts', async () => {
  railwayAnswers('online');
  const user = userEvent.setup();
  render(<Admin />);
  await user.click((await canvas()).getByRole('button', { name: 'quote-check' }));
  const usage = within(
    within(await screen.findByRole('dialog', { name: 'quote-check' })).getByRole('region', {
      name: 'Використання',
    }),
  );

  expect(usage.getByText('невдалий')).toBeDefined();
  expect(usage.getByText('Не заплановано')).toBeDefined();
});
