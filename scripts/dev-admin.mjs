// `pnpm dev:admin`: the owner admin (apps/admin) in Vite with hot reload.
//
// Without flags it starts what the admin talks to: Postgres and Mailpit
// (compose.yaml), apps/backend/.env, the migrations and the backend in watch
// mode, and points Vite's proxy at it through SLOVO_ADMIN_API_URL. Given
// SLOVO_ADMIN_API_URL, it uses that backend and starts none; it refuses one
// that is not on this machine, so the admin in development never reaches a
// Deployment.
//
// `pnpm dev:admin --mock` starts Vite alone, with the admin API answered from
// apps/admin/src/mock/fixtures.ts: no Docker, no backend.
//
// Settings, all optional: PORT (backend, default 8787) and SLOVO_ADMIN_PORT
// (Vite, default 5173). Ctrl-C stops Vite and the backend.

import { spawn } from 'node:child_process';

import {
  freePortFrom,
  makeEnvFile,
  root,
  run,
  startDocker,
  step,
  waitForHealth,
} from './dev-services.mjs';

const mock = process.argv.includes('--mock');
const givenApiUrl = process.env.SLOVO_ADMIN_API_URL;

function isLocal(url) {
  try {
    return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

if (!mock && givenApiUrl !== undefined && !isLocal(givenApiUrl)) {
  console.error(
    `\n✗ pnpm dev:admin refuses SLOVO_ADMIN_API_URL=${givenApiUrl}: the admin in development talks to a backend on this machine only.`,
  );
  process.exit(1);
}

let backend;
let apiUrl = givenApiUrl;
if (!mock && apiUrl === undefined) {
  await startDocker();
  step('Starting Postgres and Mailpit (compose project slovo)');
  run('docker', ['compose', 'up', '--detach', '--wait']);
  makeEnvFile();
  step('Running the backend migrations');
  run('pnpm', ['--filter', '@slovo/backend', 'db:migrate']);

  const apiPort = await freePortFrom(Number(process.env.PORT ?? 8787));
  apiUrl = `http://localhost:${apiPort}`;
  step(`Starting the backend on ${apiUrl}`);
  // In a process group of its own, so stopping it stops pnpm, tsx and the
  // server together; Vite stays in the terminal's group, where Ctrl-C reaches it.
  backend = spawn('pnpm', ['--filter', '@slovo/backend', 'dev'], {
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
}

const adminPort = await freePortFrom(Number(process.env.SLOVO_ADMIN_PORT ?? 5173));
console.log(`
  Admin     http://localhost:${adminPort}/admin/   (${mock ? 'admin API from the fixtures' : `backend ${apiUrl}`})
`);

const vite = spawn(
  'pnpm',
  [
    'exec',
    'vite',
    '--configLoader',
    'runner',
    '--port',
    String(adminPort),
    '--strictPort',
    ...(mock ? ['--mode', 'mock'] : []),
  ],
  {
    cwd: `${root}/apps/admin`,
    stdio: 'inherit',
    env: mock ? process.env : { ...process.env, SLOVO_ADMIN_API_URL: apiUrl },
  },
);

function stop(code) {
  if (backend !== undefined) {
    backend.removeAllListeners('exit');
    try {
      process.kill(-backend.pid, 'SIGTERM');
    } catch {
      // Already stopped.
    }
  }
  vite.kill('SIGTERM');
  process.exit(code);
}

vite.on('exit', (code) => stop(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => stop(0));
