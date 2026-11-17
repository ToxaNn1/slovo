import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

const READER = FIXTURES.listAccounts.accounts[0];
const ID = READER?.id ?? '';
const EMAIL = READER?.email ?? '';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/security');
});

/** A backend whose list holds the fixture's reader until it is deleted; the deletions asked of it. */
function backend() {
  const deleted: unknown[] = [];
  let gone = false;
  server.use(
    http.get('*/admin/accounts', () =>
      HttpResponse.json(gone ? { accounts: [], total: 0 } : FIXTURES.listAccounts),
    ),
    http.get('*/admin/accounts/:accountId', () =>
      HttpResponse.json(gone ? { account: null } : FIXTURES.getAccount),
    ),
    http.post('*/admin/accounts/:email/delete', async ({ params, request }) => {
      deleted.push({ email: params['email'], ...Object(await request.json()) });
      gone = true;
      return HttpResponse.json({ deleted: true });
    }),
  );
  return { deleted };
}

/** Opens the reader's Account from the Безпека list. */
async function openFromList() {
  const user = userEvent.setup();
  render(<Admin />);
  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));
  await user.click(await block.findByRole('link', { name: EMAIL }));
  return within(await screen.findByRole('region', { name: 'Акаунт читача' }));
}

test("a Власник opens a reader's Account from the list and reads its records per Edition, with no way to edit them", async () => {
  backend();
  const page = await openFromList();

  expect(window.location.pathname).toBe(`/admin/security/accounts/${ID}`);
  expect(page.getByRole('heading', { name: EMAIL })).toBeDefined();
  expect(page.getByText('Входи: Код з листа, Google')).toBeDefined();
  const edition = within(page.getByRole('region', { name: 'Видання uk' }));
  const facts = (name: string) => within(edition.getByRole('region', { name })).getByRole('list');
  expect(within(facts('Обране')).getByText(/w_a1/)).toBeDefined();
  expect(within(facts('Добірки')).getByText('Для подорожі · 2 слова: w_a1, w_e5')).toBeDefined();
  expect(within(facts('Приховані')).getByText(/w_c3/)).toBeDefined();
  expect(within(facts('Знаю')).getByText(/w_b2/)).toBeDefined();
  expect(within(facts('Не знаю')).getByText(/w_d4/)).toBeDefined();
  const progress = within(facts('Прогрес'));
  // 15 + 5 XP; the 7 XP before the reset marker of «Скинути прогрес» count no more.
  expect(progress.getByText('XP: 20')).toBeDefined();
  expect(progress.getByText('Денна ціль: 25 слів')).toBeDefined();
  expect(progress.getByText('Заморозки використано: 1')).toBeDefined();
  expect(progress.getByText(/Перерва з 2026-11-05 · 3 дн\./)).toBeDefined();
  expect(progress.getByText(/Відзнака streak-7 · 2026-11-02/)).toBeDefined();
  expect(within(facts('Налаштування')).getByText('theme: "dark"')).toBeDefined();
  expect(within(facts('Інші записи')).getByText('history: 1')).toBeDefined();
  expect(page.queryAllByRole('textbox')).toEqual([]);
  expect(page.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Видалити акаунт',
  ]);
});

test('an Account with no Sync records says so', async () => {
  backend();
  server.use(
    http.get('*/admin/accounts/:accountId', () =>
      HttpResponse.json({ account: { ...FIXTURES.getAccount.account, editions: [] } }),
    ),
  );
  const page = await openFromList();

  expect(page.getByText('Немає даних синхронізації.')).toBeDefined();
  expect(page.queryByRole('region', { name: /Видання/ })).toBeNull();
});

test('a Власник deletes the Account from its page with a reason, and it leaves the list', async () => {
  const { deleted } = backend();
  const user = userEvent.setup();
  const page = await openFromList();

  await user.click(page.getByRole('button', { name: 'Видалити акаунт' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText('небезпечна дія')).toBeDefined();
  const confirm = dialog.getByRole('button', { name: 'Видалити акаунт' });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), 'test Account');
  await user.click(confirm);

  const block = within(await screen.findByRole('region', { name: 'Акаунти читачів' }));
  expect(deleted).toEqual([{ email: EMAIL, reason: 'test Account' }]);
  expect(window.location.pathname).toBe('/admin/security');
  await waitFor(() => {
    expect(block.queryByRole('row', { name: new RegExp(EMAIL) })).toBeNull();
  });
});

test('an Account no longer there says so', async () => {
  backend();
  server.use(http.get('*/admin/accounts/:accountId', () => HttpResponse.json({ account: null })));
  window.history.replaceState(null, '', `/admin/security/accounts/${ID}`);
  render(<Admin />);

  expect(await screen.findByText('Цього акаунта немає: його видалено.')).toBeDefined();
});

/** An XP log record of the Account under its id. */
const xpRecord = (id: string, value: Record<string, unknown>) => ({
  key: `xp.${id}`,
  value,
  changedAt: 1,
});

test('the Account page folds the XP log as the Core does: only the records after the latest reset marker by instant, in any order', async () => {
  backend();
  const at = (day: string) => ({ date: `2026-11-${day}`, at: `2026-11-${day}T10:00:00.000Z` });
  const records = [
    // The latest reset marker by instant comes first in the server's order.
    xpRecord('r2', { kind: 'reset', ...at('05') }),
    xpRecord('x1', { kind: 'xp', ...at('01'), amount: 9 }),
    xpRecord('r1', { kind: 'reset', ...at('02') }),
    xpRecord('g1', { kind: 'word-goal', ...at('03'), goal: 25 }),
    xpRecord('f1', { kind: 'freeze', ...at('03') }),
    xpRecord('b1', { kind: 'break', ...at('03'), days: 2 }),
    xpRecord('bd1', { kind: 'badge', ...at('03'), badge: 'streak-7' }),
    xpRecord('x2', { kind: 'xp', ...at('06'), amount: 4 }),
    xpRecord('x3', { kind: 'xp', ...at('04'), amount: 6 }),
    xpRecord('f2', { kind: 'freeze', ...at('07') }),
    xpRecord('dg', { kind: 'daily-goal', ...at('06'), goal: 50 }),
    xpRecord('gm', { kind: 'goal-met', ...at('06') }),
    xpRecord('bo', { kind: 'badge-opened', ...at('06'), badge: 'streak-7' }),
    xpRecord('wa', { kind: 'wrong-answer', ...at('06'), mode: 'quiz' }),
  ];
  server.use(
    http.get('*/admin/accounts/:accountId', () =>
      HttpResponse.json({
        account: { ...FIXTURES.getAccount.account, editions: [{ editionId: 'uk', records }] },
      }),
    ),
  );
  const page = await openFromList();

  const edition = within(page.getByRole('region', { name: 'Видання uk' }));
  const progress = within(edition.getByRole('region', { name: 'Прогрес' }));
  expect(progress.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'XP: 4',
    'Заморозки використано: 1',
  ]);
  expect(edition.queryByRole('region', { name: 'Інші записи' })).toBeNull();
});
