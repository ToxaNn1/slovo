import { FeatureSwitchesSchema, type Rule } from '@slovo/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { server } from './mock/server';
import { Admin } from './router';

/** The admin API's refusal as the backend answers it. */
const refusal = (status: number, code: string, data?: object) =>
  HttpResponse.json({ defined: true, code, status, message: code, data }, { status });

const EDITIONS = [
  { id: 'uk', displayName: 'Рідкісні слова' },
  { id: 'pl', displayName: 'Rzadkie słowa' },
  { id: 'de', displayName: 'Seltene Wörter' },
];

/** Every feature on, `mistakeReports` unavailable everywhere, `game` off and `idioms` unavailable in `de`. */
function statesOf(editionId: string) {
  return FeatureSwitchesSchema.parse({
    ...Object.fromEntries(FeatureSwitchesSchema.keyof().options.map((feature) => [feature, 'on'])),
    mistakeReports: 'unavailable',
    game: editionId === 'de' ? 'off' : 'on',
    idioms: editionId === 'de' ? 'unavailable' : 'on',
  });
}

/** A backend over three Editions whose Rules a write replaces; the bodies of the writes, in order. */
function threeEditions() {
  const rules = new Map<string, Rule[]>(EDITIONS.map(({ id }) => [id, []]));
  const writes: unknown[] = [];
  const answer = (editionId: string) =>
    HttpResponse.json({
      states: statesOf(editionId),
      rules: rules.get(editionId) ?? [],
      minimums: {},
    });
  server.use(
    http.get('*/admin/editions', () => HttpResponse.json({ editions: EDITIONS })),
    http.get('*/admin/editions/:editionId/switches', ({ params }) =>
      answer(String(params['editionId'])),
    ),
    http.post('*/admin/switches/:feature/kill', async ({ params, request }) => {
      const body = await request.json();
      writes.push(body);
      const feature = String(params['feature']);
      for (const [editionId, kept] of rules) {
        rules.set(editionId, [
          { id: 'kill', editionId, feature, order: 0, verdict: 'off', targets: {} },
          ...kept.filter((rule) => rule.feature !== feature),
        ]);
      }
      return HttpResponse.json({ editionIds: EDITIONS.map(({ id }) => id) });
    }),
  );
  return { writes };
}

/** The row of the feature in the matrix. */
async function rowOf(feature: string) {
  const header = await screen.findByRole('rowheader', { name: feature });
  const row = header.closest('tr');
  if (row === null) throw new Error(`no row of ${feature}`);
  return within(row);
}

test('the matrix counts a feature on in some Editions, and shows the exact state of one', async () => {
  threeEditions();
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/admin/switches');
  render(<Admin />);

  expect((await rowOf('game')).getByText('увімкнено (2 з 3)')).toBeDefined();
  // On in every Edition that has it, though one Edition does not.
  expect((await rowOf('idioms')).getAllByText('увімкнено').length).toBeGreaterThan(0);
  expect((await rowOf('idioms')).queryByText(/з 3/)).toBeNull();
  expect((await rowOf('mistakeReports')).queryAllByRole('switch')).toEqual([]);
  expect((await rowOf('mistakeReports')).getAllByText('недоступно').length).toBeGreaterThan(0);

  const edition = screen.getByRole('combobox', { name: 'Edition' });
  await within(edition).findByRole('option', { name: 'Seltene Wörter' });
  await user.selectOptions(edition, 'Seltene Wörter');

  const game = await rowOf('game');
  expect(game.queryByText(/з 3/)).toBeNull();
  expect(game.getByText('вимкнено')).toBeDefined();
  expect(
    game.getByRole('switch', { name: 'game у Seltene Wörter' }).getAttribute('aria-checked'),
  ).toBe('false');
});

