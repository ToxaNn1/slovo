/**
 * The real network, clock and cache folder for a run on this machine. Every
 * dev tool that fetches dictionary pages uses these, so they share one cache
 * and one throttle per host.
 */
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import type { Clock, Fetch } from './polite-client';

/** The network, introducing the tool to the sites it asks. */
export const fetchPage: Fetch = async (url, { timeoutMs }) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'slovo-sourcing/0.1 (dev tool; one request every 2 s)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: response.status, body: await response.text() };
};

/** The wall clock. */
export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) =>
    new Promise((done) => {
      setTimeout(done, ms);
    }),
};

/**
 * The cache every worktree and run on the machine shares:
 * `$SLOVO_SOURCING_CACHE`, else `$XDG_CACHE_HOME/slovo-sourcing` or
 * `~/.cache/slovo-sourcing`.
 */
export function defaultCacheDir(): string {
  const configured = process.env['SLOVO_SOURCING_CACHE'];
  if (configured !== undefined && configured !== '') return resolve(configured);
  const cacheHome = process.env['XDG_CACHE_HOME'];
  return join(
    cacheHome === undefined || cacheHome === '' ? join(homedir(), '.cache') : cacheHome,
    'slovo-sourcing',
  );
}
