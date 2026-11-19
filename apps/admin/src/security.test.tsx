import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { override, type Refusal, refusal } from './mock/handlers';
import { server } from './mock/server';
import { Admin } from './router';

const ISSUED = FIXTURES.issueAgentToken;

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/security');
});

/** A backend that lists the issued token by name once it is issued; the bodies of the writes. */
function backend() {
  let issued = false;
  const bodies: unknown[] = [];
  server.use(
    override('agentTokens', () => ({
      tokens: [
        ...FIXTURES.agentTokens.tokens,
        ...(issued
          ? [{ name: ISSUED.name, createdAt: '2026-11-08T10:00:00.000Z', revokedAt: null }]
          : []),
      ],
    })),
    override('issueAgentToken', async ({ request }) => {
      bodies.push(await request.json());
      issued = true;
      return ISSUED;
    }),
  );
  return bodies;
}

/** Confirms the open write: its button is disabled until a reason is typed. */
async function confirmWith(reason: string, button: string) {
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole('dialog'));
  const confirm = dialog.getByRole('button', { name: button });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), '   ');
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), reason);
  expect(confirm).toHaveProperty('disabled', false);
  await user.click(confirm);
}

test('an issued Агент token is shown once, then only by its name', async () => {
  const bodies = backend();
  const user = userEvent.setup();
  render(<Admin />);
  const tokens = within(await screen.findByRole('region', { name: 'Токени Агентів' }));

  await user.type(tokens.getByLabelText('Назва Агента'), ISSUED.name);
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('content batches', 'Видати токен');

  expect(await tokens.findByText(ISSUED.token)).toBeDefined();
  expect(bodies).toEqual([{ name: ISSUED.name, reason: 'content batches' }]);
  await user.click(tokens.getByRole('button', { name: 'Закрити' }));

  const list = within(tokens.getByRole('list', { name: 'Токени' }));
  expect(await list.findByText(new RegExp(ISSUED.name))).toBeDefined();
  expect(screen.queryByText(ISSUED.token)).toBeNull();
  expect(document.body.textContent).not.toContain(ISSUED.token);
});

