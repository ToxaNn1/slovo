import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { CONTENT_KINDS } from './components/content-editor/kinds';
import { FIXTURES, WORD_FIELDS } from './mock/fixtures';
import { override, type Refusal, refusal } from './mock/handlers';
import { server } from './mock/server';
import { Admin } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/admin/content?edition=uk');
});

/** The edit requests' bodies, answered by `answer` in turn. */
function edits(...answers: (() => AdminApiOutputs['content']['edit'] | Refusal)[]) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    override('content.edit', async ({ request }) => {
      const body = await request.json();
      if (typeof body === 'object' && body !== null && !Array.isArray(body)) bodies.push(body);
      const answer = answers[bodies.length - 1] ?? answers[answers.length - 1];
      return answer === undefined ? FIXTURES.content.edit : answer();
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
    override('content.records', () => ({
      records: [
        { id: 'w_a1', kind: 'word', label: 'обруч', retired: false, recordVersion: 3 },
        { id: 'w_a2', kind: 'word', label: 'жупан', retired: true, recordVersion: 1 },
      ],
      total: 2,
    })),
  );
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  await within(table).findByRole('button', { name: 'жупан' });
  const rows = within(table).getAllByRole('row');
  expect(rows.map((row) => row.textContent)).toEqual([
    'ЗаписВерсіяСтанОзвучка',
    'обруч3чинний',
    'жупан1виведено',
  ]);
});

