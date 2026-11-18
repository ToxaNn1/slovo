import {
  RarityRangeSchema,
  TextSizeSchema,
  ThemeSchema,
  type TextSize,
  type Theme,
} from '@slovo/contracts';
import type { AccountDetail, AccountRow, AdminApiOutputs } from '@slovo/contracts/admin-api';
import { z } from 'zod';

import { titleOf } from './action-texts';
import { SWITCH_TEXTS } from './switches/switch-texts';

type SignInMethod = AccountRow['signInMethods'][number];

/** How a reader's recorded Sign-in methods read; a Sign-in code reaches every Account. */
const SIGN_IN_METHOD_LABELS: Readonly<Record<SignInMethod, string>> = {
  google: 'Google',
  apple: 'Apple',
};

/** The ways the Account signs in: a Sign-in code always, then its recorded Google and Apple. */
export function signInMethodsText(methods: readonly SignInMethod[]): string {
  return ['Код з листа', ...methods.map((method) => SIGN_IN_METHOD_LABELS[method])].join(', ');
}

/** One record of an Account in an Edition, as getAccount answers it. */
interface SyncedRecord {
  readonly key: string;
  readonly value: unknown;
}

/**
 * What names the ids an Edition's records keep: the Entries they name, as
 * the content database keeps them now, and the Edition card's Badges and
 * Narrator Voices, none while the card is loading.
 */
export interface RecordNames {
  readonly entries: AccountDetail['editions'][number]['entries'];
  readonly card: Pick<AdminApiOutputs['editionCard'], 'badges' | 'narratorVoices'> | undefined;
}

/** One block of an Edition's records on the Account page, each line a fact. */
export interface RecordsBlock {
  readonly title: string;
  readonly lines: readonly string[];
}

const plural = new Intl.PluralRules('uk');

/** «N слово / слова / слів» in Ukrainian. */
function words(count: number): string {
  const form = plural.select(count);
  return `${String(count)} ${form === 'one' ? 'слово' : form === 'few' ? 'слова' : 'слів'}`;
}

const Instant = z.string();
const Collection = z.object({ name: z.string() });
const Knowledge = z.object({ mark: z.enum(['known', 'unknown']) });
const Dated = { date: z.string(), at: z.string() };
/** Every kind the Core's XP log stores (its `StoredXpRecordSchema`), with the fields this page reads. */
const XpRecord = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('xp'), ...Dated, amount: z.number() }),
  z.object({ kind: z.literal('reset'), ...Dated }),
  z.object({ kind: z.literal('word-goal'), ...Dated, goal: z.number().nullable() }),
  z.object({ kind: z.literal('daily-goal'), ...Dated }),
  z.object({ kind: z.literal('goal-met'), ...Dated }),
  z.object({ kind: z.literal('freeze'), ...Dated }),
  z.object({ kind: z.literal('break'), ...Dated, days: z.number() }),
  z.object({ kind: z.literal('break-end'), ...Dated, start: z.string() }),
  z.object({ kind: z.literal('badge'), ...Dated, badge: z.string() }),
  z.object({ kind: z.literal('badge-opened'), ...Dated }),
  z.object({ kind: z.literal('wrong-answer'), ...Dated }),
]);
type XpRecord = z.infer<typeof XpRecord>;

/** What the XP log comes to on the Account page. */
interface Progress {
  readonly xp: number;
  /** The Daily Goal in force, `null` for «Без цілі», `undefined` when none was set. */
  readonly goal: number | null | undefined;
  readonly freezes: number;
  readonly breaks: readonly string[];
  readonly badges: readonly string[];
  /** The id of the latest reset marker, which a Best result after it carries. */
  readonly markerId: string | undefined;
}

/**
 * Folds the XP log as the Core does (ADR 0133): the latest reset marker is
 * the one with the latest instant, then the greatest id, and only the records
 * after its instant count, whatever order the server gives them in. The
 * Daily Goal in force is the last `word-goal` by date, then by instant.
 */
