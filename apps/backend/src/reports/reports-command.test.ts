import { spawn } from 'node:child_process';

import type { MistakeReport } from '@slovo/contracts';
import { describe, expect, it, vi } from 'vitest';

import { mistakeReports } from '../database/schema';
import { newIp, testApp, testEditions } from '../test-support';

/** A valid report of a mistake in an Entry of the Edition. */
const report = (
  editionId: string,
  entryId: string,
  change: Partial<MistakeReport> = {},
): MistakeReport => ({
  editionId,
  entryId,
  type: 'stress',
  comment: '',
  appVersion: '0.8.14',
  contentVersion: 42,
  ...change,
});

/**
 * The backend serving the Editions of the ids, with no report kept yet: the
 * tests of the file share its database, and the list reads every report.
 */
async function servingEditions(...ids: string[]) {
  const app = testApp({ editions: testEditions(ids).read() });
  await app.database.db.delete(mistakeReports);
  /** Sends the report at the time, from an IP address of its own so no limit is met. */
  const sendAt = async (time: string, sent: MistakeReport) => {
    vi.setSystemTime(new Date(time));
    await app.clientFrom(newIp()).reports.send(sent);
  };
  return { ...app, sendAt };
}

describe('the reports list command', () => {
  it('prints each kept report, newest first, with all it carries', async () => {
    const { sendAt, listReports } = await servingEditions('uk');
    await sendAt('2026-10-26T09:30:00Z', report('uk', 'w_first', { type: 'typo' }));
    await sendAt(
      '2026-10-28T14:05:07Z',
      report('uk', 'w_newest', { type: 'other', comment: 'The example is a different Word.' }),
    );
    await sendAt(
      '2026-10-27T18:00:00Z',
      report('uk', 'c_middle', { type: 'definition', appVersion: '0.8.13', contentVersion: 41 }),
    );

    const printed = await listReports();

    expect(printed.join('\n')).toMatch(
      new RegExp(
        [
          String.raw`^2026-10-28 14:05:07 UTC  uk  w_newest  other  "The example is a different Word\."`,
          String.raw`  id [0-9a-f-]{36}, app 0\.8\.14, content 42`,
          String.raw`2026-10-27 18:00:00 UTC  uk  c_middle  definition  \(no comment\)`,
          String.raw`  id [0-9a-f-]{36}, app 0\.8\.13, content 41`,
          String.raw`2026-10-26 09:30:00 UTC  uk  w_first  typo  \(no comment\)`,
          String.raw`  id [0-9a-f-]{36}, app 0\.8\.14, content 42$`,
        ].join('\n'),
      ),
    );
  });

  it('prints a comment of several lines on one line', async () => {
    const { sendAt, listReports } = await servingEditions('uk');
    await sendAt('2026-10-28T10:00:00Z', report('uk', 'w_lines', { comment: 'One.\nTwo.' }));

    const [line] = await listReports();

    expect(line).toBe('2026-10-28 10:00:00 UTC  uk  w_lines  stress  "One.\\nTwo."');
  });

  it("keeps one Edition's reports with --edition", async () => {
    const { sendAt, listReports } = await servingEditions('kept', 'other');
    await sendAt('2026-10-28T10:00:00Z', report('kept', 'w_kept'));
    await sendAt('2026-10-28T11:00:00Z', report('other', 'w_other'));

    const printed = await listReports({ editionId: 'kept' });

    expect(printed.join('\n')).toContain('w_kept');
    expect(printed.join('\n')).not.toContain('w_other');
  });

  it('keeps the reports received from the date on with --since', async () => {
    const { sendAt, listReports } = await servingEditions('uk');
    await sendAt('2026-10-26T23:59:59Z', report('uk', 'w_before'));
    await sendAt('2026-10-27T00:00:00Z', report('uk', 'w_on'));
    await sendAt('2026-10-28T12:00:00Z', report('uk', 'w_after'));

    const printed = (await listReports({ since: new Date('2026-10-27') })).join('\n');

    expect(printed).toContain('w_on');
    expect(printed).toContain('w_after');
    expect(printed).not.toContain('w_before');
  });

  it('takes both filters at once', async () => {
    const { sendAt, listReports } = await servingEditions('kept', 'other');
    await sendAt('2026-10-26T12:00:00Z', report('kept', 'w_early'));
    await sendAt('2026-10-28T12:00:00Z', report('kept', 'w_late'));
    await sendAt('2026-10-28T12:00:00Z', report('other', 'w_elsewhere'));

    const printed = await listReports({ editionId: 'kept', since: new Date('2026-10-27') });

    expect(printed).toEqual([
      '2026-10-28 12:00:00 UTC  kept  w_late  stress  (no comment)',
      expect.stringMatching(/^ {2}id /) as unknown,
    ]);
  });

  it('says so when no report is kept', async () => {
    const { listReports } = await servingEditions('uk');

    await expect(listReports()).resolves.toEqual(['No Mistake Reports to check.']);
  });

  it('says so when the filters leave no report', async () => {
    const { sendAt, listReports } = await servingEditions('kept', 'quiet');
    await sendAt('2026-10-26T12:00:00Z', report('kept', 'w_old'));

    await expect(listReports({ editionId: 'quiet' })).resolves.toEqual([
      'No Mistake Reports to check.',
    ]);
    await expect(listReports({ since: new Date('2026-10-27') })).resolves.toEqual([
      'No Mistake Reports to check.',
    ]);
  });
});

