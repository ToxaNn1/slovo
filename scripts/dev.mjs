// `pnpm dev`: starts the whole project for local work in one terminal.
//
// 1. Docker Desktop (opened when its daemon is down) and the local services of
//    compose.yaml: Postgres and Mailpit.
// 2. apps/backend/.env, made from .env.example with a fresh AUTH_SECRET when
//    it is missing.
// 3. The backend's migrations and the Edition's Language Pack.
// 4. The backend in watch mode, then Metro, each on the first free port from
//    its default, so a second worktree or a running smoke flow never collides.
//    The app is pointed at the backend through EXPO_PUBLIC_SLOVO_API_URL.
//
// Ctrl-C stops the backend and Metro; Postgres and Mailpit keep running
// (`docker compose stop` stops them). Settings, all optional:
// SLOVO_EDITION (default uk), PORT (backend, default 8787) and
// SLOVO_METRO_PORT (default 8081).

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const edition = process.env.SLOVO_EDITION ?? 'uk';

function step(text) {
  console.log(`\n▸ ${text}`);
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    console.error(`\n✗ ${command} ${args.join(' ')} failed.`);
    process.exit(result.status ?? 1);
  }
}

function dockerAnswers() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

async function startDocker() {
  if (dockerAnswers()) return;
  step('Docker Desktop is not running: opening it');
  spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' });
  for (let waited = 0; waited < 180; waited += 3) {
    await sleep(3000);
    if (dockerAnswers()) return;
  }
  console.error(
    '\n✗ Docker did not start in 3 minutes. Start Docker Desktop and run `pnpm dev` again.',
  );
  process.exit(1);
}

function makeEnvFile() {
  const env = `${root}/apps/backend/.env`;
  if (existsSync(env)) return;
  step('Making apps/backend/.env from .env.example');
  copyFileSync(`${root}/apps/backend/.env.example`, env);
  const secret = randomBytes(32).toString('base64');
  writeFileSync(
    env,
    readFileSync(env, 'utf8').replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`),
  );
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port);
  });
}

async function freePortFrom(port) {
  for (let candidate = port; candidate < port + 50; candidate += 1) {
    if (await portIsFree(candidate)) return candidate;
  }
  console.error(`\n✗ No free port between ${port} and ${port + 49}.`);
  process.exit(1);
}

async function waitForHealth(url) {
  for (let waited = 0; waited < 60; waited += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(1000);
  }
  console.error(`\n✗ The backend did not answer ${url} in 60 s; see its log above.`);
  process.exit(1);
}

await startDocker();
step('Starting Postgres and Mailpit (compose project slovo)');
run('docker', ['compose', 'up', '--detach', '--wait']);
makeEnvFile();
step('Running the backend migrations');
run('pnpm', ['--filter', '@slovo/backend', 'db:migrate']);
step(`Building the Language Pack of the Edition ${edition}`);
run('pnpm', ['build:pack', edition]);

const apiPort = await freePortFrom(Number(process.env.PORT ?? 8787));
const metroPort = await freePortFrom(Number(process.env.SLOVO_METRO_PORT ?? 8081));
const apiUrl = `http://localhost:${apiPort}`;

step(`Starting the backend on ${apiUrl}`);
// In a process group of its own, so stopping it stops pnpm, tsx and the server
// together; Metro stays in the terminal's group, where Ctrl-C reaches it.
const backend = spawn('pnpm', ['--filter', '@slovo/backend', 'dev'], {
  cwd: root,
  detached: true,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, PORT: String(apiPort) },
});
backend.on('exit', (code) => {
  console.error(`\n✗ The backend stopped (exit ${code}).`);
  process.exit(code ?? 1);
});
await waitForHealth(`${apiUrl}/health`);

console.log(`
  Backend   ${apiUrl}   (API docs ${apiUrl}/docs)
  Mailpit   http://localhost:8025   (Sign-in codes)
  Postgres  localhost:55432
  Metro     http://localhost:${metroPort}   (press i to open SLOVO on the booted simulator)
`);

// Expo writes EXPO_PUBLIC_ values into the bundle, so Metro's cache is cleared
// when the backend's address differs from the last run's.
const lastApiUrlFile = `${root}/node_modules/.cache/slovo-dev-api-url`;
const lastApiUrl = existsSync(lastApiUrlFile) ? readFileSync(lastApiUrlFile, 'utf8') : undefined;
mkdirSync(dirname(lastApiUrlFile), { recursive: true });
writeFileSync(lastApiUrlFile, apiUrl);
const clear = lastApiUrl === apiUrl ? [] : ['--clear'];

const metro = spawn(
  'pnpm',
  ['--filter', '@slovo/mobile', 'start', '--port', String(metroPort), ...clear],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SLOVO_EDITION: edition, EXPO_PUBLIC_SLOVO_API_URL: apiUrl },
  },
);

function stop(code) {
  backend.removeAllListeners('exit');
  try {
    process.kill(-backend.pid, 'SIGTERM');
  } catch {
    // Already stopped.
  }
  metro.kill('SIGINT');
  process.exit(code);
}

metro.on('exit', (code) => stop(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));