function progressOf(
  log: readonly { id: string; record: XpRecord }[],
  badgeName: (id: string) => string,
): Progress {
  let marker: { id: string; at: string } | undefined;
  for (const { id, record } of log) {
    if (record.kind !== 'reset') continue;
    if (
      marker === undefined ||
      record.at > marker.at ||
      (record.at === marker.at && id > marker.id)
    )
      marker = { id, at: record.at };
  }
  let xp = 0;
  let freezes = 0;
  const breaks: string[] = [];
  const badges: string[] = [];
  const goals: Extract<XpRecord, { kind: 'word-goal' }>[] = [];
  for (const { record } of log) {
    if (marker !== undefined && record.at <= marker.at) continue;
    switch (record.kind) {
      case 'xp':
        xp += record.amount;
        break;
      case 'word-goal':
        goals.push(record);
        break;
      case 'freeze':
        freezes += 1;
        break;
      case 'break':
        breaks.push(`Перерва з ${record.date} · ${String(record.days)} дн.`);
        break;
      case 'badge':
        badges.push(`Відзнака «${badgeName(record.badge)}» · ${record.date}`);
        break;
      default:
        // The other kinds are kept by the log and show nothing on this page.
        break;
    }
  }
  goals.sort((one, other) =>
    one.date === other.date ? one.at.localeCompare(other.at) : one.date.localeCompare(other.date),
  );
  return { xp, goal: goals.at(-1)?.goal, freezes, breaks, badges, markerId: marker?.id };
}

const THEMES: Readonly<Record<Theme, string>> = {
  system: 'Як у системі',
  light: 'Світла',
  dark: 'Темна',
};
const TEXT_SIZES: Readonly<Record<TextSize, string>> = {
  system: 'Як у системі',
  larger: 'Більший',
  largest: 'Найбільший',
};

const OldFontSize = z.enum(['S', 'M', 'L', 'XL']);
const OLD_FONT_SIZES: Readonly<Record<z.infer<typeof OldFontSize>, string>> = {
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
};

/** A setting's value read as one of its choices, `undefined` when it is none of them. */
const choiceOf =
  <T extends string>(schema: z.ZodType<T>, labels: Readonly<Record<T, string>>) =>
  (value: unknown) => {
    const read = schema.safeParse(value).data;
    return read === undefined ? undefined : labels[read];
  };

/** A switch's value as the Settings words it, `undefined` when it is not one. */
const toggle = (value: unknown) =>
  typeof value === 'boolean' ? (value ? 'увімкнено' : 'вимкнено') : undefined;

/**
 * The synced settings of the Core's `settingsRecords` by the key after
 * `settings.`: the name the app's Settings give it, and its value in words.
 */
function settingsOf(voiceName: (id: string) => string) {
  const settings: Readonly<
    Record<string, readonly [string, (value: unknown) => string | undefined]>
  > = {
    theme: ['Тема', choiceOf(ThemeSchema, THEMES)],
    textSize: ['Шрифт і розмір', choiceOf(TextSizeSchema, TEXT_SIZES)],
    // The S…XL scale before the text size followed the system (ADR 0134), still kept (ADR 0013).
    fontSize: ['Старий розмір шрифту', choiceOf(OldFontSize, OLD_FONT_SIZES)],
    hideStreak: ['Без лічильників', toggle],
    selfCheck: ['Перевір себе', toggle],
    seasonalDecor: ['Сезонний декор', toggle],
    narratorVoice: [
      'Голос диктора',
      (value) => (typeof value === 'string' ? voiceName(value) : undefined),
    ],
    rarityRange: [
      'Рідкість',
      (value) => {
        const read = RarityRangeSchema.safeParse(value).data;
        if (read === undefined) return undefined;
        return read.from === read.to
          ? `лише ${String(read.to)}`
          : `від ${String(read.from)} до ${String(read.to)}`;
      },
    ],
    readerName: ['Ім’я', (value) => (typeof value === 'string' ? value : undefined)],
  };
  /** A setting as one line: its name and value, or its key and value as kept when it reads as none. */
  return (id: string, value: unknown) => {
    const known = Object.hasOwn(settings, id) ? settings[id] : undefined;
    const text = known?.[1](value);
    return known === undefined || text === undefined
      ? `${id}: ${JSON.stringify(value)}`
      : `${known[0]}: ${text}`;
  };
}

