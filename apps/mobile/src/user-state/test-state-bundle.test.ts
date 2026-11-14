import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/** The app's folder, where Metro runs. */
const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '../..');
/** The module every link from outside the app enters through. */
const LINKS = 'src/app/+native-intent.tsx';

interface Transformed {
  readonly output: readonly { readonly data: { readonly code: string } }[];
  readonly dependencies: readonly { readonly name: string }[];
}

interface MetroConfig {
  readonly transformerPath: string;
  readonly transformer: unknown;
}

interface TransformWorker {
  transform(
    config: unknown,
    projectRoot: string,
    filename: string,
    data: Buffer,
    options: Record<string, unknown>,
  ): Promise<Transformed>;
}

/**
 * A module, the links module unless named, as Metro transforms it into an iOS bundle. The app's
 * `metro.config.cjs` adds modules to resolve but keeps Expo's transformer,
 * which this takes from Expo's default config, so no Language Pack is needed.
 */
async function transformed(dev: boolean, file = LINKS): Promise<Transformed> {
  const appRequire = createRequire(join(APP_DIR, 'package.json'));
  const expoMetro = appRequire('expo/metro-config') as {
    getDefaultConfig: (projectRoot: string) => MetroConfig;
  };
  const config = expoMetro.getDefaultConfig(APP_DIR);
  const workerRequire = createRequire(appRequire.resolve('expo/metro-config'));
  const worker = workerRequire(config.transformerPath) as TransformWorker;
  return worker.transform(config.transformer, APP_DIR, file, readFileSync(join(APP_DIR, file)), {
    dev,
    minify: false,
    platform: 'ios',
    type: 'module',
    hot: false,
    inlineRequires: false,
    inlinePlatform: true,
    unstable_transformProfile: 'default',
    experimentalImportSupport: false,
    customTransformOptions: {},
  });
}

/** What of the test states the transformed module holds: a dependency on them or their link. */
function testStatesIn({ dependencies, output }: Transformed): string[] {
  const code = output.map(({ data }) => data.code).join('\n');
  return [
    ...dependencies.map(({ name }) => name).filter((name) => name.includes('test-state')),
    ...(['test-state', 'dev/state'].some((text) => code.includes(text)) ? ['code'] : []),
  ];
}

describe('the test state link (spec #1551)', () => {
  it('is in a development bundle', async () => {
    expect(testStatesIn(await transformed(true))).toContain('@/shell/test-state-link');
  }, 60_000);

  it('is not in a production bundle: neither the link nor the module of the states', async () => {
    expect(testStatesIn(await transformed(false))).toEqual([]);
  }, 60_000);
});

/** The device clock, which a test state link's `?day=` shifts (#1859). */
const DEVICE_CLOCK = 'src/device/device-clock.ts';

/** Whether the transformed device clock tells the system time, and whether a shift can move it. */
async function clockIn(dev: boolean) {
  const code = (await transformed(dev, DEVICE_CLOCK)).output
    .map(({ data }) => data.code)
    .join('\n');
  return {
    systemTimeOnly: code.includes('now: () => _core.systemClock.now(),'),
    shiftTaken: !/function shiftDeviceClock\(ms\) \{\s*return;/.test(code),
  };
}

describe('the day shift of a test state link (#1859)', () => {
  it('moves the device clock in a development bundle', async () => {
    expect(await clockIn(true)).toEqual({ systemTimeOnly: false, shiftTaken: true });
  }, 60_000);

  it('leaves the device clock on the system time in a production bundle', async () => {
    expect(await clockIn(false)).toEqual({ systemTimeOnly: true, shiftTaken: false });
  }, 60_000);
});
