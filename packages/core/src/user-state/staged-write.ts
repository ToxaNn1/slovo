import type { UserStateChanges } from '../ports';
import type { UserState } from './user-state';

/**
 * A staged piece of a write of the user state: the changes of one module, for
 * a write someone else makes, alone or with other pieces, and the step that
 * makes them in memory once they are written (ADR 0013). A piece whose write
 * fails is never committed, so memory keeps what the user state keeps.
 *
 * A piece is made from what its module holds in memory then, so write it at
 * once: a piece staged before an earlier piece of the same module is
 * committed knows nothing of it.
 */
export interface StagedPiece<Made extends void | Promise<void> = void> {
  readonly changes: UserStateChanges;
  /**
   * Makes the changes in memory. `writeStaged` calls it once they are
   * written. `Made` is a promise for the piece whose commit takes time.
   */
  commit(): Made;
}

/** A staged piece whatever its commit takes: what a write is given. */
type AnyStagedPiece = StagedPiece<void | Promise<void>>;

const nothing = () => undefined;

/** The staged piece of the changes, with the step that makes them in memory, if they have one. */
export const staged = (changes: UserStateChanges, commit: () => void = nothing): StagedPiece => ({
  changes,
  commit,
});

/** A staged piece that changes nothing. */
export const NOTHING_STAGED: StagedPiece = staged(new Map());

/** The changes of the pieces in one map, in their order: a later piece's value of a key wins. */
const merged = (pieces: readonly AnyStagedPiece[]): UserStateChanges =>
  new Map(pieces.flatMap((piece) => [...piece.changes]));

const given = <Piece extends AnyStagedPiece>(pieces: readonly (Piece | undefined)[]): Piece[] =>
  pieces.filter((piece) => piece !== undefined);

/** Several pieces as one: their changes merged and their commits made in their order. */
export function stagedTogether(pieces: readonly (StagedPiece | undefined)[]): StagedPiece {
  const all = given(pieces);
  return {
    changes: merged(all),
    commit() {
      for (const piece of all) piece.commit();
    },
  };
}

/**
 * The staged write of the user state: merges the pieces' changes in their
 * order, writes them in one write, none when they change nothing, and then
 * commits the pieces in their order. Commits that take no time are made at
 * once, with nothing between them; one that takes time is waited for before
 * the next. A piece left out (`undefined`) is skipped. A write that fails
 * rejects and commits nothing.
 */
export async function writeStaged(
  userState: Pick<UserState, 'write'>,
  pieces: readonly (AnyStagedPiece | undefined)[],
): Promise<void> {
  const all = given(pieces);
  const changes = merged(all);
  if (changes.size > 0) await userState.write(changes);
  for (const piece of all) {
    const made = piece.commit();
    if (made !== undefined) await made;
  }
}
