import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { override } from './mock/handlers';
import { server } from './mock/server';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/security');
});

const BY = { kind: 'admin-user', email: 'owner@example.com' } as const;

type Action = AdminApiOutputs['actions']['actions'][number];

/** One row of the Action log as the backend answers it. */
const row = (
  what: string,
  before: Action['before'],
  after: Action['after'],
  reason: string | null = null,
): Action => ({
  at: '2026-11-16T10:00:00.000Z',
  who: BY,
  what,
  before,
  after,
  reason,
  editionId: 'uk',
});

/** The Action log answering these rows; its table rows, each as [Що, Було, Стало]. */
async function logOf(...rows: readonly Action[]) {
  server.use(override('actions', () => ({ actions: [...rows], total: rows.length })));
  render(<Admin />);
  const log = within(await screen.findByRole('region', { name: 'Журнал дій' }));
  await log.findAllByText('owner@example.com');
  return log
    .getAllByRole('row')
    .slice(1)
    .map((tableRow) => {
      const cells = within(tableRow).getAllByRole('cell');
      return [cells[2], cells[3], cells[4]].map((cell) => cell?.textContent ?? '');
    });
}

test('a content check reads as a sentence, and its record by its date and version', async () => {
  const rows = await logOf(
    row('content.crosswordDay.check', null, { id: '2027-12-18', recordVersion: 1 }),
    row('content.idiom.check', null, { id: 'idiom-bity-baidyky', recordVersion: 3 }),
  );

  expect(rows).toEqual([
    ['Кросворд дня позначено перевіреним', '—', 'Кросворд на 18.12.2027 · версія 1'],
    ['Ідіому позначено перевіреною', '—', 'Запис idiom-bity-baidyky · версія 3'],
  ]);
});

test('an edit lists only the fields it changed, by their Ukrainian names, old → new', async () => {
  const fields = { lemma: 'жаль', rarity: 3, registers: ['archaic'] };
  const [edit] = await logOf(
    row(
      'content.word.edit',
      { recordVersion: 3, fields: { ...fields, primaryDefinition: 'Старе тлумачення' } },
      {
        recordVersion: 4,
        fields: { ...fields, primaryDefinition: 'Нове тлумачення', registers: ['dialectal'] },
      },
    ),
  );

  expect(edit).toEqual([
    'Слово змінено',
    'версія 3 · «жаль»',
    'версія 4 · Основне тлумачення: Старе тлумачення → Нове тлумачення · Регістри: застаріле → діалектне',
  ]);
});

test('a new record and a Retired one name the record by its main field', async () => {
  const rows = await logOf(
    row('content.idiom.create', null, {
      recordVersion: 1,
      fields: { expression: 'бити байдики', primaryDefinition: 'ледарювати' },
    }),
    row(
      'content.word.retire',
      { recordVersion: 2, fields: { lemma: 'жаль' } },
      { recordVersion: 3, fields: { lemma: 'жаль', retired: true } },
    ),
  );

  expect(rows).toEqual([
    ['Ідіому додано', '—', 'версія 1 · «бити байдики»'],
    ['Слово виведено', 'версія 2 · «жаль»', 'версія 3 · «жаль»'],
  ]);
});

test('a Word sent to every Narrator Voice reads as a sentence with its id (ADR 0195)', async () => {
  const rows = await logOf(row('content.word.allVoices', null, { id: 'w_abc123' }));

  expect(rows).toEqual([['Слово передано на запис у всіх голосах', '—', 'Запис w_abc123']]);
});

test('a Curated Collection retired and brought back reads as any record, by its name', async () => {
  const before = { name: 'Слова зими', retired: false };
  const rows = await logOf(
    row(
      'content.curatedCollection.retire',
      { recordVersion: 1, fields: before },
      { recordVersion: 2, fields: { ...before, retired: true } },
    ),
    row(
      'content.curatedCollection.edit',
      { recordVersion: 2, fields: { ...before, retired: true } },
      { recordVersion: 3, fields: before },
    ),
  );

  expect(rows).toEqual([
    ['Добірку виведено', 'версія 1 · «Слова зими»', 'версія 2 · «Слова зими»'],
    ['Добірку змінено', 'версія 2 · «Слова зими»', 'версія 3 · retired: так → ні'],
  ]);
});

