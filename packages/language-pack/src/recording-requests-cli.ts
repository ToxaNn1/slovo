/**
 * Prints the Recordings to generate for an Edition, as JSON (ADR 0083):
 *
 *   pnpm recording-requests <edition-id> [--only all|missing] [--out <file>]
 *
 * Each item is `{ voice, wordId, text }`. `--only missing` (the default)
 * leaves out the Words a Narrator Voice already has a Recording of.
 * The Recordings generator (`apps/backend/recordings/generate.py`) read this list until ADR 0099.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { EDITIONS_DIR, EditionFolderError, openEdition } from './edition-folder';
import { recordingRequests, type RecordingScope } from './recording-requests';

const USAGE = 'Usage: pnpm recording-requests <edition-id> [--only all|missing] [--out <file>]';

function scopeOf(value: string | undefined): RecordingScope | undefined {
  if (value === undefined || value === 'missing') return 'missing';
  return value === 'all' ? 'all' : undefined;
}

function main(): number {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { only: { type: 'string' }, out: { type: 'string' } },
  });
  const [editionId] = positionals;
  const scope = scopeOf(values.only);
  if (editionId === undefined || positionals.length > 1 || scope === undefined) {
    console.error(USAGE);
    return 2;
  }
  let requests;
  try {
    requests = recordingRequests(openEdition(EDITIONS_DIR, editionId), scope);
  } catch (error) {
    if (!(error instanceof EditionFolderError)) throw error;
    console.error(error.message);
    return 1;
  }
  const json = `${JSON.stringify(requests, null, 2)}\n`;
  if (values.out === undefined) process.stdout.write(json);
  else writeFileSync(resolve(process.env['INIT_CWD'] ?? process.cwd(), values.out), json);
  return 0;
}

process.exitCode = main();