/** The names of the Game Modes by their id, from their Feature Switches: `guess-word` is `gameGuessWord`. */
const GAME_MODE_NAMES = new Map(
  Object.entries(SWITCH_TEXTS).map(([feature, { name }]) => [feature, name] as const),
);
const gameModeName = (modeId: string) =>
  GAME_MODE_NAMES.get(
    `game${modeId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')}`,
  ) ?? modeId;

/** A kind of record that keeps an instant under an Entry's id, adding the id to the list. */
const instantsInto = (ids: string[]) => (id: string, value: unknown) => {
  if (!Instant.safeParse(value).success) return false;
  ids.push(id);
  return true;
};

/** The id after a key's prefix, when the key has that prefix and an id after it. */
function idAfter(key: string, prefix: string): string | undefined {
  return key.startsWith(prefix) && key.length > prefix.length
    ? key.slice(prefix.length)
    : undefined;
}

/**
 * An Edition's records as the Account page reads them (ADR 0162): Favorites,
 * Collections, hidden Entries and «Знаю» and «Не знаю» marks by the title of
 * their Entry, the progress the XP log keeps (XP after the latest reset
 * marker, the Daily Goal in force, freezes used, Breaks and Badges by name),
 * settings in words, the counts of History, the Active Days kept from before
 * 1.0, confirmed Entries, Corrections worked through and Curated Collections
 * opened, and the Best result of each Game Mode after the latest reset
 * marker. A record of no known kind, or one that does not read as its kind,
 * is counted under «Інші записи» by the first part of its key, so nothing of
 * the Account is left unseen.
 */
