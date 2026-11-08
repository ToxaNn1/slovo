/**
 * The quote check job (ADR 0084, 0090): checks the quoted text of every record
 * changed since its last check against its first source's page, through the
 * sourcing port and the Postgres sourcing cache. A save never waits for it:
 * every write other than an import raises the record version, and a record
 * with no check at its version is unverified.
 */
import {
  quotedTextOf,
  quoteOnPage,
  type QuotedRecord,
  type SourcePage,
} from '@slovo/content-rules';
import type { Clock } from '@slovo/server-core';
import { and, eq, ne } from 'drizzle-orm';

import type { Database } from '../database/database';
import {
  actionLog,
  contentCorrections,
  contentIdioms,
  contentSynonymRows,
  contentTips,
  contentVersions,
  contentWords,
  quoteChecks,
  sourcingCache,
} from '../database/schema';

/** The sourcing port: fetches a source page. */
export interface SourcePages {
  get(url: string): Promise<SourcePage>;
}

/** How long a cached page stands in for the source: 30 days. */
export const QUOTE_CHECK_FRESHNESS_MS = 30 * 24 * 60 * 60 * 1000;

type Db = Pick<Database['db'], 'select'>;
type QuotedKind = QuotedRecord['kind'];

const QUOTED_TABLES = {
  word: contentWords,
  correction: contentCorrections,
  idiom: contentIdioms,
  synonymRow: contentSynonymRows,
  tip: contentTips,
} as const;

/** A live quoted record changed since the import, with its check at its version, if any. */
interface Changed {
  readonly record: QuotedRecord;
  readonly id: string;
  readonly recordVersion: number;
  readonly url: string;
  readonly check: 'unverified' | 'verified' | 'failed';
}

/**
 * The Edition's live quoted records an Admin user or an Агент changed. An
 * imported record passed `pnpm content verify` in CI, and a record with no
 * source page (a Tip quoting its book alone) has nothing to fetch: neither is
 * listed.
 */
async function changedRecords(db: Db, editionId: string): Promise<Changed[]> {
  const checks = await db.select().from(quoteChecks).where(eq(quoteChecks.editionId, editionId));
  const checkOf = (kind: QuotedKind, id: string) =>
    checks.find((check) => check.kind === kind && check.id === id);
  type Table = (typeof QUOTED_TABLES)[QuotedKind];
  const live = (table: Table) =>
    and(eq(table.editionId, editionId), eq(table.retired, false), ne(table.changedBy, 'import'));
  const rows = [
    ...(
      await db
        .select({
          id: contentWords.id,
          fields: contentWords.fields,
          recordVersion: contentWords.recordVersion,
        })
        .from(contentWords)
        .where(live(contentWords))
    ).map((row) => ({ ...row, record: { kind: 'word', fields: row.fields } as const })),
    ...(
      await db
        .select({
          id: contentCorrections.id,
          fields: contentCorrections.fields,
          recordVersion: contentCorrections.recordVersion,
        })
        .from(contentCorrections)
        .where(live(contentCorrections))
    ).map((row) => ({ ...row, record: { kind: 'correction', fields: row.fields } as const })),
    ...(
      await db
        .select({
          id: contentIdioms.id,
          fields: contentIdioms.fields,
          recordVersion: contentIdioms.recordVersion,
        })
        .from(contentIdioms)
        .where(live(contentIdioms))
    ).map((row) => ({ ...row, record: { kind: 'idiom', fields: row.fields } as const })),
    ...(
      await db
        .select({
          id: contentSynonymRows.id,
          fields: contentSynonymRows.fields,
          recordVersion: contentSynonymRows.recordVersion,
        })
        .from(contentSynonymRows)
        .where(live(contentSynonymRows))
    ).map((row) => ({ ...row, record: { kind: 'synonymRow', fields: row.fields } as const })),
    ...(
      await db
        .select({
          id: contentTips.id,
          fields: contentTips.fields,
          recordVersion: contentTips.recordVersion,
        })
        .from(contentTips)
        .where(live(contentTips))
    ).map((row) => ({ ...row, record: { kind: 'tip', fields: row.fields } as const })),
  ];
  return rows.flatMap(({ id, recordVersion, record }): Changed[] => {
    const url = record.fields.sources[0]?.url;
    if (url === undefined) return [];
    const check = checkOf(record.kind, id);
    return [
      {
        record,
        id,
        recordVersion,
        url,
        check:
          check?.recordVersion !== recordVersion
            ? 'unverified'
            : check.outcome === 'verified'
              ? 'verified'
              : 'failed',
      },
    ];
  });
}

