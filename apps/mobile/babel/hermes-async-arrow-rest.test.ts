import { runInNewContext } from 'node:vm';

import { transformSync } from '@babel/core';
import { describe, expect, it } from 'vitest';

import hermesAsyncArrowRest from './hermes-async-arrow-rest.cjs';

/** The value `source` leaves in `result`, after the plugin rewrote it. */
async function run(source: string): Promise<{ code: string; result: unknown }> {
  const code = transformSync(source, { plugins: [hermesAsyncArrowRest], configFile: false })?.code;
  if (code == null) throw new Error('Babel returned no code');
  const context: { result?: unknown } = {};
  runInNewContext(code, context);
  return { code, result: await context.result };
}

describe('hermes-async-arrow-rest', () => {
  it('takes the rest pattern of an async arrow into its body, as @orpc/client writes it', async () => {
    const { code, result } = await run(
      'const f = async (...[input, options = {}]) => [input, options]; result = f(1);',
    );

    expect(code).not.toMatch(/\.\.\.\[/);
    expect(result).toEqual([1, {}]);
  });

  it('keeps the arguments a caller passes', async () => {
    const { result } = await run(
      'const f = async (first, ...[second, third = 3]) => { return [first, second, third]; }; result = f(1, 2);',
    );

    expect(result).toEqual([1, 2, 3]);
  });

  it('leaves an async arrow with a plain rest parameter as written', async () => {
    const { code } = await run('const f = async (...args) => args; result = f(1);');

    expect(code).toContain('async (...args) => args');
  });
});
