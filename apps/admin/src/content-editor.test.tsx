import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, test } from 'vitest';

import { CONTENT_KINDS } from './components/content-editor/kinds';
import { FIXTURES, WORD_FIELDS } from './mock/fixtures';
import { server } from './mock/server';
import { Admin } from './router';

const RECORD = '*/admin/content/:editionId/records/:kind/:id';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/content?edition=uk');
});

/** The edit requests' bodies, answered by `answer` in turn. */
function edits(...answers: (() => Response)[]) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.put(RECORD, async ({ request }) => {
      const body = await request.json();
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) bodies.push(body);
      const answer = answers[bodies.length - 1] ?? answers[answers.length - 1];
      return answer === undefined ? HttpResponse.json(FIXTURES.content.edit) : answer();
    }),
  );
  return bodies;
}

/** Opens the Word of the list in its editor. */
async function openWord() {
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('button', { name: 'обруч' }));
  await screen.findByLabelText('Лема');
  return user;
}

test('shows the Edition card read-only, and opens an editor with its fields for each kind', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  const card = await screen.findByRole('region', { name: 'Картка Edition' });
  await within(card).findByText('Рідкісні слова');
  expect(within(card).queryByRole('textbox')).toBeNull();
  for (const kind of CONTENT_KINDS) {
    await user.click(screen.getByRole('tab', { name: kind.name }));
    await user.click(await screen.findByRole('button', { name: 'Додати' }));
    for (const field of kind.fields) {
      expect(await screen.findByLabelText(field.label)).toBeDefined();
    }
  }
});

test('a save answers the new content version; a refused rule shows its name at the field', async () => {
  const bodies = edits(
    () =>
      HttpResponse.json(
        {
          defined: true,
          code: 'REFUSED',
          status: 422,
          message: 'The record breaks a content rule',
          data: {
            refusals: [{ rule: 'word-category', field: 'categoryId', message: 'Немає такої' }],
          },
        },
        { status: 422 },
      ),
    () => HttpResponse.json(FIXTURES.content.edit),
  );
  const user = await openWord();

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  const category = screen.getByLabelText('Категорія');
  expect(await screen.findByText(/word-category/)).toBeDefined();
  expect(category.getAttribute('aria-invalid')).toBe('true');

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText('Опубліковано, версія контенту 2')).toBeDefined();
  expect(bodies).toHaveLength(2);
});

test('a stale answer shows the diff and the save asks again over the current version', async () => {
  const current = { ...WORD_FIELDS, primaryDefinition: 'Чужа правка.' };
  const bodies = edits(
    () =>
      HttpResponse.json(
        {
          defined: true,
          code: 'STALE',
          status: 409,
          message: 'The record changed since the version the write saw',
          data: { currentVersion: 4 },
        },
        { status: 409 },
      ),
    () => HttpResponse.json(FIXTURES.content.edit),
  );
  const user = await openWord();
  server.use(
    http.get(RECORD, () =>
      HttpResponse.json({ fields: current, recordVersion: 4, retired: false }),
    ),
  );
  const definition = screen.getByLabelText('Основне тлумачення');
  await user.clear(definition);
  await user.type(definition, 'Моя правка.');

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  const diff = await screen.findByRole('region', { name: 'Запис змінився, поки ви редагували' });
  expect(within(diff).getByText('Моя правка.')).toBeDefined();
  expect(within(diff).getByText('Чужа правка.')).toBeDefined();

  await user.click(screen.getByRole('button', { name: 'Зберегти поверх версії 4' }));
  await screen.findByText('Опубліковано, версія контенту 2');
  expect(bodies.map((body) => body['recordVersion'])).toEqual([1, 4]);
});

test('after a Word Stress change the record shows «потребує нового запису»', async () => {
  edits(() => HttpResponse.json({ ...FIXTURES.content.edit, needsNewRecording: true }));
  const user = await openWord();
  const stress = screen.getByLabelText('Наголос');
  await user.clear(stress);
  await user.type(stress, '[[1]');

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText('потребує нового запису')).toBeDefined();
});

test('an Entry save goes through with an empty reason', async () => {
  const bodies = edits(() => HttpResponse.json(FIXTURES.content.edit));
  const user = await openWord();

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await screen.findByText('Опубліковано, версія контенту 2');
  expect(bodies[0]).not.toHaveProperty('reason');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('retire asks for the confirmation and a reason', async () => {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${RECORD}/retire`, async ({ request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(FIXTURES.content.retire);
    }),
  );
  const user = await openWord();

  await user.click(screen.getByRole('button', { name: 'Вивести з ужитку' }));
  const dialog = within(await screen.findByRole('dialog'));
  const confirm = dialog.getByRole('button', { name: 'Вивести з ужитку' });
  expect(confirm).toHaveProperty('disabled', true);
  await user.type(dialog.getByLabelText('Причина'), 'дубль');
  await user.click(confirm);

  await waitFor(() => {
    expect(bodies).toEqual([expect.objectContaining({ reason: 'дубль', recordVersion: 1 })]);
  });
});
