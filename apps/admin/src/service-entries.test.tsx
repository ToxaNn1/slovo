import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { override, refusal } from './mock/handlers';
import { server } from './mock/server';
import { SERVICE_ENTRIES, SERVICE_IDS } from './mock/services-fixtures';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/services');
});

afterEach(() => {
  vi.useRealTimers();
});

/** Opens Neon's window and answers its entries section. */
async function neonEntries(options: Parameters<typeof userEvent.setup>[0] = {}) {
  const user = userEvent.setup(options);
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
    override('services.addEntry', async ({ request, params }) => {
      bodies.push({ serviceId: params['serviceId'], ...Object(await request.json()) });
      return { entry: SERVICE_ENTRIES[3] };
    }),
  );
  const { user, entries } = await neonEntries();
  await user.click(await entries.findByRole('button', { name: 'Додати запис' }));
  const form = within(entries.getByRole('form', { name: 'Новий запис' }));

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
    override('services.editEntry', async ({ request, params }) => {
      bodies.push({ id: params['id'], ...Object(await request.json()) });
      return { entry: SERVICE_ENTRIES[2] };
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
    override('services.deleteEntry', async ({ request, params }) => {
      bodies.push({ id: params['id'], ...Object(await request.json()) });
      return { deleted: true };
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
  server.use(override('services.entries', () => ({ vault: 'off', entries: [] })));
  const { entries } = await neonEntries();

  expect((await entries.findByRole('status')).textContent).toContain(
    'Сховище вимкнене: на сервері не задано VAULT_KEY.',
  );
  expect(entries.queryByRole('form')).toBeNull();
});

test('a write refused as vault-off says why in the confirmation', async () => {
  server.use(
    override('services.deleteEntry', () =>
      refusal(503, { defined: true, code: 'VAULT_OFF', status: 503, message: 'off' }),
    ),
  );
  const { user, entries } = await neonEntries();
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Видалити' }));
  await confirmWith('rotated away', 'Видалити');

  const dialog = within(await screen.findByRole('dialog', { name: /Видалити запис/ }));
  expect((await dialog.findByText(/Сховище вимкнене/)).textContent).toContain('VAULT_KEY');
});

/** A fake value, made for the test: never a real one. */
const FAKE_VALUE = 'fake-neon-key-0001';

/**
 * Answers the reads of the API key as the backend does: locked until a
 * code is entered, the value after it; keeps what each request was.
 */
function vaultLockedUntilCode(rightCode = '123456') {
  const calls: string[] = [];
  let open = false;
  const locked = () =>
    refusal(423, { defined: true, code: 'LOCKED', status: 423, message: 'locked' });
  server.use(
    override('services.unlockVault', async ({ request }) => {
      const { code } = Object(await request.json()) as { code: string };
      calls.push(`unlock ${code}`);
      if (code !== rightCode) {
        return refusal(400, {
          defined: true,
          code: 'WRONG_CODE',
          status: 400,
          message: 'wrong',
          data: { attemptsLeft: 2 },
        });
      }
      open = true;
      return { openUntil: '2026-11-17T10:15:00.000Z' };
    }),
    override('services.revealEntry', ({ params }) => {
      calls.push(`reveal ${String(params['id'])}`);
      return open ? { value: FAKE_VALUE } : locked();
    }),
    override('services.copyEntry', ({ params }) => {
      calls.push(`copy ${String(params['id'])}`);
      return open ? { value: FAKE_VALUE } : locked();
    }),
  );
  return calls;
}

/** Enters the code in the TOTP prompt. */
async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string) {
  const prompt = within(await screen.findByRole('dialog', { name: 'Відкрити сховище' }));
  await user.type(prompt.getByLabelText('Код із застосунку'), code);
  await user.click(prompt.getByRole('button', { name: 'Відкрити' }));
  return prompt;
}

test('«Показати» asks for the TOTP on a locked Vault, shows the value, and hides it after 30 s', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const calls = vaultLockedUntilCode();
  const { user, entries } = await neonEntries({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Показати' }));
  await enterCode(user, '123456');

  expect(await token.findByText(FAKE_VALUE)).toBeDefined();
  expect(screen.queryByRole('dialog', { name: 'Відкрити сховище' })).toBeNull();
  expect(calls).toEqual([
    `reveal ${SERVICE_ENTRIES[3].id}`,
    'unlock 123456',
    `reveal ${SERVICE_ENTRIES[3].id}`,
  ]);
  // The fake clock also runs on with real time, so the check before 30 s keeps a margin.
  act(() => {
    vi.advanceTimersByTime(25_000);
  });
  expect(token.queryByText(FAKE_VALUE)).not.toBeNull();
  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  expect(token.queryByText(FAKE_VALUE)).toBeNull();
  expect(token.getByLabelText('Приховано').textContent).toBe('••••••••');
});

test('a wrong TOTP is refused in the prompt and shows nothing', async () => {
  const calls = vaultLockedUntilCode();
  const { user, entries } = await neonEntries();
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Показати' }));
  const prompt = await enterCode(user, '000000');

  expect((await prompt.findByRole('alert')).textContent).toContain('Невірний код');
  expect(screen.queryByText(FAKE_VALUE)).toBeNull();
  expect(calls).toEqual([`reveal ${SERVICE_ENTRIES[3].id}`, 'unlock 000000']);
});

test('«Копіювати» writes the clipboard without ever showing the value', async () => {
  const calls = vaultLockedUntilCode();
  const { user, entries } = await neonEntries();
  const token = within(await entries.findByRole('listitem', { name: 'API-ключ' }));

  await user.click(token.getByRole('button', { name: 'Копіювати' }));
  await enterCode(user, '123456');

  expect(await token.findByText('Скопійовано')).toBeDefined();
  expect(await navigator.clipboard.readText()).toBe(FAKE_VALUE);
  expect(document.body.textContent).not.toContain(FAKE_VALUE);
  expect(calls.at(-1)).toBe(`copy ${SERVICE_ENTRIES[3].id}`);
  // A login is in the open: it has neither.
  const login = within(entries.getByRole('listitem', { name: 'Акаунт' }));
  expect(login.queryByRole('button', { name: 'Копіювати' })).toBeNull();
});
