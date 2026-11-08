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

/** Where an Admin user's TOTP stands: none yet, set up but never used to sign in, or on. */
export type AdminTotp =
  | { readonly state: 'none' }
  | { readonly state: 'pending'; readonly sealedSecret: string }
  | { readonly state: 'on'; readonly sealedSecret: string };

/** Seals a secret the store keeps, and opens it again. */
export interface SecretVault {
  seal(plain: string): string;
  open(sealed: string): string;
}

/** An active Admin user, as the sign-in knows them. */
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly totp: AdminTotp;
}

/** A signed-in admin session, by the hash of its cookie's token. */
export interface AdminSessionRow {
  readonly tokenHash: string;
  readonly user: AdminUser;
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

/** The admin's identities and its Action log, kept by the backend apart from the Accounts. */
export interface AdminStore {
  /** The active Admin user of the email, trimmed and lower case. */
  adminUserByEmail(email: string): Promise<AdminUser | undefined>;
  /** Keeps the email's one emailed code, by hash, in place of any before it. */
  setSignInCode(code: { email: string; codeHash: string; expiresAt: Date }): Promise<void>;
  /** The email's emailed code, by hash. */
  signInCode(email: string): Promise<{ codeHash: string; expiresAt: Date } | undefined>;
  deleteSignInCode(email: string): Promise<void>;
  /** Sets a sealed TOTP secret not yet used, and the recovery codes by hash, in place of any before. */
  setPendingTotp(
    adminUserId: string,
    sealedSecret: string,
    recoveryCodeHashes: readonly string[],
  ): Promise<void>;
  /** Turns the pending TOTP on: it has signed in once. */
  confirmTotp(adminUserId: string, at: Date): Promise<void>;
  /** Spends the recovery code; `false` when it is not one of the user's unspent codes. */
  spendRecoveryCode(adminUserId: string, codeHash: string, at: Date): Promise<boolean>;
  addAdminSession(session: {
    tokenHash: string;
    adminUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  /** The session of an active Admin user under the hash. */
  adminSession(tokenHash: string): Promise<AdminSessionRow | undefined>;
  touchAdminSession(tokenHash: string, at: Date): Promise<void>;
  /** The Admin user's sessions, newest first. */
  adminSessionsOf(adminUserId: string): Promise<readonly AdminSessionRow[]>;
  deleteAdminSession(tokenHash: string): Promise<void>;
  deleteAdminSessionsOf(adminUserId: string): Promise<void>;
  /** Whether at least one Власник is active. */
  hasOwner(): Promise<boolean>;
  /** Adds an Admin user; `taken` when the email has one already. */
  addAdminUser(user: {
    email: string;
    role: AdminRole;
    createdAt: Date;
  }): Promise<'added' | 'taken'>;
  /** The active Admin users, by email. */
  adminUsers(): Promise<readonly AdminUser[]>;
  /** Sets the role of an active Admin user. */
  setAdminRole(adminUserId: string, role: AdminRole): Promise<void>;
  /** Removes the Admin user's access: their state turns `removed` and their sessions end. */
  removeAdminUser(adminUserId: string): Promise<void>;
  /**
   * Gives a removed Admin user of the email access again under the role, with
   * no TOTP and no recovery codes, so they set them up afresh; `false` when
   * the email has no removed Admin user.
   */
  reactivateAdminUser(email: string, role: AdminRole): Promise<boolean>;
  /** Every Агент token by name, revoked or not, the hash left out. */
  agentTokens(): Promise<readonly AgentToken[]>;
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
  /** The 500 newest rows of the Action log, newest first, of the Edition when one is given. */
  actions(editionId?: string): Promise<readonly Action[]>;
}

/** An Агент token as Безпека lists it: never the token, nor its hash. */
export interface AgentToken {
  readonly name: string;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export type AddAgentResult =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: 'name-taken' };

/** A write of Безпека done, or refused by name. */
export type AccessResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: 'taken' | 'self' | 'unknown' };

/** Who wrote a change of Безпека, and why. */
export interface AccessWrite {
  readonly who: Actor;
  readonly reason: string | null;
}

/** Admin users, Агент tokens and the Action log (ADR 0088). */
export interface AdminAccess {
  /** Whether the admin is on: at least one Власник exists. */
  isOn(): Promise<boolean>;
  /** Appends a change to the Action log, stamped with the clock. */
  log(entry: ActionEntry): Promise<void>;
  /** The 500 newest rows of the Action log, newest first, of the Edition when one is given. */
  actions(editionId?: string): Promise<readonly Action[]>;
  /** Adds a Власник by a server command, and logs it. */
  addOwner(email: string, command: string): Promise<'added' | 'taken'>;
  /** The active Admin users, by email. */
  people(): Promise<readonly AdminUser[]>;
  /** Gives the email access under the role, and logs it; `taken` when it has access already. */
  invite(email: string, role: AdminRole, write: AccessWrite): Promise<AccessResult>;
  /** Changes the role of a person other than the writer, and logs it. */
  setRole(email: string, role: AdminRole, write: AccessWrite): Promise<AccessResult>;
  /** Removes the access of a person other than the writer, ending their sessions, and logs it. */
  remove(email: string, write: AccessWrite): Promise<AccessResult>;
  /** Every Агент token by name, revoked or not. */
  agents(): Promise<readonly AgentToken[]>;
  /** Issues an Агент token, answered once and kept as its hash, and logs it. */
  addAgent(name: string, write: AccessWrite): Promise<AddAgentResult>;
  /** Revokes the Агент's token, and logs it; `false` when it has none to revoke. */
  revokeAgent(name: string, write: AccessWrite): Promise<boolean>;
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
  const logBy = ({ who, reason }: AccessWrite, what: string, before: Json, after: Json) =>
    log({ who, what, before, after, reason, editionId: null, batchId: null });
  const normal = (email: string) => email.trim().toLowerCase();
  const isWriter = (who: Actor, email: string) => who.kind === 'admin-user' && who.email === email;