/** Runs `pnpm reports` with the arguments and no database, and answers its exit code and what it printed to stderr. */
async function runCommand(...args: string[]) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', 'src/reports/reports-command.ts', ...args],
    {
      cwd: new URL('../..', import.meta.url),
      env: { PATH: process.env['PATH'] ?? '' },
    },
  );
  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
  const exitCode = await new Promise<number | null>((resolve) => child.on('exit', resolve));
  return { exitCode, stderr };
}

describe('the reports list command given --since', { timeout: 30_000 }, () => {
  it.each(['2026-02-30', '2026-13-01', '2026-04-31', '2026-00-10'])(
    'refuses %s, a day that is no day of the calendar, saying so, and exits non-zero',
    async (since) => {
      const { exitCode, stderr } = await runCommand('list', '--since', since);

      expect(exitCode).toBe(2);
      expect(stderr).toContain(`--since ${since} is no day of the calendar.`);
    },
  );
});

/** The ids `reports list` prints, in its order. */
const printedIds = (printed: string[]) =>
  printed.flatMap((line) => /^ {2}id ([0-9a-f-]{36}),/.exec(line)?.[1] ?? []);

describe('the reports resolve command', () => {
  it('takes the report off the list and keeps the others', async () => {
    const { sendAt, listReports, resolveReport } = await servingEditions('uk');
    await sendAt('2026-10-27T10:00:00Z', report('uk', 'w_kept'));
    await sendAt('2026-10-28T10:00:00Z', report('uk', 'w_checked'));
    const [checked, kept] = printedIds(await listReports());

    const resolved = await resolveReport(String(checked));

    expect(resolved).toEqual({ exitCode: 0, line: `Resolved Mistake Report ${String(checked)}.` });
    const printed = await listReports();
    expect(printed.join('\n')).not.toContain('w_checked');
    expect(printedIds(printed)).toEqual([kept]);
  });

  it('says so and exits non-zero for an id it does not keep', async () => {
    const { sendAt, listReports, resolveReport } = await servingEditions('uk');
    await sendAt('2026-10-28T10:00:00Z', report('uk', 'w_kept'));
    const [kept] = printedIds(await listReports());
    await resolveReport(String(kept));

    await expect(resolveReport(String(kept))).resolves.toEqual({
      exitCode: 1,
      line: `No Mistake Report ${String(kept)} to resolve.`,
    });
    await expect(resolveReport('not-an-id')).resolves.toEqual({
      exitCode: 1,
      line: 'No Mistake Report not-an-id to resolve.',
    });
  });
});
