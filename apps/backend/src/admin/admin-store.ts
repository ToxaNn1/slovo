import { createHash } from 'node:crypto';

import type { AdminStore } from '@slovo/server-core';
import { and, asc, eq, isNull } from 'drizzle-orm';

import type { Database } from '../database/database';
import { actionLog, adminUsers, agentTokens } from '../database/schema';

/** The admin's identities and its Action log, in their own tables (ADR 0088). */
export function createAdminStore({ db }: Database): AdminStore {
  return {
    async hasOwner() {
      const [owner] = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.role, 'owner'), eq(adminUsers.state, 'active')))
        .limit(1);
      return owner !== undefined;
    },

    async addAdminUser({ email, role, createdAt }) {
      const added = await db
        .insert(adminUsers)
        .values({ email, role, state: 'active', createdAt })
        .onConflictDoNothing()
        .returning({ id: adminUsers.id });
      return added.length > 0 ? 'added' : 'taken';
    },

    async addAgentToken({ name, tokenHash, createdAt }) {
      const added = await db
        .insert(agentTokens)
        .values({ name, tokenHash, createdAt })
        .onConflictDoNothing()
        .returning({ name: agentTokens.name });
      return added.length > 0 ? 'added' : 'taken';
    },

    async revokeAgentToken(name, at) {
      const revoked = await db
        .update(agentTokens)
        .set({ revokedAt: at })
        .where(and(eq(agentTokens.name, name), isNull(agentTokens.revokedAt)))
        .returning({ name: agentTokens.name });
      return revoked.length > 0;
    },

    async agentNamed(tokenHash) {
      const [agent] = await db
        .select({ name: agentTokens.name })
        .from(agentTokens)
        .where(and(eq(agentTokens.tokenHash, tokenHash), isNull(agentTokens.revokedAt)));
      return agent?.name;
    },

    async appendAction(action) {
      await db.insert(actionLog).values(action);
    },

    async actions(editionId) {
      const rows = await db
        .select()
        .from(actionLog)
        .where(editionId === undefined ? undefined : eq(actionLog.editionId, editionId))
        .orderBy(asc(actionLog.id));
      return rows.map(({ who, at, what, before, after, reason, editionId, batchId }) => ({
        who,
        at,
        what,
        before: before ?? null,
        after: after ?? null,
        reason,
        editionId,
        batchId,
      }));
    },
  };
}

/** The SHA-256 of a token, in hex: what the admin's tables keep instead of the token. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
