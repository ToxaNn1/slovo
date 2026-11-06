import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { formatBuildError } from '@slovo/language-pack';
import {
  EditionFolderError,
  type EditionFolder,
  type EntryKind,
  type EntryText,
} from '@slovo/language-pack/edition';

import { PoliteClient, type Clock, type Fetch } from './polite-client';
import { formatReviewReport } from './report';
import type { DraftOutcome, DraftSummary, Flag, LemmaOutcome, ReviewReport } from './review-report';
import { matchKey, SOURCE_LANGUAGE } from './text';

/** What every sourcing run takes, whatever kind of Entry it drafts. */
export interface PipelineOptions {
  /** The Edition the drafts are for: its Categories, language traits, id registry and content. */
  readonly edition: EditionFolder;
  /** The review folder: each kind writes its drafts and review report into its own folder in it. */
  readonly outDir: string;
  /**
   * Where fetched pages and each host's request schedule are kept. Runs that
   * share it never fetch a page twice and share the throttle.
   */
  readonly cacheDir: string;
  readonly fetch: Fetch;
  readonly clock: Clock;
  /** A source of numbers in [0, 1), for new Entry ids. */
  readonly random: () => number;
  /** The least time between two requests to one host, across every process sharing the cache. */
  readonly minIntervalMs?: number;
  /** Hears about back-offs and hosts taken out of the run. */
  readonly log?: (message: string) => void;
}

export type SourcingResult =
  | {
      readonly ok: true;
      readonly report: ReviewReport;
      /** The review report the run wrote. */
      readonly reportFile: string;
    }
  | { readonly ok: false; readonly errors: readonly string[] };

/** One line of a list file, read by its kind. */
export type ParsedLine<R> =
  | { readonly ok: true; readonly text: string; readonly request: R }
  | {
      readonly ok: false;
      /** The text the line names, when it can be told; a repeat of it is refused too. */
      readonly text: string | undefined;
      readonly errors: readonly string[];
    };

/** What a kind's drafter gets from the run. */
export interface DraftContext {
  readonly client: PoliteClient;
  readonly edition: EditionFolder;
  /** A new opaque id of the kind that the id registry doesn't list and no draft of this run has. */
  readonly newId: () => string;
}

/** A draft as its kind drafted it; the run decides whether it is ready. */
export interface KindDraft {
  readonly entry: { readonly id: string };
  readonly headword: string;
  /** What the build's checks and the schema refuse, as `field: message`. */
  readonly issues: readonly string[];
  readonly flags: readonly Flag[];
  readonly summary: DraftSummary;
}

/** What a kind's drafter found for one line of the list. */
export interface KindOutcome {
  readonly drafts: readonly KindDraft[];
  /** What a human must look at for the line as a whole. */
  readonly flags: readonly Flag[];
}

/** A kind of Entry the sourcing run drafts: Words, and the kinds that extend the run. */
export interface SourcingKind<R> {
  /** Its folder in the review folder, e.g. `words`. */
  readonly folder: string;
  /** The Entries of the Edition a draft's text must not repeat. */
  readonly entryKind: EntryKind;
  /** The Entry as messages name it, e.g. `Word`. */
  readonly entryName: string;
  /** The prefix of its ids, e.g. `w_`. */
  readonly idPrefix: string;
  /** Reads one line of the list, its `#` comment and blanks already taken out. */
  parseLine(content: string, edition: EditionFolder): ParsedLine<R>;
  /** Starts drafting for a run; the drafter is called once per line, in list order. */
  start(context: DraftContext): (request: R) => Promise<KindOutcome>;
}

export const REPORT_FILE = 'review-report.md';
const DRAFTS_DIR = 'drafts';
const INCOMPLETE_DIR = 'incomplete';
const DEFAULT_MIN_INTERVAL_MS = 2000;

/**
 * One sourcing run: refuses an Edition the Ukrainian sources can't serve and a
 * list with any bad line before anything is fetched, drafts every line, and
 * writes the ready drafts to `drafts/`, the others to `incomplete/` and the
 * review report, all in the kind's folder of the review folder. A draft whose
 * text is already an Entry of the kind in the Edition, Retired or not, is
 * incomplete and flagged.
 */
