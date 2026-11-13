import { describe, expect, it } from 'vitest';

import type { AnySchema } from '@orpc/contract';

import { adminContract } from './admin';

/** Whether the procedure's input schema takes the value. */
async function takes(
  procedure: { '~orpc': { inputSchema?: AnySchema } },
  value: unknown,
): Promise<boolean> {
  const result = await procedure['~orpc'].inputSchema?.['~standard'].validate(value);
  return result !== undefined && result.issues === undefined;
}

describe('an Аналітика period', () => {
  it('takes only a day of the calendar', async () => {
    const { analytics } = adminContract;
    const period = (to: string) => ({ editionId: 'uk', from: '2026-11-01', to });

    expect(await takes(analytics, period('2026-11-13'))).toBe(true);
    expect(await takes(analytics, period('2026-13-45'))).toBe(false);
  });
});
