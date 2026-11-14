import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { printSummary } from './cli-common';
import {
  REPORT_FILE,
  runSourcing,
  type KindOutcome,
  type PipelineOptions,
  type ReviewReport,
  type SourcingKind,
} from './index';
import { seededRandom, editionWithSnapshot } from './test-support';

/** An Edition with the UA Edition's config and no content. */
function emptyEdition() {
  return editionWithSnapshot();
}

function options(overrides: Partial<PipelineOptions> = {}): PipelineOptions {
  const workDir = mkdtempSync(join(tmpdir(), 'slovo-pipeline-'));
  return {
    edition: emptyEdition(),
    outDir: join(workDir, 'review'),
    cacheDir: join(workDir, 'cache'),
    fetch: () => Promise.reject(new Error('No network in this test')),
    clock: { now: () => 0, sleep: () => Promise.resolve() },
    random: seededRandom(),
    ...overrides,
  };
}

/** A kind that drafts one Tip per line with `draft`, which may throw. */
function tipsKind(draft: (text: string, newId: () => string) => KindOutcome): SourcingKind<string> {
  return {
    entryKind: 'tip',
    folder: 'tips',
    idPrefix: 't_',
    parseLine: (content) => ({ ok: true, text: content, request: content }),
    start:
      ({ newId }) =>
      (request) =>
        Promise.resolve().then(() => draft(request, newId)),
  };
}

function oneDraft(text: string, newId: () => string): KindOutcome {
  return {
    drafts: [
      {
        entry: { id: newId() },
        headword: text,
        issues: [],
        flags: [],
        summary: { text, group: '—', examples: 0, definition: '' },
      },
    ],
    flags: [],
  };
}

/** Every file of the kind's folder with its content. */
function snapshot(outDir: string): Record<string, string> {
  const dir = join(outDir, 'tips');
  const files: Record<string, string> = {};
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const path = join(dir, name);
    if (name.endsWith('.json') || name.endsWith('.md')) files[name] = readFileSync(path, 'utf8');
  }
  return files;
}

describe('a sourcing run', () => {
  it('leaves the previous drafts and report as they were when it stops mid-run', async () => {
    const run = options();
    const first = await runSourcing('один\nдва\n', run, tipsKind(oneDraft));
    expect(first.ok).toBe(true);
    const before = snapshot(run.outDir);
    expect(Object.keys(before)).toHaveLength(3);

    const failing = tipsKind((text, newId) => {
      if (text === 'два') throw new Error('A parser broke');
      return oneDraft(text, newId);
    });
    await expect(runSourcing('один\nдва\n', run, failing)).rejects.toThrow('A parser broke');

    expect(snapshot(run.outDir)).toEqual(before);
    expect(readdirSync(run.outDir)).toEqual(['tips']);
  });

  it('replaces the previous drafts and report when it ends', async () => {
    const run = options();
    await runSourcing('один\nдва\n', run, tipsKind(oneDraft));

    const second = await runSourcing('три\n', run, tipsKind(oneDraft));

    if (!second.ok) throw new Error(second.errors.join('\n'));
    const [draft] = second.report.lemmas.flatMap((lemma) => lemma.drafts);
    expect(Object.keys(snapshot(run.outDir)).sort()).toEqual([
      `drafts/${draft?.id ?? ''}.json`,
      REPORT_FILE,
    ]);
    expect(second.reportFile).toBe(join(run.outDir, 'tips', REPORT_FILE));
    expect(readFileSync(second.reportFile, 'utf8')).toContain('## три (line 1)');
  });

  it('gives up on a new id after many taken ones instead of looping', async () => {
    const run = options({ random: () => 0 });

    await expect(runSourcing('один\nдва\n', run, tipsKind(oneDraft))).rejects.toThrow(
      /No free t_ id/,
    );
  });

  it('reports every repeat of a line against its first line', async () => {
    const result = await runSourcing('один\nОдин\nодин\n', options(), tipsKind(oneDraft));

    expect(result).toEqual({
      ok: false,
      errors: [
        'Line 2: "Один" is already listed on line 1',
        'Line 3: "один" is already listed on line 1',
      ],
    });
  });
});

describe('printSummary', () => {
  const report = (overrides: Partial<ReviewReport>): ReviewReport => ({
    lemmas: [],
    requests: { network: 1, cached: 0, backoffs: 0, unreachable: {} },
    ...overrides,
  });
  const summary = (result: ReviewReport) => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    return printSummary({ ok: true, report: result, reportFile: '/tmp/report.md' });
  };

  it('gives 0 for a run that fetched every line', () => {
    expect(summary(report({ lemmas: [{ lemma: 'коса', line: 1, drafts: [], flags: [] }] }))).toBe(
      0,
    );
  });

  it('gives 3 when a line failed to fetch', () => {
    const lemmas = [
      { lemma: 'коса', line: 1, drafts: [], flags: [] },
      {
        lemma: 'мжичка',
        line: 2,
        drafts: [],
        flags: [{ kind: 'fetch-failed' as const, message: 'HTTP 500' }],
      },
    ];
    expect(summary(report({ lemmas }))).toBe(3);
  });

  it('gives 3 when goroh.pp.ua was unreachable', () => {
    const requests = {
      network: 0,
      cached: 0,
      backoffs: 0,
      unreachable: { 'goroh.pp.ua': 'timed out' },
    };
    expect(summary(report({ requests }))).toBe(3);
  });
});
