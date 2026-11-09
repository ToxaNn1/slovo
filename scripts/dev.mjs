// `pnpm dev`: starts the whole project for local work in one terminal.
//
// 1. Docker Desktop (opened when its daemon is down) and the local services of
//    compose.yaml: Postgres and Mailpit.
// 2. apps/backend/.env, made from .env.example with a fresh AUTH_SECRET when
//    it is missing, or given a fresh one when it keeps the example's, which
//    the backend refuses.
// 3. The backend's migrations, the default Edition's content imported into
//    Postgres once (ADR 0090).
// 4. The backend in watch mode, the Edition's Language Pack built from its
//    content snapshot, then Metro, each server on the first free port from
//    its default, so a second worktree or a running smoke flow never collides.
//    The app is pointed at the backend through EXPO_PUBLIC_SLOVO_API_URL.
//
// Ctrl-C stops the backend and Metro; Postgres and Mailpit keep running
// (`docker compose stop` stops them). Settings, all optional:
// PORT (backend, default 8787) and
// SLOVO_METRO_PORT (default 8081).

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  freePortFrom,
  makeEnvFile,
  root,
  run,
  startDocker,
  step,
  waitForHealth,
} from './dev-services.mjs';

await startDocker();
step('Starting Postgres and Mailpit (compose project slovo)');
run('docker', ['compose', 'up', '--detach', '--wait']);
makeEnvFile();
step('Running the backend migrations');
run('pnpm', ['--filter', '@slovo/backend', 'db:migrate']);
const { defaultEdition } = JSON.parse(readFileSync(`${root}app/app.json`, 'utf8'));
step(`Importing the content of the default Edition "${defaultEdition}" into Postgres`);
// An earlier run's import stays: the database keeps what it has.
run('pnpm', ['--silent', 'content', 'import', '--edition', defaultEdition]);

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

step("Building the Language Pack of the app's default Edition from the backend's snapshot");
const pack = spawnSync('pnpm', ['build:pack'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_SLOVO_API_URL: apiUrl },
});
if (pack.status !== 0) {
  console.error('\n✗ pnpm build:pack failed.');
  backend.removeAllListeners('exit');
  process.kill(-backend.pid, 'SIGTERM');
  process.exit(pack.status ?? 1);
}

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
    env: { ...process.env, EXPO_PUBLIC_SLOVO_API_URL: apiUrl },
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
