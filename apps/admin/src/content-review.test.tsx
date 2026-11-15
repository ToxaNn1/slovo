import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { FIXTURES, WORD_FIELDS } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/content/review?edition=uk');
});

const word = (id: string, lemma: string, primaryDefinition: string) => ({
  id,
  fields: { ...WORD_FIELDS, id, lemma, primaryDefinition },
  recordVersion: 2,
});

/**
 * The backend's records not checked yet, in order: a check or a retire takes
 * one out; the bodies of every check and retire, in turn.
 */
function unchecked(...records: ReturnType<typeof word>[]) {
  const left = [...records];
  const checks: unknown[] = [];
  const retires: unknown[] = [];
  const edits: unknown[] = [];
  const take = (id: string | readonly string[] | undefined) => {
    const at = left.findIndex((record) => record.id === id);
    if (at >= 0) left.splice(at, 1);
  };
  server.use(
    http.get('*/admin/content/:editionId/unchecked/:kind', () =>
      HttpResponse.json({ total: left.length, ...(left[0] ? { record: left[0] } : {}) }),
    ),
    http.post('*/admin/content/:editionId/records/:kind/:id/check', async ({ request, params }) => {
      checks.push(await request.json());
      take(params['id']);
      return HttpResponse.json({ id: params['id'], recordVersion: 2 });
    }),
    http.post(
      '*/admin/content/:editionId/records/:kind/:id/retire',
      async ({ request, params }) => {
        retires.push(await request.json());
        take(params['id']);
        return HttpResponse.json(FIXTURES.content.retire);
      },
    ),
    http.put('*/admin/content/:editionId/records/:kind/:id', async ({ request, params }) => {
      edits.push(await request.json());
      return HttpResponse.json({ ...FIXTURES.content.edit, id: params['id'], recordVersion: 3 });
    }),
  );
  return { checks, retires, edits };
}

const card = () => screen.findByRole('article', { name: 'Запис на перегляді' });

test('shows the next unchecked record as a card to read, with no inputs, and «1 з 2»', async () => {
  unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  render(<Admin />);

  const shown = await card();
  expect(within(shown).getByText('обруч')).toBeTruthy();
  expect(within(shown).getByText('Зігнута кільцем смуга.')).toBeTruthy();
  expect(within(shown).queryByRole('textbox')).toBeNull();
  expect(screen.getByText('1 з 2')).toBeTruthy();
});

test('«Так» checks the record at its record version and shows the next, «2 з 2»', async () => {
  const { checks } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Так/ }));

  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(checks).toEqual([{ recordVersion: 2 }]);
  expect(screen.getByText('2 з 2')).toBeTruthy();
});

test('the key 1 checks, as «Так» does', async () => {
  const { checks } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.keyboard('1');

  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(checks).toHaveLength(1);
});

test('«Ні» retires the record with the reason typed, or with none, and shows the next', async () => {
  const { retires, checks } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
    word('w_a3', 'кобза', 'Народний інструмент.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Ні/ }));
  await user.type(screen.getByLabelText("Причина (необов'язково)"), 'Не рідкісне');
  await user.click(screen.getByRole('button', { name: 'Вивести з ужитку' }));
  expect(await within(await card()).findByText('жупан')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: /Ні/ }));
  await user.click(screen.getByRole('button', { name: 'Вивести з ужитку' }));
  expect(await within(await card()).findByText('кобза')).toBeTruthy();

  expect(retires).toHaveLength(2);
  expect(retires[0]).toMatchObject({ recordVersion: 2, reason: 'Не рідкісне' });
  expect(retires[1]).not.toHaveProperty('reason');
  expect(checks).toEqual([]);
});

test('«Редагувати» opens the record form; a save checks the record at its new version and shows the next', async () => {
  const { edits, checks } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Редагувати/ }));
  const lemma = await screen.findByLabelText('Лема');
  await user.clear(lemma);
  await user.type(lemma, 'обручик');
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));

  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(edits).toEqual([expect.objectContaining({ recordVersion: 2 })]);
  expect(edits[0]).toMatchObject({ fields: { lemma: 'обручик' } });
  await waitFor(() => {
    expect(checks).toEqual([{ recordVersion: 3 }]);
  });
});

test('says so when every record of the kind is checked', async () => {
  unchecked();
  render(<Admin />);

  expect(await screen.findByText('Усе переглянуто')).toBeTruthy();
});
