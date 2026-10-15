import type { UserStateChanges, UserStatePort } from './ports';

/**
 * One forward-only step of the user-state schema: the changes that bring the
 * records of the version before up to `version`.
 */
export interface UserStateMigration {
  readonly version: number;
  migrate(state: Pick<UserStatePort, 'get' | 'list'>): Promise<UserStateChanges>;
}
