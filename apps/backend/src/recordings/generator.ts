import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { z } from 'zod';

/** One Recording to make: a Narrator Voice reading a text. */
export interface RecordingRequest {
  readonly voice: string;
  readonly text: string;
}

export type RecordingOutcome =
  | { readonly ok: true; readonly bytes: Uint8Array; readonly durationMs: number }
  | { readonly ok: false };

/** What one run of the generator made: one outcome per request, in request order. */
export interface RecordingBatch {
  readonly outcomes: RecordingOutcome[];
  /** The run hit its time limit before it reached every request. */
  readonly timedOut: boolean;
}

/** Makes Recordings. */
export interface RecordingGenerator {
  record(requests: readonly RecordingRequest[]): Promise<RecordingBatch>;
}

const ResultsSchema = z.array(
  z.discriminatedUnion('ok', [
    z.object({ id: z.string(), ok: z.literal(true), durationMs: z.number().int().min(0) }),
    z.object({ id: z.string(), ok: z.literal(false) }),
  ]),
);

/**
 * The threads torch and its maths libraries (OpenMP, MKL, OpenBLAS) may use:
 * by default they take one per core of the whole Railway host, which the
 * service's 2 vCPU cannot run, and the engine crawls.
 */
const GENERATOR_THREADS = 2;

/**
 * Runs the script to its end or its time limit, passing on each line it
 * prints as it prints it; whether the time limit killed it, or why it failed.
 */
function runScript(
  [program, ...args]: readonly [string, ...string[]],
  timeoutMs: number,
  log: (line: string) => void,
): Promise<{ readonly timedOut: boolean; readonly error?: Error }> {
  const threads = String(GENERATOR_THREADS);
  const child = spawn(program, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      OMP_NUM_THREADS: threads,
      MKL_NUM_THREADS: threads,
      OPENBLAS_NUM_THREADS: threads,
    },
  });
  const read = [child.stdout, child.stderr].map(
    (stream) =>
      new Promise<void>((resolve) => {
        const lines = createInterface({ input: stream });
        lines.on('line', log);
        lines.on('close', resolve);
      }),
  );
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);
  return new Promise((resolve) => {
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ timedOut, error });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      void Promise.all(read).then(() => {
        if (timedOut)
          resolve({ timedOut, error: new Error(`timed out after ${String(timeoutMs)} ms`) });
        else if (code === 0) resolve({ timedOut });
        else
          resolve({
            timedOut,
            error: new Error(`the script exited with ${signal ?? String(code)}`),
          });
      });
    });
  });
}

/**
 * How long one run of the script may take: 25 minutes, under the 30-minute
 * lease (`RECORDING_LEASE_MS`), so a hung script never outlives its lease.
 * A run it stops keeps the Recordings the script listed by then.
 */
const GENERATOR_TIMEOUT_MS = 25 * 60 * 1000;

/**
 * The generator `recordings/generate.py` in its `--out-dir`
 * mode: one run of the script for the whole batch, the engine loaded once.
 */
export function scriptGenerator({
  command,
  modelDir,
  timeoutMs = GENERATOR_TIMEOUT_MS,
  log = (line) => {
    console.log(`recordings: ${line}`);
  },
}: {
  /** The interpreter and the script, such as `[python, '-I', 'generate.py']`. */
  command: readonly [string, ...string[]];
  modelDir: string;
  /**
   * The run is killed after this long: the requests the script listed as
   * made keep their Recordings and the rest fail.
   */
  timeoutMs?: number;
  /** Takes each line the script prints, such as the seconds a request took. */
  log?: (line: string) => void;
}): RecordingGenerator {
  return {
    async record(requests) {
      if (requests.length === 0) return { outcomes: [], timedOut: false };
      const work = await mkdtemp(join(tmpdir(), 'recordings-'));
      try {
        const listed = requests.map((request, index) => ({ id: String(index), ...request }));
        const requestsFile = join(work, 'requests.json');
        const outDir = join(work, 'out');
        await writeFile(requestsFile, JSON.stringify(listed));
        const { timedOut, error: stopped } = await runScript(
          [...command, '--model', modelDir, '--requests', requestsFile, '--out-dir', outDir],
          timeoutMs,
          log,
        );
        // The script rewrites results.json after every request, so a run that
        // stopped part way still lists what it made; with no list, the batch fails.
        const results = await readFile(join(outDir, 'results.json'), 'utf8').then(
          (text) => ResultsSchema.parse(JSON.parse(text)),
          (error: unknown) => {
            throw stopped ?? error;
          },
        );
        if (stopped !== undefined)
          console.error(
            `recordings: the generator stopped after ${String(results.length)} of ` +
              `${String(requests.length)} requests: ${stopped.message}`,
          );
        const byId = new Map(results.map((result) => [result.id, result]));
        const outcomes = await Promise.all(
          listed.map(async ({ id }): Promise<RecordingOutcome> => {
            const result = byId.get(id);
            if (result?.ok !== true) return { ok: false };
            const bytes = new Uint8Array(await readFile(join(outDir, `${id}.mp3`)));
            return { ok: true, bytes, durationMs: result.durationMs };
          }),
        );
        return { outcomes, timedOut };
      } finally {
        await rm(work, { recursive: true, force: true });
      }
    },
  };
}