test('switches, people, thresholds and the Content queue read in Ukrainian', async () => {
  const rule = { editionId: 'uk', feature: 'game', order: 0, targets: {} };
  const rows = await logOf(
    row(
      'switches.kill',
      [{ ...rule, id: 'r1', verdict: 'on' }],
      [{ ...rule, id: 'kill', verdict: 'off' }],
    ),
    row(
      'switches.minimum.set',
      { platform: 'ios' },
      {
        platform: 'ios',
        minimum: { soft: '1.2.0', hard: '1.0.0' },
      },
    ),
    row(
      'admin.user.role',
      { email: 'editor@example.com', role: 'admin' },
      { email: 'editor@example.com', role: 'owner' },
    ),
    row('alert-threshold.set', { key: 'crashFree', value: 99 }, { key: 'crashFree', value: 98.5 }),
    row(
      'content.batch.rollback',
      { batchId: 'b1' },
      { retired: ['a'], restored: [], skipped: ['b', 'c'] },
    ),
    row('content.flag.accept', { flagId: 7 }, null),
    row(
      'account.delete',
      { email: 'reader@example.com', createdAt: '2026-10-01T09:00:00.000Z' },
      null,
    ),
  );

  expect(rows).toEqual([
    ['Функцію вимкнено для всіх (аварійно)', 'Ігри: увімкнено для всіх', 'Ігри: вимкнено для всіх'],
    [
      'Змінено мінімальну версію застосунку',
      'iOS: не задано',
      'iOS: просити оновити нижче 1.2.0, не пускати нижче 1.0.0',
    ],
    ['Змінено роль', 'editor@example.com · Адмін', 'editor@example.com · Власник'],
    ['Змінено поріг сповіщення', 'Сесії без падінь, %: 99', 'Сесії без падінь, %: 98,5'],
    ['Пачку відкочено', '—', 'виведено: 1 · повернуто: 0 · пропущено: 2'],
    ['Позначку прийнято', 'позначка №7', '—'],
    ['Обліковий запис читача видалено', 'reader@example.com, створено 01.10.2026', '—'],
  ]);
});

test('a key the admin does not know yet still reads, never as raw JSON', async () => {
  const [unknown] = await logOf(row('something.new', { a: [1, { b: 'два' }] }, 'текст'));

  expect(unknown).toEqual(['Інша дія: something.new', 'a: 1, b: два', 'текст']);
  expect(screen.getByRole('region', { name: 'Журнал дій' }).textContent).not.toContain('{"');
});

test('the log lists a page of rows, the total, and the next page of the Edition on Далі', async () => {
  window.history.replaceState(null, '', '/admin/security?edition=uk');
  const asked: string[] = [];
  server.use(
    override('actions', ({ request }) => {
      const url = new URL(request.url);
      asked.push(url.search);
      const page = url.searchParams.get('page') ?? '1';
      const at = page === '1' ? '2026-11-16T10:00:00.000Z' : '2026-11-15T10:00:00.000Z';
      return {
        actions: [{ ...row('content.crosswordDay.check', null, null, `row-of-page-${page}`), at }],
        total: 53,
      };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const log = within(await screen.findByRole('region', { name: 'Журнал дій' }));
  const pages = within(await log.findByRole('navigation', { name: 'Сторінки журналу' }));

  expect(pages.getByText('1–50 з 53')).toBeTruthy();
  expect(log.getByText('row-of-page-1')).toBeTruthy();

  await user.click(pages.getByRole('button', { name: 'Далі' }));

  expect(await log.findByText('row-of-page-2')).toBeTruthy();
  expect(pages.getByText('51–53 з 53')).toBeTruthy();
  expect(asked.at(-1)).toContain('page=2');
  expect(asked.at(-1)).toContain('editionId=uk');
});

test('the actions on Services and their entries read as sentences, never as «Інша дія»', async () => {
  const entry = (fields: readonly string[] = []) => ({
    service: 'Railway',
    entry: '0b8c1d6e-7a35-4f0e-9b1a-2c3d4e5f6a7b',
    type: 'token',
    fields: [...fields],
  });
  const rows = await logOf(
    row('service.add', null, {
      name: 'Sentry',
      kind: 'metered',
      plan: 'Team',
      monthlyPriceUsdCents: 2600,
      billingDay: 5,
    }),
    row(
      'service.money.edit',
      { name: 'Sentry', plan: 'Team', monthlyPriceUsdCents: 2600 },
      { name: 'Sentry', plan: 'Business', monthlyPriceUsdCents: 8000 },
    ),
    row('service.entry.add', null, entry(['type', 'label', 'note', 'value'])),
    row('service.entry.edit', null, entry(['label', 'value'])),
    row('service.entry.delete', null, entry()),
    row('service.entry.reveal', null, { service: 'Railway', entry: 'e-1', type: 'password' }),
    row('service.entry.copy', null, { service: 'Railway', entry: 'e-1', type: 'login' }),
  );

  expect(rows).toEqual([
    ['Додано сервіс', '—', 'Sentry · тариф Team · $26 на місяць · списання 5-го числа'],
    [
      'Змінено тариф і ціну сервісу',
      'Sentry · тариф Team · $26 на місяць',
      'Sentry · тариф Business · $80 на місяць',
    ],
    ['Додано запис сервісу', '—', 'Railway · Токен / API-ключ'],
    ['Змінено запис сервісу', '—', 'Railway · Токен / API-ключ · змінено: назва, значення'],
    ['Видалено запис сервісу', '—', 'Railway · Токен / API-ключ'],
    ['Показано значення запису сервісу', '—', 'Railway · Пароль'],
    ['Скопійовано значення запису сервісу', '—', 'Railway · Логін'],
  ]);
});
