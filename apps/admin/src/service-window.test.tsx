import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { server } from './mock/server';
import { SENTRY_USAGE, SERVICE_COSTS, SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

afterEach(() => {
  vi.useRealTimers();
});

/** The fixture Services with Neon on a plan: $19 a month, charged on the 31st. */
function neonOnAPlan() {
  server.use(
    http.get('*/admin/services', () =>
      HttpResponse.json({
        services: SERVICES.map((service) =>
          service.id === SERVICE_IDS.Neon
            ? { ...service, plan: 'Launch', monthlyPriceUsdCents: 1900, billingDay: 31 }
            : service,
        ),
        costs: SERVICE_COSTS,
      }),
    ),
    http.get('*/admin/services/usage', () =>
      HttpResponse.json({
        usage: [
          {
            serviceId: SERVICE_IDS.Neon,
            read: {
              ...SENTRY_USAGE.read,
              reading: {
                kind: 'metered',
                usage: [
                  { name: 'compute', unit: 'CU-hours', used: 25, limit: 100 },
                  { name: 'storage', unit: 'GB', used: 0.25, limit: 0.5 },
                  { name: 'egress', unit: 'GB', used: 4.5, limit: 5 },
                ],
              },
            },
          },
        ],
      }),
    ),
  );
}

async function openService(name: string) {
  const user = userEvent.setup();
  render(<Admin />);
  const canvas = within(await screen.findByRole('group', { name: 'Полотно Сервісів' }));
  await user.click(canvas.getByRole('button', { name }));
  return screen.findByRole('dialog', { name });
}

test('a Service opens its window with the money, the usage and the entries side by side', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  neonOnAPlan();
  const window = within(await openService('Neon'));

  const money = within(window.getByRole('region', { name: 'Гроші' }));
  expect(money.getByText('Launch')).toBeDefined();
  expect(money.getByText('$19 / місяць')).toBeDefined();
  expect(money.getByText('31-го щомісяця')).toBeDefined();
  // November has 30 days: a charge on the 31st falls on its last.
  expect(money.getByText('Наступне 30 листопада')).toBeDefined();

  const usage = within(window.getByRole('region', { name: 'Використання' }));
  expect(usage.getByText('25 з 100 CU-год')).toBeDefined();
  expect(usage.getByText('256 з 512 МБ')).toBeDefined();
  expect(usage.getByText('4,5 з 5 ГБ')).toBeDefined();
  expect(usage.getByText('лишилося 256 МБ')).toBeDefined();
  expect(usage.getByText('Оновлено 17 листопада, 09:30')).toBeDefined();
  expect(usage.getAllByRole('meter')).toHaveLength(3);

  const entries = within(window.getByRole('region', { name: 'Записи' }));
  expect(await entries.findByText('owner@example.com')).toBeDefined();
});

test('nothing in the window reads as raw JSON or a key', async () => {
  neonOnAPlan();
  const dialog = await openService('Neon');
  await within(dialog).findByText('owner@example.com');

  const text = dialog.textContent;
  expect(text).not.toMatch(/[{}]/);
  expect(text).not.toMatch(/"\w[\w-]*":/);
  expect(text).not.toMatch(/\b(compute|egress|storage|CU-hours|GB|USD)\b/);
});

test('a Service without a usage port shows the limits of its plan', async () => {
  server.use(
    http.get('*/admin/services', () =>
      HttpResponse.json({
        services: SERVICES.map((service) =>
          service.id === SERVICE_IDS['Zoho Mail']
            ? { ...service, limits: [{ name: 'storage', unit: 'GB', limit: 5 }] }
            : service,
        ),
        costs: SERVICE_COSTS,
      }),
    ),
  );
  const usage = within(
    within(await openService('Zoho Mail')).getByRole('region', { name: 'Використання' }),
  );

  expect(usage.getByText('Використання не читається, ось ліміти тарифу:')).toBeDefined();
  expect(usage.getByText('Сховище')).toBeDefined();
  expect(usage.getByText('5 ГБ')).toBeDefined();
});

test('Esc or the back gesture closes the window', async () => {
  const dialog = await openService('Neon');

  const request = new Event('cancel', { cancelable: true });
  fireEvent(dialog, request);

  expect(request.defaultPrevented).toBe(true);
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
