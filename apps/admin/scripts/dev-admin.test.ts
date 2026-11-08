import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { FIXTURES } from '../src/mock/fixtures';

const script = fileURLToPath(new URL('../../../scripts/dev-admin.mjs', import.meta.url));
const running: ChildProcess[] = [];

function start(args: string[], env: Record<string, string>) {
  const child = spawn('node', [script, ...args], {
    detached: true,
    env: { ...process.env, ...env },
  });
  running.push(child);
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
  child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
  const exit = new Promise<number | null>((resolve) => child.on('exit', resolve));
  return { exit, output: () => output };
}

/** The first group of `pattern` once the output shows it. */
async function waitFor(output: () => string, pattern: RegExp): Promise<string> {
  for (let waited = 0; waited < 300; waited += 1) {
    const match = pattern.exec(output());
    if (match?.[1] !== undefined) return match[1];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No ${pattern.source} in:\n${output()}`);
}

/** The JSON at `url` once Vite listens there. */
async function answer(url: string): Promise<unknown> {
  for (let tried = 0; ; tried += 1) {
    try {
      return await (await fetch(url)).json();
    } catch (error) {
      if (tried === 300) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

afterEach(() => {
  for (const child of running.splice(0)) {
    try {
      if (child.pid !== undefined) process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already stopped.
    }
  }
});

describe('pnpm dev:admin', () => {
  it('refuses a backend that is not on this machine, before Docker', async () => {
    const { exit, output } = start([], { SLOVO_ADMIN_API_URL: 'https://api.example.com' });
    expect(await exit).toBe(1);
    expect(output()).toContain('refuses');
    expect(output()).not.toContain('Docker');
  });

  it('with --mock serves the fixtures on the admin API', async () => {
    const { output } = start(['--mock'], { SLOVO_ADMIN_PORT: '5391' });
    const url = await waitFor(output, /Admin\s+(http:\/\/localhost:\d+\/admin\/)/);
    expect(await answer(`${url}api/editions`)).toEqual(FIXTURES.editions);
  }, 40_000);
});
