#!/usr/bin/env node
/**
 * Pushes this CI run on `main` to the backend's history for Якість (ADR 0096):
 * the tests and failed tests of every JUnit report, the coverage per package
 * of every coverage summary, and how long each finished job took.
 *
 *   node scripts/ci-history.mjs <folder of the downloaded test reports> [--dry-run]
 *
 * Reads GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA and GITHUB_TOKEN of the
 * run, and SLOVO_BACKEND_URL and CI_HISTORY_TOKEN. Without either of the last
 * two it says so and ends with 0: the history must never turn `main` red.
 */
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Every file under the folder whose name is `name`. */
function filesNamed(folder, name) {
  return readdirSync(folder, { recursive: true })
    .map((path) => join(folder, String(path)))
    .filter((path) => path.endsWith(`${sep}${name}`) && statSync(path).isFile());
}

const attribute = (tag, name) =>
  new RegExp(`\\s${name}="([^"]*)"`)
    .exec(tag)?.[1]
    ?.replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&') ?? '';

/** The tests of a JUnit report, and the names of those that failed. */
export function parseJunit(xml) {
  const cases = xml.split('<testcase').slice(1);
  const failed = cases
    .filter((body) => {
      const end = body.indexOf('>');
      if (body[end - 1] === '/') return false;
      const close = body.indexOf('</testcase>');
      return /<(failure|error)[\s>]/.test(close === -1 ? body : body.slice(0, close));
    })
    .map((body) => {
      const tag = body.slice(0, body.indexOf('>'));
      return [attribute(tag, 'classname'), attribute(tag, 'name')].filter(Boolean).join(' > ');
    });
  return { tests: cases.length, failed };
}

/**
 * The package of a report: the workspace folder before `coverage/` and the
 * runner after it, e.g. `apps/mobile/coverage/jest/` is `apps/mobile jest`.
 */
function whereOf(folder, path) {
  const parts = relative(folder, path).split(sep);
  const at = parts.indexOf('coverage');
  const runner = parts[at + 1];
  const where = parts.slice(Math.max(0, at - 2), at).join('/');
  return runner === undefined || runner === 'vitest' || runner.endsWith('.json')
    ? where
    : `${where} ${runner}`;
}

/** The run's tests, failed tests and coverage per package, from the reports in the folder. */
export function readReports(folder) {
  let tests = 0;
  const failedTests = [];
  for (const path of filesNamed(folder, 'junit.xml')) {
    const report = parseJunit(readFileSync(path, 'utf8'));
    tests += report.tests;
    failedTests.push(...report.failed);
  }
  const sums = new Map();
  for (const path of filesNamed(folder, 'coverage-summary.json')) {
    const { total } = JSON.parse(readFileSync(path, 'utf8'));
    const key = whereOf(folder, path);
    const sum = sums.get(key) ?? { lines: [0, 0], branches: [0, 0] };
    sum.lines[0] += total.lines.covered;
    sum.lines[1] += total.lines.total;
    sum.branches[0] += total.branches.covered;
    sum.branches[1] += total.branches.total;
    sums.set(key, sum);
  }
  const pct = ([covered, all]) => (all === 0 ? 100 : Math.round((covered / all) * 10000) / 100);
  const coverage = [...sums]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, sum]) => ({ package: key, lines: pct(sum.lines), branches: pct(sum.branches) }));
  return { tests, failedTests: [...new Set(failedTests)].slice(0, 1000), coverage };
}

/** How long each finished job of the run took, in seconds, and when it ran. */
async function jobsOf(repository, runId, token) {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } },
  );
  if (!response.ok) throw new Error(`GitHub answered ${String(response.status)} for the jobs`);
  const { jobs } = await response.json();
  return jobs
    .filter((job) => job.started_at && job.completed_at)
    .map((job) => ({
      name: job.name.slice(0, 200),
      seconds: Math.max(0, (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000),
      span: {
        startedAt: new Date(job.started_at).toISOString(),
        completedAt: new Date(job.completed_at).toISOString(),
      },
    }))
    .slice(0, 100);
}

async function main([folder, flag]) {
  const env = process.env;
  const dryRun = flag === '--dry-run';
  if (folder === undefined) throw new Error('usage: ci-history.mjs <reports folder> [--dry-run]');
  if (!dryRun && (!env.SLOVO_BACKEND_URL || !env.CI_HISTORY_TOKEN)) {
    console.log('SLOVO_BACKEND_URL or CI_HISTORY_TOKEN is not set: the CI history is not pushed.');
    return;
  }
  const run = {
    runId: Number(env.GITHUB_RUN_ID ?? 1),
    at: new Date().toISOString(),
    sha: env.GITHUB_SHA ?? '0000000',
    ...readReports(folder),
    jobs: env.GITHUB_TOKEN
      ? await jobsOf(env.GITHUB_REPOSITORY, env.GITHUB_RUN_ID, env.GITHUB_TOKEN)
      : [],
  };
  if (dryRun) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  const response = await fetch(new URL('/v1/admin/ci-runs', env.SLOVO_BACKEND_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.CI_HISTORY_TOKEN}`,
    },
    body: JSON.stringify(run),
  });
  if (!response.ok) throw new Error(`the backend answered ${String(response.status)}`);
  console.log(
    `Pushed run ${String(run.runId)}: ${String(run.tests)} tests, ${String(run.failedTests.length)} failed.`,
  );
}

// Run as a script, also from a path with spaces or through a symlink.
if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  await main(process.argv.slice(2));
}
