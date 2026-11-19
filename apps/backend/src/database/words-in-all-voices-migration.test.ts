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

describe('the migration that adds the list of Words in all voices', () => {
  it('lists every Word with a live Recording in a voice other than the default, so none is retired (ADR 0195)', async () => {
    const own = await createTestDatabase(testDatabaseUrl(), { migrate: false });
    onTestFinished(() => own.drop());
    const database = createDatabase(own.url, silentLogger);
    onTestFinished(() => database.close());
    await migrate(database.db, { migrationsFolder: migrationsBefore('_words_in_all_voices') });
    // default-only: the default voice alone; every-voice: two live voices;
    // retired-other: another voice only retired; other-edition: an Edition
    // whose default the migration doesn't know keeps every recorded Word.
    await database.db.execute(sql`
      insert into media_recordings
        (edition_id, word_id, narrator_voice, recording_kind, hash, size, duration_ms, retired_at, content_version, created_at)
      values
        ('uk', 'default-only', 'oksana', 'plain', 'a', 1, 900, null, 1, now()),
        ('uk', 'every-voice', 'oksana', 'plain', 'b', 1, 900, null, 1, now()),
        ('uk', 'every-voice', 'taras', 'plain', 'c', 1, 900, null, 1, now()),
        ('uk', 'every-voice', 'marta', 'plain', 'd', 1, 900, null, 1, now()),
        ('uk', 'retired-other', 'oksana', 'plain', 'e', 1, 900, null, 1, now()),
        ('uk', 'retired-other', 'taras', 'plain', 'f', 1, 900, now(), 1, now()),
        ('xx', 'other-edition', 'oksana', 'plain', 'g', 1, 900, null, 1, now())`);

    await migrateDatabase(own.url, silentLogger);

    const listed = await database.db.execute<{ edition_id: string; word_id: string }>(
      sql`select edition_id, word_id from words_in_all_voices order by edition_id, word_id`,
    );
    expect(listed.rows).toEqual([
      { edition_id: 'uk', word_id: 'every-voice' },
      { edition_id: 'xx', word_id: 'other-edition' },
    ]);
  });
});
