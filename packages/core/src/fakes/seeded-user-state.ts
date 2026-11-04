import type { Clock, UserStatePort } from '../ports';
import { trackChanges, type TrackedUserState } from '../user-state/tracked-user-state';
import { createMemoryUserStatePort, openUserState, type UserState } from '../user-state/user-state';
import type { UserStateRecord, UserStateRecords } from '../user-state/user-state-record';
import {
  changesOfFacts,
  type UserStateFact,
  type UserStateFactName,
  type UserStateFacts,
} from '../user-state/user-state-facts';
import { userStateRecords } from '../user-state-schema';

type Declared = typeof userStateRecords;

export type { UserStateFact, UserStateFactName, UserStateFacts };

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
  await userState.write(changesOfFacts(facts));
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
