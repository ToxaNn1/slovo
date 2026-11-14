import type { UserState } from '../user-state/user-state';
import { READER_NAME_AT_MOST, readerNameLength, settingsRecords } from './records';

export { READER_NAME_AT_MOST, readerNameLength };

/** What a typed name keeps (ADR 0136): the name trimmed, no name for a blank one, or nothing past the limit. */
export type ReaderNameChoice =
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'tooLong' };

/** The reader's name a typed one makes: trimmed, blank as none, refused past {@link READER_NAME_AT_MOST} characters. */
export function readerNameOf(typed: string): ReaderNameChoice {
  const name = typed.trim();
  if (name === '') return { kind: 'none' };
  if (readerNameLength(name) > READER_NAME_AT_MOST) return { kind: 'tooLong' };
  return { kind: 'name', name };
}

/**
 * The reader's optional name on the Profile (ADR 0136), kept in the user
 * state, which syncs it through the Account. It reaches no Analytics, no
 * Community Counter and no Questionnaire counter: it holds no port to them.
 */
export interface ReaderName {
  /** The name, or nothing while the reader has none. */
  readonly state: string | undefined;
  /** Keeps the name `typed` makes; a refused one keeps the name as it was. Resolves to the choice. */
  change(typed: string): Promise<ReaderNameChoice>;
  /** Calls `listener` after each change of the name. Returns the call that stops it. */
  subscribe(listener: () => void): () => void;
}

/** Opens the reader's name over the user state as it stands. */
export async function openReaderName({
  userState,
}: {
  userState: Pick<UserState, 'read' | 'write'>;
}): Promise<ReaderName> {
  const record = settingsRecords.readerName;
  let state = await userState.read(record);
  const listeners = new Set<() => void>();
  return {
    get state() {
      return state;
    },
    async change(typed) {
      const choice = readerNameOf(typed);
      if (choice.kind === 'tooLong') return choice;
      const next = choice.kind === 'name' ? choice.name : undefined;
      // An equal name is written too: its stamp lets the newer choice win on sync.
      await userState.write(record.change(next));
      if (next !== state) {
        state = next;
        for (const listener of listeners) listener();
      }
      return choice;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
