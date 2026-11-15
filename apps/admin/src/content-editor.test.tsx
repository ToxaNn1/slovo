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

test('lists the records of a kind as a table of label, version and state', async () => {
  server.use(
    http.get('*/admin/content/:editionId/records/:kind', () =>
      HttpResponse.json({
        records: [
          { id: 'w_a1', label: 'обруч', retired: false, recordVersion: 3 },
          { id: 'w_a2', label: 'жупан', retired: true, recordVersion: 1 },
        ],
        total: 2,
      }),
    ),
  );
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  await within(table).findByRole('button', { name: 'жупан' });
  const rows = within(table).getAllByRole('row');
  expect(rows.map((row) => row.textContent)).toEqual([
    'ЗаписВерсіяСтан',
    'обруч3чинний',
    'жупан1виведено',
  ]);
});

test('lists 50 records a page, moves between pages, and a search starts again on the first', async () => {
  const asked: URL[] = [];
  server.use(
    http.get('*/admin/content/:editionId/records/:kind', ({ request }) => {
      const url = new URL(request.url);
      asked.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      return HttpResponse.json({
        records: [
          {
            id: `w_p${String(page)}`,
            label: `слово ${String(page)}`,
            retired: false,
            recordVersion: 1,
          },
        ],
        total: 120,
      });
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);

  const pages = await screen.findByRole('navigation', { name: 'Сторінки записів' });
  await within(pages).findByText('1–50 з 120');
  expect(within(pages).getByRole('button', { name: 'Назад' })).toHaveProperty('disabled', true);
  await user.click(within(pages).getByRole('button', { name: '3' }));
  await screen.findByRole('button', { name: 'слово 3' });
  expect(within(pages).getByText('101–120 з 120')).toBeDefined();
  expect(within(pages).getByRole('button', { name: 'Далі' })).toHaveProperty('disabled', true);
  await user.click(within(pages).getByRole('button', { name: 'Назад' }));
  await screen.findByRole('button', { name: 'слово 2' });

  await user.type(screen.getByRole('textbox', { name: 'Пошук' }), 'обр');
  await user.click(screen.getByRole('button', { name: 'Шукати' }));
  await screen.findByRole('button', { name: 'слово 1' });
  const last = asked.at(-1);
  expect(last?.searchParams.get('query')).toBe('обр');
  expect(last?.searchParams.get('page') ?? '1').toBe('1');
});

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

test('the Word form has no JSON: vowels, labelled choices, rows with + and ×, rarity buttons', async () => {
  const bodies = edits(() => HttpResponse.json(FIXTURES.content.edit));
  const user = await openWord();
  expect(screen.queryByText(/JSON/)).toBeNull();

  const stress = within(screen.getByRole('group', { name: 'Наголос' }));
  expect(stress.getByRole('button', { name: 'у' }).getAttribute('aria-pressed')).toBe('true');
  expect(stress.queryByRole('button', { name: 'б' })).toBeNull();
  await user.click(stress.getByRole('button', { name: 'у' }));
  await user.click(stress.getByRole('button', { name: 'о' }));

  expect(screen.getByRole('option', { name: 'іменник' })).toBeDefined();
  await user.selectOptions(screen.getByLabelText('Рід'), 'жіночий');
  const registers = within(screen.getByRole('group', { name: 'Регістри' }));
  await user.click(registers.getByRole('button', { name: 'розмовне' }));

  const synonyms = within(screen.getByRole('group', { name: 'Синоніми' }));
  await user.click(synonyms.getByRole('button', { name: '+ Додати' }));
  await user.type(synonyms.getByLabelText('Синоніми 1'), 'коло');

  const sources = within(screen.getByRole('group', { name: 'Джерела' }));
  await user.click(sources.getByRole('button', { name: 'Прибрати 1' }));
  await user.click(sources.getByRole('button', { name: '+ Додати' }));
  await user.type(sources.getByLabelText('Назва'), 'ВТССУМ');

  const examples = within(screen.getByRole('group', { name: 'Приклади' }));
  await user.click(examples.getByRole('button', { name: '+ Додати' }));
  await user.type(examples.getByLabelText('Текст'), 'Котив обруч.');
  await user.type(examples.getByLabelText('Автор'), 'Леся Українка');

  const rarity = within(screen.getByRole('group', { name: 'Рідкісність' }));
  expect(rarity.getByRole('button', { name: /^3/ }).getAttribute('aria-pressed')).toBe('true');
  await user.click(rarity.getByRole('button', { name: '5 майже ніхто не знає' }));

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await screen.findByText('Опубліковано, версія контенту 2');
  expect(bodies[0]?.['fields']).toMatchObject({
    lemma: 'обруч',
    stress: [0],
    partOfSpeech: 'noun',
    gender: 'feminine',
    registers: ['colloquial'],
    synonyms: ['коло'],
    sources: [{ title: 'ВТССУМ' }],
    examples: [{ text: 'Котив обруч.', author: 'Леся Українка' }],
    rarity: 5,
    categoryId: 'old-crafts',
  });
});

test('a number sub-field that is not a number is named at its field, and nothing is sent', async () => {
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Кросворди дня' }));
  await user.click(await screen.findByRole('button', { name: 'Додати' }));
  const words = within(await screen.findByRole('group', { name: 'Слова кросворду' }));
  await user.click(words.getByRole('button', { name: '+ Додати' }));
  await user.type(words.getByLabelText('Рядок'), 'два');
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));

  expect(await screen.findByText('Тут має бути число')).toBeDefined();
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('after a Word Stress change the record shows «потребує нового запису»', async () => {
  edits(() => HttpResponse.json({ ...FIXTURES.content.edit, needsNewRecording: true }));
  const user = await openWord();
  const stress = within(screen.getByRole('group', { name: 'Наголос' }));
  await user.click(stress.getByRole('button', { name: 'о' }));

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

test('a new Crossword day sends its date and words to the crosswordDay kind', async () => {
  const sent: { kind: string | readonly string[] | undefined; body: unknown }[] = [];
  server.use(
    http.post('*/admin/content/:editionId/records/:kind', async ({ params, request }) => {
      sent.push({ kind: params['kind'], body: await request.json() });
      return HttpResponse.json(FIXTURES.content.create);
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Кросворди дня' }));
  await user.click(await screen.findByRole('button', { name: 'Додати' }));
  await user.type(await screen.findByLabelText('Дата'), '2026-12-01');
  const words = within(screen.getByRole('group', { name: 'Слова кросворду' }));
  await user.click(words.getByRole('button', { name: '+ Додати' }));
  await user.type(words.getByLabelText('Запис'), 'w_a1');
  await user.type(words.getByLabelText('Відповідь'), 'обруч');
  await user.type(words.getByLabelText('Підказка'), 'обід колеса');
  await user.type(words.getByLabelText('Рядок'), '0');
  await user.type(words.getByLabelText('Стовпець'), '0');
  await user.selectOptions(words.getByLabelText('Напрямок'), 'по горизонталі');
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'новий день');
  await user.click(dialog.getByRole('button', { name: 'Додати' }));

  await waitFor(() => {
    expect(sent).toMatchObject([
      {
        kind: 'crosswordDay',
        body: {
          fields: {
            date: '2026-12-01',
            words: [
              {
                entryId: 'w_a1',
                answer: 'обруч',
                clue: 'обід колеса',
                row: 0,
                column: 0,
                direction: 'across',
              },
            ],
          },
          reason: 'новий день',
        },
      },
    ]);
  });
});

const ILLUSTRATION = `${RECORD}/illustration`;
const LIVE = { hash: 'a'.repeat(64), url: 'https://media.slovo.test/illustrations/w_a1.old.png' };

test("a Word shows its Illustration, and an upload sends the file's bytes and shows the new one", async () => {
  const sent: unknown[] = [];
  server.use(
    http.get(RECORD, () => HttpResponse.json({ ...FIXTURES.content.record, illustration: LIVE })),
    http.put(ILLUSTRATION, async ({ request }) => {
      sent.push(await request.json());
      return HttpResponse.json(FIXTURES.content.uploadIllustration);
    }),
  );
  const user = await openWord();
  const image = await screen.findByRole('img', { name: 'Ілюстрація' });
  expect(image.getAttribute('src')).toBe(LIVE.url);

  const png = new File([new Uint8Array([137, 80, 78, 71])], 'obruch.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Завантажити ілюстрацію'), png);

  await waitFor(() => {
    expect(screen.getByRole('img', { name: 'Ілюстрація' }).getAttribute('src')).toBe(
      FIXTURES.content.uploadIllustration.illustration.url,
    );
  });
  expect(sent).toEqual([{ png: btoa(String.fromCharCode(137, 80, 78, 71)) }]);
});

test('a refused Illustration shows the rule it breaks', async () => {
  server.use(
    http.put(ILLUSTRATION, () =>
      HttpResponse.json(
        {
          defined: true,
          code: 'REFUSED',
          status: 422,
          message: 'The record breaks a content rule',
          data: {
            refusals: [{ rule: 'illustration-size', message: 'Файл більший за 150 КБ' }],
          },
        },
        { status: 422 },
      ),
    ),
  );
  const user = await openWord();
  expect(screen.queryByRole('img', { name: 'Ілюстрація' })).toBeNull();

  const png = new File([new Uint8Array([1, 2, 3])], 'big.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Завантажити ілюстрацію'), png);

  expect(await screen.findByText('illustration-size: Файл більший за 150 КБ')).toBeDefined();
});

test('retire keeps its confirmation open until the write ends', async () => {
  let answer: (response: Response) => void = () => undefined;
  const bodies: unknown[] = [];
  server.use(
    http.post(`${RECORD}/retire`, async ({ request }) => {
      bodies.push(await request.json());
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    }),
  );
  const user = await openWord();

  await user.click(screen.getByRole('button', { name: 'Вивести з ужитку' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'дубль');
  await user.click(dialog.getByRole('button', { name: 'Вивести з ужитку' }));

  await waitFor(() => {
    expect(bodies).toHaveLength(1);
  });
  expect(screen.getByRole('dialog')).toBeDefined();
  expect(dialog.getByRole('button', { name: 'Вивести з ужитку' })).toHaveProperty('disabled', true);
  answer(HttpResponse.json(FIXTURES.content.retire));
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(bodies).toHaveLength(1);
});

test('a stale answer whose re-read fails says the save did not go through', async () => {
  edits(() =>
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
  );
  const user = await openWord();
  server.use(http.get(RECORD, () => HttpResponse.json({}, { status: 502 })));

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText('Не вдалося. Спробуйте ще раз.')).toBeDefined();
});
