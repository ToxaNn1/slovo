import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const appFolder = here('../src/app');

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((item) =>
    item.isDirectory() ? filesUnder(join(folder, item.name)) : [join(folder, item.name)],
  );
}

/**
 * The route of each screen file of Expo Router, by its path: `settings/about.tsx`
 * is `/settings/about`, `saved/index.tsx` is `/saved`. Layouts (`_layout`) and
 * the files Expo Router reads for itself (`+native-intent`) are no screens.
 */
function screenRoutes(): Map<string, string> {
  const routes = new Map<string, string>();
  for (const file of filesUnder(appFolder)) {
    const path = relative(appFolder, file).split(sep).join('/');
    const name = path.split('/').at(-1) ?? '';
    if (!name.endsWith('.tsx') || name.startsWith('_') || name.startsWith('+')) continue;
    const route = `/${path.replace(/\.tsx$/, '')}`.replace(/\/index$/, '');
    routes.set(route === '' ? '/' : route, path);
  }
  return routes;
}

/** The routes the app pass's steps name, as `ROUTE: '<route>'` (Prettier's quotes, or double ones). */
function passRoutes(): Set<string> {
  const text = readFileSync(here('app-pass.yaml'), 'utf8');
  return new Set(
    [...text.matchAll(/^ {6}ROUTE: (["'])([^"']+)\1$/gm)].flatMap((match) => match[2] ?? []),
  );
}

describe('the app pass', () => {
  it('finds the screen routes', () => {
    const routes = screenRoutes();
    expect(routes.get('/')).toBe('index.tsx');
    expect(routes.get('/saved/collections/[collectionId]')).toBe(
      'saved/collections/[collectionId]/index.tsx',
    );
    expect([...routes.values()].some((path) => path.includes('_layout'))).toBe(false);
  });

  it('opens every screen route of the app', () => {
    const visited = passRoutes();
    const missing = [...screenRoutes()]
      .filter(([route]) => !visited.has(route))
      .map(([, file]) => `apps/mobile/src/app/${file}`);
    expect(missing, 'Add a step for each to apps/mobile/maestro/app-pass.yaml').toEqual([]);
  });

  it('names no route the app no longer has', () => {
    const routes = screenRoutes();
    const stale = [...passRoutes()].filter((route) => !routes.has(route));
    expect(stale, 'Remove these steps from apps/mobile/maestro/app-pass.yaml').toEqual([]);
  });
});
