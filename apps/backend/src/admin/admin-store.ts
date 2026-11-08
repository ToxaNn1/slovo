import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

import type { AdminStore, AdminTotp, AdminUser, SecretVault } from '@slovo/server-core';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import type { Database } from '../database/database';
import {
  actionLog,
  adminSessions,
  adminSignInCodes,
  adminUsers,
  agentTokens,
  recoveryCodes,
} from '../database/schema';

/** The admin's identities and its Action log, in their own tables (ADR 0088). */
export function createAdminStore({ db }: Database): AdminStore {
  const userOf = (row: typeof adminUsers.$inferSelect): AdminUser => {
    const totp: AdminTotp =
      row.totpSecret === null
        ? { state: 'none' }
        : {
            state: row.totpConfirmedAt === null ? 'pending' : 'on',
            sealedSecret: row.totpSecret,
          };
    return { id: row.id, email: row.email, role: row.role, totp };
  };
  const active = eq(adminUsers.state, 'active');
  const sessionsWith = (where: ReturnType<typeof eq>) =>
    db
      .select({ session: adminSessions, user: adminUsers })
      .from(adminSessions)
      .innerJoin(adminUsers, eq(adminSessions.adminUserId, adminUsers.id))
      .where(and(where, active))
      .orderBy(desc(adminSessions.createdAt))
      .then((rows) =>
        rows.map(({ session, user }) => ({
          tokenHash: session.tokenHash,
          user: userOf(user),
          createdAt: session.createdAt,
          lastSeenAt: session.lastSeenAt,
          expiresAt: session.expiresAt,
        })),
      );

  return {
    async adminUserByEmail(email) {
      const [row] = await db
        .select()
        .from(adminUsers)
        .where(and(eq(adminUsers.email, email), active));
      return row === undefined ? undefined : userOf(row);
    },

    async setSignInCode({ email, codeHash, expiresAt }) {
      await db
        .insert(adminSignInCodes)
        .values({ email, codeHash, expiresAt })
        .onConflictDoUpdate({ target: adminSignInCodes.email, set: { codeHash, expiresAt } });
    },

    async signInCode(email) {
      const [row] = await db
        .select({ codeHash: adminSignInCodes.codeHash, expiresAt: adminSignInCodes.expiresAt })
        .from(adminSignInCodes)
        .where(eq(adminSignInCodes.email, email));
      return row;
    },

    async deleteSignInCode(email) {
      await db.delete(adminSignInCodes).where(eq(adminSignInCodes.email, email));
    },

    async setPendingTotp(adminUserId, sealedSecret, codeHashes) {
      await db.transaction(async (tx) => {
        await tx
          .update(adminUsers)
          .set({ totpSecret: sealedSecret, totpConfirmedAt: null })
          .where(eq(adminUsers.id, adminUserId));
        await tx.delete(recoveryCodes).where(eq(recoveryCodes.adminUserId, adminUserId));
        await tx
          .insert(recoveryCodes)
          .values(codeHashes.map((codeHash) => ({ codeHash, adminUserId })));
      });
    },

    async confirmTotp(adminUserId, at) {
      await db
        .update(adminUsers)
        .set({ totpConfirmedAt: at })
        .where(eq(adminUsers.id, adminUserId));
    },

    async spendRecoveryCode(adminUserId, codeHash, at) {
      const spent = await db
        .update(recoveryCodes)
        .set({ usedAt: at })
        .where(
          and(
            eq(recoveryCodes.codeHash, codeHash),
            eq(recoveryCodes.adminUserId, adminUserId),
            isNull(recoveryCodes.usedAt),
          ),
        )
        .returning({ codeHash: recoveryCodes.codeHash });
      return spent.length > 0;
    },

    async addAdminSession({ tokenHash, adminUserId, createdAt, expiresAt }) {
      await db
        .insert(adminSessions)
        .values({ tokenHash, adminUserId, createdAt, lastSeenAt: createdAt, expiresAt });
    },

    async adminSession(tokenHash) {
      const [row] = await sessionsWith(eq(adminSessions.tokenHash, tokenHash));
      return row;
    },

    async touchAdminSession(tokenHash, at) {
      await db
        .update(adminSessions)
        .set({ lastSeenAt: at })
        .where(eq(adminSessions.tokenHash, tokenHash));
    },

    adminSessionsOf: (adminUserId) => sessionsWith(eq(adminSessions.adminUserId, adminUserId)),

    async deleteAdminSession(tokenHash) {
      await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
    },

    async deleteAdminSessionsOf(adminUserId) {
      await db.delete(adminSessions).where(eq(adminSessions.adminUserId, adminUserId));
    },

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

/** HMAC-SHA1, the hash of the admin's TOTP. */
export const hmacSha1 = (key: Uint8Array, message: Uint8Array) =>
  new Uint8Array(createHmac('sha1', key).update(message).digest());

/**
 * Seals the admin's TOTP secrets (AES-256-GCM) with a key derived from the
 * backend's secret, so a copy of the database alone signs no one in.
 */
export function createSecretVault(secret: string): SecretVault {
  const key = createHmac('sha256', secret).update('admin-totp').digest();
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const sealed = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [iv, cipher.getAuthTag(), sealed].map((part) => part.toString('base64url')).join('.');
    },
    open(sealed) {
      const [iv = '', tag = '', body = ''] = sealed.split('.');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
