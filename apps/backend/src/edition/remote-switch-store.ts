import type { RemoteSwitchStore } from '@slovo/server-core';
import { and, eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { remoteSwitches } from '../database/schema';

/** The Feature Switches turned off remotely, kept in the `remote_switches` table. */
export function createRemoteSwitchStore({ db }: Database): RemoteSwitchStore {
  return {
    async off(editionId) {
      const rows = await db
        .select({ feature: remoteSwitches.feature })
        .from(remoteSwitches)
        .where(and(eq(remoteSwitches.editionId, editionId), eq(remoteSwitches.off, true)));
      return rows.map((row) => row.feature);
    },

    async set(editionId, feature, off, at) {
      await db
        .insert(remoteSwitches)
        .values({ editionId, feature, off, setAt: at })
        .onConflictDoUpdate({
          target: [remoteSwitches.editionId, remoteSwitches.feature],
          set: { off, setAt: at },
        });
    },
  };
}
