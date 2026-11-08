import { FeatureSwitchesSchema, type Rule } from '@slovo/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

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

/** Every feature on, `mistakeReports` unavailable everywhere, `game` off in `de`. */
function statesOf(editionId: string) {
  return FeatureSwitchesSchema.parse({
    ...Object.fromEntries(FeatureSwitchesSchema.keyof().options.map((feature) => [feature, 'on'])),
    mistakeReports: 'unavailable',
    game: editionId === 'de' ? 'off' : 'on',
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

test('the Kill switch asks for a reason and the matrix shows the feature off after it', async () => {
  const { writes } = threeEditions();
  const user = userEvent.setup();
  window.history.replaceState(null, '', '/admin/switches');
  render(<Admin />);
  expect((await rowOf('tips')).getByText('увімкнено')).toBeDefined();

  const kill = within(screen.getByRole('region', { name: 'Kill switch' }));
  await user.selectOptions(kill.getByRole('combobox', { name: 'Світч' }), 'tips');
  await user.click(kill.getByRole('button', { name: 'Вимкнути для всіх' }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByRole('button', { name: 'Підтвердити' })).toHaveProperty('disabled', true);
  await user.type(dialog.getByRole('textbox', { name: 'Причина' }), 'tips crash the app');
  await user.click(dialog.getByRole('button', { name: 'Підтвердити' }));

  expect(await (await rowOf('tips')).findByText('вимкнено')).toBeDefined();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(writes).toEqual([{ reason: 'tips crash the app' }]);
});