/** The content report's quote check counts for the Edition. */
export async function quoteCheckCounts(db: Db, editionId: string) {
  const changed = await changedRecords(db, editionId);
  return {
    unverified: changed.filter(({ check }) => check === 'unverified').length,
    failed: changed.filter(({ check }) => check === 'failed').length,
  };
}

export function createQuoteCheck({
  database,
  clock,
  pages,
}: {
  database: Database;
  clock: Clock;
  pages: SourcePages;
}) {
  const { db } = database;

  /** The page from the sourcing cache while fresh, else from the source; a 200 or 404 is cached. */
  async function pageOf(url: string): Promise<SourcePage | undefined> {
    const now = clock.now();
    const [cached] = await db.select().from(sourcingCache).where(eq(sourcingCache.pageUrl, url));
    if (
      cached !== undefined &&
      now.getTime() - cached.fetchedAt.getTime() < QUOTE_CHECK_FRESHNESS_MS
    ) {
      return { status: cached.httpStatus, body: cached.body };
    }
    let page: SourcePage;
    try {
      page = await pages.get(url);
    } catch {
      return undefined;
    }
    if (page.status === 200 || page.status === 404) {
      const row = { pageUrl: url, httpStatus: page.status, body: page.body, fetchedAt: now };
      await db
        .insert(sourcingCache)
        .values(row)
        .onConflictDoUpdate({ target: sourcingCache.pageUrl, set: row });
    }
    return page;
  }

  /**
   * Checks every unverified record of every imported Edition once. A quote not
   * on its page is flagged for the Content queue with the finding; the record
   * stays live. A page that could not be fetched leaves the record unverified
   * for the next run.
   */
  async function run() {
    const counts = { verified: 0, failed: 0, unfetched: 0 };
    const imported = await db
      .select({ editionId: contentVersions.editionId })
      .from(contentVersions);
    for (const { editionId } of imported) {
      const unverified = (await changedRecords(db, editionId)).filter(
        ({ check }) => check === 'unverified',
      );
      for (const { record, id, recordVersion, url } of unverified) {
        const page = await pageOf(url);
        const found = page === undefined ? undefined : quoteOnPage(quotedTextOf(record), url, page);
        if (found === undefined || found.outcome === 'fetch-failed') {
          counts.unfetched += 1;
          continue;
        }
        const finding =
          found.outcome === 'ok'
            ? null
            : found.outcome === 'llm'
              ? `quote not found: on ${url} only a language model's block holds it`
              : `quote not found: «${found.quote}» is not on ${url}`;
        const now = clock.now();
        await db.transaction(async (tx) => {
          const check = {
            recordVersion,
            outcome: finding === null ? ('verified' as const) : ('not-found' as const),
            finding,
            checkedAt: now,
          };
          await tx
            .insert(quoteChecks)
            .values({ editionId, kind: record.kind, id, ...check })
            .onConflictDoUpdate({
              target: [quoteChecks.editionId, quoteChecks.kind, quoteChecks.id],
              set: check,
            });
          if (finding === null) return;
          await tx.insert(actionLog).values({
            who: { kind: 'command', command: 'quote-check' },
            at: now,
            what: `content.${record.kind}.flag`,
            before: null,
            after: { id },
            reason: finding,
            editionId,
            batchId: null,
          });
        });
        counts[finding === null ? 'verified' : 'failed'] += 1;
      }
    }
    return counts;
  }

  return { run };
}
