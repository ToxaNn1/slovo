// The helpers `pnpm dev` (scripts/dev.mjs) and `pnpm dev:admin` (scripts/dev-admin.mjs)
// share: Docker and compose, apps/backend/.env, free ports and the health wait.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('..', import.meta.url));

export function step(text) {
  console.log(`\n▸ ${text}`);
}

export function run(command, args, env = {}) {
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

export async function startDocker() {
  if (dockerAnswers()) return;
  step('Docker Desktop is not running: opening it');
  spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' });
  for (let waited = 0; waited < 180; waited += 3) {
    await sleep(3000);
    if (dockerAnswers()) return;
  }
  console.error(
    '\n✗ Docker did not start in 3 minutes. Start Docker Desktop and run `pnpm dev` or `pnpm dev:admin` again.',
  );
  process.exit(1);
}

export function makeEnvFile() {
  const env = `${root}/apps/backend/.env`;
  const example = `${root}/apps/backend/.env.example`;
  if (!existsSync(env)) {
    step('Making apps/backend/.env from .env.example');
    copyFileSync(example, env);
  }
  // A copy made by hand may keep the example's AUTH_SECRET too.
  const exampleSecret = /^AUTH_SECRET=.*$/m.exec(readFileSync(example, 'utf8'))?.[0];
  const text = readFileSync(env, 'utf8');
  if (exampleSecret === undefined || !text.split('\n').includes(exampleSecret)) return;
  step('Giving apps/backend/.env a fresh AUTH_SECRET');
  const secret = randomBytes(32).toString('base64');
  writeFileSync(env, text.replace(exampleSecret, `AUTH_SECRET=${secret}`));
}

function portIsFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port);
  });
}

export async function freePortFrom(port) {
  for (let candidate = port; candidate < port + 50; candidate += 1) {
    if (await portIsFree(candidate)) return candidate;
  }
  console.error(`\n✗ No free port between ${port} and ${port + 49}.`);
  process.exit(1);
}

export async function waitForHealth(url) {
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
