import { z } from 'zod';

import { accountRecords, INSTALLED_KEY } from '../account/records';
import { communityCounterRecords } from '../community-counters/records';
import { contentUpdateRecords } from '../content-update/records';
import { editionRecords } from '../edition/records';
import { feedRecords } from '../feed/records';
import { gameRecords } from '../game/records';
import { knowledgeRecords } from '../knowledge/records';
import { mistakeReportRecords } from '../mistake-reports/records';
import { mixRecords } from '../mix/records';
import { notificationRecords } from '../notifications/records';
import { onboardingRecords } from '../onboarding/records';
import { progressRecords } from '../progress/records';
import { questionnaireRecords } from '../questionnaire/records';
import { savedRecords } from '../saved/records';
import { searchRecords } from '../search/records';
import { settingsRecords } from '../settings/records';
import { syncRecords } from '../sync/records';
import {
  declareRecord,
  parseJson,
  type SyncMark,
  type UserStateRecord,
  type UserStateRecords,
} from './user-state-record';
import type { UserStateMigration } from './user-state-migration';

/**
 * The user-state schema (ADR 0013): the registry of every record the Core
 * keeps, the sync mark of a key, and the migrations that bring an older
 * schema forward. Each domain folder declares its own records in its
 * `records.ts`; the registry collects them and refuses two that clash.
 */

/** The record that holds the schema version of the user state, a whole number. */
export const SCHEMA_VERSION_KEY = 'schema.version';

/** A declared record, or a kind of records under a prefix. */
type Declaration = UserStateRecord<unknown> | UserStateRecords<unknown>;

/** The keys a declaration names: its key, or its prefix followed by any id. */
function claims(declaration: Declaration): { readonly key: string; readonly prefix: boolean } {
  return 'key' in declaration
    ? { key: declaration.key, prefix: false }
    : { key: declaration.prefix, prefix: true };
}

/** Whether two declarations name a key in common. */
function clash(a: Declaration, b: Declaration): boolean {
  const [first, second] = [claims(a), claims(b)];
  if (first.prefix && second.key.startsWith(first.key))
    return second.prefix || second.key.length > first.key.length;
  if (second.prefix && first.key.startsWith(second.key))
    return first.prefix || first.key.length > second.key.length;
  return first.key === second.key;
}

/**
 * Checks that no two domains declare a record of the same name and no two
 * declarations name a key in common, so each key belongs to one record.
 * Throws on the first clash.
 */
export function checkUserStateRecords(
  domains: readonly Readonly<Record<string, Declaration>>[],
): void {
  const checked: [string, Declaration][] = [];
  for (const domain of domains) {
    for (const [name, declaration] of Object.entries(domain)) {
      if (checked.some(([other]) => other === name)) {
        throw new Error(`Two user-state records are named "${name}".`);
      }
      const other = checked.find(([, kept]) => clash(kept, declaration));
      if (other !== undefined) {
        throw new Error(`The user-state records "${other[0]}" and "${name}" name a key in common.`);
      }
      checked.push([name, declaration]);
    }
  }
}

/** The schema's own record, which no domain declares. */
const schemaRecords = {
  /** The schema version, written by `openUserState` with each migration; it never syncs. */
  schemaVersion: declareRecord(SCHEMA_VERSION_KEY, z.number().int().nonnegative(), {
    sync: 'device-only',
  }),
};

/** The records of every domain, each declared in its domain folder. */
const domains = [
  schemaRecords,
  accountRecords,
  settingsRecords,
  feedRecords,
  searchRecords,
  savedRecords,
  mixRecords,
  knowledgeRecords,
  progressRecords,
  notificationRecords,
  onboardingRecords,
  questionnaireRecords,
  contentUpdateRecords,
  editionRecords,
  gameRecords,
  syncRecords,
  communityCounterRecords,
  mistakeReportRecords,
] as const;

checkUserStateRecords(domains);

/** Every record of the user state, by name. */
export const userStateRecords = {
  ...schemaRecords,
  ...accountRecords,
  ...settingsRecords,
  ...feedRecords,
  ...searchRecords,
  ...savedRecords,
  ...mixRecords,
  ...knowledgeRecords,
  ...progressRecords,
  ...notificationRecords,
  ...onboardingRecords,
  ...questionnaireRecords,
  ...contentUpdateRecords,
  ...editionRecords,
  ...gameRecords,
  ...syncRecords,
  ...communityCounterRecords,
  ...mistakeReportRecords,
};

/** Every declared record and kind of record, for finding the one a key belongs to. */
const declared: readonly Declaration[] = domains.flatMap((domain) => Object.values(domain));

