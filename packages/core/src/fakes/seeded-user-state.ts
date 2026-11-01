import type { Clock, UserStateChanges, UserStatePort } from '../ports';
import { trackChanges, type TrackedUserState } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort, openUserState, type UserState } from '../user-state/user-state';
import type { UserStateRecord, UserStateRecords } from '../user-state/user-state-record';
import { userStateRecords } from '../user-state-schema';

type Declared = typeof userStateRecords;

/** A fact the user state keeps, by the name the Core declares it under. */
export type UserStateFactName = keyof Declared;

/** The value of a fact: one value, or one value per id for a kind of records (a Best result per Game Mode, say). */
export type UserStateFact<N extends UserStateFactName> =
  Declared[N] extends UserStateRecord<infer T>
    ? T
    : Declared[N] extends UserStateRecords<infer T>
      ? Readonly<Record<string, T>>
      : never;

/** The facts a test seeds the user state with, each by its name; the Core keeps the keys and the encoding (ADR 0013). */
export type UserStateFacts = { readonly [N in UserStateFactName]?: UserStateFact<N> };

function isFactName(name: string): name is UserStateFactName {
  return name in userStateRecords;
}

/** The changes that keep the facts. */
function changesOf(facts: UserStateFacts): UserStateChanges {
  const changes = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(facts)) {
    if (!isFactName(name)) continue;
    const declared: UserStateRecord<unknown> | UserStateRecords<unknown> = userStateRecords[name];
    const each =
      'key' in declared
        ? [declared.change(value)]
        : Object.entries(typeof value === 'object' ? value : {}).map(([id, one]) =>
            declared.record(id).change(one),
          );
    for (const change of each) for (const [key, text] of change) changes.set(key, text);
  }
  return changes;
}

/** A stopped clock, for a test whose pending changes carry no time it reads. */
const stoppedClock: Clock = { now: () => new Date('2026-01-01T00:00:00Z'), timeZone: () => 'UTC' };

/**
 * The user state opened and tracked as on the device, holding the facts as
 * records kept from before: none of them is a pending change. It lives in
 * memory unless the test gives the port to seed (a database, or one that
 * watches the writes); each later write is tracked at the clock's time.
 */
export async function seedUserState(
  facts: UserStateFacts = {},
  {
    port = createMemoryUserStatePort(),
    clock = stoppedClock,
  }: { port?: UserStatePort; clock?: Clock } = {},
): Promise<TrackedUserState> {
  const userState = await openUserState({ port });
  await userState.write(changesOf(facts));
  return trackChanges({ userState, clock });
}

/** The fact the user state holds by the name: its value, or each value by id for a kind of records. */
export async function readFact<N extends UserStateFactName>(
  userState: UserState,
  name: N,
): Promise<
  Declared[N] extends UserStateRecord<infer T>
    ? T | undefined
    : Declared[N] extends UserStateRecords<infer T>
      ? ReadonlyMap<string, T>
      : never
>;
export async function readFact(userState: UserState, name: UserStateFactName): Promise<unknown> {
  const declared: UserStateRecord<unknown> | UserStateRecords<unknown> = userStateRecords[name];
  return 'key' in declared ? userState.read(declared) : userState.list(declared);
}