test('every write opens the confirmation, its button disabled until a reason is typed', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const people = within(await screen.findByRole('region', { name: 'Люди і доступ' }));
  const tokens = within(screen.getByRole('region', { name: 'Токени Агентів' }));
  await people.findByText(/editor@example.com/);

  await user.type(people.getByLabelText('Пошта'), 'new@example.com');
  await user.click(people.getByRole('button', { name: 'Запросити' }));
  expect(within(await screen.findByRole('dialog')).getByText('підтвердження')).toBeDefined();
  await confirmWith('a new editor', 'Запросити');

  await user.click(people.getByRole('button', { name: 'Зробити Власником' }));
  await confirmWith('trusted', 'Змінити роль');

  await user.click(people.getByRole('button', { name: 'Забрати доступ' }));
  expect(within(await screen.findByRole('dialog')).getByText('небезпечна дія')).toBeDefined();
  await confirmWith('left', 'Забрати доступ');

  await user.click(await tokens.findByRole('button', { name: 'Відкликати' }));
  await confirmWith('leaked', 'Відкликати');

  await user.type(tokens.getByLabelText('Назва Агента'), 'claude-next');
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('batches', 'Видати токен');

  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('an alert threshold changes only with a reason, and shows its default', async () => {
  const bodies: unknown[] = [];
  server.use(
    override('setAlertThreshold', async ({ params, request }) => {
      bodies.push({ key: params['key'], ...Object(await request.json()) });
      return FIXTURES.setAlertThreshold;
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const thresholds = within(await screen.findByRole('region', { name: 'Пороги сповіщень' }));
  const crashFree = within(
    await thresholds.findByRole('form', { name: 'Поріг: Сесії без падінь, %' }),
  );
  const value = crashFree.getByLabelText('Сесії без падінь, %');

  expect(value).toHaveProperty('value', '99');
  expect(crashFree.getByText('Типово 99,5')).toBeDefined();
  await user.clear(value);
  await user.type(value, '99.5');
  await user.click(crashFree.getByRole('button', { name: 'Змінити поріг' }));
  expect(bodies).toEqual([]);
  await confirmWith('too noisy', 'Змінити поріг');

  await waitFor(() => {
    expect(bodies).toEqual([{ key: 'crashFree', value: 99.5, reason: 'too noisy' }]);
  });
});

test('the Action log names its author, with the same texts in both Themes', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const log = within(await screen.findByRole('region', { name: 'Журнал дій' }));

  expect(await log.findByText('команда switches off')).toBeDefined();
  expect(log.getByText('the Game loses scores')).toBeDefined();
  const section = screen.getByRole('region', { name: 'Безпека' });
  const light = section.textContent;
  await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Безпека' }).textContent).toBe(light);
  await user.click(screen.getByRole('button', { name: 'Світла' }));
});

test('a write keeps its confirmation open until it ends, and a refusal stays in it', async () => {
  let answer: (refused: Refusal) => void = () => undefined;
  const writes: unknown[] = [];
  server.use(
    override('issueAgentToken', async ({ request }) => {
      writes.push(await request.json());
      return new Promise<Refusal>((resolve) => {
        answer = resolve;
      });
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const tokens = within(await screen.findByRole('region', { name: 'Токени Агентів' }));

  await user.type(tokens.getByLabelText('Назва Агента'), 'claude-next');
  await user.click(tokens.getByRole('button', { name: 'Видати токен' }));
  await confirmWith('batches', 'Видати токен');

  const dialog = within(screen.getByRole('dialog'));
  await waitFor(() => {
    expect(writes).toHaveLength(1);
  });
  expect(dialog.getByRole('button', { name: 'Видати токен' })).toHaveProperty('disabled', true);
  answer(
    refusal(409, {
      defined: true,
      code: 'CONFLICT',
      status: 409,
      message: 'CONFLICT',
      data: { refusal: 'name-taken' },
    }),
  );

  expect(await dialog.findByText('Цю назву вже видано; оберіть іншу.')).toBeDefined();
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(writes).toHaveLength(1);
});

test('a Безпека list that fails to load says so instead of reading empty', async () => {
  server.use(override('people', () => refusal(502, {})));
  render(<Admin />);
  const people = within(await screen.findByRole('region', { name: 'Люди і доступ' }));

  expect(await people.findByText('Не вдалося завантажити.')).toBeDefined();
});

/** A backend of 51 Accounts, newest first, listed by page and search as the backend does; the deletions asked of it and the list's queries. */
function accountsBackend() {
  const deleted: unknown[] = [];
  const queries: { page: string | null; search: string | null }[] = [];
  let accounts: AdminApiOutputs['listAccounts']['accounts'] = Array.from(
    { length: 51 },
    (_, i) => ({
      id: `account-${String(i)}`,
      email: i === 0 ? 'reader@example.com' : `reader-${String(i)}@example.com`,
      createdAt: '2026-10-01T09:00:00.000Z',
      signInMethods: i === 0 ? ['google', 'apple'] : [],
    }),
  );
  server.use(
    override('listAccounts', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const page = Number(params.get('page') ?? '1');
      const search = (params.get('search') ?? '').trim().toLowerCase();
      queries.push({ page: params.get('page'), search: params.get('search') });
      const matching = accounts.filter(({ email }) => email.includes(search));
      return {
        accounts: matching.slice((page - 1) * 50, page * 50),
        total: matching.length,
      };
    }),
    override('deleteAccount', async ({ params, request }) => {
      deleted.push({ email: params['email'], ...Object(await request.json()) });
      accounts = accounts.filter(({ email }) => email !== params['email']);
      return { deleted: true };
    }),
  );
  return { deleted, queries };
}

test('a Власник sees every reader Account a page at a time, with its date and sign-in methods', async () => {
  accountsBackend();
  const user = userEvent.setup();
  render(<Admin />);
  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));

  const first = await block.findByRole('row', { name: /reader@example\.com/ });
  expect(within(first).getByText('Код з листа, Google, Apple')).toBeDefined();
  // 09:00 UTC is 12:00 in Kyiv.
  expect(within(first).getByText(/2026.*12:00/)).toBeDefined();
  expect(block.getAllByRole('row', { name: /@example\.com/ })).toHaveLength(50);
  expect(block.getByText('1–50 з 51')).toBeDefined();

  await user.click(block.getByRole('button', { name: 'Далі' }));
  expect(await block.findByText('51–51 з 51')).toBeDefined();
  expect(
    block.getAllByRole('row', { name: /@example\.com/ }).map((row) => row.textContent),
  ).toEqual([expect.stringContaining('reader-50@example.com')]);
});

test('a search by part of an email narrows the Accounts from the first page', async () => {
  const { queries } = accountsBackend();
  const user = userEvent.setup();
  render(<Admin />);
  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));
  await block.findByText('1–50 з 51');
  await user.click(block.getByRole('button', { name: 'Далі' }));
  await block.findByText('51–51 з 51');

  await user.type(block.getByLabelText('Пошта читача'), 'READER-5');
  await user.click(block.getByRole('button', { name: 'Знайти' }));

  expect(await block.findByText('1–2 з 2')).toBeDefined();
  expect(queries.at(-1)).toEqual({ page: null, search: 'READER-5' });
  expect(block.getByRole('row', { name: /reader-50@example\.com/ })).toBeDefined();

  await user.clear(block.getByLabelText('Пошта читача'));
  await user.type(block.getByLabelText('Пошта читача'), 'nobody');
  await user.click(block.getByRole('button', { name: 'Знайти' }));
  expect(await block.findByText('Не знайдено.')).toBeDefined();
});

test('a Власник deletes a listed Account with a reason', async () => {
  const { deleted } = accountsBackend();
  const user = userEvent.setup();
  render(<Admin />);
  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));
  const row = await block.findByRole('row', { name: /reader@example\.com/ });

  await user.click(within(row).getByRole('button', { name: 'Видалити акаунт' }));
  expect(within(await screen.findByRole('dialog')).getByText('небезпечна дія')).toBeDefined();
  await confirmWith('spam Account', 'Видалити акаунт');

  expect(await block.findByText('Акаунт reader@example.com видалено.')).toBeDefined();
  expect(deleted).toEqual([{ email: 'reader@example.com', reason: 'spam Account' }]);
  await waitFor(() => {
    expect(block.queryByRole('row', { name: /reader@example\.com/ })).toBeNull();
  });
});

test('deleting the one Account of the last page steps back to the page before', async () => {
  accountsBackend();
  const user = userEvent.setup();
  render(<Admin />);
  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));
  await block.findByText('1–50 з 51');
  await user.click(block.getByRole('button', { name: 'Далі' }));
  const row = await block.findByRole('row', { name: /reader-50@example\.com/ });

  await user.click(within(row).getByRole('button', { name: 'Видалити акаунт' }));
  await confirmWith('spam Account', 'Видалити акаунт');

  expect(await block.findByText('1–50 з 50')).toBeDefined();
  expect(block.getAllByRole('row', { name: /@example\.com/ })).toHaveLength(50);
});
