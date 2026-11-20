import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES, QUEUE_BATCH as BATCH, QUEUE_REPORT as REPORT } from './mock/fixtures';
import { override, type Refusal, refusal } from './mock/handlers';
import { server } from './mock/server';
import { Admin } from './router';

const QUEUE = FIXTURES.contentQueue;

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/content/queue');
});

/** The writes the backend received: their path and body. */
function writes() {
  const received: { path: string; body: unknown }[] = [];
  const receive = async (request: Request) => {
    received.push({ path: new URL(request.url).pathname, body: await request.json() });
  };
  server.use(
    override('contentQueue.rollback', async ({ request }) => {
      await receive(request);
      return QUEUE.rollback;
    }),
    override('contentQueue.review', async ({ request }) => {
      await receive(request);
      return QUEUE.review;
    }),
    override('contentQueue.resolveFlag', async ({ request }) => {
      await receive(request);
      return QUEUE.resolveFlag;
    }),
    override('contentQueue.resolveReport', async ({ request }) => {
      await receive(request);
      return QUEUE.resolveReport;
    }),
  );
  return received;
}

async function confirmWith(reason: string, button: string) {
  const user = userEvent.setup();
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), reason);
  await user.click(dialog.getByRole('button', { name: button }));
}

test('an Агент batch reads its author and counts; its rollback says how many records it skipped', async () => {
  const received = writes();
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));

  expect(await batches.findByText(new RegExp(BATCH.author))).toBeDefined();
  expect(batches.getByText('+3 нових · 2 змінено')).toBeDefined();
  await user.click(batches.getByRole('button', { name: 'Відкотити пачку' }));
  await confirmWith('wrong stress', 'Відкотити пачку');

  expect(await batches.findByText('1 запис пропущено')).toBeDefined();
  expect(received).toEqual([
    {
      path: `/v1/admin/content-queue/batches/${BATCH.id}/rollback`,
      body: { reason: 'wrong stress' },
    },
  ]);
});

test('a batch marked reviewed and an accepted flag are written with their reason', async () => {
  const received = writes();
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));
  await user.click(await batches.findByRole('button', { name: 'Позначити перевіреним' }));
  await confirmWith('checked', 'Позначити перевіреним');

  const flags = within(screen.getByRole('region', { name: 'Прапорці' }));
  expect(await flags.findByText(/Цитату не знайдено/)).toBeDefined();
  await user.click(flags.getByRole('button', { name: 'Прийняти' }));
  await confirmWith('quote fixed', 'Прийняти');

  await screen.findByRole('region', { name: 'Прапорці' });
  expect(received).toEqual([
    { path: `/v1/admin/content-queue/batches/${BATCH.id}/review`, body: { reason: 'checked' } },
    {
      path: '/v1/admin/content-queue/flags/7',
      body: { decision: 'accept', reason: 'quote fixed' },
    },
  ]);
});

test('a Mistake Report reads its type and versions; «Вирішено» resolves it', async () => {
  const received = writes();
  const user = userEvent.setup();
  render(<Admin />);
  const reports = within(await screen.findByRole('region', { name: 'Помилки в записах' }));

  const report = within(await reports.findByRole('listitem'));
  expect(report.getByText(/наголос/)).toBeDefined();
  expect(report.getByText(/версія застосунку 0\.8\.0/)).toBeDefined();
  expect(report.getByText(/версія контенту 2/)).toBeDefined();
  expect(report.getByText(REPORT.comment)).toBeDefined();
  await user.click(report.getByRole('button', { name: 'Вирішено' }));
  await confirmWith('fixed in v3', 'Вирішено');

  await screen.findByRole('region', { name: 'Помилки в записах' });
  expect(received).toEqual([
    {
      path: `/v1/admin/content-queue/reports/${REPORT.id}/resolve`,
      body: { reason: 'fixed in v3' },
    },
  ]);
});

test('a Mistake Report opens the whole Entry it names and links the email of a signed-in reader', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const reports = within(await screen.findByRole('region', { name: 'Помилки в записах' }));
  const report = within(await reports.findByRole('listitem'));

  const email = report.getByRole('link', { name: 'reader@example.com' });
  expect(email.getAttribute('href')).toBe('mailto:reader@example.com');
  expect(report.queryByText('Лінія, де небо ніби сходиться з землею.')).toBeNull();
  await user.click(report.getByRole('button', { name: 'Показати запис w_b2' }));

  const entry = within(report.getByRole('article', { name: 'Запис w_b2' }));
  expect(entry.getByText('Лема')).toBeDefined();
  expect(entry.getByText('Лінія, де небо ніби сходиться з землею.')).toBeDefined();
});

