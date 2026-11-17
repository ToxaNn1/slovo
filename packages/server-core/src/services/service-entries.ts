import {
  OPEN_ENTRY_TYPES,
  type ServiceEntry,
  type ServiceEntryType,
} from '@slovo/contracts/admin-api';

import type { AccessWrite, Actor, AdminAccess } from '../admin/admin-access';
import type { Clock } from '../ports';

/** How long a fresh TOTP opens «Показати» and «Копіювати» for one admin session (ADR 0164). */
export const VAULT_OPEN_MS = 15 * 60 * 1000;

/**
 * The Vault (ADR 0164): seals the secret Service entries under `VAULT_KEY`,
 * or is off while the Deployment has none, and then no entry is written.
 */
export type ServiceVault =
  | {
      readonly state: 'on';
      seal(plain: string): string;
      open(sealed: string): string;
    }
  | { readonly state: 'off' };

/** A Service entry's value as the store keeps it: a login and a link in the open, the rest sealed. */
export type StoredEntryValue =
  | { readonly kind: 'open'; readonly value: string }
  | { readonly kind: 'sealed'; readonly sealed: string };

/** A Service entry as the store keeps it. */
export interface StoredServiceEntry {
  readonly id: string;
  readonly serviceId: string;
  readonly type: ServiceEntryType;
  readonly label: string;
  readonly note: string | null;
  readonly value: StoredEntryValue;
}

