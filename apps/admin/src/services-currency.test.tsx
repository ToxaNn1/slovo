import type { UsdRate } from '@slovo/contracts/admin-api';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

/** The API answers Neon at $19.50 on the 5th, the total $48.50, and the NBU rate. */
function answer(rate: UsdRate | null) {
  server.use(
    http.get('*/admin/services', () =>
      HttpResponse.json({
        services: SERVICES.map((service) =>
          service.id === SERVICE_IDS.Neon
            ? { ...service, plan: 'Launch', monthlyPriceUsdCents: 1950, billingDay: 5 }
            : service,
        ),
        costs: {
          monthlyTotalUsdCents: 4850,
          nextCharge: { on: '2026-12-05', amountUsdCents: 1950, serviceIds: [SERVICE_IDS.Neon] },
        },
      }),
    ),
    http.get('*/admin/services/usd-rate', () => HttpResponse.json({ rate })),
  );
}

const TODAY: UsdRate = { uahPerUsd: 41.4321, on: '2026-11-17', state: 'today' };

// The matchers see the no-break space of the digit groups as a space.
const costs = async () => within(await screen.findByRole('group', { name: 'Витрати' }));

test('the USD/UAH switch shows the total, the next charge and a price in hryvnias at the NBU rate', async () => {
  answer(TODAY);
  const user = userEvent.setup();
  render(<Admin />);

  const header = await costs();
  expect(header.getByText('≈ $48.50 / місяць')).toBeDefined();
  expect(header.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');

  await user.click(header.getByRole('button', { name: 'UAH' }));
  // $48.50 × 41.4321 = 2 009.46; $19.50 × 41.4321 = 807.93.
  expect(await header.findByText('≈ 2 009 ₴ / місяць')).toBeDefined();
  expect(header.getByText('Наступне списання 5 грудня: 808 ₴ · Neon')).toBeDefined();
  expect(header.getByText('Курс НБУ на 17 листопада: $1 = 41,4321 ₴')).toBeDefined();

  await user.click(
    within(screen.getByRole('group', { name: 'Полотно Сервісів' })).getByRole('button', {
      name: 'Neon',
    }),
  );
  const panel = within(await screen.findByRole('dialog', { name: 'Neon' }));
  expect(panel.getByText('808 ₴ / місяць')).toBeDefined();
  // The panel's switch is the same pick.
  await user.click(panel.getByRole('button', { name: 'USD' }));
  expect(panel.getByText('$19.50 / місяць')).toBeDefined();
});

test('the switch is remembered on the device', async () => {
  answer(TODAY);
  const user = userEvent.setup();
  render(<Admin />);
  await user.click((await costs()).getByRole('button', { name: 'UAH' }));
  cleanup();

  render(<Admin />);
  const header = await costs();
  expect(await header.findByText('≈ 2 009 ₴ / місяць')).toBeDefined();
  expect(header.getByRole('button', { name: 'UAH' }).getAttribute('aria-pressed')).toBe('true');
});

test('a failed NBU read shows the last known rate with its day', async () => {
  answer({ uahPerUsd: 41.2, on: '2026-11-14', state: 'last-known' });
  const user = userEvent.setup();
  render(<Admin />);
  const header = await costs();
  await user.click(header.getByRole('button', { name: 'UAH' }));

  // $48.50 × 41.2 = 1 998.2.
  expect(await header.findByText('≈ 1 998 ₴ / місяць')).toBeDefined();
  expect(
    header.getByText('Курс НБУ на 14 листопада (останній відомий): $1 = 41,2 ₴'),
  ).toBeDefined();
});

test('with no rate ever read the money stays in dollars and says so', async () => {
  answer(null);
  const user = userEvent.setup();
  render(<Admin />);
  const header = await costs();
  await user.click(header.getByRole('button', { name: 'UAH' }));

  expect(await header.findByText('Курс НБУ невідомий, суми в доларах.')).toBeDefined();
  expect(header.getByText('≈ $48.50 / місяць')).toBeDefined();
});
