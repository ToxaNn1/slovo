import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  createTestDatabase,
  migrationsBefore,
  silentLogger,
  testDatabaseUrl,
} from '../test-support';
import { createDatabase } from './database';
import { migrateDatabase } from './migrate';

describe('the migration that makes a provider identity unique', () => {
  it('keeps the oldest of the sign-in methods two racing first sign-ins wrote for one identity', async () => {
    const own = await createTestDatabase(testDatabaseUrl(), { migrate: false });
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    await migrate(database.db, { migrationsFolder: migrationsBefore('_sign_in_method_unique') });
    await database.db.execute(sql`
      insert into accounts (id, email, name, email_verified, created_at, updated_at) values
        ('00000000-0000-4000-8000-000000000001', 'a@mail.com', '', true, now(), now()),
        ('00000000-0000-4000-8000-000000000002', 'b@mail.com', '', true, now(), now())`);
    await database.db.execute(sql`
      insert into sign_in_methods (id, account_id, provider_id, provider_account_id, created_at, updated_at) values
        ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-000000000002', 'google', 'subject', '2026-01-02', now()),
        ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000001', 'google', 'subject', '2026-01-01', now()),
        ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000001', 'google', 'subject', '2026-01-01', now()),
        ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000002', 'apple', 'subject', '2026-01-03', now())`);

    await migrateDatabase(own.url, silentLogger);

    const kept = await database.db.execute<{ id: string }>(
      sql`select id from sign_in_methods order by id`,
    );
    expect(kept.rows).toEqual([
      { id: '00000000-0000-4000-8000-0000000000a1' },
      { id: '00000000-0000-4000-8000-0000000000c1' },
    ]);
    await expect(
      database.db.execute(sql`
        insert into sign_in_methods (account_id, provider_id, provider_account_id, created_at, updated_at)
        values ('00000000-0000-4000-8000-000000000002', 'google', 'subject', now(), now())`),
    ).rejects.toThrow();
  });
});
