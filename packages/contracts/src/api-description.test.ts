import { oc } from '@orpc/contract';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { describeApi } from './api-description';
import { procedure } from './api/procedure';

/** Every schema with `prefixItems` in a description, wherever it sits. */
function tuplesIn(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(tuplesIn);
  if (typeof value !== 'object' || value === null) return [];
  const own = 'prefixItems' in value ? [Object.fromEntries(Object.entries(value))] : [];
  return [...own, ...Object.values(value).flatMap(tuplesIn)];
}

describe('the description of the API', () => {
  it('promises the fixed items of a tuple with a rest, inside a union too', async () => {
    const pair = z.tuple([z.string()], z.number());
    const contract = oc.prefix('/v1').router({
      thing: procedure
        .route({ method: 'POST', path: '/things' })
        .input(z.strictObject({ name: z.string() }))
        .output(
          z.object({
            pair,
            maybe: z.union([z.tuple([z.string(), z.string()], z.number()), z.null()]),
          }),
        ),
    });

    const tuples = tuplesIn(await describeApi(contract));

    expect(tuples.map(({ minItems }) => minItems).sort()).toEqual([1, 2]);
  });
});
