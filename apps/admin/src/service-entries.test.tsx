import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { SERVICE_ENTRIES, SERVICE_IDS } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

/** Opens Neon's side panel and answers its entries section. */
async function neonEntries() {
  const user = userEvent.setup();
  render(<Admin />);
  const canvas = within(await screen.findByRole('group', { name: 'Полотно Сервісів' }));
  await user.click(canvas.getByRole('button', { name: 'Neon' }));
  const panel = within(await screen.findByRole('dialog', { name: 'Neon' }));
  return { user, entries: within(panel.getByRole('region', { name: 'Записи' })) };
}

/** Confirms the open write with the reason. */
async function confirmWith(reason: string, button: string) {
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole('dialog', { name: /запис/ }));
  const confirm = dialog.getByRole('button', { name: button });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), reason);
  await user.click(confirm);
}

test('the panel shows logins and links in the open, and masks the sealed entries', async () => {
  const { entries } = await neonEntries();

  const login = within(await entries.findByRole('listitem', { name: 'Акаунт' }));
  expect(login.getByText('owner@example.com')).toBeDefined();
  expect(login.getByText('Логін · Акаунт')).toBeDefined();
  const link = within(entries.getByRole('listitem', { name: 'Консоль' }));
  expect(link.getByText('https://console.neon.tech')).toBeDefined();
  for (const name of ['Пароль', 'API-ключ']) {
    const sealed = within(entries.getByRole('listitem', { name }));
    expect(sealed.getByLabelText('Приховано').textContent).toBe('••••••••');
  }
  expect(
    within(entries.getByRole('listitem', { name: 'API-ключ' })).getByText(
      'Де використовується: DATABASE_URL',
    ),
  ).toBeDefined();
  // There is no export of entries.
  expect(screen.queryByRole('button', { name: /Експорт/ })).toBeNull();
});

test('a new entry goes through the confirmation with a reason', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/admin/services/:serviceId/entries', async ({ request, params }) => {
      bodies.push({ serviceId: params['serviceId'], ...Object(await request.json()) });
      return HttpResponse.json({ entry: SERVICE_ENTRIES[3] });
    }),
  );
  const { user, entries } = await neonEntries();
  const form = within(await entries.findByRole('form', { name: 'Новий запис' }));

  await user.selectOptions(form.getByLabelText('Тип'), 'Токен / API-ключ');
  await user.type(form.getByLabelText('Назва'), 'Read key');
  const value = form.getByLabelText('Значення');
  expect(value.getAttribute('type')).toBe('password');
  await user.type(value, 'fake-key');
  await user.type(form.getByLabelText('Де використовується'), 'CI');
  await user.click(form.getByRole('button', { name: 'Додати запис' }));
  expect(
    await screen.findByRole('dialog', { name: 'Додати запис «Read key» до Neon?' }),
  ).toBeDefined();
  await confirmWith('the CI key', 'Додати');

  await waitFor(() => {
    expect(bodies).toEqual([
      {
        serviceId: SERVICE_IDS.Neon,
        type: 'token',
        label: 'Read key',
        note: 'CI',
        value: 'fake-key',
        reason: 'the CI key',
      },
    ]);
  });
});

test('a change of a sealed entry leaves its value out unless a new one is typed', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/admin/services/entries/:id', async ({ request, params }) => {
      bodies.push({ id: params['id'], ...Object(await request.json()) });
      return HttpResponse.json({ entry: SERVICE_ENTRIES[2] });
    }),
  );
  const { user, entries } = await neonEntries();
  const password = within(await entries.findByRole('listitem', { name: 'Пароль' }));

  await user.click(password.getByRole('button', { name: 'Змінити' }));
  const form = within(password.getByRole('form', { name: 'Зміна запису Пароль' }));
  const value = form.getByLabelText('Нове значення (порожнє — без змін)');
  expect(value).toHaveProperty('value', '');
  await user.clear(form.getByLabelText('Де використовується'));
  await user.type(form.getByLabelText('Де використовується'), 'консоль Neon');
  await user.click(form.getByRole('button', { name: 'Зберегти' }));
  await confirmWith('a clearer note', 'Зберегти');

  await waitFor(() => {
    expect(bodies).toEqual([
      {
        id: SERVICE_ENTRIES[2].id,
        label: 'Пароль',
        note: 'консоль Neon',
        reason: 'a clearer note',
      },
    ]);
  });
});

test('an entry is deleted through the confirmation', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post('*/admin/services/entries/:id/delete', async ({ request, params }) => {
      bodies.push({ id: params['id'], ...Object(await request.json()) });
      return HttpResponse.json({ deleted: true });
    }),
  );
  const { user, entries } = await neonEntries();
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Видалити' }));
  await confirmWith('rotated away', 'Видалити');

  await waitFor(() => {
    expect(bodies).toEqual([{ id: SERVICE_ENTRIES[3].id, reason: 'rotated away' }]);
  });
});

test('without VAULT_KEY the section says the Vault is off and offers no write', async () => {
  server.use(
    http.get('*/admin/services/:serviceId/entries', () =>
      HttpResponse.json({ vault: 'off', entries: [] }),
    ),
  );
  const { entries } = await neonEntries();

  expect((await entries.findByRole('status')).textContent).toContain(
    'Сховище вимкнене: на сервері не задано VAULT_KEY.',
  );
  expect(entries.queryByRole('form')).toBeNull();
});

test('a write refused as vault-off says why in the confirmation', async () => {
  server.use(
    http.post('*/admin/services/entries/:id/delete', () =>
      HttpResponse.json(
        { defined: true, code: 'VAULT_OFF', status: 503, message: 'off' },
        { status: 503 },
      ),
    ),
  );
  const { user, entries } = await neonEntries();
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Видалити' }));
  await confirmWith('rotated away', 'Видалити');

  const dialog = within(await screen.findByRole('dialog', { name: /Видалити запис/ }));
  expect((await dialog.findByText(/Сховище вимкнене/)).textContent).toContain('VAULT_KEY');
});
