import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('.', import.meta.url));
const appRequire = createRequire(join(APP_DIR, 'package.json'));

interface Resolution {
  type: string;
  filePath?: string;
}

interface AppMetroConfig {
  resolver: {
    assetExts: string[];
    resolveRequest: (context: unknown, moduleName: string, platform: string) => Resolution;
  };
  serializer: {
    customSerializer: (
      entryPoint: string,
      preModules: unknown[],
      graph: unknown,
      options: Record<string, unknown>,
    ) => Promise<string | { code: string }>;
  };
  watchFolders: string[];
}

// The app's config without the Language Pack metro.config.cjs reads at start.
const { appMetroConfig } = appRequire('./metro-app-config.cjs') as {
  appMetroConfig: (projectRoot: string, modules: Record<string, string>) => AppMetroConfig;
};

const modules = {
  'slovo-editions': '/generated/editions.js',
  'slovo-editions/fonts': '/generated/fonts.js',
  'slovo-app/config': '/repo/app.json',
  'slovo-app/splash': '/repo/splash.json',
};

/** The bundle code the config's serializer writes for an entry point with no modules. */
async function emptyBundle(config: AppMetroConfig): Promise<string> {
  const entry = join(APP_DIR, 'index.js');
  const graph = {
    dependencies: new Map(),
    entryPoints: new Set([entry]),
    transformOptions: { platform: 'ios', dev: false, customTransformOptions: {} },
  };
  const out = await config.serializer.customSerializer(entry, [], graph, {
    dev: false,
    projectRoot: APP_DIR,
    serverRoot: APP_DIR,
    createModuleId: () => 0,
    getRunModuleStatement: (id: number) => `__r(${String(id)});`,
    includeAsyncPaths: false,
    modulesOnly: false,
    processModuleFilter: () => true,
    runBeforeMainModule: [],
    runModule: true,
    sourceMapUrl: null,
    sourceUrl: null,
    inlineSourceMap: false,
    asyncRequireModulePath: '',
    shouldAddToIgnoreList: () => false,
  });
  return typeof out === 'string' ? out : out.code;
}

describe('metro config', () => {
  it("writes Sentry's debug id into the bundle, so its source map can be matched to a crash", async () => {
    const bundle = await emptyBundle(appMetroConfig(APP_DIR, modules));

    expect(bundle).toContain('_sentryDebugIds');
  });

  it.each(Object.entries(modules))('resolves %s to its file', (moduleName, filePath) => {
    const config = appMetroConfig(APP_DIR, modules);

    expect(config.resolver.resolveRequest({}, moduleName, 'ios')).toEqual({
      type: 'sourceFile',
      filePath,
    });
  });

  it('hands every other module to the resolver Metro gives', () => {
    const config = appMetroConfig(APP_DIR, modules);
    const context = {
      resolveRequest: (_context: unknown, moduleName: string): Resolution => ({
        type: 'sourceFile',
        filePath: `/node_modules/${moduleName}.js`,
      }),
    };

    expect(config.resolver.resolveRequest(context, 'react', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: '/node_modules/react.js',
    });
  });

  it('bundles the Language Pack as an asset and watches the Edition folders', () => {
    const config = appMetroConfig(APP_DIR, modules);

    expect(config.resolver.assetExts).toContain('db');
    expect(config.watchFolders).toContain(EDITIONS_DIR);
  });
});
