import type { AdminApiInputs } from '@slovo/contracts/admin-api';

/** A kind of record the content editor writes. */
export type ContentKind = AdminApiInputs['content']['record']['kind'];

/**
 * How a field is edited: a line of text, a number, or JSON for a list or an
 * object. An empty text or JSON field is left out of the record.
 */
export type FieldControl = 'text' | 'long-text' | 'number' | 'json';

export interface EditorField {
  readonly name: string;
  readonly label: string;
  readonly control: FieldControl;
}

export interface KindEditor {
  readonly kind: ContentKind;
  readonly name: string;
  readonly fields: readonly EditorField[];
}

const field = (name: string, label: string, control: FieldControl): EditorField => ({
  name,
  label,
  control,
});

const PRIMARY_DEFINITION = field('primaryDefinition', 'Основне тлумачення', 'long-text');
const EXTRA_DEFINITIONS = field('extraDefinitions', 'Додаткові тлумачення', 'json');
const EXAMPLES = field('examples', 'Приклади', 'json');
const EXAMPLE = field('example', 'Приклад', 'json');
const ETYMOLOGY = field('etymology', 'Етимологія', 'long-text');
const SOURCES = field('sources', 'Джерела', 'json');
const CATEGORY = field('categoryId', 'Категорія', 'text');
const NON_STANDARD_FORM = field('nonStandardForm', 'Ненормативна форма', 'text');
const EXPLANATION = field('explanation', 'Пояснення', 'long-text');

/**
 * The editor of every kind, with the fields the contracts define for it
 * (Word, Idiom, Correction, Tip, Synonym Row, Curated Collection and Crossword day
 * schemas).
 * Categories, translation, topic and CEFR fields are not edited here.
 */
export const CONTENT_KINDS: readonly KindEditor[] = [
  {
    kind: 'word',
    name: 'Слова',
    fields: [
      field('lemma', 'Лема', 'text'),
      field('stress', 'Наголос', 'json'),
      field('partOfSpeech', 'Частина мови', 'text'),
      field('gender', 'Рід', 'text'),
      PRIMARY_DEFINITION,
      EXTRA_DEFINITIONS,
      EXAMPLES,
      field('synonyms', 'Синоніми', 'json'),
      field('antonyms', 'Антоніми', 'json'),
      ETYMOLOGY,
      field('registers', 'Регістри', 'json'),
      field('region', 'Регіон', 'json'),
      field('history', 'Історія', 'json'),
      field('origin', 'Походження', 'json'),
      field('illustration', 'Ілюстрація', 'json'),
      CATEGORY,
      field('rarity', 'Рідкісність', 'number'),
      SOURCES,
      field('correctionIds', 'Виправлення', 'json'),
    ],
  },
  {
    kind: 'idiom',
    name: 'Ідіоми',
    fields: [
      field('expression', 'Вираз', 'text'),
      field('idiomType', 'Тип ідіоми', 'text'),
      PRIMARY_DEFINITION,
      EXTRA_DEFINITIONS,
      EXAMPLES,
      ETYMOLOGY,
      SOURCES,
    ],
  },
  {
    kind: 'correction',
    name: 'Виправлення',
    fields: [
      NON_STANDARD_FORM,
      field('correctionType', 'Тип виправлення', 'text'),
      field('standardEquivalents', 'Нормативні відповідники', 'json'),
      EXPLANATION,
      field('examplePair', 'Пара прикладів', 'json'),
      CATEGORY,
      SOURCES,
      field('literaryUses', 'Літературні вжитки', 'json'),
    ],
  },
  {
    kind: 'tip',
    name: 'Поради',
    fields: [
      field('title', 'Заголовок', 'text'),
      NON_STANDARD_FORM,
      field('standardForm', 'Нормативна форма', 'text'),
      EXPLANATION,
      EXAMPLE,
      SOURCES,
      field('gameQuestion', 'Питання гри', 'json'),
    ],
  },
  {
    kind: 'synonymRow',
    name: 'Синонімічні ряди',
    fields: [
      field('dominant', 'Домінанта', 'json'),
      field('meaning', 'Значення', 'long-text'),
      field('members', 'Члени ряду', 'json'),
      EXAMPLE,
      SOURCES,
    ],
  },
  {
    kind: 'curatedCollection',
    name: 'Добірки',
    fields: [
      field('name', 'Назва', 'text'),
      field('description', 'Опис', 'long-text'),
      field('publishedOn', 'Дата публікації', 'text'),
      field('entryIds', 'Записи добірки', 'json'),
    ],
  },
  {
    kind: 'crosswordDay',
    name: 'Кросворди дня',
    fields: [field('date', 'Дата', 'text'), field('words', 'Слова кросворду', 'json')],
  },
];

/** The text a field's control shows for a record's value. */
export function textOf(control: FieldControl, value: unknown): string {
  if (value === undefined) return '';
  if (control === 'json') return JSON.stringify(value);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** A field's value read back from its control's text, or why it can't be read. */
export function valueOf(
  control: FieldControl,
  text: string,
): { ok: true; value: unknown } | { ok: false } {
  if (text.trim() === '') return { ok: true, value: undefined };
  if (control === 'number') {
    const number = Number(text);
    return Number.isFinite(number) ? { ok: true, value: number } : { ok: false };
  }
  if (control !== 'json') return { ok: true, value: text };
  try {
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}
