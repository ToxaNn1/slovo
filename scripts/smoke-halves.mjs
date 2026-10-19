// `pnpm smoke:halves`: the full Maestro smoke as two halves at once, on two
// simulators (ticket #452, ADR 0028). Half 1 is `smoke-1.yaml`, half 2
// `smoke-2.yaml`; each runs on its own simulator against its own Metro, and
// both against one backend. It ends with a pass/fail list per half.
//
//   pnpm smoke:halves --device <udid> --device <udid> \
//     --metro <port> --metro <port> --api <port> [--half 1|2]
//
// --half runs only that half, on its own device and Metro of the pairs below
// (a rerun of one half after a failure).
//
// The first --device and --metro are half 1, the second half 2. The simulators
// must be booted, with the development client installed and a Metro running on
// each port. The backend (Postgres and Mailpit too) serves `account.yaml` and
// `sync.yaml`, which are both in half 2. The script boots and shuts down no
// simulator, Metro or backend.
//
// Maestro runs hold the machine-wide lock `/tmp/slovo-maestro.lock` (a
// directory, taken with mkdir): the script waits while it exists and removes
// it at the end, once for both halves. The raw output of each half is kept in
// a temporary folder whose path the script prints.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const mobile = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const LOCK = '/tmp/slovo-maestro.lock';
const JAVA_HOME = '/usr/local/opt/openjdk@17';

const USAGE =
  'Usage: pnpm smoke:halves --device <udid> --device <udid> --metro <port> --metro <port> --api <port> [--half 1|2]';

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    device: { type: 'string', multiple: true },
    metro: { type: 'string', multiple: true },
    api: { type: 'string' },
    half: { type: 'string' },
  },
  strict: false,
});
const devices = values.device ?? [];
const metros = values.metro ?? [];
if (devices.length !== 2 || new Set(devices).size !== 2) fail('Give two different --device UDIDs.');
if (metros.length !== 2 || new Set(metros).size !== 2) fail('Give two different --metro ports.');
if (values.half !== undefined && !['1', '2'].includes(values.half)) fail('--half is 1 or 2.');
const halves = values.half === undefined ? [0, 1] : [Number(values.half) - 1];
for (const port of [...metros, values.api]) {
  if (!/^\d{2,5}$/.test(port ?? '')) fail(`"${port}" is not a port.`);
}

// The feature flows a half calls, in order.
function flowsOf(file) {
  const text = readFileSync(join(mobile, 'maestro', file), 'utf8');
  return [...text.matchAll(/^- runFlow: (flows\/\S+\.yaml)$/gm)].map((match) => match[1]);
}

// The feature flows the output of a Maestro run reports as passed or failed. A
// flow that is still running has no mark yet, and Maestro stops a half at the
// first failure, so the flows after it have none either.
function flowResults(output) {
  const results = new Map();
  for (const line of output.split('\n')) {
    const match = /^\s*Run (flows\/\S+\.yaml)\.\.\. (COMPLETED|FAILED)$/.exec(line);
    if (match) results.set(match[1], match[2] === 'COMPLETED');
  }
  return results;
}

async function takeLock() {
  let told = false;
  for (;;) {
    try {
      mkdirSync(LOCK);
      return;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (!told) console.log(`Waiting for ${LOCK} (another Maestro run holds it)…`);
      told = true;
      await sleep(10_000);
    }
  }
}

let locked = false;
function releaseLock() {
  if (locked) rmSync(LOCK, { recursive: true, force: true });
  locked = false;
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseLock();
    process.exit(130);
  });
}

function minutes(ms) {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

function runHalf(index, logDir) {
  const file = `smoke-${index + 1}.yaml`;
  const log = join(logDir, `half-${index + 1}.log`);
  const started = Date.now();
  const env = { ...process.env };
  if (!env.JAVA_HOME && existsSync(JAVA_HOME)) env.JAVA_HOME = JAVA_HOME;
  // Two drivers start at once on a busy machine; the default 30 s is too short.
  env.MAESTRO_DRIVER_STARTUP_TIMEOUT ??= '240000';
  const child = spawn(
    'maestro',
    [
      '--device',
      devices[index],
      'test',
      '--no-ansi',
      `maestro/${file}`,
      '-e',
      `METRO_URL=http://localhost:${metros[index]}`,
      '-e',
      `API_URL=http://localhost:${values.api}`,
    ],
    { cwd: mobile, env },
  );
  let output = '';
  const collect = (chunk) => {
    output += chunk;
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  return new Promise((resolve) => {
    child.on('close', (code) => {
      writeFileSync(log, output);
      resolve({ index, file, log, code, output, ms: Date.now() - started });
    });
  });
}

const logDir = mkdtempSync(join(tmpdir(), 'slovo-smoke-halves-'));
await takeLock();
locked = true;
console.log(
  `${halves.length === 2 ? 'Both halves' : 'Half ' + (halves[0] + 1)} started; output in ${logDir}`,
);
const started = Date.now();
let runs;
try {
  runs = await Promise.all(halves.map((index) => runHalf(index, logDir)));
} finally {
  releaseLock();
}

let failed = false;
console.log('');
for (const run of runs) {
  const results = flowResults(run.output);
  const planned = flowsOf(run.file);
  const failedFlows = planned.filter((flow) => results.get(flow) === false);
  const passed = planned.filter((flow) => results.get(flow) === true);
  const notRun = planned.filter((flow) => !results.has(flow));
  // A half that exits non-zero with no flow marked failed died outside a flow
  // (the app did not open, Maestro could not reach the simulator).
  const ok = run.code === 0 && failedFlows.length === 0;
  if (!ok) failed = true;
  console.log(
    `Half ${run.index + 1} (${run.file}, ${devices[run.index]}): ${ok ? 'PASSED' : 'FAILED'} in ${minutes(run.ms)}`,
  );
  console.log(`  passed (${passed.length}/${planned.length}): ${passed.join(' ') || '—'}`);
  if (failedFlows.length > 0) console.log(`  failed: ${failedFlows.join(' ')}`);
  if (!ok && failedFlows.length === 0) console.log(`  failed outside a flow, exit ${run.code}`);
  if (!ok && notRun.length > 0) console.log(`  not run: ${notRun.join(' ')}`);
  console.log(`  output: ${run.log}`);
}
console.log(`\nThe run took ${minutes(Date.now() - started)}.`);
process.exit(failed ? 1 : 0);
