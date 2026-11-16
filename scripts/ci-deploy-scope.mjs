#!/usr/bin/env node
/**
 * What a push to main has to deploy (ADR 0151, amending 0104). Writes two
 * `true`/`false` flags to GITHUB_OUTPUT when it is set, and prints them:
 *
 * - `deploy`: a file changed that a Railway service is built from or
 *   configured by. Documentation, the phone app, the site, the widget, the
 *   video, the UI package and the workflows alone deploy nothing.
 * - `snapshot`: a file changed that can make the stored content fail the
 *   snapshot's output validation (#1819): the content Contract the snapshot
 *   route reaches, the content rules, the backend's content and database code
 *   and its migrations. Only then does the deploy ask for every Edition's
 *   snapshot, which reads all the content from Neon.
 *
 * The change is counted from the last commit whose deploy succeeded, not from
 * the push before, so a red or cancelled deploy is caught up by the next push.
 * When that commit can't be found or the diff fails, both flags are `true`.
 *
 *   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo GITHUB_SHA=… GITHUB_RUN_ID=… \
 *     node scripts/ci-deploy-scope.mjs
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The name of the job in ci.yml that deploys, whose success marks a deployed commit. */
const DEPLOY_JOB = 'Deploy to Railway';
/** How many earlier main runs to look through for the last deployed commit. */
const RUNS_LOOKED_AT = 50;

/** Files no Railway service is built from or configured by. */
const DEPLOY_FREE = [
  /^docs\//,
  /\.md$/,
  /^apps\/(mobile|site|widget|video)\//,
  /^packages\/ui\//,
  /^editions\/[^/]+\/legal\//,
  /^\.github\//,
  /^\.maestro\//,
  /^\.claude\//,
  /^copy-review\//,
];
/** The entry of the content Contract the snapshot route answers with. */
const SNAPSHOT_CONTRACT = 'packages/contracts/src/api/content.ts';
/** Code beside the Contract that decides what the snapshot reads and checks. */
const SNAPSHOT_CODE = [
  /^packages\/content-rules\/src\//,
  /^apps\/backend\/src\/(content|database)\//,
  /^apps\/backend\/migrations\//,
];
const TEST = /\.test\.ts$/;

/** The repository files `entry` reaches through relative imports, itself included. */
export function reachedFiles(entry, root = process.cwd()) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(join(root, file), 'utf8');
    for (const [, specifier] of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const base = join(dirname(file), specifier);
      const found = [`${base}.ts`, join(base, 'index.ts'), base].find(
        (path) => path.endsWith('.ts') && existsSync(join(root, path)),
      );
      if (found !== undefined) visit(relative('.', found));
    }
  };
  visit(entry);
  return seen;
}

/** The two flags for the changed files, given the files the snapshot Contract reaches. */
export function deployScope(changed, snapshotContract) {
  const deploy = changed.some((file) => !DEPLOY_FREE.some((free) => free.test(file)));
  const snapshot = changed.some(
    (file) =>
      !TEST.test(file) &&
      (snapshotContract.has(file) || SNAPSHOT_CODE.some((code) => code.test(file))),
  );
  return { deploy, snapshot };
}

async function lastDeployedSha({ token, repository, runId }) {
  const api = `https://api.github.com/repos/${repository}/actions`;
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' };
  const get = async (url) => {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${url} answered ${String(response.status)}`);
    return response.json();
  };
  const { workflow_runs: runs } = await get(
    `${api}/workflows/ci.yml/runs?branch=main&event=push&status=completed&per_page=${String(RUNS_LOOKED_AT)}`,
  );
  for (const run of runs) {
    if (String(run.id) === String(runId)) continue;
    const { jobs } = await get(`${api}/runs/${String(run.id)}/jobs?per_page=100`);
    if (jobs.some((job) => job.name === DEPLOY_JOB && job.conclusion === 'success')) {
      return run.head_sha;
    }
  }
  return undefined;
}

function changedSince(base, head) {
  const output = execFileSync('git', ['diff', '--name-only', base, head], { encoding: 'utf8' });
  return output.split('\n').filter((line) => line !== '');
}

async function main() {
  const head = process.env.GITHUB_SHA ?? 'HEAD';
  let scope = { deploy: true, snapshot: true };
  try {
    const base = await lastDeployedSha({
      token: process.env.GITHUB_TOKEN,
      repository: process.env.GITHUB_REPOSITORY,
      runId: process.env.GITHUB_RUN_ID,
    });
    if (base === undefined) {
      console.log('No earlier successful deploy found: everything deploys.');
    } else {
      const changed = changedSince(base, head);
      console.log(`Changed since the last deploy (${base}): ${String(changed.length)} files.`);
      scope = deployScope(changed, reachedFiles(SNAPSHOT_CONTRACT));
    }
  } catch (error) {
    console.log(`Detection failed, everything deploys: ${String(error)}`);
  }
  const lines = [`deploy=${String(scope.deploy)}`, `snapshot=${String(scope.snapshot)}`];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await main();
}
