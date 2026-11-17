import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { expect, test } from 'vitest';

import { periodDays } from './filters';
import { server } from './mock/server';
import { Admin } from './router';

async function openAnalytics() {
  const user = userEvent.setup();
  render(<Admin />);
  const sections = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Аналітика' }));
  const section = await screen.findByRole('region', { name: 'Аналітика' });
  await within(section).findByText('Останні дані за 13:58');
  return { user, section: within(section) };
}

test('Аналітика draws the fixtures, the Counters and the Variant result, with the same texts in both themes', async () => {
  const { user, section } = await openAnalytics();

  const active = within(section.getByRole('figure', { name: 'Активні за днями' }));
  expect(active.getByText('07.11')).toBeDefined();
  expect(active.getByText('135')).toBeDefined();
  expect(section.getByText('Медіана відвідин: 4 хв 5 с')).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Пристрої' })).getByText('iPhone 15'),
  ).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Версії застосунку' })).getByText('1.0.0'),
  ).toBeDefined();
  expect(
    within(section.getByRole('figure', { name: 'Країни' })).getByText('Немає даних'),
  ).toBeDefined();

  const marks = within(section.getByRole('list', { name: 'Позначки читачів' }));
  expect(marks.getAllByRole('listitem').map(({ textContent }) => textContent)).toEqual([
    'Натиснули «Знаю»1200 · 78 % позначок',
    'Натиснули «Не знаю»340 · 22 % позначок',
    'Додали в Улюблене95',
  ]);

  const variants = within(await section.findByRole('figure', { name: 'Варіанти gameTimed' }));
  expect(variants.getByText('a')).toBeDefined();
  expect(variants.getByText('61')).toBeDefined();

  const light = screen.getByRole('region', { name: 'Аналітика' }).textContent;
  await user.click(screen.getByRole('button', { name: 'owner@example.com Власник' }));
  await user.click(screen.getByRole('button', { name: 'Темна' }));
  expect(document.documentElement.dataset['theme']).toBe('dark');
  expect(screen.getByRole('region', { name: 'Аналітика' }).textContent).toBe(light);
});

test('Аналітика says PostHog is down when its read fails', async () => {
  server.use(
    http.get('*/admin/editions/:editionId/analytics', () =>
      HttpResponse.json(
        {
          defined: true,
          code: 'ANALYTICS_UNAVAILABLE',
          status: 503,
          message: 'PostHog недоступний',
        },
        { status: 503 },
      ),
    ),
  );
  const user = userEvent.setup();
  render(<Admin />);
  const sections = within(await screen.findByRole('navigation', { name: 'Розділи' }));
  await user.click(sections.getByRole('link', { name: 'Аналітика' }));

  expect(await screen.findByText('PostHog недоступний')).toBeDefined();
});

test('Аналітика counts the readers, each number with the one line saying what it counts', async () => {
  const requests: string[] = [];
  server.events.on('request:start', ({ request }) => {
    requests.push(decodeURIComponent(request.url));
  });
  const { section } = await openAnalytics();
  const readers = within(await section.findByRole('list', { name: 'Читачі' }));

  expect(readers.getAllByRole('listitem').map(({ textContent }) => textContent)).toEqual([
    'Зареєстровані312Читачі з SLOVO ID. Фільтр видання на це число не діє: тут усі SLOVO ID.',
    'Без реєстрації, щонайменшещонайменше 845Активні за останній день у PostHog мінус зареєстровані. Оцінка знизу: PostHog бачить лише тих, хто ділиться статистикою.',
    'Вимкнули статистику27Скільки разів «Ділитися анонімною статистикою» вимкнули за період. Кожне вимкнення окремо, а не скільки читачів мають її вимкненою зараз.',
    'Із синхронізацією198SLOVO ID із записами синхронізації у вибраних виданнях: це число йде за фільтром видання.',
  ]);
  expect(requests.some((url) => /\/admin\/editions\/all\/reader-counts\?.*from=/.test(url))).toBe(
    true,
  );
  server.events.removeAllListeners();
});

test('the unregistered estimate says PostHog is down, and the other counts stay', async () => {
  server.use(
    http.get('*/admin/editions/:editionId/reader-counts', () =>
      HttpResponse.json({
        registered: 312,
        unregisteredAtLeast: null,
        statisticsOff: 27,
        syncing: 198,
      }),
    ),
  );
  const { section } = await openAnalytics();
  const readers = within(await section.findByRole('list', { name: 'Читачі' }));
  const [registered, unregistered, switchOffs, syncing] = readers.getAllByRole('listitem');

  expect(registered?.textContent).toContain('312');
  expect(unregistered?.textContent).toContain('PostHog недоступний');
  expect(unregistered?.textContent).not.toContain('щонайменше 0');
  expect(switchOffs?.textContent).toContain('27');
  expect(syncing?.textContent).toContain('198');
});

test('the reader counts say they are unavailable when their read fails', async () => {
  server.use(
    http.get('*/admin/editions/:editionId/reader-counts', () =>
      HttpResponse.json({ message: 'down' }, { status: 500 }),
    ),
  );
  const { section } = await openAnalytics();

  expect(await section.findByText('Кількість читачів недоступна')).toBeDefined();
  expect(section.queryByRole('list', { name: 'Читачі' })).toBeNull();
});

test('a period reads its days up to today, in Kyiv', () => {
  const now = new Date('2026-11-08T23:30:00.000Z');
  expect(periodDays('7d', now)).toEqual({ from: '2026-11-03', to: '2026-11-09' });
  expect(periodDays('1d', now)).toEqual({ from: '2026-11-09', to: '2026-11-09' });
});

test('the questionnaire answers come grouped per question, in Ukrainian, with counts and shares', async () => {
  const { section } = await openAnalytics();
  const answersOf = async (question: string) =>
    within(await section.findByRole('figure', { name: question }))
      .getAllByRole('listitem')
      .map(({ textContent }) => textContent);

  expect(await answersOf('«Як добре ти знаєш мову?»')).toEqual([
    'Добре12 · 71 %',
    'Не знаю4 · 24 %',
    'expert1 · 6 %',
  ]);
  expect(section.getByText('Відповіли 17 разів')).toBeDefined();
  expect(await answersOf('«Навіщо тобі рідкісні слова?»')).toEqual(['Грати зі словами5 · 100 %']);
  expect(await answersOf('«Скільки слів на день?»')).toEqual([
    '10 слів на день6 · 75 %',
    'Без цілі (крок пропущено)2 · 25 %',
  ]);
  expect(await answersOf('«Коли нагадати?»')).toEqual([
    'Зранку, 09:003 · 75 %',
    'Без нагадувань1 · 25 %',
  ]);
  expect(await answersOf('«Хто ви?» (старі версії застосунку)')).toEqual(['student2 · 100 %']);
});

test('the top Words of each mark come as the Lemma and its readers, the most first, and say so when none is marked', async () => {
  const { section } = await openAnalytics();
  const topOf = (label: string) =>
    within(section.getByRole('list', { name: label }))
      .getAllByRole('listitem')
      .map(({ textContent }) => textContent);

  expect(topOf('Найчастіше «Не знаю»')).toEqual(['1. обручик41', '2. жмут17']);
  expect(topOf('Найчастіше «Знаю»')).toEqual(['1. весна300']);
  expect(section.getByRole('figure', { name: 'Найчастіше в Улюбленому' }).textContent).toContain(
    'Ще ніхто не додав',
  );
});
