import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, openUserState } from './index';

// The contract suite in apps/mobile covers migrations on every adapter; these
// cover what only the Core decides.
describe('openUserState', () => {
  it('refuses a schema version it cannot read, rather than migrating again', async () => {
    const records = new Map([['schema.version', 'two']]);
    const migrate = () => Promise.resolve(new Map([['migrated', 'again']]));

    await expect(
      openUserState({
        port: createMemoryUserStatePort(records),
        migrations: [{ version: 1, migrate }],
      }),
    ).rejects.toThrow(/schema version/);
    expect(records.has('migrated')).toBe(false);
  });

  it('rejects migrations that skip a version', async () => {
    const migrate = () => Promise.resolve(new Map());

    await expect(
      openUserState({ port: createMemoryUserStatePort(), migrations: [{ version: 2, migrate }] }),
    ).rejects.toThrow(/version 2/);
  });
});