/**
 * How the record under the key syncs, by the schema: its mark,
 * `last-write-wins` for an unmarked record, and nothing for a key the schema
 * doesn't declare, such as a record of a newer app.
 */
export function syncMarkOf(key: string): SyncMark | 'last-write-wins' | undefined {
  const declaration = declared.find((record) =>
    'key' in record
      ? record.key === key
      : key.startsWith(record.prefix) && key.length > record.prefix.length,
  );
  if (declaration === undefined) return undefined;
  return declaration.sync ?? 'last-write-wins';
}

/**
 * Whether the record under the key syncs: last write wins, `union` or
 * `highest`. A `device-only` record and a key the schema doesn't declare
 * don't.
 */
export function syncs(key: string): boolean {
  const mark = syncMarkOf(key);
  return mark !== undefined && mark !== 'device-only';
}

/**
 * The user-state schema, one step per version. Append a step to change it;
 * never edit or remove one that has shipped. A step names its keys as they
 * were in its version, since the records above may change after it.
 */
export const userStateMigrations: readonly UserStateMigration[] = [
  // 0.2: the user settings (Theme, font size). A new store has nothing to bring forward.
  { version: 1, migrate: () => Promise.resolve(new Map()) },
  // After 0.2: the settings are kept as JSON like every other record, not as bare text.
  {
    version: 2,
    async migrate({ get }) {
      const changes = new Map<string, string>();
      for (const key of ['settings.theme', 'settings.fontSize']) {
        const text = await get(key);
        if (text !== undefined) changes.set(key, JSON.stringify(text));
      }
      return changes;
    },
  },
  // After 0.2: Seen is one record per Entry (`feed.seen.` + id), not one array, so
  // sync can merge it record by record (ADR 0013). An unreadable array is dropped,
  // as 0.2 read nothing Seen from it.
  {
    version: 3,
    async migrate({ get }) {
      const text = await get('feed.seen');
      if (text === undefined) return new Map();
      const changes = new Map<string, string | undefined>([['feed.seen', undefined]]);
      const ids = z.array(z.string()).safeParse(parseJson(text));
      for (const id of ids.data ?? []) changes.set(`feed.seen.${id}`, JSON.stringify(true));
      return changes;
    },
  },
  // 0.8: a Seen record holds the id of the Cycle it was Seen in, not `true`, so a
  // device offline since an older Cycle can't carry its marks into a new one. Each
  // takes the current Cycle, or the first, which opens when none reads. The last
  // migration that may re-encode a record that syncs (ADR 0013): from 0.8 a new
  // encoding takes a new key.
  {
    version: 4,
    async migrate({ get, list }) {
      const text = await get('feed.cycle');
      // The Cycle as 0.7 kept it; one that doesn't read opens as the first.
      const cycle = z
        .object({ id: z.number().int().positive(), seed: z.number().int().nonnegative() })
        .safeParse(text === undefined ? undefined : parseJson(text));
      const changes = new Map<string, string>();
      for (const [key, value] of await list('feed.seen.')) {
        if (parseJson(value) === true) changes.set(key, JSON.stringify(cycle.data?.id ?? 1));
      }
      return changes;
    },
  },
  // 0.8.9: the installed marker. A store that holds a record besides its schema
  // version was kept by this install before the marker, so its Session stays;
  // a new store holds none, so the Account forgets a Session left from an
  // earlier install.
  {
    version: 5,
    async migrate({ list }) {
      const records = await list('');
      const kept = [...records.keys()].some((key) => key !== SCHEMA_VERSION_KEY);
      return new Map(kept ? [[INSTALLED_KEY, JSON.stringify(true)]] : []);
    },
  },
  // 0.8.12: a Best result per Game Mode (ADR 0052). The single `game.best` of
  // every mode becomes the Best result of «Вгадай слово», under a new key that
  // syncs as `highest`, with a pending change from the first-sign-in time so
  // the Account gets it too; `game.best` stays as it is and is no longer read.
  {
    version: 6,
    async migrate({ get }) {
      const text = await get('game.best');
      const best = z
        .number()
        .int()
        .min(0)
        .max(15)
        .safeParse(text === undefined ? undefined : parseJson(text));
      if (!best.success) return new Map();
      const value = JSON.stringify(best.data);
      return new Map([
        ['game.best.guess-word', value],
        [
          'sync.pending.game.best.guess-word',
          JSON.stringify({ changedAt: new Date(0).toISOString(), value }),
        ],
      ]);
    },
  },
];
