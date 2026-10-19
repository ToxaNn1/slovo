import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The files a flow calls with `- runFlow: <file>`, in order.
function calledFlows(file: string): string[] {
  const text = readFileSync(here(file), 'utf8');
  return [...text.matchAll(/^- runFlow: (\S+\.yaml)$/gm)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

const featureFlows = (file: string) => calledFlows(file).filter((f) => f.startsWith('flows/'));

describe('the smoke flow and its two halves', () => {
  it('runs the two halves in a row', () => {
    expect(calledFlows('smoke.yaml')).toEqual(['smoke-1.yaml', 'smoke-2.yaml']);
  });

  it('covers every feature flow, each once', () => {
    const onDisk = readdirSync(here('flows'))
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => `flows/${name}`)
      .sort();
    const inHalves = [...featureFlows('smoke-1.yaml'), ...featureFlows('smoke-2.yaml')].sort();
    expect(inHalves).toEqual(onDisk);
  });

  it('keeps the flows that need the backend in one half, account before sync', () => {
    const halves = [featureFlows('smoke-1.yaml'), featureFlows('smoke-2.yaml')];
    const withBackend = halves.filter(
      (half) => half.includes('flows/account.yaml') || half.includes('flows/sync.yaml'),
    );
    expect(withBackend).toHaveLength(1);
    const half = withBackend[0] ?? [];
    expect(half.indexOf('flows/account.yaml')).toBeGreaterThanOrEqual(0);
    expect(half.indexOf('flows/account.yaml')).toBeLessThan(half.indexOf('flows/sync.yaml'));
  });
});
