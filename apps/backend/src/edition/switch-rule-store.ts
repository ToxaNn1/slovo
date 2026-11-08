import type { ForceUpdateMinimums } from '@slovo/contracts';
import type { SwitchRuleStore } from '@slovo/server-core';
import { and, asc, eq } from 'drizzle-orm';

import type { Database } from '../database/database';
import { forceUpdateMinimums, switchRules } from '../database/schema';

/** The remote Feature Switch Rules and force-update minimums, kept in their tables (ADR 0089). */
export function createSwitchRuleStore({ db }: Database): SwitchRuleStore {
  return {
    async rules(editionId) {
      const rows = await db
        .select()
        .from(switchRules)
        .where(eq(switchRules.editionId, editionId))
        .orderBy(asc(switchRules.feature), asc(switchRules.order));
      return rows.map((row) => ({
        id: row.ruleId,
        editionId: row.editionId,
        feature: row.feature,
        order: row.order,
        verdict: row.verdict,
        targets: row.targets,
      }));
    },

    async setRules(editionId, feature, rules, at) {
      await db.transaction(async (tx) => {
        await tx
          .delete(switchRules)
          .where(and(eq(switchRules.editionId, editionId), eq(switchRules.feature, feature)));
        if (rules.length === 0) return;
        await tx.insert(switchRules).values(
          rules.map((rule) => ({
            editionId,
            feature,
            order: rule.order,
            ruleId: rule.id,
            verdict: rule.verdict,
            targets: rule.targets,
            setAt: at,
          })),
        );
      });
    },

    async minimums(editionId) {
      const rows = await db
        .select()
        .from(forceUpdateMinimums)
        .where(eq(forceUpdateMinimums.editionId, editionId));
      const minimums: { -readonly [P in keyof ForceUpdateMinimums]: ForceUpdateMinimums[P] } = {};
      for (const { platform, soft, hard } of rows) {
        minimums[platform] = {
          ...(soft === null ? {} : { soft }),
          ...(hard === null ? {} : { hard }),
        };
      }
      return minimums;
    },

    async setMinimum(editionId, platform, { soft, hard }, at) {
      const values = { soft: soft ?? null, hard: hard ?? null, setAt: at };
      await db
        .insert(forceUpdateMinimums)
        .values({ editionId, platform, ...values })
        .onConflictDoUpdate({
          target: [forceUpdateMinimums.editionId, forceUpdateMinimums.platform],
          set: values,
        });
    },
  };
}