test('lists 50 records a page, moves between pages, and a search starts again on the first', async () => {
  const asked: URL[] = [];
  server.use(
    override('content.records', ({ request }) => {
      const url = new URL(request.url);
      asked.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      return {
        records: [
          {
            id: `w_p${String(page)}`,
            kind: 'word',
            label: `слово ${String(page)}`,
            retired: false,
            recordVersion: 1,
          },
        ],
        total: 120,
      };
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
      refusal(422, {
        defined: true,
        code: 'REFUSED',
        status: 422,
        message: 'The record breaks a content rule',
        data: {
          refusals: [{ rule: 'word-category', field: 'categoryId', message: 'Немає такої' }],
        },
      }),
    () => FIXTURES.content.edit,
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
      refusal(409, {
        defined: true,
        code: 'STALE',
        status: 409,
        message: 'The record changed since the version the write saw',
        data: { currentVersion: 4 },
      }),
    () => FIXTURES.content.edit,
  );
  const user = await openWord();
  server.use(
    override('content.record', () => ({ fields: current, recordVersion: 4, retired: false })),
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
  const bodies = edits(() => FIXTURES.content.edit);
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

test('a new Lemma drops the Stress positions that no longer fall on a vowel', async () => {
  const bodies = edits(() => FIXTURES.content.edit);
  const user = await openWord();
  const lemma = screen.getByLabelText('Лема');
  await user.clear(lemma);
  await user.type(lemma, 'кобза');

  const stress = within(screen.getByRole('group', { name: 'Наголос' }));
  expect(stress.getAllByRole('button').map((vowel) => vowel.getAttribute('aria-pressed'))).toEqual([
    'false',
    'false',
  ]);
  await user.click(stress.getByRole('button', { name: 'о' }));
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await screen.findByText('Опубліковано, версія контенту 2');
  expect(bodies[0]?.['fields']).toMatchObject({ lemma: 'кобза', stress: [1] });
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
  edits(() => ({ ...FIXTURES.content.edit, needsNewRecording: true }));
  const user = await openWord();
  const stress = within(screen.getByRole('group', { name: 'Наголос' }));
  await user.click(stress.getByRole('button', { name: 'о' }));

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText('потребує нового запису')).toBeDefined();
});

test('an Entry whose source refused the quote check says so, with the status and the day', async () => {
  server.use(
    override('content.record', () => ({
      ...FIXTURES.content.record,
      sourceRefused: { status: 403, at: '2026-11-20T09:00:00.000Z' },
    })),
  );
  await openWord();

  expect(
    screen.getByText(
      'Джерело відмовило перевірці цитати: HTTP 403, 20 лист. 2026 р., 11:00. Наступна спроба через добу.',
    ),
  ).toBeDefined();
});

test('an Entry save goes through with an empty reason', async () => {
  const bodies = edits(() => FIXTURES.content.edit);
  const user = await openWord();

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await screen.findByText('Опубліковано, версія контенту 2');
  expect(bodies[0]).not.toHaveProperty('reason');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('retire asks for the confirmation and a reason', async () => {
  const bodies: unknown[] = [];
  server.use(
    override('content.retire', async ({ request }) => {
      bodies.push(await request.json());
      return FIXTURES.content.retire;
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
    override('content.create', async ({ params, request }) => {
      sent.push({ kind: params['kind'], body: await request.json() });
      return FIXTURES.content.create;
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

/** A Curated Collection of the list, answered with its date and when it appears. */
/** One Curated Collection, retired while `retired()` says so. */
function collection(appearedAt: string, retired: () => boolean = () => false) {
  server.use(
    override('content.records', () => ({
      records: [
        {
          id: 'cc_a1',
          kind: 'curatedCollection',
          label: 'Слова зими',
          retired: retired(),
          recordVersion: 1,
        },
      ],
      total: 1,
    })),
    override('content.record', () => ({
      fields: {
        id: 'cc_a1',
        name: 'Слова зими',
        description: 'Рідкісні слова холодної пори.',
        publishedOn: '2026-12-01',
        entryIds: ['w_a1'],
        retired: retired(),
      },
      recordVersion: 1,
      retired: retired(),
      appearedAt,
    })),
  );
}

test('a new Curated Collection with no date is sent without one, which means «одразу»', async () => {
  const sent: unknown[] = [];
  server.use(
    override('content.create', async ({ request }) => {
      sent.push(await request.json());
      return FIXTURES.content.create;
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Додати' }));
  const date = await screen.findByLabelText('Дата публікації');
  expect(date.getAttribute('aria-describedby')).toBeTruthy();
  expect(screen.getByText('Порожньо — одразу')).toBeDefined();
  await user.type(screen.getByLabelText('Назва'), 'Слова зими');
  await user.type(screen.getByLabelText('Опис'), 'Рідкісні слова холодної пори.');
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'нова добірка');
  await user.click(dialog.getByRole('button', { name: 'Додати' }));

  await waitFor(() => {
    expect(sent).toHaveLength(1);
  });
  expect(sent[0]).toMatchObject({ fields: { name: 'Слова зими' } });
  expect(sent[0]).not.toHaveProperty('fields.publishedOn');
});

test('the date of a Curated Collection is read-only once it appeared, and editable before', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-18T10:00:00.000Z'));
  const user = userEvent.setup();
  collection('2026-11-30T22:00:00.000Z');
  const { unmount } = render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  expect((await screen.findByLabelText('Дата публікації')).hasAttribute('readonly')).toBe(false);
  unmount();

  collection('2026-11-17T22:00:00.000Z');
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  const date = await screen.findByLabelText('Дата публікації');
  expect(date.hasAttribute('readonly')).toBe(true);
  expect(screen.getByText('Добірка вже з’явилася: дату не змінити')).toBeDefined();
  vi.useRealTimers();
});

test('a Curated Collection that appeared retires as any record: marked «виведено», its date still read-only', async () => {
  const retires: unknown[] = [];
  collection('2026-11-01T00:00:00.000Z', () => retires.length > 0);
  server.use(
    override('content.retire', async ({ request, params }) => {
      retires.push({ kind: params['kind'], body: await request.json() });
      return FIXTURES.content.retire;
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  await user.click(await screen.findByRole('button', { name: 'Вивести з ужитку' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'застаріла');
  await user.click(dialog.getByRole('button', { name: 'Вивести з ужитку' }));

  expect(await screen.findByText('Виведено з ужитку')).toBeDefined();
  expect(retires).toEqual([
    {
      kind: 'curatedCollection',
      body: expect.objectContaining({ reason: 'застаріла', recordVersion: 1 }) as unknown,
    },
  ]);
  expect(screen.getByText('виведено')).toBeDefined();
  expect(screen.getByLabelText('Дата публікації').hasAttribute('readonly')).toBe(true);
});

test('a retired record comes back into use: an edit of its fields with `retired: false`', async () => {
  const bodies = edits();
  collection('2026-11-01T00:00:00.000Z', () => bodies.length === 0);
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  expect(await screen.findByText('Виведено з ужитку')).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Вивести з ужитку' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Повернути в ужиток' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'знову актуальна');
  await user.click(dialog.getByRole('button', { name: 'Повернути в ужиток' }));

  await waitFor(() => {
    expect(bodies).toEqual([
      expect.objectContaining({
        reason: 'знову актуальна',
        recordVersion: 1,
        fields: expect.objectContaining({
          name: 'Слова зими',
          publishedOn: '2026-12-01',
          retired: false,
        }) as unknown,
      }),
    ]);
  });
  expect(await screen.findByRole('button', { name: 'Вивести з ужитку' })).toBeDefined();
  expect(screen.queryByText('Виведено з ужитку')).toBeNull();
});

test('a record that was just retired stays retired on the next save', async () => {
  const retires: unknown[] = [];
  const bodies = edits();
  collection('2026-11-01T00:00:00.000Z', () => retires.length > 0);
  server.use(
    override('content.retire', async ({ request }) => {
      retires.push(await request.json());
      return FIXTURES.content.retire;
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  await user.click(await screen.findByRole('button', { name: 'Вивести з ужитку' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'застаріла');
  await user.click(dialog.getByRole('button', { name: 'Вивести з ужитку' }));
  expect(await screen.findByRole('button', { name: 'Повернути в ужиток' })).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => {
    expect(bodies).toEqual([
      expect.objectContaining({
        recordVersion: 2,
        fields: expect.objectContaining({ retired: true }) as unknown,
      }),
    ]);
  });
});

test('bringing a record back sends its saved fields, and the next save keeps it in use', async () => {
  const bodies = edits();
  collection('2026-11-01T00:00:00.000Z', () => bodies.length === 0);
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  const name = await screen.findByLabelText('Назва');
  await user.clear(name);
  await user.type(name, 'Слова весни');
  await user.click(screen.getByRole('button', { name: 'Повернути в ужиток' }));
  const dialog = within(await screen.findByRole('dialog'));
  await user.type(dialog.getByLabelText('Причина'), 'знову актуальна');
  await user.click(dialog.getByRole('button', { name: 'Повернути в ужиток' }));
  expect(await screen.findByRole('button', { name: 'Вивести з ужитку' })).toBeDefined();
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => {
    expect(bodies).toEqual([
      expect.objectContaining({
        recordVersion: 1,
        fields: expect.objectContaining({ name: 'Слова зими', retired: false }) as unknown,
      }),
      expect.objectContaining({
        recordVersion: 2,
        fields: expect.objectContaining({ name: 'Слова весни', retired: false }) as unknown,
      }),
    ]);
  });
});

const LIVE = { hash: 'a'.repeat(64), url: 'https://media.slovo.test/illustrations/w_a1.old.png' };

test("a Word shows its Illustration, and an upload sends the file's bytes and shows the new one", async () => {
  const sent: unknown[] = [];
  server.use(
    override('content.record', () => ({ ...FIXTURES.content.record, illustration: LIVE })),
    override('content.uploadIllustration', async ({ request }) => {
      sent.push(await request.json());
      return FIXTURES.content.uploadIllustration;
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
    override('content.uploadIllustration', () =>
      refusal(422, {
        defined: true,
        code: 'REFUSED',
        status: 422,
        message: 'The record breaks a content rule',
        data: {
          refusals: [{ rule: 'illustration-size', message: 'Файл більший за 150 КБ' }],
        },
      }),
    ),
  );
  const user = await openWord();
  expect(screen.queryByRole('img', { name: 'Ілюстрація' })).toBeNull();

  const png = new File([new Uint8Array([1, 2, 3])], 'big.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText('Завантажити ілюстрацію'), png);

  expect(await screen.findByText('illustration-size: Файл більший за 150 КБ')).toBeDefined();
});

test('retire keeps its confirmation open until the write ends', async () => {
  let answer: (retired: AdminApiOutputs['content']['retire']) => void = () => undefined;
  const bodies: unknown[] = [];
  server.use(
    override('content.retire', async ({ request }) => {
      bodies.push(await request.json());
      return new Promise<AdminApiOutputs['content']['retire']>((resolve) => {
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
  answer(FIXTURES.content.retire);
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  expect(bodies).toHaveLength(1);
});

test('a stale answer whose re-read fails says the save did not go through', async () => {
  edits(() =>
    refusal(409, {
      defined: true,
      code: 'STALE',
      status: 409,
      message: 'The record changed since the version the write saw',
      data: { currentVersion: 4 },
    }),
  );
  const user = await openWord();
  server.use(override('content.record', () => refusal(502, {})));

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText('Не вдалося. Спробуйте ще раз.')).toBeDefined();
});

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});

test('on a narrow screen the open record sits under the list, and opening one scrolls to it', async () => {
  const scrolled: Element[] = [];
  // A desk-wide screen, narrower than the editor's side by side.
  window.matchMedia = (media: string) =>
    Object.assign(new EventTarget(), {
      matches: !media.includes('1280px'),
      media,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    });
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  const user = userEvent.setup();
  render(<Admin />);
  expect(await screen.findByText('Оберіть запис у списку або натисніть «Додати».')).toBeTruthy();

  await user.click(await screen.findByRole('button', { name: 'обруч' }));

  const form = await screen.findByLabelText('Лема');
  expect(scrolled).toHaveLength(1);
  expect(scrolled[0]?.contains(form)).toBe(true);
});

/** The records the Entry picker finds, each of its kind and Category. */
type Listed = AdminApiOutputs['content']['records']['records'][number];

const PICKABLE: Listed[] = (
  [
    { id: 'w_a1', kind: 'word', label: 'обруч', categoryId: 'objects' },
    { id: 'w_a2', kind: 'word', label: 'жупан', categoryId: 'clothes' },
    { id: 'w_a3', kind: 'word', label: 'кунтуш', categoryId: 'clothes' },
    { id: 'c_a1', kind: 'correction', label: 'дякуючи', categoryId: 'grammar' },
    { id: 'i_a1', kind: 'idiom', label: 'бити байдики' },
    { id: 'cc_a1', kind: 'curatedCollection', label: 'Слова зими' },
  ] satisfies Omit<Listed, 'retired' | 'recordVersion'>[]
).map((record) => ({ ...record, retired: false, recordVersion: 1 }));

/** The records answered by kind, text query, Category and ids; the Edition card with its Categories. */
function pickable() {
  server.use(
    override('content.records', ({ params, request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query') ?? '';
      const categoryId = url.searchParams.get('categoryId');
      const ids = [...url.searchParams.entries()]
        .filter(([key]) => key.startsWith('ids'))
        .map(([, value]) => value);
      const records = PICKABLE.filter(
        (record) =>
          record.kind === params['kind'] &&
          record.label.includes(query) &&
          (categoryId === null || record.categoryId === categoryId) &&
          (ids.length === 0 || ids.includes(record.id)),
      );
      return { records, total: records.length };
    }),
    override('editionCard', () => ({
      ...FIXTURES.editionCard,
      categories: [
        { id: 'objects', displayName: 'Предмети', description: 'Речі', tone: 'loud' },
        { id: 'clothes', displayName: 'Одяг', description: 'Вбрання', tone: 'loud' },
      ],
      correctionCategories: [
        { id: 'grammar', displayName: 'Граматика', description: 'Правила', tone: 'loud' },
      ],
    })),
  );
}

/** Opens a new Curated Collection; `save` sends it and answers the Entry ids it sent. */
async function newCollection() {
  const sent: unknown[] = [];
  pickable();
  server.use(
    override('content.create', async ({ request }) => {
      sent.push(await request.json());
      return FIXTURES.content.create;
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Додати' }));
  const picker = within(await screen.findByRole('group', { name: 'Записи добірки' }));
  const save = async () => {
    await user.type(screen.getByLabelText('Назва'), 'Слова зими');
    await user.type(screen.getByLabelText('Опис'), 'Рідкісні слова холодної пори.');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText('Причина'), 'нова добірка');
    await user.click(dialog.getByRole('button', { name: 'Додати' }));
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    return sent[0];
  };
  return { user, picker, save };
}

/** The chosen Entries of a picker as their rows read: kind, label and Category. */
const chosenOf = (picker: {
  getByRole: (role: 'list', options: { name: string }) => HTMLElement;
}) =>
  within(picker.getByRole('list', { name: 'Обрані записи' }))
    .queryAllByRole('listitem')
    .map((item) => item.querySelector('[data-entry]')?.textContent);

test('the Entry picker finds Entries of every kind by text, ticks them and saves them in order', async () => {
  const { user, picker, save } = await newCollection();

  await user.type(picker.getByLabelText('Пошук записів'), 'жуп');
  await waitFor(() => {
    expect(picker.queryByRole('checkbox', { name: 'обруч' })).toBeNull();
  });
  await user.click(await picker.findByRole('checkbox', { name: 'жупан' }));
  await user.click(picker.getByRole('tab', { name: 'Ідіоми' }));
  await user.clear(picker.getByLabelText('Пошук записів'));
  await user.click(await picker.findByRole('checkbox', { name: 'бити байдики' }));
  expect(picker.queryByLabelText('Категорія записів')).toBeNull();
  expect(picker.queryByRole('tab', { name: 'Добірки' })).toBeNull();

  expect(chosenOf(picker)).toEqual(['Слова · жупан · Одяг', 'Ідіоми · бити байдики']);
  expect(await save()).toMatchObject({ fields: { entryIds: ['w_a2', 'i_a1'] } });
});

test('the Entry picker finds by Category, and «Додати всі показані» adds each listed Entry once', async () => {
  const { user, picker, save } = await newCollection();

  await user.selectOptions(await picker.findByLabelText('Категорія записів'), 'Одяг');
  await waitFor(() => {
    expect(picker.queryByRole('checkbox', { name: 'обруч' })).toBeNull();
  });
  await user.click(await picker.findByRole('checkbox', { name: 'кунтуш' }));
  await user.click(picker.getByRole('button', { name: 'Додати всі показані' }));
  await user.click(picker.getByRole('button', { name: 'Додати всі показані' }));

  expect(chosenOf(picker)).toEqual(['Слова · кунтуш · Одяг', 'Слова · жупан · Одяг']);
  expect(picker.getByRole('checkbox', { name: 'жупан' })).toHaveProperty('checked', true);
  await user.click(picker.getByRole('tab', { name: 'Виправлення' }));
  await user.selectOptions(await picker.findByLabelText('Категорія записів'), 'Граматика');
  await user.click(await picker.findByRole('checkbox', { name: 'дякуючи' }));
  expect(await save()).toMatchObject({ fields: { entryIds: ['w_a3', 'w_a2', 'c_a1'] } });
});

test('an open collection lists its Entries by kind, label and Category; remove and reorder save the shown order, and a refused save names its rule', async () => {
  pickable();
  server.use(
    override('content.record', () => ({
      fields: {
        id: 'cc_a1',
        name: 'Слова зими',
        description: 'Рідкісні слова холодної пори.',
        entryIds: ['w_a1', 'c_a1', 'w_a2', 'w_gone'],
      },
      recordVersion: 1,
      retired: false,
    })),
  );
  const bodies = edits(() =>
    refusal(422, {
      defined: true,
      code: 'REFUSED',
      status: 422,
      message: 'The record breaks a content rule',
      data: {
        refusals: [
          { rule: 'collection-entry', field: 'entryIds', message: 'w_gone is an unknown entry' },
        ],
      },
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  const picker = within(await screen.findByRole('group', { name: 'Записи добірки' }));

  await waitFor(() => {
    expect(chosenOf(picker)).toEqual([
      'Слова · обруч · Предмети',
      'Виправлення · дякуючи · Граматика',
      'Слова · жупан · Одяг',
      'w_gone · невідомий запис',
    ]);
  });
  await user.click(picker.getByRole('button', { name: 'Вище: жупан' }));
  await user.click(picker.getByRole('button', { name: 'Прибрати: обруч' }));
  await user.click(picker.getByRole('button', { name: 'Нижче: жупан' }));
  expect(chosenOf(picker)).toEqual([
    'Виправлення · дякуючи · Граматика',
    'Слова · жупан · Одяг',
    'w_gone · невідомий запис',
  ]);

  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  expect(await screen.findByText(/collection-entry/)).toBeDefined();
  expect(bodies[0]).toMatchObject({ fields: { entryIds: ['c_a1', 'w_a2', 'w_gone'] } });
});

test("a collection's pictogram is a Category or Correction Category, and empty means the Edition default", async () => {
  const { user, save } = await newCollection();
  const pictogram = await screen.findByLabelText('Піктограма');
  await waitFor(() => {
    expect(
      within(pictogram)
        .getAllByRole('option')
        .map(({ textContent }) => textContent),
    ).toEqual(['Типова піктограма Видання', 'Предмети', 'Одяг', 'Граматика']);
  });

  await user.selectOptions(pictogram, 'Граматика');
  expect(await save()).toMatchObject({ fields: { pictogram: 'grammar' } });
});

test('an open collection shows its pictogram, and the Edition default saves it without one', async () => {
  pickable();
  server.use(
    override('content.record', () => ({
      fields: {
        id: 'cc_a1',
        name: 'Слова зими',
        description: 'Рідкісні слова холодної пори.',
        entryIds: ['w_a1'],
        pictogram: 'clothes',
      },
      recordVersion: 1,
      retired: false,
    })),
  );
  const bodies = edits();
  const user = userEvent.setup();
  render(<Admin />);
  await user.click(await screen.findByRole('tab', { name: 'Добірки' }));
  await user.click(await screen.findByRole('button', { name: 'Слова зими' }));
  const pictogram = await screen.findByLabelText('Піктограма');
  await waitFor(() => {
    expect(pictogram).toHaveProperty('value', 'clothes');
  });

  await user.selectOptions(pictogram, 'Типова піктограма Видання');
  await user.click(screen.getByRole('button', { name: 'Зберегти' }));
  await waitFor(() => {
    expect(bodies).toHaveLength(1);
  });
  expect(bodies[0]).toMatchObject({ fields: { entryIds: ['w_a1'] } });
  expect(bodies[0]).not.toHaveProperty('fields.pictogram');
});

test("shows each Word's Recordings as «N з M» and filters the Words by them", async () => {
  const asked: (string | null)[] = [];
  server.use(
    override('content.records', ({ request }) => {
      asked.push(new URL(request.url).searchParams.get('recordings'));
      return {
        records: [
          {
            id: 'w_a1',
            kind: 'word',
            label: 'обруч',
            retired: false,
            recordVersion: 1,
            recordings: { live: 4, of: 4, allVoices: true },
          },
          {
            id: 'w_a2',
            kind: 'word',
            label: 'жупан',
            retired: false,
            recordVersion: 1,
            recordings: { live: 1, of: 4, allVoices: true },
          },
        ],
        total: 2,
      };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  await within(table).findByRole('button', { name: 'жупан' });
  expect(
    within(table)
      .getAllByRole('row')
      .map((row) => row.textContent),
  ).toEqual(['ЗаписВерсіяСтанОзвучка', 'обруч1чинний4 з 4', 'жупан1чинний1 з 4чекає запису']);
  // A Word in all voices already, or on the list, has no button.
  expect(within(table).queryByRole('button', { name: /Додати інші голоси/ })).toBeNull();

  await user.selectOptions(screen.getByRole('combobox', { name: 'Озвучка' }), 'incomplete');
  await waitFor(() => {
    expect(asked.at(-1)).toBe('incomplete');
  });
  await user.selectOptions(screen.getByRole('combobox', { name: 'Озвучка' }), 'complete');
  await waitFor(() => {
    expect(asked.at(-1)).toBe('complete');
  });
});

test('a Retired Word in fewer than every voice has no «Додати інші голоси»', async () => {
  server.use(
    override('content.records', () => ({
      records: [
        {
          id: 'w_a3',
          kind: 'word',
          label: 'кунтуш',
          retired: true,
          recordVersion: 2,
          recordings: { live: 1, of: 4, allVoices: false },
        },
      ],
      total: 1,
    })),
  );
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  await within(table).findByRole('button', { name: 'кунтуш' });
  expect(within(table).getByText('1 з 4')).toBeDefined();
  expect(within(table).queryByRole('button', { name: /Додати інші голоси/ })).toBeNull();
});

test('adds the other voices to a Word at one confirmation with no reason', async () => {
  const added: string[] = [];
  server.use(
    override('content.addOtherVoices', ({ params }) => {
      added.push(String(params['id']));
      return { id: String(params['id']) };
    }),
  );
  const user = userEvent.setup();
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  expect(await within(table).findByText('1 з 4')).toBeDefined();
  await user.click(within(table).getByRole('button', { name: 'Додати інші голоси: обруч' }));
  const dialog = await screen.findByRole('dialog', { name: 'Додати інші голоси до «обруч»?' });
  expect(within(dialog).queryByLabelText(/Причина/)).toBeNull();
  await user.click(within(dialog).getByRole('button', { name: 'Додати' }));

  await waitFor(() => {
    expect(added).toEqual(['w_a1']);
  });
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

test('says why the other voices were not added to a Word', async () => {
  server.use(
    override('content.addOtherVoices', () =>
      refusal(409, {
        defined: true,
        code: 'NOT_ADDABLE',
        status: 409,
        message: 'no',
        data: { reason: 'listed' },
      }),
    ),
  );
  const user = userEvent.setup();
  render(<Admin />);

  const table = await screen.findByRole('table', { name: 'Записи' });
  await user.click(await within(table).findByRole('button', { name: 'Додати інші голоси: обруч' }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Додати' }));

  expect(await within(dialog).findByRole('alert')).toHaveProperty(
    'textContent',
    'Слово вже чекає запису в усіх голосах',
  );
});
