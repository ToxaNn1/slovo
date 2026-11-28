import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';

import { FIXTURES } from './mock/fixtures';
import { override, refusal } from './mock/handlers';
import { server } from './mock/server';
import { Admin } from './router';

test('Якість shows each Sentry number with its change against yesterday and its freshness', async () => {
  window.history.replaceState(null, '', '/admin/quality');
  render(<Admin />);

  const crashFree = within(await screen.findByRole('listitem', { name: 'Сесії без збоїв' }));
  expect(crashFree.getByText('99,6%')).toBeDefined();
  expect(crashFree.getByText('+0,2 проти вчора')).toBeDefined();
  const crashFreeUsers = within(screen.getByRole('listitem', { name: 'Користувачі без збоїв' }));
  expect(crashFreeUsers.getByText('99,8%')).toBeDefined();
  expect(crashFreeUsers.getByText('+0,1 проти вчора')).toBeDefined();
  expect(
    within(screen.getByRole('listitem', { name: 'Збої' })).getByText('−2 проти вчора'),
  ).toBeDefined();
  expect(
    within(screen.getByRole('listitem', { name: 'Нові помилки' })).getByText('Нових помилок немає'),
  ).toBeDefined();
  // No tracing yet (ADR 0048): p95 and app start have no data.
  expect(
    within(screen.getByRole('listitem', { name: 'p95 бекенду' })).getByText('Немає даних'),
  ).toBeDefined();
  expect(
    within(screen.getByRole('listitem', { name: 'Запуск застосунку' })).getByText('Немає даних'),
  ).toBeDefined();
  // 10:00 UTC is 12:00 in Kyiv.
  expect(screen.getByText('Останні дані за 8 лист. 2026 р., 12:00')).toBeDefined();
});

test('Якість charts the coverage, the flaky tests and the CI durations of the period', async () => {
  window.history.replaceState(null, '', '/admin/quality');
  render(<Admin />);

  const coverage = within(await screen.findByRole('figure', { name: 'Покриття' }));
  expect(coverage.getByText('core · 92,5%')).toBeDefined();
  expect(coverage.getByText('backend · 78%')).toBeDefined();
  const flaky = within(screen.getByRole('figure', { name: 'Нестабільні тести' }));
  expect(flaky.getByText('sync › retries a lost write · 1')).toBeDefined();
  const durations = within(screen.getByRole('figure', { name: 'Тривалість CI' }));
  // The jobs run side by side: the bar is the wait, the runner time a note; a
  // run kept before the jobs carried their times has no bar.
  expect(durations.getAllByRole('listitem')).toHaveLength(1);
  expect(durations.getByText(/^c6f01b8 · .* · 4,2 хв · раннери 5,2 хв$/)).toBeDefined();
});

test('Якість shows a count of new issues Sentry has more of as «N+»', async () => {
  server.use(
    override('quality', () => ({
      ...FIXTURES.quality,
      kpis: {
        ...FIXTURES.quality.kpis,
        newIssues: {
          state: 'ok',
          value: 1000,
          yesterday: 40,
          atLeast: true,
          fetchedAt: '2026-11-08T10:00:00.000Z',
        },
      },
    })),
  );
  window.history.replaceState(null, '', '/admin/quality');
  render(<Admin />);

  const newIssues = within(await screen.findByRole('listitem', { name: 'Нові помилки' }));
  expect(newIssues.getByText('1 000+')).toBeDefined();
  // A floor has no honest change against yesterday.
  expect(newIssues.queryByText(/проти вчора/)).toBeNull();
});

test('Якість says which source is down: Sentry per number, GitHub for the CI history', async () => {
  server.use(
    override('quality', () => ({
      ...FIXTURES.quality,
      kpis: { ...FIXTURES.quality.kpis, errors: { state: 'unavailable' } },
    })),
    override('ciHistory', () => refusal(502, {})),
  );
  window.history.replaceState(null, '', '/admin/quality');
  render(<Admin />);

  expect(
    within(await screen.findByRole('listitem', { name: 'Помилки' })).getByText(
      'Sentry недоступний',
    ),
  ).toBeDefined();
  expect(await screen.findByText('GitHub недоступний')).toBeDefined();
  expect(screen.queryByRole('figure', { name: 'Покриття' })).toBeNull();
});

test('Якість with no CI run yet shows «Немає даних» in each chart', async () => {
  server.use(override('ciHistory', () => ({ runs: [] })));
  window.history.replaceState(null, '', '/admin/quality');
  render(<Admin />);

  for (const name of ['Покриття', 'Нестабільні тести', 'Тривалість CI'])
    expect(
      within(await screen.findByRole('figure', { name })).getByText('Немає даних'),
    ).toBeDefined();
});

test('on Якість 90 days reads as 30 days with a hint, and longer periods are off', async () => {
  const periods: (string | null)[] = [];
  server.use(
    override('quality', ({ request }) => {
      periods.push(new URL(request.url).searchParams.get('period'));
      return FIXTURES.quality;
    }),
  );
  window.history.replaceState(null, '', '/admin/quality?period=90d');
  render(<Admin />);

  await screen.findByRole('listitem', { name: 'Сесії без збоїв' });
  const period = within(screen.getByRole('group', { name: 'Період' }));
  expect(period.getByRole('button', { name: '30 днів' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Sentry зберігає дані 30 днів')).toBeDefined();
  expect(period.getByRole('button', { name: '90 днів' })).toHaveProperty('disabled', true);
  expect(periods).toEqual(['30d']);
});

test('another section keeps 90 days on offer', async () => {
  window.history.replaceState(null, '', '/admin/switches?period=90d');
  render(<Admin />);
  await screen.findByRole('region', { name: 'Свічі' });
  const period = within(screen.getByRole('group', { name: 'Період' }));
  expect(period.getByRole('button', { name: '90 днів' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('Sentry зберігає дані 30 днів')).toBeNull();
  expect(screen.queryByText('Фільтри тут не діють')).toBeNull();
  expect(screen.getByRole('combobox', { name: 'Edition' }).matches(':disabled')).toBe(false);
});