test('a switch change asks for a reason, and a refused Rule names the switch it depends on', async () => {
  threeEditions();
  const sent: unknown[] = [];
  server.use(
    http.put('*/admin/editions/:editionId/switches/:feature/rules', async ({ request }) => {
      sent.push(await request.json());
      return refusal(400, 'BAD_REQUEST', { refusal: 'dependency-off', feature: 'xpLog' });
    }),
  );
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/admin/switches?edition=uk');
  render(<Admin />);

  await user.click(
    (await rowOf('badges')).getByRole('switch', { name: 'badges у Рідкісні слова' }),
  );
  const dialog = within(await screen.findByRole('dialog'));
  const confirm = dialog.getByRole('button', { name: 'Підтвердити' });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByRole('textbox', { name: 'Причина' }), '   ');
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByRole('textbox', { name: 'Причина' }), 'badges go dark');
  expect(confirm).toHaveProperty('disabled', false);

  await user.click(confirm);
  expect(await dialog.findByText(/«xpLog»/)).toBeDefined();
  expect(sent).toMatchObject([
    { rules: [{ verdict: 'off', targets: {} }], reason: 'badges go dark' },
  ]);
});

/** Opens a tab of Свічі. */
async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  const tabs = within(await screen.findByRole('navigation', { name: 'Свічі' }));
  await user.click(tabs.getByRole('link', { name }));
}

/** Turns the feature off with the Аварійний вимикач tab, giving the reason. */
async function kill(user: ReturnType<typeof userEvent.setup>, feature: string, reason: string) {
  await openTab(user, 'Аварійний вимикач');
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${feature} `) }));
  const panel = within(screen.getByRole('region', { name: 'Аварійний вимикач' }));
  expect(panel.getByText(`Вимкнеться «${feature}» · усі Editions`)).toBeDefined();
  await user.click(panel.getByRole('button', { name: 'Вимкнути зараз' }));
  const dialog = within(await screen.findByRole('dialog'));
  const confirm = dialog.getByRole('button', { name: 'Вимкнути зараз' });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByRole('textbox', { name: 'Причина' }), reason);
  await user.click(confirm);
  await vi.waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
}

test('the Kill switch asks for a reason and the matrix shows the feature off after it', async () => {
  const { writes } = threeEditions();
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/admin/switches');
  render(<Admin />);
  expect((await rowOf('tips')).getAllByText('увімкнено')).not.toHaveLength(0);

  await kill(user, 'tips', 'tips crash the app');
  await openTab(user, 'Feature Switch');

  expect(await (await rowOf('tips')).findAllByText('вимкнено')).not.toHaveLength(0);
  expect(writes).toEqual([{ reason: 'tips crash the app' }]);
});

test('the Rule editor saves over a Kill switch written since it opened, never undoing it', async () => {
  threeEditions();
  const sent: unknown[] = [];
  server.use(
    http.put('*/admin/editions/:editionId/switches/:feature/rules', async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json({ editionId: 'uk' });
    }),
  );
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/admin/switches?edition=uk');
  render(<Admin />);

  await user.click((await rowOf('game')).getByRole('button', { name: 'Правила' }));
  const editor = 'Правила game у Рідкісні слова';
  expect(await screen.findByRole('region', { name: editor })).toBeDefined();

  await openTab(user, 'Аварійний вимикач');
  await user.click(screen.getByRole('button', { name: 'Усі Editions' }));
  await kill(user, 'game', 'game crashes');
  await user.click(screen.getByRole('button', { name: 'Рідкісні слова' }));
  await openTab(user, 'Правило');
  expect(screen.getByRole('combobox', { name: 'Світч' })).toHaveProperty('value', 'game');

  await user.click(
    within(await screen.findByRole('region', { name: editor })).getByRole('button', {
      name: 'Зберегти правила',
    }),
  );
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByRole('textbox', { name: 'Причина' }), 'reorder');
  await user.click(dialog.getByRole('button', { name: 'Підтвердити' }));

  await vi.waitFor(() => {
    expect(sent).toMatchObject([{ rules: [{ verdict: 'off', targets: {} }], reason: 'reorder' }]);
  });
});

test('while the Editions fail to load, the Kill switch stays off and the screen says so', async () => {
  server.use(http.get('*/admin/editions', () => HttpResponse.json({}, { status: 502 })));
  window.history.replaceState(null, '', '/admin/switches/kill');
  render(<Admin />);

  expect(await screen.findByText('Не вдалося завантажити свічі.')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Вимкнути зараз' })).toHaveProperty('disabled', true);
});