/** Where the Service entries are kept. */
export interface ServiceEntryStore {
  /** The name of the Service, or none when there is no such Service. */
  serviceName(serviceId: string): Promise<string | undefined>;
  /** The Service's entries, by type and label. */
  list(serviceId: string): Promise<readonly StoredServiceEntry[]>;
  get(id: string): Promise<StoredServiceEntry | undefined>;
  /** Adds the entry, its id from the database. */
  add(entry: Omit<StoredServiceEntry, 'id'>): Promise<StoredServiceEntry>;
  update(entry: StoredServiceEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The fields of an entry a write may change. */
export interface EntryChanges {
  readonly label?: string | undefined;
  readonly note?: string | null | undefined;
  readonly value?: string | undefined;
}

/** A new entry of a Service. */
export interface NewEntry {
  readonly serviceId: string;
  readonly type: ServiceEntryType;
  readonly label: string;
  readonly note: string | null;
  readonly value: string;
}

/** An entry write done, or refused by name. */
export type EntryWriteResult<Done> =
  ({ readonly ok: true } & Done) | { readonly ok: false; readonly reason: 'vault-off' | 'unknown' };

/** One entry's plain value, or the refusal by name: the Vault locked for the session among them. */
export type EntryReadResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: 'vault-off' | 'locked' | 'unknown' };

/** Why a plain value is read: shown by «Показати», or copied by «Копіювати» without showing. */
export type EntryRead = 'reveal' | 'copy';

/** The Service entries of «Сервіси» (ADR 0164): no list answers a sealed value. */
export interface ServiceEntries {
  readonly vault: ServiceVault['state'];
  /** The Service's entries, sealed ones without their value; none when there is no such Service. */
  list(serviceId: string): Promise<readonly ServiceEntry[] | undefined>;
  add(entry: NewEntry, write: AccessWrite): Promise<EntryWriteResult<{ entry: ServiceEntry }>>;
  edit(
    id: string,
    changes: EntryChanges,
    write: AccessWrite,
  ): Promise<EntryWriteResult<{ entry: ServiceEntry }>>;
  remove(id: string, write: AccessWrite): Promise<EntryWriteResult<object>>;
  /**
   * Opens the Vault for the admin session for 15 minutes, once its Admin user
   * has entered a fresh TOTP; the window lives in memory, by the session.
   */
  unlock(session: string): { readonly openUntil: Date };
  /** One entry's plain value inside the session's window, logged by the entry and never the value. */
  read(id: string, how: EntryRead, session: string, who: Actor): Promise<EntryReadResult>;
}

const isOpenType = (type: ServiceEntryType): type is (typeof OPEN_ENTRY_TYPES)[number] =>
  OPEN_ENTRY_TYPES.some((open) => open === type);

/** An entry as a read answers it: a sealed one without its value. */
function shownOf({ id, serviceId, type, label, note, value }: StoredServiceEntry): ServiceEntry {
  if (isOpenType(type) && value.kind === 'open') {
    return { id, serviceId, type, label, note, value: value.value };
  }
  if (!isOpenType(type)) return { id, serviceId, type, label, note };
  throw new Error(`the ${type} entry ${id} is stored sealed`);
}

/**
 * Keeps the Service entries, sealing passwords, tokens and recovery codes in
 * the Vault. Each write leaves an Action log row that names the Service, the
 * entry and the changed fields, and never a value.
 */
export function createServiceEntries({
  store,
  vault,
  admin,
  clock,
}: {
  store: ServiceEntryStore;
  vault: ServiceVault;
  admin: Pick<AdminAccess, 'log'>;
  clock: Clock;
}): ServiceEntries {
  /** The end of each admin session's window, by its token; none is ever written down. */
  const openUntil = new Map<string, Date>();
  const isOpen = (session: string) => {
    const until = openUntil.get(session);
    return until !== undefined && clock.now() < until;
  };

  const log = (
    { who, reason }: AccessWrite,
    what: string,
    entry: StoredServiceEntry,
    service: string,
    fields: readonly string[],
  ) =>
    admin.log({
      who,
      what,
      before: null,
      after: { service, entry: entry.id, type: entry.type, fields: [...fields] },
      reason,
      editionId: null,
      batchId: null,
    });

  return {
    vault: vault.state,

    async list(serviceId) {
      if ((await store.serviceName(serviceId)) === undefined) return undefined;
      return (await store.list(serviceId)).map(shownOf);
    },

    async add({ value, ...entry }, write) {
      if (vault.state === 'off') return { ok: false, reason: 'vault-off' };
      const service = await store.serviceName(entry.serviceId);
      if (service === undefined) return { ok: false, reason: 'unknown' };
      const added = await store.add({
        ...entry,
        value: isOpenType(entry.type)
          ? { kind: 'open', value }
          : { kind: 'sealed', sealed: vault.seal(value) },
      });
      await log(write, 'service.entry.add', added, service, ['type', 'label', 'note', 'value']);
      return { ok: true, entry: shownOf(added) };
    },

    async edit(id, changes, write) {
      if (vault.state === 'off') return { ok: false, reason: 'vault-off' };
      const entry = await store.get(id);
      const service = entry === undefined ? undefined : await store.serviceName(entry.serviceId);
      if (entry === undefined || service === undefined) return { ok: false, reason: 'unknown' };
      // A sealed value is opened by a reveal or a copy alone: a new one given counts as changed.
      const valueChanged =
        changes.value !== undefined &&
        (entry.value.kind === 'sealed' || changes.value !== entry.value.value);
      const fields = [
        changes.label !== undefined && changes.label !== entry.label ? 'label' : [],
        changes.note !== undefined && changes.note !== entry.note ? 'note' : [],
        valueChanged ? 'value' : [],
      ].flat();
      const { value } = changes;
      const edited: StoredServiceEntry = {
        ...entry,
        label: changes.label ?? entry.label,
        note: changes.note === undefined ? entry.note : changes.note,
        value:
          value === undefined || !fields.includes('value')
            ? entry.value
            : entry.value.kind === 'open'
              ? { kind: 'open', value }
              : { kind: 'sealed', sealed: vault.seal(value) },
      };
      await store.update(edited);
      await log(write, 'service.entry.edit', edited, service, fields);
      return { ok: true, entry: shownOf(edited) };
    },

    async remove(id, write) {
      if (vault.state === 'off') return { ok: false, reason: 'vault-off' };
      const entry = await store.get(id);
      const service = entry === undefined ? undefined : await store.serviceName(entry.serviceId);
      if (entry === undefined || service === undefined) return { ok: false, reason: 'unknown' };
      await store.remove(id);
      await log(write, 'service.entry.delete', entry, service, []);
      return { ok: true };
    },

    unlock(session) {
      const now = clock.now();
      for (const [kept, until] of openUntil) if (until <= now) openUntil.delete(kept);
      const until = new Date(now.getTime() + VAULT_OPEN_MS);
      openUntil.set(session, until);
      return { openUntil: until };
    },

    async read(id, how, session, who) {
      if (vault.state === 'off') return { ok: false, reason: 'vault-off' };
      if (!isOpen(session)) return { ok: false, reason: 'locked' };
      const entry = await store.get(id);
      const service = entry === undefined ? undefined : await store.serviceName(entry.serviceId);
      if (entry === undefined || service === undefined) return { ok: false, reason: 'unknown' };
      const value =
        entry.value.kind === 'open' ? entry.value.value : vault.open(entry.value.sealed);
      await admin.log({
        who,
        what: `service.entry.${how}`,
        before: null,
        after: { service, entry: entry.id, type: entry.type },
        reason: null,
        editionId: null,
        batchId: null,
      });
      return { ok: true, value };
    },
  };
}
