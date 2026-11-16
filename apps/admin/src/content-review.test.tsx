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
    http.get('*/admin/content/:editionId/unchecked/:kind', ({ request }) => {
      const next = left[Number(new URL(request.url).searchParams.get('skip') ?? 0)];
      return HttpResponse.json({ total: left.length, ...(next ? { record: next } : {}) });
    }),
    http.get('*/admin/content/:editionId/records/:kind/:id', ({ params }) => {
      const found = records.find((record) => record.id === params['id']);
      return HttpResponse.json({
        fields: found?.fields ?? {},
        recordVersion: found?.recordVersion ?? 1,
        retired: false,
      });
    }),
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

test('the card reads a choice by its label and the stress in the word', async () => {
  unchecked(word('w_a1', 'обруч', 'Зігнута кільцем смуга.'));
  render(<Admin />);

  const shown = await card();
  expect(within(shown).getByText('іменник')).toBeTruthy();
  expect(within(shown).getByText('чоловічий')).toBeTruthy();
  expect(within(shown).getByText('обру́ч')).toBeTruthy();
});

test('«Редагувати» puts the record form in the place of the card', async () => {
  unchecked(word('w_a1', 'обруч', 'Зігнута кільцем смуга.'));
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Редагувати/ }));

  expect(await screen.findByLabelText('Лема')).toBeTruthy();
  expect(screen.queryByRole('article', { name: 'Запис на перегляді' })).toBeNull();
});

test('«Назад» shows the record just checked again, and «Далі» returns to the queue', async () => {
  unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();
  expect(screen.getByRole('button', { name: '← Назад' })).toHaveProperty('disabled', true);

  await user.click(screen.getByRole('button', { name: /Так/ }));
  expect(await within(await card()).findByText('жупан')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: '← Назад' }));
  expect(await within(await card()).findByText('обруч')).toBeTruthy();
  expect(await screen.findByText('Уже переглянуто: перевірено')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Так/ })).toBeNull();

  await user.keyboard('{ArrowRight}');
  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(screen.getByText('2 з 2')).toBeTruthy();
});

test('a record retired here comes back into use from «Назад»', async () => {
  unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const rollbacks: unknown[] = [];
  server.use(
    http.get('*/admin/content/:editionId/records/:kind/:id', () =>
      HttpResponse.json({ ...FIXTURES.content.record, retired: rollbacks.length === 0 }),
    ),
    http.post('*/admin/content-queue/batches/:batchId/rollback', async ({ request, params }) => {
      const body: unknown = await request.json();
      rollbacks.push({ batchId: params['batchId'], body });
      return HttpResponse.json(FIXTURES.contentQueue.rollback);
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Ні/ }));
  await user.click(screen.getByRole('button', { name: 'Вивести з ужитку' }));
  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  await user.keyboard('{ArrowLeft}');
  expect(await screen.findByText('Уже переглянуто: виведено з ужитку')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Повернути в ужиток' }));

  await waitFor(() => {
    expect(rollbacks).toEqual([
      { batchId: FIXTURES.content.openBatch.batchId, body: { reason: 'Повернуто з перегляду' } },
    ]);
  });
  expect(await screen.findByText('Уже переглянуто: повернуто в ужиток')).toBeTruthy();
});

test('«Далі» (key 4) moves on to the next card with no answer: nothing checked or retired, «2 з 2»', async () => {
  const { checks, retires, edits } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();

  await user.click(screen.getByRole('button', { name: /Далі/ }));
  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(screen.getByText('2 з 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Далі/ })).toHaveProperty('disabled', true);

  await user.keyboard('{ArrowLeft}');
  expect(await within(await card()).findByText('обруч')).toBeTruthy();
  await user.keyboard('4');
  expect(await within(await card()).findByText('жупан')).toBeTruthy();

  expect([checks, retires, edits]).toEqual([[], [], []]);
});

test('a record passed by is answered later from «Назад» with «Так», then the queue goes on', async () => {
  const { checks } = unchecked(
    word('w_a1', 'обруч', 'Зігнута кільцем смуга.'),
    word('w_a2', 'жупан', 'Старовинний одяг.'),
    word('w_a3', 'кобза', 'Народний інструмент.'),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await card();
  await user.keyboard('4');
  expect(await within(await card()).findByText('жупан')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: '← Назад' }));
  expect(await within(await card()).findByText('обруч')).toBeTruthy();
  expect(screen.getByText('Не переглянуто')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Так/ }));

  expect(await within(await card()).findByText('жупан')).toBeTruthy();
  expect(checks).toEqual([{ recordVersion: 2 }]);
  expect(screen.getByText('2 з 3')).toBeTruthy();
});

test('the card names the Category as the app does, by its display name', async () => {
  unchecked(word('w_a1', 'обруч', 'Зігнута кільцем смуга.'));
  server.use(
    http.get('*/admin/editions/:editionId', () =>
      HttpResponse.json({
        ...FIXTURES.editionCard,
        categories: [
          { id: 'old-crafts', displayName: 'Старі ремесла', description: 'Ремесла.', tone: 'loud' },
        ],
      }),
    ),
  );
  render(<Admin />);

  const shown = await card();
  expect(await within(shown).findByText('Старі ремесла')).toBeTruthy();
  expect(within(shown).queryByText('old-crafts')).toBeNull();
});
