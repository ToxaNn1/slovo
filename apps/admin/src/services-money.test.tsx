import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { override } from './mock/handlers';
import { server } from './mock/server';
import { ADDED_SERVICE, SERVICE_IDS, SERVICES } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

/** Types the reason into the confirmation and confirms; the button waits for a reason. */
async function confirmWith(title: string, reason: string, button: string) {
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole('dialog', { name: title }));
  const confirm = dialog.getByRole('button', { name: button });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), reason);
  await user.click(confirm);
}

test('the top of the canvas shows the monthly total and the next charge from the API', async () => {
  server.use(
    override('services.list', () => ({
      services: SERVICES,
      costs: {
        monthlyTotalUsdCents: 4850,
        nextCharge: {
          on: '2027-02-28',
          amountUsdCents: 900,
          serviceIds: [SERVICE_IDS.GitHub, SERVICE_IDS.Railway],
        },
      },
    })),
  );
  render(<Admin />);

  const costs = within(await screen.findByRole('group', { name: 'Витрати' }));
  expect(costs.getByText('≈ $48.50 / місяць')).toBeDefined();
  expect(costs.getByText('Наступне списання 28 лютого: $9 · GitHub, Railway')).toBeDefined();
});

test('with no priced Service the total is $0 and no charge comes', async () => {
  render(<Admin />);

  const costs = within(await screen.findByRole('group', { name: 'Витрати' }));
  expect(costs.getByText('≈ $0 / місяць')).toBeDefined();
  expect(costs.getByText('Наступного списання немає')).toBeDefined();
});

test("the side panel changes a Service's plan, price and billing day only with a reason", async () => {
  const bodies: unknown[] = [];
  server.use(
    override('services.editMoney', async ({ params, request }) => {
      bodies.push({ id: params['id'], ...Object(await request.json()) });
      return { service: ADDED_SERVICE, changed: ['plan'] };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(
    within(await screen.findByRole('group', { name: 'Полотно Сервісів' })).getByRole('button', {
      name: 'Neon',
    }),
  );
  const panel = within(await screen.findByRole('dialog', { name: 'Neon' }));
  expect(panel.getByText('День списання')).toBeDefined();

  const money = within(panel.getByRole('region', { name: 'Гроші' }));
  await user.click(money.getByRole('button', { name: 'Змінити' }));
  const form = within(panel.getByRole('form', { name: 'План і ціна' }));
  await user.type(form.getByLabelText('План'), 'Launch');
  await user.type(form.getByLabelText('Ціна, $ / місяць'), '19,5');
  await user.type(form.getByLabelText('День списання'), '32');
  expect(form.getByRole('button', { name: 'Зберегти' })).toHaveProperty('disabled', true);
  await user.clear(form.getByLabelText('День списання'));
  await user.type(form.getByLabelText('День списання'), '31');
  await user.click(form.getByRole('button', { name: 'Зберегти' }));
  expect(bodies).toEqual([]);
  await confirmWith('Змінити план і ціну сервісу Neon?', 'the invoice', 'Зберегти');

  await waitFor(() => {
    expect(bodies).toEqual([
      {
        id: SERVICE_IDS.Neon,
        plan: 'Launch',
        monthlyPriceUsdCents: 1950,
        billingDay: 31,
        reason: 'the invoice',
      },
    ]);
  });
});

test('«Додати сервіс» adds a Service only after a confirmation with a reason', async () => {
  const bodies: unknown[] = [];
  server.use(
    override('services.add', async ({ request }) => {
      bodies.push(await request.json());
      return { service: ADDED_SERVICE };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);

  await user.click(await screen.findByRole('button', { name: 'Додати сервіс' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Додати сервіс' }));
  const form = within(dialog.getByRole('form', { name: 'Новий сервіс' }));
  expect(form.getByRole('button', { name: 'Додати' })).toHaveProperty('disabled', true);
  await user.type(form.getByLabelText('Назва'), 'Hetzner');
  await user.selectOptions(form.getByLabelText('Вид'), 'Cron');
  await user.type(form.getByLabelText('Ціна, $ / місяць'), '4.5');
  await user.click(form.getByRole('button', { name: 'Додати' }));
  expect(bodies).toEqual([]);
  await confirmWith('Додати сервіс Hetzner?', 'backups', 'Додати');

  await waitFor(() => {
    expect(bodies).toEqual([
      {
        name: 'Hetzner',
        kind: 'cron',
        plan: null,
        monthlyPriceUsdCents: 450,
        billingDay: null,
        reason: 'backups',
      },
    ]);
  });
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Додати сервіс' })).toBeNull();
  });
});