test('an anonymous report names no reader; one whose Entry is gone says so', async () => {
  server.use(
    override('contentQueue.reports', () => ({
      reports: [{ ...REPORT, entry: null, accountEmail: null }],
    })),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const reports = within(await screen.findByRole('region', { name: 'Помилки в записах' }));
  const report = within(await reports.findByRole('listitem'));

  expect(report.getByText(/анонімно/)).toBeDefined();
  expect(report.queryByRole('link')).toBeNull();
  await user.click(report.getByRole('button', { name: 'Показати запис w_b2' }));
  expect(report.getByText('Запису з таким id у виданні немає.')).toBeDefined();
});

test('an empty queue reads «Усе перевірено»', async () => {
  server.use(
    override('contentQueue.batches', () => ({ batches: [] })),
    override('contentQueue.flags', () => ({ flags: [] })),
    override('contentQueue.reports', () => ({ reports: [] })),
  );
  render(<Admin />);

  expect(await screen.findByText('Усе перевірено')).toBeDefined();
  expect(screen.queryByRole('region', { name: 'Пачки Агентів' })).toBeNull();
});

test('the Контент link counts the open batches of the Edition filter', async () => {
  const asked: string[] = [];
  server.use(
    override('contentQueue.batches', ({ request }) => {
      asked.push(new URL(request.url).search);
      return QUEUE.batches;
    }),
  );
  window.history.replaceState(null, '', '/admin/?edition=uk');
  render(<Admin />);
  const nav = within(await screen.findByRole('navigation', { name: 'Розділи' }));

  expect(await nav.findByRole('link', { name: 'Контент 1' })).toBeDefined();
  expect(asked.some((search) => search.includes('uk'))).toBe(true);
});

test('a queue write keeps its confirmation open until it ends, and a refusal stays in it', async () => {
  let answer: (refused: Refusal) => void = () => undefined;
  const received: unknown[] = [];
  server.use(
    override('contentQueue.review', async ({ request }) => {
      received.push(await request.json());
      return new Promise<Refusal>((resolve) => {
        answer = resolve;
      });
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));

  await user.click(await batches.findByRole('button', { name: 'Позначити перевіреним' }));
  await confirmWith('checked', 'Позначити перевіреним');

  const dialog = within(screen.getByRole('dialog'));
  await waitFor(() => {
    expect(received).toHaveLength(1);
  });
  expect(dialog.getByRole('button', { name: 'Позначити перевіреним' })).toHaveProperty(
    'disabled',
    true,
  );
  answer(refusal(500, { code: 'INTERNAL_SERVER_ERROR', status: 500 }));

  expect(await dialog.findByRole('alert')).toBeDefined();
  expect(screen.getByRole('dialog')).toBeDefined();
});

test('a queue that fails to load says so', async () => {
  server.use(
    override('contentQueue.batches', () => refusal(502, {})),
    override('contentQueue.flags', () => refusal(502, {})),
    override('contentQueue.reports', () => refusal(502, {})),
  );
  render(<Admin />);

  expect(await screen.findByText('Не вдалося завантажити чергу.')).toBeDefined();
});

/** Three open batches, oldest first, as the queue lists them. */
const THREE = ['a', 'b', 'c'].map((letter, index) => ({
  ...BATCH,
  id: `00000000-0000-4000-8000-00000000000${String(index + 1)}`,
  author: `wave-${letter}`,
  createdAt: `2026-11-1${String(index + 1)}T08:00:00.000Z`,
}));

function threeBatches() {
  server.use(override('contentQueue.batches', () => ({ batches: THREE })));
}

test('«Вибрати всі» selects every batch and marks them all reviewed at one confirmation', async () => {
  threeBatches();
  const received = writes();
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));
  const markAll = await batches.findByRole('button', { name: 'Позначити перевіреними (0)' });
  expect(markAll).toHaveProperty('disabled', true);

  await user.click(batches.getByRole('checkbox', { name: 'Вибрати всі' }));
  await user.click(batches.getByRole('button', { name: 'Позначити перевіреними (3)' }));
  await confirmWith('rewritten 16.11', 'Позначити перевіреними');

  expect(await batches.findByText('Позначено перевіреними 3 пачки.')).toBeDefined();
  expect(received).toEqual(
    THREE.map((batch) => ({
      path: `/v1/admin/content-queue/batches/${batch.id}/review`,
      body: { reason: 'rewritten 16.11' },
    })),
  );
});

test('the batches ticked one by one roll back newest first and count what they skipped', async () => {
  threeBatches();
  const received = writes();
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));

  await user.click(await batches.findByRole('checkbox', { name: /wave-a/ }));
  await user.click(batches.getByRole('checkbox', { name: /wave-c/ }));
  expect(batches.getByRole('checkbox', { name: 'Вибрати всі' })).toHaveProperty(
    'indeterminate',
    true,
  );
  await user.click(batches.getByRole('button', { name: 'Відкотити (2)' }));
  await confirmWith('bad wave', 'Відкотити');

  expect((await batches.findByText(/Відкочено 2 пачки/)).textContent).toBe(
    'Відкочено 2 пачки. 2 записи пропущено',
  );
  expect(received.map((write) => write.path)).toEqual([
    `/v1/admin/content-queue/batches/${THREE[2]?.id ?? ''}/rollback`,
    `/v1/admin/content-queue/batches/${THREE[0]?.id ?? ''}/rollback`,
  ]);
});

test('a second click on «Вибрати всі» clears the selection', async () => {
  threeBatches();
  const user = userEvent.setup();
  render(<Admin />);
  const batches = within(await screen.findByRole('region', { name: 'Пачки Агентів' }));
  const all = await batches.findByRole('checkbox', { name: 'Вибрати всі' });

  await user.click(all);
  await user.click(all);

  expect(batches.getByRole('button', { name: 'Відкотити (0)' })).toHaveProperty('disabled', true);
  expect(batches.queryAllByRole('checkbox', { checked: true })).toHaveLength(0);
});
