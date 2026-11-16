import type {
  CorrectionType,
  Gender,
  IdiomType,
  PartOfSpeech,
  Rarity,
  Register,
} from '@slovo/contracts';
import type { AdminApiInputs } from '@slovo/contracts/admin-api';

/** A kind of record the content editor writes. */
export type ContentKind = AdminApiInputs['content']['record']['kind'];

/** A value a choice offers, with the label the owner reads. */
export interface Option {
  readonly value: string;
  readonly label: string;
}

/**
 * How a field is edited, one control per shape of value: a line or block of
 * text, a whole number, one value of a set, several values of a set, the
 * stressed vowels of a text field beside it, a rarity, one row per item of a
 * list, or labelled sub-fields of an object. An empty field is left out of
 * the record.
 */
export type FieldControl =
  | { readonly type: 'text' }
  | { readonly type: 'long-text' }
  | { readonly type: 'number' }
  | { readonly type: 'choice'; readonly options: readonly Option[] }
  | { readonly type: 'category'; readonly of: 'categories' | 'correctionCategories' }
  | { readonly type: 'chips'; readonly options: readonly Option[] }
  | { readonly type: 'stress'; readonly of: string }
  | { readonly type: 'rarity' }
  | { readonly type: 'list'; readonly item: FieldControl }
  | { readonly type: 'object'; readonly fields: readonly EditorField[] };

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

const TEXT: FieldControl = { type: 'text' };
const LONG_TEXT: FieldControl = { type: 'long-text' };
const NUMBER: FieldControl = { type: 'number' };
const TEXTS: FieldControl = { type: 'list', item: TEXT };
/** The Categories of the Edition a Category field picks from. */
export type CategoryOptions = Readonly<
  Record<'categories' | 'correctionCategories', readonly Option[]>
>;

type Named = readonly { readonly id: string; readonly displayName: string }[];

/**
 * An Edition's Categories as options, each by the display name the app shows
 * for it (ADR 0033); none while the Edition card is loading.
 */
export function categoryOptionsOf(
  card: { readonly categories: Named; readonly correctionCategories: Named } | undefined,
): CategoryOptions {
  const of = (list: Named = []) =>
    list.map(({ id, displayName }) => ({ value: id, label: displayName }));
  return { categories: of(card?.categories), correctionCategories: of(card?.correctionCategories) };
}

const optionsOf = (labels: Readonly<Record<string, string>>): readonly Option[] =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
const choice = (labels: Readonly<Record<string, string>>): FieldControl => ({
  type: 'choice',
  options: optionsOf(labels),
});
const object = (...fields: EditorField[]): FieldControl => ({ type: 'object', fields });
const rows = (...fields: EditorField[]): FieldControl => ({
  type: 'list',
  item: object(...fields),
});

const PART_OF_SPEECH: Readonly<Record<PartOfSpeech, string>> = {
  noun: 'іменник',
  verb: 'дієслово',
  adjective: 'прикметник',
  adverb: 'прислівник',
  pronoun: 'займенник',
  numeral: 'числівник',
  preposition: 'прийменник',
  conjunction: 'сполучник',
  particle: 'частка',
  interjection: 'вигук',
};
const GENDER: Readonly<Record<Gender, string>> = {
  masculine: 'чоловічий',
  feminine: 'жіночий',
  neuter: 'середній',
  common: 'спільний',
  'plural-only': 'лише множина',
};
const REGISTER: Readonly<Record<Register, string>> = {
  archaic: 'застаріле',
  dialectal: 'діалектне',
  bookish: 'книжне',
  colloquial: 'розмовне',
};
const IDIOM_TYPE: Readonly<Record<IdiomType, string>> = {
  idiom: 'фразеологізм',
  placeName: 'назва місця',
  proverb: 'приказка',
};
const CORRECTION_TYPE: Readonly<Record<CorrectionType, string>> = {
  surzhyk: 'суржик',
  wrongStress: 'неправильний наголос',
  calque: 'калька',
  officialese: 'канцелярит',
  paronym: 'пароніми',
  russianism: 'русизм',
  anglicism: 'англіцизм',
};

/** What each rarity means to a reader, from 1 to 5. */
export const RARITY_LINES: Readonly<Record<Rarity, string>> = {
  1: 'чув, але не вживаю',
  2: 'знаю, але чую рідко',
  3: 'знає не кожен',
  4: 'знають одиниці',
  5: 'майже ніхто не знає',
};

