import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES, QUEUE_BATCH as BATCH, QUEUE_REPORT as REPORT } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

const QUEUE = FIXTURES.contentQueue;

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/content/queue');
});

/** The writes the backend received: their path and body. */
function writes() {
  const received: { path: string; body: unknown }[] = [];
  server.use(
    http.post('*/admin/content-queue/*', async ({ request }) => {
      const path = new URL(request.url).pathname;
      received.push({ path, body: await request.json() });
      if (path.endsWith('/rollback')) return HttpResponse.json(QUEUE.rollback);
      if (path.endsWith('/review')) return HttpResponse.json(QUEUE.review);
      if (path.includes('/flags/')) return HttpResponse.json(QUEUE.resolveFlag);
      return HttpResponse.json(QUEUE.resolveReport);
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

test('an empty queue reads «Усе перевірено»', async () => {
  server.use(
    http.get('*/admin/content-queue/batches', () => HttpResponse.json({ batches: [] })),
    http.get('*/admin/content-queue/flags', () => HttpResponse.json({ flags: [] })),
    http.get('*/admin/content-queue/reports', () => HttpResponse.json({ reports: [] })),
  );
  render(<Admin />);

  expect(await screen.findByText('Усе перевірено')).toBeDefined();
  expect(screen.queryByRole('region', { name: 'Пачки Агентів' })).toBeNull();
});

test('the Контент link counts the open batches of the Edition filter', async () => {
  const asked: string[] = [];
  server.use(
    http.get('*/admin/content-queue/batches', ({ request }) => {
      asked.push(new URL(request.url).search);
      return HttpResponse.json(QUEUE.batches);
    }),
  );
  window.history.replaceState(null, '', '/admin/?edition=uk');
  render(<Admin />);
  const nav = within(await screen.findByRole('navigation', { name: 'Розділи' }));

  expect(await nav.findByRole('link', { name: 'Контент 1' })).toBeDefined();
  expect(asked.some((search) => search.includes('uk'))).toBe(true);
});

test('a queue write keeps its confirmation open until it ends, and a refusal stays in it', async () => {
  let answer: (response: Response) => void = () => undefined;
  const received: unknown[] = [];
  server.use(
    http.post('*/admin/content-queue/*', async ({ request }) => {
      received.push(await request.json());
      return new Promise<Response>((resolve) => {
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
  answer(HttpResponse.json({ code: 'INTERNAL_SERVER_ERROR', status: 500 }, { status: 500 }));

  expect(await dialog.findByRole('alert')).toBeDefined();
  expect(screen.getByRole('dialog')).toBeDefined();
});

test('a queue that fails to load says so', async () => {
  server.use(
    http.get('*/admin/content-queue/*', () => HttpResponse.json({}, { status: 502 })),
  );
  render(<Admin />);

  expect(await screen.findByText('Не вдалося завантажити чергу.')).toBeDefined();
});