  return {
    isOn: () => store.hasOwner(),
    log,
    actions: (editionId) => store.actions(editionId),

    async addOwner(email, command) {
      const normalized = normal(email);
      const added = await store.addAdminUser({
        email: normalized,
        role: 'owner',
        createdAt: clock.now(),
      });
      if (added === 'added') {
        await logBy({ who: { kind: 'command', command }, reason: null }, 'admin.owner.add', null, {
          email: normalized,
          role: 'owner',
        });
      }
      return added;
    },

    people: () => store.adminUsers(),

    async invite(email, role, write) {
      const normalized = normal(email);
      const added = await store.addAdminUser({ email: normalized, role, createdAt: clock.now() });
      if (added === 'taken' && !(await store.reactivateAdminUser(normalized, role))) {
        return { ok: false, reason: 'taken' };
      }
      await logBy(write, 'admin.user.invite', null, { email: normalized, role });
      return { ok: true };
    },

    async setRole(email, role, write) {
      const normalized = normal(email);
      if (isWriter(write.who, normalized)) return { ok: false, reason: 'self' };
      const user = await store.adminUserByEmail(normalized);
      if (user === undefined) return { ok: false, reason: 'unknown' };
      await store.setAdminRole(user.id, role);
      await logBy(
        write,
        'admin.user.role',
        { email: normalized, role: user.role },
        {
          email: normalized,
          role,
        },
      );
      return { ok: true };
    },

    async remove(email, write) {
      const normalized = normal(email);
      if (isWriter(write.who, normalized)) return { ok: false, reason: 'self' };
      const user = await store.adminUserByEmail(normalized);
      if (user === undefined) return { ok: false, reason: 'unknown' };
      await store.removeAdminUser(user.id);
      await logBy(write, 'admin.user.remove', { email: normalized, role: user.role }, null);
      return { ok: true };
    },

    agents: () => store.agentTokens(),

    async addAgent(name, write) {
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
      await logBy(write, 'admin.agent.add', null, { name });
      return { ok: true, token };
    },

    async revokeAgent(name, write) {
      const revoked = await store.revokeAgentToken(name, clock.now());
      if (revoked) {
        await logBy(write, 'admin.agent.revoke', { name }, { name, revoked: true });
      }
      return revoked;
    },

    async agentOf(token) {
      if (!token.startsWith(TOKEN_PREFIX)) return undefined;
      return store.agentNamed(hash(token));
    },
  };
}