const TEXT_AND_AUTHOR = [field('text', 'Текст', LONG_TEXT), field('author', 'Автор', TEXT)];
const SOURCE = rows(
  field('title', 'Назва', TEXT),
  field('shortName', 'Скорочення', TEXT),
  field('url', 'Посилання', TEXT),
  field('archivedUrl', 'Посилання на архів', TEXT),
);
const ROW_WORD = [
  field('text', 'Слово', TEXT),
  field('stress', 'Наголос', { type: 'stress', of: 'text' }),
  field('wordId', 'Слово в словнику', TEXT),
];

const PRIMARY_DEFINITION = field('primaryDefinition', 'Основне тлумачення', LONG_TEXT);
const EXTRA_DEFINITIONS = field('extraDefinitions', 'Додаткові тлумачення', TEXTS);
const EXAMPLES = field('examples', 'Приклади', rows(...TEXT_AND_AUTHOR));
const EXAMPLE = field('example', 'Приклад', object(...TEXT_AND_AUTHOR));
const ETYMOLOGY = field('etymology', 'Етимологія', LONG_TEXT);
const SOURCES = field('sources', 'Джерела', SOURCE);
const NON_STANDARD_FORM = field('nonStandardForm', 'Ненормативна форма', TEXT);
const EXPLANATION = field('explanation', 'Пояснення', LONG_TEXT);

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
      field('lemma', 'Лема', TEXT),
      field('stress', 'Наголос', { type: 'stress', of: 'lemma' }),
      field('partOfSpeech', 'Частина мови', choice(PART_OF_SPEECH)),
      field('gender', 'Рід', choice(GENDER)),
      PRIMARY_DEFINITION,
      EXTRA_DEFINITIONS,
      EXAMPLES,
      field('synonyms', 'Синоніми', TEXTS),
      field('antonyms', 'Антоніми', TEXTS),
      ETYMOLOGY,
      field('registers', 'Регістри', { type: 'chips', options: optionsOf(REGISTER) }),
      field('region', 'Регіон', TEXT),
      field('history', 'Історія', LONG_TEXT),
      field('origin', 'Походження', TEXT),
      field('illustration', 'Ілюстрація', TEXT),
      field('categoryId', 'Категорія', { type: 'category', of: 'categories' }),
      field('rarity', 'Рідкісність', { type: 'rarity' }),
      SOURCES,
      field('correctionIds', 'Виправлення', TEXTS),
    ],
  },
  {
    kind: 'idiom',
    name: 'Ідіоми',
    fields: [
      field('expression', 'Вираз', TEXT),
      field('idiomType', 'Тип ідіоми', choice(IDIOM_TYPE)),
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
      field('correctionType', 'Тип виправлення', choice(CORRECTION_TYPE)),
      field('standardEquivalents', 'Нормативні відповідники', TEXTS),
      EXPLANATION,
      field(
        'examplePair',
        'Пара прикладів',
        object(
          field('nonStandard', 'Ненормативний приклад', TEXT),
          field('standard', 'Нормативний приклад', TEXT),
        ),
      ),
      field('categoryId', 'Категорія', { type: 'category', of: 'correctionCategories' }),
      SOURCES,
      field(
        'literaryUses',
        'Літературні вжитки',
        rows(
          field('text', 'Цитата', LONG_TEXT),
          field('author', 'Автор', TEXT),
          field('work', 'Твір', TEXT),
          field('authorDeathYear', 'Рік смерті автора', NUMBER),
          field('workYear', 'Рік твору', NUMBER),
          field('url', 'Посилання', TEXT),
        ),
      ),
    ],
  },
  {
    kind: 'tip',
    name: 'Поради',
    fields: [
      field('title', 'Заголовок', TEXT),
      NON_STANDARD_FORM,
      field('standardForm', 'Нормативна форма', TEXT),
      EXPLANATION,
      EXAMPLE,
      SOURCES,
      field(
        'gameQuestion',
        'Питання гри',
        object(
          field('prompt', 'Питання', TEXT),
          field('rightAnswer', 'Правильна відповідь', TEXT),
          field('wrongAnswers', 'Неправильні відповіді', TEXTS),
        ),
      ),
    ],
  },
  {
    kind: 'synonymRow',
    name: 'Синонімічні ряди',
    fields: [
      field('dominant', 'Домінанта', object(...ROW_WORD)),
      field('meaning', 'Значення', LONG_TEXT),
      field(
        'members',
        'Члени ряду',
        rows(...ROW_WORD, field('shadeNote', 'Відтінок значення', TEXT)),
      ),
      EXAMPLE,
      SOURCES,
    ],
  },
  {
    kind: 'curatedCollection',
    name: 'Добірки',
    fields: [
      field('name', 'Назва', TEXT),
      field('description', 'Опис', LONG_TEXT),
      field('publishedOn', 'Дата публікації', TEXT),
      field('entryIds', 'Записи добірки', TEXTS),
    ],
  },
  {
    kind: 'crosswordDay',
    name: 'Кросворди дня',
    fields: [
      field('date', 'Дата', TEXT),
      field(
        'words',
        'Слова кросворду',
        rows(
          field('entryId', 'Запис', TEXT),
          field('answer', 'Відповідь', TEXT),
          field('clue', 'Підказка', TEXT),
          field('row', 'Рядок', NUMBER),
          field('column', 'Стовпець', NUMBER),
          field(
            'direction',
            'Напрямок',
            choice({ across: 'по горизонталі', down: 'по вертикалі' }),
          ),
        ),
      ),
    ],
  },
];

