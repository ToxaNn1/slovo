import type { UserStateChanges } from '../ports';
import type { UserStateRecord, UserStateRecords } from './user-state-record';
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

/**
 * Facts of the user state, each by its name, such as the facts a test seeds
 * or a test state holds; the Core keeps the keys and the encoding (ADR 0013).
 */
export type UserStateFacts = { readonly [N in UserStateFactName]?: UserStateFact<N> };

function isFactName(name: string): name is UserStateFactName {
  return name in userStateRecords;
}

/** The changes of the user state that keep the facts, each under its record's key. */
export function changesOfFacts(facts: UserStateFacts): UserStateChanges {
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
