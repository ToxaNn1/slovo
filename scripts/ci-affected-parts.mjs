#!/usr/bin/env node
/**
 * Which test parts of `ci.yml` a pull request can affect (ADR 0098, amending
 * 0086). Writes one `true`/`false` flag per part, and the `--filter` arguments
 * of the part "other packages", to GITHUB_OUTPUT when it is set, and prints
 * them.
 *
 *   EVENT_NAME=pull_request BASE_SHA=<base sha> node scripts/ci-affected-parts.mjs
 *
 * Everything runs on any event but a pull request, when a changed file lies
 * outside the workspace packages and is not documentation (an Edition's
 * content, a root config, the lockfile, a workflow, a script), and when the
 * detection fails. A pull request of documentation alone runs nothing.
 * Otherwise a part runs when Turborepo counts its package as affected: changed,
 * or depending on a changed package.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

/** The packages a part of its own tests; "other packages" tests the rest. */
const OWN_PARTS = {
  core: '@slovo/core',
  ui: '@slovo/ui',
  site: '@slovo/site',
  admin: '@slovo/admin',
  mobile: '@slovo/mobile',
  backend: '@slovo/backend',
};
/** Tested by a part or a job of their own, never by "other packages". */
const NOT_OTHER = ['@slovo/backend', '@slovo/core', '@slovo/ui', '@slovo/mobile', '@slovo/site'];

const DOCS = /^docs\/|\.md$/;
const IN_PACKAGES = /^(apps|packages|tools)\//;
// The app links to the legal pages by address and never reads them (ADR 0086).
const SITE_ONLY = /^(editions\/[^/]+\/legal\/|\.github\/workflows\/pages\.yml$)/;
const MOBILE_ONLY = /^\.github\/workflows\/(maestro|ota-update)\.yml$/;

const ALL_OTHER_FILTERS = NOT_OTHER.map((name) => `--filter=!${name}`).join(' ');

/** Every part on. */
function all(reason) {
  const flags = Object.fromEntries([...Object.keys(OWN_PARTS), 'other'].map((p) => [p, true]));
  return { reason, flags, otherFilters: ALL_OTHER_FILTERS };
}

/**
 * The parts for the changed files and the names of the affected packages.
 * `affected` is called only when the packages decide.
 */
function partsFor(changed, affected) {
  const files = changed.filter(Boolean);
  // The legal pages are Markdown, but the site builds them.
  const code = files.filter((file) => SITE_ONLY.test(file) || !DOCS.test(file));
  const outside = code.filter(
    (file) => !IN_PACKAGES.test(file) && !SITE_ONLY.test(file) && !MOBILE_ONLY.test(file),
  );
  if (outside.length > 0) return all(`changed outside the packages: ${outside[0]}`);
  const names = code.length === 0 ? [] : affected();
  const flags = Object.fromEntries(
    Object.entries(OWN_PARTS).map(([part, name]) => [part, names.includes(name)]),
  );
  if (code.some((file) => SITE_ONLY.test(file))) flags.site = true;
  if (code.some((file) => MOBILE_ONLY.test(file))) flags.mobile = true;
  const others = names.filter((name) => !NOT_OTHER.includes(name)).sort();
  flags.other = others.length > 0;
  return {
    reason: `affected: ${names.join(' ') || 'none'}`,
    flags,
    otherFilters: others.map((name) => `--filter=${name}`).join(' '),
  };
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

/** The packages Turborepo counts as affected since the base, dependents included. */
function turboAffected(base) {
  const { devDependencies } = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = devDependencies.turbo.replace(/^[^\d]*/, '');
  const out = execFileSync(
    'npx',
    ['--yes', `turbo@${version}`, 'ls', '--affected', '--output=json'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        TURBO_SCM_BASE: base,
        TURBO_SCM_HEAD: 'HEAD',
        TURBO_TELEMETRY_DISABLED: '1',
      },
    },
  );
  const { packages } = JSON.parse(out.slice(out.indexOf('{')));
  return packages.items.map((item) => item.name);
}

function detect() {
  const { EVENT_NAME: event, BASE_SHA: base } = process.env;
  if (event !== 'pull_request' || !base) return all(`event ${event ?? 'unknown'}`);
  try {
    const changed = git('diff', '--name-only', base, 'HEAD').split('\n');
    return partsFor(changed, () => turboAffected(base));
  } catch (error) {
    console.log(`::warning::Affected parts not detected, running every part: ${error.message}`);
    return all('detection failed');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { reason, flags, otherFilters } = detect();
  const lines = [
    ...Object.entries(flags).map(([part, on]) => `${part}=${on}`),
    `other_filters=${otherFilters}`,
  ];
  console.log(reason);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}
