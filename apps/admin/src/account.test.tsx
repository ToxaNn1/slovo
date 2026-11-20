import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { ACCOUNT, FIXTURES } from './mock/fixtures';
import { override } from './mock/handlers';
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
    override('listAccounts', () => (gone ? { accounts: [], total: 0 } : FIXTURES.listAccounts)),
    override('getAccount', () => (gone ? { account: null } : FIXTURES.getAccount)),
    override('deleteAccount', async ({ params, request }) => {
      deleted.push({ email: params['email'], ...Object(await request.json()) });
      gone = true;
      return { deleted: true };
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
  expect(within(facts('Обране')).getByText('обруч')).toBeDefined();
  expect(
    within(facts('Добірки')).getByText('Для подорожі · 2 слова: обруч, w_e5 (немає в базі)'),
  ).toBeDefined();
  expect(within(facts('Приховані')).getByText('вир')).toBeDefined();
  expect(within(facts('Знаю')).getByText('обрій')).toBeDefined();
  expect(within(facts('Не знаю')).getByText('шпарка')).toBeDefined();
  const progress = within(facts('Прогрес'));
  // 15 + 5 XP; the 7 XP before the reset marker of «Скинути прогрес» count no more.
  expect(progress.getByText('XP: 20')).toBeDefined();
  expect(progress.getByText('Денна ціль: 25 слів')).toBeDefined();
  expect(progress.getByText('Заморозки використано: 1')).toBeDefined();
  expect(progress.getByText(/Перерва з 2026-11-05 · 3 дн\./)).toBeDefined();
  expect(await progress.findByText('Відзнака «Тиждень поспіль» · 2026-11-02')).toBeDefined();
  expect(within(facts('Налаштування')).getByText('Тема: Темна')).toBeDefined();
  expect(within(facts('Активність')).getByText('Переглянуті: 1 слово')).toBeDefined();
  expect(edition.queryByRole('region', { name: 'Інші записи' })).toBeNull();
  expect(page.queryAllByRole('textbox')).toEqual([]);
  expect(page.getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Видалити акаунт',
  ]);
});

test('an Account with no Sync records says so', async () => {
  backend();
  server.use(override('getAccount', () => ({ account: { ...ACCOUNT, editions: [] } })));
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
  server.use(override('getAccount', () => ({ account: null })));
  window.history.replaceState(null, '', `/admin/security/accounts/${ID}`);
  render(<Admin />);

  expect(await screen.findByText('Цього акаунта немає: його видалено.')).toBeDefined();
});

/** An XP log record of the Account under its id. */
/** A Sync record's value, as the contract types it. */
type RecordValue = (typeof ACCOUNT)['editions'][number]['records'][number]['value'];

const xpRecord = (id: string, value: RecordValue) => ({
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
    override('getAccount', () => ({
      account: {
        ...ACCOUNT,
        editions: [{ editionId: 'uk', records, entries: [] }],
      },
    })),
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

/** The Account's records in the UA Edition, every other part of the fixture kept. */
function withRecords(records: readonly { key: string; value: RecordValue }[]) {
  server.use(
    override('getAccount', () => ({
      account: {
        ...ACCOUNT,
        editions: [
          {
            editionId: 'uk',
            records: records.map((record, index) => ({ ...record, changedAt: index + 1 })),
            entries: [],
          },
        ],
      },
    })),
  );
}

/** The lines of a block of the UA Edition on the Account page. */
const linesOf = (page: Awaited<ReturnType<typeof openFromList>>, name: string) =>
  within(within(page.getByRole('region', { name: 'Видання uk' })).getByRole('region', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

test('the Account page names every setting and its value in Ukrainian, and one it does not know as it is kept', async () => {
  backend();
  withRecords([
    { key: 'settings.theme', value: 'system' },
    { key: 'settings.textSize', value: 'larger' },
    { key: 'settings.fontSize', value: 'L' },
    { key: 'settings.hideStreak', value: true },
    { key: 'settings.selfCheck', value: false },
    { key: 'settings.seasonalDecor', value: true },
    { key: 'settings.narratorVoice', value: 'taras' },
    { key: 'settings.rarityRange', value: { from: 1, to: 3 } },
    { key: 'settings.readerName', value: 'Оля' },
    { key: 'settings.theme2', value: 'dark' },
    { key: 'settings.selfCheck', value: 'yes' },
    { key: 'settings.fontSize', value: 'XXL' },
  ]);
  const page = await openFromList();

  await waitFor(() => {
    expect(linesOf(page, 'Налаштування')).toContain('Голос диктора: Тарас');
  });
  expect(linesOf(page, 'Налаштування')).toEqual([
    'Тема: Як у системі',
    'Шрифт і розмір: Більший',
    'Старий розмір шрифту: L',
    'Без лічильників: увімкнено',
    'Перевір себе: вимкнено',
    'Сезонний декор: увімкнено',
    'Голос диктора: Тарас',
    'Рідкість: від 1 до 3',
    'Ім’я: Оля',
    'theme2: "dark"',
    'selfCheck: "yes"',
    'fontSize: "XXL"',
  ]);
});

test('the Account page names the synced kinds it knows, the Best results after the latest reset marker, and counts only the rest under «Інші записи»', async () => {
  backend();
  const day = (date: string) => ({ date, at: `${date}T10:00:00.000Z` });
  withRecords([
    { key: 'history.w_a1', value: { seenAt: '2026-11-01T10:00:00.000Z', wordOfTheDay: false } },
    { key: 'history.w_b2', value: { seenAt: '2026-11-02T10:00:00.000Z', wordOfTheDay: true } },
    { key: 'activeDays.2026-10-02', value: true },
    { key: 'activeDays.2026-10-05', value: true },
    { key: 'activeDays.2026-10-03', value: true },
    { key: 'confirmed.w_a1', value: '2026-11-03T10:00:00.000Z' },
    { key: 'correctionsWorkedThrough.c_a1', value: true },
    { key: 'curatedCollections.opened.cc_a1', value: true },
    { key: 'xp.r1', value: { kind: 'reset', ...day('2026-11-04') } },
    { key: 'game.bestRight.stress', value: 9 },
    { key: 'game.bestRight.guess-word~r1', value: 12 },
    { key: 'game.bestRight.no-such-mode~r1', value: 3 },
    { key: 'game.best.guess-word~r1', value: 15 },
    { key: 'mix.categories.nature', value: true },
    { key: 'mix.categories.city', value: false },
  ]);
  const page = await openFromList();

  expect(linesOf(page, 'Активність')).toEqual([
    'Переглянуті: 2 слова',
    'Активні дні до 1.0: 3, останній 2026-10-05',
    'Підтверджені: 1 слово',
    'Розібрані виправлення: 1',
    'Відкриті добірки редакції: 1',
  ]);
  expect(linesOf(page, 'Найкраще в грі')).toEqual(['Гра «Вгадай слово»: 12', 'no-such-mode: 3']);
  // The Best results kept before, which counted Rounds passed, are not read.
  expect(linesOf(page, 'Інші записи')).toEqual(['game: 1', 'mix: 2']);
});
