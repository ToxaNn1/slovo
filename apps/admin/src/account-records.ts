import type { AccountRow } from '@slovo/contracts/admin-api';
import { z } from 'zod';

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
const XpRecord = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('xp'), amount: z.number() }),
  z.object({ kind: z.literal('reset') }),
  z.object({ kind: z.literal('word-goal'), goal: z.number().nullable() }),
  z.object({ kind: z.literal('freeze') }),
  z.object({ kind: z.literal('break'), date: z.string(), days: z.number() }),
  z.object({ kind: z.literal('badge'), date: z.string(), badge: z.string() }),
]);

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
 * Collections, hidden Entries, «Знаю» and «Не знаю» marks, the progress the
 * XP log keeps (XP after the latest reset marker, the Daily Goal in force,
 * freezes used, Breaks and Badges) and settings. A record of no known kind,
 * or one that does not read as its kind, is counted under «Інші записи» by
 * the first part of its key, so nothing of the Account is left unseen.
 */
export function recordsBlocks(records: readonly SyncedRecord[]): readonly RecordsBlock[] {
  const favorites: string[] = [];
  const collections = new Map<string, { name: string; entries: string[] }>();
  const collectionEntries: { collectionId: string; entryId: string }[] = [];
  const hidden: string[] = [];
  const known: string[] = [];
  const unknown: string[] = [];
  const settings: string[] = [];
  const others = new Map<string, number>();
  let xp = 0;
  let goal: number | null | undefined;
  let freezes = 0;
  const breaks: string[] = [];
  const badges: string[] = [];

  const other = (key: string) => {
    const kind = key.split('.')[0] ?? key;
    others.set(kind, (others.get(kind) ?? 0) + 1);
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
      (_, value) => {
        const read = XpRecord.safeParse(value).data;
        if (read === undefined) return false;
        switch (read.kind) {
          case 'xp':
            xp += read.amount;
            break;
          case 'reset':
            xp = 0;
            break;
          case 'word-goal':
            goal = read.goal;
            break;
          case 'freeze':
            freezes += 1;
            break;
          case 'break':
            breaks.push(`Перерва з ${read.date} · ${String(read.days)} дн.`);
            break;
          case 'badge':
            badges.push(`Відзнака ${read.badge} · ${read.date}`);
            break;
        }
        return true;
      },
    ],
    [
      'settings.',
      (id, value) => {
        settings.push(`${id}: ${JSON.stringify(value)}`);
        return true;
      },
    ],
  ];

  // The XP log folds in the order the records were kept, which is the order they come in.
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

  const progress = [
    `XP: ${String(xp)}`,
    ...(goal === undefined ? [] : [`Денна ціль: ${goal === null ? 'Без цілі' : words(goal)}`]),
    `Заморозки використано: ${String(freezes)}`,
    ...breaks,
    ...badges,
  ];
  const blocks: RecordsBlock[] = [
    { title: 'Обране', lines: favorites },
    {
      title: 'Добірки',
      lines: [...collections.values()].map(
        ({ name, entries }) =>
          `${name} · ${words(entries.length)}${entries.length === 0 ? '' : `: ${entries.join(', ')}`}`,
      ),
    },
    { title: 'Приховані', lines: hidden },
    { title: 'Знаю', lines: known },
    { title: 'Не знаю', lines: unknown },
    { title: 'Прогрес', lines: progress },
    { title: 'Налаштування', lines: settings },
    {
      title: 'Інші записи',
      lines: [...others].map(([kind, count]) => `${kind}: ${String(count)}`),
    },
  ];
  return blocks.filter(({ lines }) => lines.length > 0);
}
