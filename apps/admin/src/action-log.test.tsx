import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { server } from './mock/server';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/security');
});

const BY = { kind: 'admin-user', email: 'owner@example.com' } as const;

/** One row of the Action log as the backend answers it. */
const row = (what: string, before: unknown, after: unknown, reason: string | null = null) => ({
  at: '2026-11-16T10:00:00.000Z',
  who: BY,
  what,
  before,
  after,
  reason,
  editionId: 'uk',
});

/** The Action log answering these rows; its table rows, each as [Що, Було, Стало]. */
async function logOf(...rows: readonly ReturnType<typeof row>[]) {
  server.use(
    http.get('*/admin/actions', () => HttpResponse.json({ actions: rows, total: rows.length })),
  );
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
      { platform: 'ios', minimum: undefined },
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
    http.get('*/admin/actions', ({ request }) => {
      const url = new URL(request.url);
      asked.push(url.search);
      const page = url.searchParams.get('page') ?? '1';
      const at = page === '1' ? '2026-11-16T10:00:00.000Z' : '2026-11-15T10:00:00.000Z';
      return HttpResponse.json({
        actions: [{ ...row('content.crosswordDay.check', null, null, `row-of-page-${page}`), at }],
        total: 53,
      });
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
