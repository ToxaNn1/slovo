/**
 * The commands that write through the content write API, one batch per run
 * (ADR 0090), and `check`, which runs the shared content rules on the input
 * locally and sends nothing. Each prints the API's answer: the id, the record
 * version, the content version and the batch, or what refused the write.
 */
import type { ApiClient } from '@slovo/contracts/api';
import {
  checkRecord,
  contentSetOf,
  parseRecord,
  recordFileOf,
  type Refusal,
} from '@slovo/content-rules';
import type { EditionConfig } from '@slovo/contracts';

import { refusalLines, type RecordKind } from './api';
import { readIncoming, readObject, withoutId } from './input';

export interface Io {
  print(line: string): void;
  problem(line: string): void;
}

interface Written {
  readonly id: string;
  readonly recordVersion: number;
  readonly contentVersion: number;
  readonly batchId: string;
  readonly needsNewRecording?: boolean | undefined;
}

const writtenLine = ({ id, recordVersion, contentVersion, batchId, needsNewRecording }: Written) =>
  `${id} v${String(recordVersion)} content v${String(contentVersion)} batch ${batchId}` +
  (needsNewRecording === true ? ' needs new Recording' : '');

/** Runs a write, printing its answer or its refusal; false when it was refused. */
async function attempt<T>(
  about: string,
  io: Io,
  write: () => Promise<T>,
  line: (answer: T) => string,
): Promise<T | undefined> {
  try {
    const answer = await write();
    io.print(line(answer));
    return answer;
  } catch (error) {
    for (const refusal of refusalLines(about, error)) io.problem(refusal);
    return undefined;
  }
}

/** Opens the run's one batch; undefined, with the refusal printed, when the API refuses it. */
async function openBatch(api: ApiClient, editionId: string, io: Io): Promise<string | undefined> {
  try {
    return (await api.admin.content.openBatch({ editionId })).batchId;
  } catch (error) {
    for (const line of refusalLines('batch', error)) io.problem(line);
    return undefined;
  }
}

/** The record version of the record as the API holds it now. */
async function currentVersion(
  api: ApiClient,
  where: { editionId: string; kind: RecordKind; id: string },
  io: Io,
): Promise<number | undefined> {
  try {
    return (await api.admin.content.record(where)).recordVersion;
  } catch (error) {
    for (const line of refusalLines(where.id, error)) io.problem(line);
    return undefined;
  }
}

/** Creates each record of an array file or a drafts folder; the backend issues the ids. */
export async function add(
  api: ApiClient,
  { editionId, kind, path }: { editionId: string; kind: RecordKind; path: string },
  io: Io,
): Promise<number> {
  const incoming = readIncoming(path);
  if (!incoming.ok) {
    for (const problem of incoming.problems) io.problem(problem);
    return 1;
  }
  const batchId = await openBatch(api, editionId, io);
  if (batchId === undefined) return 1;
  let refused = false;
  for (const { fields, origin } of incoming.records) {
    const written = await attempt(
      origin,
      io,
      () => api.admin.content.create({ editionId, kind, batchId, fields }),
      writtenLine,
    );
    if (written === undefined) refused = true;
  }
  return refused ? 1 : 0;
}

/**
 * Replaces a record's fields with the file's. The file names the record
 * version the edit was made from as `recordVersion`; without it the edit is
 * made from the current one.
 */
export async function edit(
  api: ApiClient,
  { editionId, kind, id, file }: { editionId: string; kind: RecordKind; id: string; file: string },
  io: Io,
): Promise<number> {
  const read = readObject(file);
  if (!read.ok) {
    io.problem(read.problem);
    return 1;
  }
  const { recordVersion: named, ...fields } = read.value;
  const recordVersion =
    typeof named === 'number' ? named : await currentVersion(api, { editionId, kind, id }, io);
  if (recordVersion === undefined) return 1;
  const batchId = await openBatch(api, editionId, io);
  if (batchId === undefined) return 1;
  const written = await attempt(
    id,
    io,
    () =>
      api.admin.content.edit({
        editionId,
        kind,
        id,
        batchId,
        recordVersion,
        fields: withoutId(fields),
      }),
    writtenLine,
  );
  return written === undefined ? 1 : 0;
}

