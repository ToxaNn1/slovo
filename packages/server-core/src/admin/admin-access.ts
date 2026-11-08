import type { Clock, Json, Random } from '../ports';

/** The role of an Admin user: Власник does everything, Адмін everything but Безпека (ADR 0088). */
export type AdminRole = 'owner' | 'admin';

/** Who made a change the Action log records. */
export type Actor =
  | { readonly kind: 'admin-user'; readonly email: string }
  | { readonly kind: 'agent'; readonly name: string }
  | { readonly kind: 'command'; readonly command: string };

/** What a change brings to the Action log; the log adds when. */
export interface ActionEntry {
  readonly who: Actor;
  /** What changed, such as `admin.owner.add` or `content.entry.edit`. */
  readonly what: string;
  readonly before: Json;
  readonly after: Json;
  readonly reason: string | null;
  readonly editionId: string | null;
  /** The batch the change belongs to: one CLI run of an Агент is one batch. */
  readonly batchId: string | null;
}

/** One row of the Action log, kept forever and never edited. */
export interface Action extends ActionEntry {
  readonly at: Date;
}

/** The admin's identities and its Action log, kept by the backend apart from the Accounts. */
export interface AdminStore {
  /** Whether at least one Власник is active. */
  hasOwner(): Promise<boolean>;
  /** Adds an Admin user; `taken` when the email has one already. */
  addAdminUser(user: {
    email: string;
    role: AdminRole;
    createdAt: Date;
  }): Promise<'added' | 'taken'>;
  /** Adds an Агент token by its hash; `taken` when the name has a token, revoked or not. */
  addAgentToken(token: {
    name: string;
    tokenHash: string;
    createdAt: Date;
  }): Promise<'added' | 'taken'>;
  /** Revokes the name's token; `false` when it has none that is not revoked. */
  revokeAgentToken(name: string, at: Date): Promise<boolean>;
  /** The name of the Агент whose token is not revoked and hashes to `tokenHash`. */
  agentNamed(tokenHash: string): Promise<string | undefined>;
  /** Appends a row to the Action log: the one write path of the log. */
  appendAction(action: Action): Promise<void>;
  /** The Action log, oldest first, of the Edition when one is given. */
  actions(editionId?: string): Promise<readonly Action[]>;
}

export type AddAgentResult =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: 'name-taken' };

/** Admin users, Агент tokens and the Action log (ADR 0088). */
export interface AdminAccess {
  /** Whether the admin is on: at least one Власник exists. */
  isOn(): Promise<boolean>;
  /** Appends a change to the Action log, stamped with the clock. */
  log(entry: ActionEntry): Promise<void>;
  /** The Action log, oldest first, of the Edition when one is given. */
  actions(editionId?: string): Promise<readonly Action[]>;
  /** Adds a Власник by a server command, and logs it. */
  addOwner(email: string, command: string): Promise<'added' | 'taken'>;
  /** Issues an Агент token, answered once and kept as its hash, and logs it. */
  addAgent(name: string, command: string): Promise<AddAgentResult>;
  /** Revokes the Агент's token, and logs it; `false` when it has none to revoke. */
  revokeAgent(name: string, command: string): Promise<boolean>;
  /** The Агент a bearer token authenticates, if any. */
  agentOf(token: string): Promise<string | undefined>;
}

const TOKEN_LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** 40 letters of 62: over 230 bits, beyond any guessing. */
const TOKEN_LENGTH = 40;
const TOKEN_PREFIX = 'slovo_agent_';

export function createAdminAccess({
  store,
  clock,
  random,
  hash,
}: {
  store: AdminStore;
  clock: Clock;
  random: Random;
  /** A one-way hash of a token, the one the store keeps instead of the token. */
  hash: (token: string) => string;
}): AdminAccess {
  const log = (entry: ActionEntry) => store.appendAction({ ...entry, at: clock.now() });
  const byCommand = (command: string, what: string, before: Json, after: Json) =>
    log({
      who: { kind: 'command', command },
      what,
      before,
      after,
      reason: null,
      editionId: null,
      batchId: null,
    });

  return {
    isOn: () => store.hasOwner(),
    log,
    actions: (editionId) => store.actions(editionId),

    async addOwner(email, command) {
      const normalized = email.trim().toLowerCase();
      const added = await store.addAdminUser({
        email: normalized,
        role: 'owner',
        createdAt: clock.now(),
      });
      if (added === 'added') {
        await byCommand(command, 'admin.owner.add', null, { email: normalized, role: 'owner' });
      }
      return added;
    },

    async addAgent(name, command) {
      const letters = Array.from({ length: TOKEN_LENGTH }, () =>
        TOKEN_LETTERS.charAt(random.int(TOKEN_LETTERS.length)),
      );
      const token = TOKEN_PREFIX + letters.join('');
      const added = await store.addAgentToken({
        name,
        tokenHash: hash(token),
        createdAt: clock.now(),
      });
      if (added === 'taken') return { ok: false, reason: 'name-taken' };
      await byCommand(command, 'admin.agent.add', null, { name });
      return { ok: true, token };
    },

    async revokeAgent(name, command) {
      const revoked = await store.revokeAgentToken(name, clock.now());
      if (revoked) {
        await byCommand(command, 'admin.agent.revoke', { name }, { name, revoked: true });
      }
      return revoked;
    },

    async agentOf(token) {
      if (!token.startsWith(TOKEN_PREFIX)) return undefined;
      return store.agentNamed(hash(token));
    },
  };
}
