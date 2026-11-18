// `pnpm app-pass`: the full Maestro app pass, `apps/mobile/maestro/app-pass.yaml`
// (ADR 0177). It opens every screen route of the app and the sheets a tap
// opens, keeping a screenshot of each, and ends with the steps that passed and
// the first that failed.
//
//   pnpm app-pass [--device <udid>] [--expo-go] [--metro <port>]
//                 [--entry <entry id>] [--state <test state>] [--out <folder>]
//
// The simulator must be booted with the app open from the one Metro (8082
// when --metro is left out); the script starts no simulator and no Metro.
// --expo-go runs the pass in Expo Go (`host.exp.Exponent`) through its
// `exp://127.0.0.1:<metro>/--/` links instead of the development client's
// `slovo://`. --state loads a test state first (docs/agents/test-states.md,
// development client only), replacing the simulator's user state:
// `full-saved` gives the Collection steps a Collection. --out keeps the
// screenshots and the log in that folder (a new temporary one by default).
//
// The run holds the machine-wide Maestro lock `/tmp/slovo-maestro.lock`, as
// `pnpm smoke:halves` does: it waits while another run holds it.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const mobile = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const LOCK = '/tmp/slovo-maestro.lock';
const JAVA_HOME = '/usr/local/opt/openjdk@17';
const USAGE =
  'Usage: pnpm app-pass [--device <udid>] [--expo-go] [--metro <port>] [--entry <id>] [--state <name>] [--out <folder>]';

function fail(message) {
  console.error(`${message}\n${USAGE}`);
  process.exit(2);
}

const { values } = parseArgs({
  options: {
    device: { type: 'string' },
    'expo-go': { type: 'boolean', default: false },
    metro: { type: 'string', default: '8082' },
    entry: { type: 'string' },
    state: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!/^\d{2,5}$/.test(values.metro)) fail(`"${values.metro}" is not a port.`);
if (values.state !== undefined && values['expo-go']) fail('--state needs the development client.');
if (values.state !== undefined && !/^[a-z0-9-]+$/.test(values.state))
  fail(`"${values.state}" is not a test state name.`);

const out =
  values.out === undefined ? mkdtempSync(join(tmpdir(), 'slovo-app-pass-')) : resolve(values.out);
mkdirSync(out, { recursive: true });

const settings = values['expo-go']
  ? ['APP_ID=host.exp.Exponent', `LINK=exp://127.0.0.1:${values.metro}/--/`]
  : [];
if (values.entry !== undefined) settings.push(`ENTRY_ID=${values.entry}`);

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
function releaseLock() {
  rmSync(LOCK, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseLock();
    process.exit(130);
  });
}

/** Runs a command to its end, its output on the screen and kept for the log. */
function run(command, args, options) {
  return new Promise((done) => {
    const child = spawn(command, args, options);
    let output = '';
    const collect = (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('close', (code) => {
      done({ code: code ?? 1, output });
    });
  });
}

await takeLock();
try {
  if (values.state !== undefined) {
    const link = `slovo://dev/state/${values.state}`;
    const { code } = await run('xcrun', ['simctl', 'openurl', values.device ?? 'booted', link], {});
    if (code !== 0) process.exit(code);
    await sleep(8_000);
  }
  const env = { ...process.env };
  if (!env.JAVA_HOME && existsSync(JAVA_HOME)) env.JAVA_HOME = JAVA_HOME;
  const args = [
    ...(values.device === undefined ? [] : ['--device', values.device]),
    'test',
    '--no-ansi',
    join(mobile, 'maestro', 'app-pass.yaml'),
    ...settings.flatMap((setting) => ['-e', setting]),
  ];
  // `takeScreenshot` writes into the folder the run starts in.
  const { code, output } = await run('maestro', args, { cwd: out, env });
  writeFileSync(join(out, 'app-pass.log'), output);
  console.log(`\n${code === 0 ? 'App pass: every step passed.' : 'App pass FAILED.'}`);
  console.log(`Screenshots and log: ${out}`);
  process.exitCode = code;
} finally {
  releaseLock();
}