/** What a control holds while the owner edits it: texts as typed, lists and sub-fields as they are. */
export type FormValue =
  string | number | undefined | readonly FormValue[] | { readonly [name: string]: FormValue };

/** The sub-fields of an object a control holds. */
export type FormObject = Readonly<Record<string, FormValue>>;

export const isList = (value: FormValue): value is readonly FormValue[] => Array.isArray(value);

export const isObject = (value: FormValue): value is FormObject =>
  typeof value === 'object' && !Array.isArray(value);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The value a field's control holds for a record's value (undefined: a new, empty one). */
export function formValueOf(control: FieldControl, value: unknown): FormValue {
  switch (control.type) {
    case 'number':
      return typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
    case 'rarity':
      return typeof value === 'number' ? value : undefined;
    case 'chips':
      return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
    case 'stress':
      return Array.isArray(value) ? value.filter((item) => typeof item === 'number') : [];
    case 'list':
      return Array.isArray(value) ? value.map((item) => formValueOf(control.item, item)) : [];
    case 'object':
      return Object.fromEntries(
        control.fields.map(({ name, control: sub }) => [
          name,
          formValueOf(sub, isRecord(value) ? value[name] : undefined),
        ]),
      );
    default:
      return typeof value === 'string' ? value : '';
  }
}

/** A field's value read back from its control, or why it can't be read. */
export type Read =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly message: string };

const EMPTY: Read = { ok: true, value: undefined };

/** The record's value of a field from what its control holds; an empty field reads as undefined. */
export function recordValueOf(control: FieldControl, value: FormValue): Read {
  switch (control.type) {
    case 'number': {
      if (typeof value !== 'string' || value.trim() === '') return EMPTY;
      const number = Number(value);
      return Number.isFinite(number)
        ? { ok: true, value: number }
        : { ok: false, message: 'Тут має бути число' };
    }
    case 'rarity':
      return { ok: true, value: typeof value === 'number' ? value : undefined };
    case 'chips':
    case 'stress':
      return isList(value) && value.length > 0 ? { ok: true, value } : EMPTY;
    case 'list': {
      if (!isList(value)) return EMPTY;
      const items: unknown[] = [];
      for (const item of value) {
        const read = recordValueOf(control.item, item);
        if (!read.ok) return read;
        if (read.value !== undefined) items.push(read.value);
      }
      return items.length === 0 ? EMPTY : { ok: true, value: items };
    }
    case 'object': {
      if (!isObject(value)) return EMPTY;
      const fields: Record<string, unknown> = {};
      for (const { name, control: sub } of control.fields) {
        const read = recordValueOf(sub, value[name]);
        if (!read.ok) return read;
        if (read.value !== undefined) fields[name] = read.value;
      }
      return Object.keys(fields).length === 0 ? EMPTY : { ok: true, value: fields };
    }
    default:
      return typeof value === 'string' && value.trim() !== '' ? { ok: true, value } : EMPTY;
  }
}

const labelOf = (options: readonly Option[], value: FormValue) =>
  options.find((option) => option.value === value)?.label ??
  (typeof value === 'string' ? value : '');

/** A control's value as one line of text, as the stale diff shows it. */
export function shownOf(control: FieldControl, value: FormValue): string {
  switch (control.type) {
    case 'choice':
      return value === '' ? '' : labelOf(control.options, value);
    case 'chips':
      return isList(value) ? value.map((item) => labelOf(control.options, item)).join(', ') : '';
    case 'stress':
      return isList(value)
        ? value
            .map((position) => (typeof position === 'number' ? String(position + 1) : ''))
            .join(', ')
        : '';
    case 'rarity':
      return typeof value === 'number' ? String(value) : '';
    case 'list':
      return isList(value)
        ? value
            .map((item) => shownOf(control.item, item))
            .filter((text) => text !== '')
            .join('; ')
        : '';
    case 'object':
      return isObject(value)
        ? control.fields
            .map(({ name, control: sub }) => shownOf(sub, value[name]))
            .filter((text) => text !== '')
            .join(' · ')
        : '';
    default:
      return typeof value === 'string' ? value : '';
  }
}