export function recordsBlocks(
  records: readonly SyncedRecord[],
  { entries, card }: RecordNames,
): readonly RecordsBlock[] {
  const titles = new Map(entries.map(({ id, kind, fields }) => [id, titleOf(kind, fields) ?? id]));
  const entryName = (id: string) => titles.get(id) ?? `${id} (немає в базі)`;
  const nameIn = (named: readonly { id: string; name: string }[] | undefined) => (id: string) =>
    named?.find((each) => each.id === id)?.name ?? id;
  const settingText = settingsOf(nameIn(card?.narratorVoices));

  const favorites: string[] = [];
  const collections = new Map<string, { name: string; entries: string[] }>();
  const collectionEntries: { collectionId: string; entryId: string }[] = [];
  const hidden: string[] = [];
  const known: string[] = [];
  const unknown: string[] = [];
  const settings: string[] = [];
  const others = new Map<string, number>();
  const xpLog: { id: string; record: XpRecord }[] = [];
  const history: string[] = [];
  const activeDays: string[] = [];
  const confirmed: string[] = [];
  const workedThrough: string[] = [];
  const curatedOpened: string[] = [];
  const bests: { id: string; result: number }[] = [];

  const other = (key: string) => {
    const kind = key.split('.')[0] ?? key;
    others.set(kind, (others.get(kind) ?? 0) + 1);
  };
  /** A kind of record counted by its ids, whatever it keeps under them. */
  const countedInto = (ids: string[]) => (id: string) => {
    ids.push(id);
    return true;
  };

  // Each kind of record, by its prefix: what it adds when its value reads as its kind.
  const kinds: readonly (readonly [string, (id: string, value: unknown) => boolean])[] = [
    ['favorites.', instantsInto(favorites)],
    [
      'collections.',
      (id, value) => {
        const read = Collection.safeParse(value).data;
        if (read === undefined) return false;
        collections.set(id, { name: read.name, entries: [] });
        return true;
      },
    ],
    [
      'collectionEntries.',
      (id) => {
        const dot = id.indexOf('.');
        if (dot <= 0) return false;
        collectionEntries.push({ collectionId: id.slice(0, dot), entryId: id.slice(dot + 1) });
        return true;
      },
    ],
    ['hidden.', instantsInto(hidden)],
    [
      'knowledge.',
      (id, value) => {
        const read = Knowledge.safeParse(value).data;
        if (read === undefined) return false;
        (read.mark === 'known' ? known : unknown).push(id);
        return true;
      },
    ],
    [
      'xp.',
      (id, value) => {
        const record = XpRecord.safeParse(value).data;
        if (record === undefined) return false;
        xpLog.push({ id, record });
        return true;
      },
    ],
    [
      'settings.',
      (id, value) => {
        settings.push(settingText(id, value));
        return true;
      },
    ],
    ['history.', countedInto(history)],
    ['activeDays.', countedInto(activeDays)],
    ['confirmed.', instantsInto(confirmed)],
    ['correctionsWorkedThrough.', countedInto(workedThrough)],
    ['curatedCollections.opened.', countedInto(curatedOpened)],
    [
      'game.bestRight.',
      (id, value) => {
        if (typeof value !== 'number') return false;
        bests.push({ id, result: value });
        return true;
      },
    ],
  ];

  for (const { key, value } of records) {
    const kind = kinds.find(([prefix]) => idAfter(key, prefix) !== undefined);
    const id = kind === undefined ? undefined : idAfter(key, kind[0]);
    if (kind === undefined || id === undefined || !kind[1](id, value)) other(key);
  }
  for (const { collectionId, entryId } of collectionEntries) {
    const collection = collections.get(collectionId);
    if (collection === undefined) other(`collectionEntries.${collectionId}`);
    else collection.entries.push(entryId);
  }

  const { xp, goal, freezes, breaks, badges, markerId } = progressOf(xpLog, nameIn(card?.badges));
  const progress = [
    `XP: ${String(xp)}`,
    ...(goal === undefined ? [] : [`Денна ціль: ${goal === null ? 'Без цілі' : words(goal)}`]),
    `Заморозки використано: ${String(freezes)}`,
    ...breaks,
    ...badges,
  ];
  const lastDay = activeDays.toSorted().at(-1);
  const activity = [
    ...(history.length === 0 ? [] : [`Переглянуті: ${words(history.length)}`]),
    ...(lastDay === undefined
      ? []
      : [`Активні дні до 1.0: ${String(activeDays.length)}, останній ${lastDay}`]),
    ...(confirmed.length === 0 ? [] : [`Підтверджені: ${words(confirmed.length)}`]),
    ...(workedThrough.length === 0
      ? []
      : [`Розібрані виправлення: ${String(workedThrough.length)}`]),
    ...(curatedOpened.length === 0
      ? []
      : [`Відкриті добірки редакції: ${String(curatedOpened.length)}`]),
  ];
  // A Best result counts when it carries the latest reset marker: one from before it is no more.
  const bestLines = bests.flatMap(({ id, result }) => {
    const [modeId = id, after] = id.split('~');
    return after === markerId ? [`${gameModeName(modeId)}: ${String(result)}`] : [];
  });
  const named = (ids: readonly string[]) => ids.map(entryName);
  const blocks: RecordsBlock[] = [
    { title: 'Обране', lines: named(favorites) },
    {
      title: 'Добірки',
      lines: [...collections.values()].map(
        ({ name, entries: inIt }) =>
          `${name} · ${words(inIt.length)}${inIt.length === 0 ? '' : `: ${named(inIt).join(', ')}`}`,
      ),
    },
    { title: 'Приховані', lines: named(hidden) },
    { title: 'Знаю', lines: named(known) },
    { title: 'Не знаю', lines: named(unknown) },
    { title: 'Прогрес', lines: progress },
    { title: 'Найкраще в грі', lines: bestLines },
    { title: 'Активність', lines: activity },
    { title: 'Налаштування', lines: settings },
    {
      title: 'Інші записи',
      lines: [...others].map(([kind, count]) => `${kind}: ${String(count)}`),
    },
  ];
  return blocks.filter(({ lines }) => lines.length > 0);
}