export async function runSourcing<R>(
  list: string,
  options: PipelineOptions,
  kind: SourcingKind<R>,
): Promise<SourcingResult> {
  const { edition } = options;
  const takenIds = readTakenIds(edition);
  if (!takenIds.ok) return { ok: false, errors: takenIds.errors };
  const { locale } = edition.config;
  if (new Intl.Locale(locale).language !== SOURCE_LANGUAGE) {
    return {
      ok: false,
      errors: [`The sources are Ukrainian dictionaries, but the Edition is in ${locale}`],
    };
  }
  const parsed = parseList(list, edition, kind);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const client = new PoliteClient(
    options.fetch,
    options.clock,
    options.cacheDir,
    options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS,
    options.log,
  );
  const draft = kind.start({
    client,
    edition,
    newId: idMaker(kind.idPrefix, options.random, takenIds.ids),
  });
  const existing = existingTexts(edition, kind.entryKind);

  const dir = join(options.outDir, kind.folder);
  for (const folder of [DRAFTS_DIR, INCOMPLETE_DIR]) {
    rmSync(join(dir, folder), { recursive: true, force: true });
    mkdirSync(join(dir, folder), { recursive: true });
  }

  const lemmas: LemmaOutcome[] = [];
  for (const { text, line, request } of parsed.lines) {
    const outcome = await draft(request);
    const drafts = outcome.drafts.map((kindDraft): DraftOutcome => {
      const taken = existing.get(matchKey(kindDraft.summary.text)) ?? [];
      const flags =
        taken.length === 0
          ? kindDraft.flags
          : [...kindDraft.flags, existingEntryFlag(kindDraft.summary.text, kind.entryName, taken)];
      const ready = kindDraft.issues.length === 0 && taken.length === 0;
      const file = `${ready ? DRAFTS_DIR : INCOMPLETE_DIR}/${kindDraft.entry.id}.json`;
      writeFileSync(join(dir, file), `${JSON.stringify(kindDraft.entry, null, 2)}\n`);
      return {
        id: kindDraft.entry.id,
        file,
        ready,
        headword: kindDraft.headword,
        issues: kindDraft.issues,
        flags,
        summary: kindDraft.summary,
      };
    });
    lemmas.push({ lemma: text, line, drafts, flags: outcome.flags });
  }

  const report: ReviewReport = {
    lemmas,
    requests: { ...client.stats, unreachable: { ...client.stats.unreachable } },
  };
  const reportFile = join(dir, REPORT_FILE);
  writeFileSync(reportFile, formatReviewReport(report));
  return { ok: true, report, reportFile };
}

/** Reads the list: one request per line, `#` starts a comment; every bad or repeated line is named. */
function parseList<R>(
  text: string,
  edition: EditionFolder,
  kind: SourcingKind<R>,
):
  | { ok: true; lines: { text: string; line: number; request: R }[] }
  | { ok: false; errors: string[] } {
  const lines: { text: string; line: number; request: R }[] = [];
  const errors: string[] = [];
  const lineOf = new Map<string, number>();

  text.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const content = raw.replace(/#.*/, '').trim();
    if (content === '') return;
    const parsed = kind.parseLine(content, edition);
    const lineErrors = parsed.ok ? [] : [...parsed.errors];
    if (parsed.text !== undefined) {
      const key = matchKey(parsed.text);
      const firstLine = lineOf.get(key);
      if (firstLine !== undefined) {
        lineErrors.push(`"${parsed.text}" is already listed on line ${String(firstLine)}`);
      }
      lineOf.set(key, line);
    }
    errors.push(...lineErrors.map((message) => `Line ${String(line)}: ${message}`));
    if (parsed.ok) lines.push({ text: parsed.text, line, request: parsed.request });
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, lines };
}

/** The ids the Edition's id registry lists; none when it has no registry yet. */
function readTakenIds(
  edition: EditionFolder,
): { ok: true; ids: Set<string> } | { ok: false; errors: string[] } {
  try {
    return { ok: true, ids: new Set(edition.readIfPresent('idRegistry')) };
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    return { ok: false, errors: error.errors.map(formatBuildError) };
  }
}

/** New opaque ids that the Edition's id registry doesn't list, and no draft of this run has. */
function idMaker(prefix: string, random: () => number, takenIds: Set<string>): () => string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return () => {
    for (;;) {
      let id = prefix;
      for (let i = 0; i < 6; i += 1) id += alphabet.charAt(Math.floor(random() * alphabet.length));
      if (!takenIds.has(id)) {
        takenIds.add(id);
        return id;
      }
    }
  };
}

/** The Edition's Entries of one kind by the match key of their text. */
function existingTexts(edition: EditionFolder, kind: EntryKind): Map<string, EntryText[]> {
  const byText = new Map<string, EntryText[]>();
  for (const entry of edition.entryTexts()) {
    if (entry.kind !== kind) continue;
    const key = matchKey(entry.text);
    byText.set(key, [...(byText.get(key) ?? []), entry]);
  }
  return byText;
}

function existingEntryFlag(text: string, entryName: string, taken: readonly EntryText[]): Flag {
  const ids = taken.map((entry) => (entry.retired ? `${entry.id} (Retired)` : entry.id));
  return {
    kind: 'existing-entry',
    message: `"${text}" is already a ${entryName} of the Edition: ${ids.join(', ')}`,
  };
}
