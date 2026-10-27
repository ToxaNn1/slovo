import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceDir = fileURLToPath(new URL('.', import.meta.url));

const animationImport = /from 'react-native-(reanimated|gesture-handler|worklets)'/;

/** Every component module of the UI, by path relative to `src`. */
function componentModules(): string[] {
  return readdirSync(sourceDir, { recursive: true, encoding: 'utf8' }).filter(
    (file) => file.endsWith('.tsx') && !file.includes('.test.'),
  );
}

describe('React Compiler scope (ADR 0059)', () => {
  it("opts every component with Reanimated or gesture code out with 'use no memo'", () => {
    const animated = componentModules().filter((file) =>
      animationImport.test(readFileSync(join(sourceDir, file), 'utf8')),
    );

    const compiled = animated.filter(
      (file) => !readFileSync(join(sourceDir, file), 'utf8').startsWith("'use no memo';\n"),
    );

    expect(animated.length).toBeGreaterThan(0);
    expect(compiled).toEqual([]);
  });
});