/** Retires a record at its current record version: it stays, marked retired. */
export async function retire(
  api: ApiClient,
  { editionId, kind, id }: { editionId: string; kind: RecordKind; id: string },
  io: Io,
): Promise<number> {
  const recordVersion = await currentVersion(api, { editionId, kind, id }, io);
  if (recordVersion === undefined) return 1;
  const batchId = await openBatch(api, editionId, io);
  if (batchId === undefined) return 1;
  const written = await attempt(
    id,
    io,
    () => api.admin.content.retire({ editionId, kind, id, batchId, recordVersion }),
    writtenLine,
  );
  return written === undefined ? 1 : 0;
}

/** Flags a record for the Content queue with its explanation; the content stays. */
export async function flag(
  api: ApiClient,
  {
    editionId,
    kind,
    id,
    reason,
  }: { editionId: string; kind: RecordKind; id: string; reason: string },
  io: Io,
): Promise<number> {
  const batchId = await openBatch(api, editionId, io);
  if (batchId === undefined) return 1;
  const flagged = await attempt(
    id,
    io,
    () => api.admin.content.flag({ editionId, kind, id, batchId, reason }),
    (answer) => `${answer.id} flagged batch ${answer.batchId}`,
  );
  return flagged === undefined ? 1 : 0;
}

/** The id prefix of each kind of record (ADR 0010). */
const ID_PREFIX: Record<RecordKind, string> = {
  word: 'w_',
  correction: 'c_',
  idiom: 'i_',
  synonymRow: 'r_',
  tip: 't_',
  curatedCollection: 'cc_',
};

/**
 * Checks each record of the input with the shared content rules against
 * the Edition's current content, as a save would be checked, and prints
 * every refusal; nothing is sent.
 */
export async function check(
  api: ApiClient,
  {
    editionId,
    kind,
    path,
    config,
    today,
  }: { editionId: string; kind: RecordKind; path: string; config: EditionConfig; today: Date },
  io: Io,
): Promise<number> {
  const incoming = readIncoming(path);
  if (!incoming.ok) {
    for (const problem of incoming.problems) io.problem(problem);
    return 1;
  }
  let snapshot;
  try {
    snapshot = await api.content.snapshot({ editionId });
  } catch (error) {
    for (const line of refusalLines('snapshot', error)) io.problem(line);
    return 1;
  }
  const set = contentSetOf({
    word: snapshot.words,
    correction: snapshot.corrections,
    idiom: snapshot.idioms,
    synonymRow: snapshot.synonymRows,
    tip: snapshot.tips,
    curatedCollection: snapshot.curatedCollections,
  });
  const taken = new Set(
    [set.words, set.corrections, set.idioms, set.synonymRows, set.tips, set.curatedCollections]
      .flat()
      .map(({ file }) => file),
  );
  let refused = 0;
  let next = 0;
  for (const { fields, origin } of incoming.records) {
    // A placeholder id no record of the Edition holds: the backend issues the real one.
    let id: string;
    do id = `${ID_PREFIX[kind]}${(next++).toString(36).padStart(6, '0')}`;
    while (taken.has(recordFileOf(kind, id)));
    const parsed = parseRecord(kind, recordFileOf(kind, id), { ...fields, id });
    const refusals: Refusal[] = parsed.ok
      ? checkRecord(config, set, parsed.record, { today })
      : parsed.refusals;
    for (const { rule, field, message } of refusals) {
      io.problem(
        `${origin}: REFUSED ${rule}${field === undefined ? '' : ` (${field})`}: ${message}`,
      );
    }
    if (refusals.length > 0) refused += 1;
  }
  if (refused === 0) io.print(`${String(incoming.records.length)} records pass the content rules`);
  return refused === 0 ? 0 : 1;
}
