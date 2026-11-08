import type { Clock } from '../ports';
import type { Actor, AdminAccess } from './admin-access';

/** Who ticked an Owner check and when; a tick takes no reason (ADR 0088). */
export interface OwnerCheckTick {
  readonly at: Date;
  readonly by: Actor;
}

/** A check the owner runs by hand on a version before it ships. */
export interface OwnerCheck {
  readonly id: number;
  /** The milestone the check belongs to, such as `0.9`. */
  readonly version: string;
  readonly text: string;
  readonly addedBy: Actor;
  readonly addedAt: Date;
  readonly ticked: OwnerCheckTick | null;
}

export type NewOwnerCheck = Omit<OwnerCheck, 'id'>;

export type TickResult = 'ticked' | 'already' | 'unknown';

/** Where the backend keeps the Owner checks. */
export interface OwnerCheckStore {
  /** Every check, of the version when one is given, oldest first. */
  list(version?: string): Promise<readonly OwnerCheck[]>;
  add(rows: readonly NewOwnerCheck[]): Promise<readonly OwnerCheck[]>;
  /** Ticks an open check; a ticked one keeps its first tick. */
  tick(id: number, tick: OwnerCheckTick): Promise<TickResult>;
  count(): Promise<number>;
}

/** A check line read from a Markdown file. */
export interface ParsedOwnerCheck {
  readonly version: string;
  readonly text: string;
  readonly ticked: boolean;
}

export type ParsedOwnerChecks =
  | { readonly kind: 'parsed'; readonly checks: readonly ParsedOwnerCheck[] }
  /** A check line with no version heading above it and no fallback version. */
  | { readonly kind: 'no-version'; readonly line: number };

/** A milestone `0.1` to `1.0`, not part of a date such as `08.11` or a build `0.9.1`. */
const VERSION = /(?<![\d.])(0\.\d{1,2}|1\.0)(?![\d.])/;
const HEADING = /^#{1,6}\s+(.*)$/;
const CHECK = /^\s*(?:[-*]\s+\[([ xX])\]|\d+\.)\s+(.+?)\s*$/;

/**
 * Reads the check lines of a Markdown file: `- [ ]`, `- [x]` and numbered items. A line takes
 * the version of the nearest heading that names one, else the fallback; headings and prose are skipped.
 */
export function ownerChecksOf(markdown: string, fallbackVersion?: string): ParsedOwnerChecks {
  const checks: ParsedOwnerCheck[] = [];
  let version = fallbackVersion;
  const lines = markdown.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const heading = HEADING.exec(line);
    if (heading) {
      const named = VERSION.exec(heading[1] ?? '');
      if (named?.[1]) version = named[1];
      continue;
    }
    const check = CHECK.exec(line);
    if (!check?.[2]) continue;
    if (version === undefined) return { kind: 'no-version', line: index + 1 };
    checks.push({ version, text: check[2], ticked: check[1] === 'x' || check[1] === 'X' });
  }
  return { kind: 'parsed', checks };
}

export type ImportResult =
  | { readonly kind: 'imported'; readonly count: number }
  | { readonly kind: 'no-version'; readonly line: number }
  /** The table already holds checks: the import runs once. */
  | { readonly kind: 'not-empty' };

/** The Owner checks: listed per version, ticked in Розробка, added by a command (ADR 0088). */
export interface OwnerChecks {
  list(version?: string): Promise<readonly OwnerCheck[]>;
  add(version: string, text: string, who: Actor): Promise<OwnerCheck>;
  tick(id: number, who: Actor): Promise<TickResult>;
  /** The one-time import of a checks file; a `[x]` line comes in ticked by the command. */
  import(markdown: string, command: string, fallbackVersion?: string): Promise<ImportResult>;
}

const viewOf = (check: OwnerCheck) => ({
  id: check.id,
  version: check.version,
  text: check.text,
  ticked: check.ticked !== null,
});

export function createOwnerChecks({
  store,
  clock,
  admin,
}: {
  store: OwnerCheckStore;
  clock: Clock;
  admin: Pick<AdminAccess, 'log'>;
}): OwnerChecks {
  const logAdded = (what: string, who: Actor, check: OwnerCheck) =>
    admin.log({
      who,
      what,
      before: null,
      after: viewOf(check),
      reason: null,
      editionId: null,
      batchId: null,
    });

  return {
    list: (version) => store.list(version),
    async add(version, text, who) {
      const [check] = await store.add([
        { version, text, addedBy: who, addedAt: clock.now(), ticked: null },
      ]);
      if (!check) throw new Error('The store added no Owner check.');
      await logAdded('owner-check.add', who, check);
      return check;
    },
    async tick(id, who) {
      const result = await store.tick(id, { at: clock.now(), by: who });
      if (result === 'ticked') {
        await admin.log({
          who,
          what: 'owner-check.tick',
          before: { id, ticked: false },
          after: { id, ticked: true },
          reason: null,
          editionId: null,
          batchId: null,
        });
      }
      return result;
    },
    async import(markdown, command, fallbackVersion) {
      const parsed = ownerChecksOf(markdown, fallbackVersion);
      if (parsed.kind === 'no-version') return parsed;
      if ((await store.count()) > 0) return { kind: 'not-empty' };
      const who: Actor = { kind: 'command', command };
      const at = clock.now();
      const added = await store.add(
        parsed.checks.map((check) => ({
          version: check.version,
          text: check.text,
          addedBy: who,
          addedAt: at,
          ticked: check.ticked ? { at, by: who } : null,
        })),
      );
      for (const check of added) await logAdded('owner-check.import', who, check);
      return { kind: 'imported', count: added.length };
    },
  };
}
