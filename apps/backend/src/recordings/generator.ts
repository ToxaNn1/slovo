import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

/** One Recording to make: a Narrator Voice reading a text. */
export interface RecordingRequest {
  readonly voice: string;
  readonly text: string;
}

export type RecordingOutcome =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly durationMs: number }
  | { readonly ok: false };

/** Makes Recordings, one outcome per request, in request order. */
export interface RecordingGenerator {
  record(requests: readonly RecordingRequest[]): Promise<RecordingOutcome[]>;
}

const ResultsSchema = z.array(
  z.discriminatedUnion('ok', [
    z.object({ id: z.string(), ok: z.literal(true), durationMs: z.number().int().min(0) }),
    z.object({ id: z.string(), ok: z.literal(false) }),
  ]),
);

const run = promisify(execFile);

/**
 * How long one run of the script may take: 25 minutes, under the 30-minute
 * lease (`RECORDING_LEASE_MS`), so a hung script never outlives its lease.
 */
export const GENERATOR_TIMEOUT_MS = 25 * 60 * 1000;

/**
 * The generator `recordings/generate.py` (ADR 0083) in its `--out-dir`
 * mode: one run of the script for the whole batch, the engine loaded once.
 */
export function scriptGenerator({
  command,
  modelDir,
  timeoutMs = GENERATOR_TIMEOUT_MS,
}: {
  /** The interpreter and the script, such as `[python, '-I', 'generate.py']`. */
  command: readonly [string, ...string[]];
  modelDir: string;
  /** The run is killed after this long and the batch fails. */
  timeoutMs?: number;
}): RecordingGenerator {
  return {
    async record(requests) {
      if (requests.length === 0) return [];
      const work = await mkdtemp(join(tmpdir(), 'recordings-'));
      try {
        const listed = requests.map((request, index) => ({ id: String(index), ...request }));
        const requestsFile = join(work, 'requests.json');
        const outDir = join(work, 'out');
        await writeFile(requestsFile, JSON.stringify(listed));
        const [program, ...args] = command;
        await run(
          program,
          [...args, '--model', modelDir, '--requests', requestsFile, '--out-dir', outDir],
          { maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: 'SIGKILL' },
        );
        const results = ResultsSchema.parse(
          JSON.parse(await readFile(join(outDir, 'results.json'), 'utf8')),
        );
        const byId = new Map(results.map((result) => [result.id, result]));
        return await Promise.all(
          listed.map(async ({ id }): Promise<RecordingOutcome> => {
            const result = byId.get(id);
            if (result?.ok !== true) return { ok: false };
            const bytes = new Uint8Array(await readFile(join(outDir, `${id}.mp3`)));
            return { ok: true, bytes, durationMs: result.durationMs };
          }),
        );
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    },
  };
}
