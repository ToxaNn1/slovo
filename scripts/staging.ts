#!/usr/bin/env node
/**
 * The Staging Deployment's tools (ADR 0168): the checks its two workflows run
 * on their inputs, its database reset and the owner's set-up wizard. Node runs
 * this file as it is (it strips the types), with no install:
 *
 *   node scripts/staging.ts check-ref <git ref>
 *   node scripts/staging.ts check-definition <path of a .railway/railway.ts>
 *   NEON_API_KEY=… NEON_PROJECT_ID=… NEON_STAGING_BRANCH_ID=… \
 *     node scripts/staging.ts reset <confirmation, the word `staging`>
 *   node scripts/staging.ts wizard [--dry-run]
 *
 * The reset asks Neon to restore the staging branch from its parent, so no
 * data crosses the network. Nothing here runs on a schedule, and the wizard
 * calls no API: the owner does every step in the dashboards.
 */
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A checked input: its value, or why it is refused. */
export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

/** The address the Staging Deployment answers at (`.railway/railway.ts`). */
export const STAGING_ADDRESS = 'https://staging.slovoapp.org';

/** The word the reset asks for, so a stray run never wipes the staging data. */
export const RESET_CONFIRMATION = 'staging';

const NEON_API = 'https://console.neon.tech/api/v2';

/**
 * A branch, tag or commit to deploy: the characters `git check-ref-format`
 * allows in practice, no `..`, no leading `-` (which a command would read as
 * an option), no `@{`, no `/` or `.lock` at an end, and no pull request's
 * ref (`refs/pull/…`).
 */
export function checkRef(ref: string): Checked<string> {
  const refused = (why: string): Checked<string> => ({
    ok: false,
    reason: `The git ref "${ref}" ${why}`,
  });
  if (ref.length === 0) return refused('is empty: expected a branch, a tag or a commit');
  if (ref.length > 200) return refused('is longer than 200 characters');
  if (!/^[A-Za-z0-9._/-]+$/.test(ref)) return refused('may hold only letters, digits and . _ / -');
  if (ref.startsWith('-')) return refused('starts with "-"');
  if (ref.includes('..') || ref.includes('//')) return refused('holds ".." or "//"');
  if (/(^[/.]|[/.]$|\.lock$|\/\.)/.test(ref))
    return refused('starts or ends with "/" or ".", or ends with ".lock"');
  // A pull request's ref holds the code of whoever opened it, which the
  // deploy would run with the staging token.
  if (/^(refs\/)?pull\//.test(ref)) return refused("is a pull request's ref");
  return { ok: true, value: ref };
}

/** The staging Railway service, as the deploy needs it to be. */
export interface StagingService {
  /** The variables the owner sets in the `staging` environment, in the file's order. */
  preserved: string[];
}

/**
 * Checks the project `.railway/railway.ts` declares for the `staging`
 * environment before a deploy applies it: the backend alone, asleep when idle,
 * no Cron schedule, `DEPLOYMENT=staging`. A ref from before the Staging
 * Deployment existed would otherwise apply production's Cron services there,
 * which keep Neon awake all month.
 */
export function checkStagingDefinition(definition: unknown): Checked<StagingService> {
  const refused = (why: string): Checked<StagingService> => ({
    ok: false,
    reason: `The Railway project file declares no Staging Deployment for this ref: ${why}`,
  });
  const resources = field(definition, 'resources');
  if (!Array.isArray(resources)) return refused('it lists no resources');
  if (resources.length !== 1)
    return refused(`it declares ${resources.length} resources, expected the backend alone`);
  const backend: unknown = resources[0];
  if (field(backend, 'type') !== 'service' || field(backend, 'name') !== 'backend') {
    return refused('its one resource is not the backend service');
  }
  const deploy = field(backend, 'deploy');
  if (field(deploy, 'cronSchedule') !== undefined)
    return refused('the backend runs on a Cron schedule');
  if (field(deploy, 'sleepApplication') !== true) return refused('the backend does not sleep');
  const variables = field(backend, 'variables');
  if (typeof variables !== 'object' || variables === null)
    return refused('the backend has no variables');
  const deployment = field(variables, 'DEPLOYMENT');
  if (field(deployment, 'type') !== 'literal' || field(deployment, 'value') !== 'staging') {
    return refused('DEPLOYMENT is not set to "staging"');
  }
  const preserved = Object.entries(variables)
    .filter(([, variable]) => field(variable, 'type') === 'preserve')
    .map(([name]) => name);
  return { ok: true, value: { preserved } };
}

/** What the reset is given: the confirmation and the three Neon settings. */
export interface ResetInputs {
  confirmation: string;
  apiKey: string | undefined;
  projectId: string | undefined;
  branchId: string | undefined;
}

interface ResetTarget {
  apiKey: string;
  projectId: string;
  branchId: string;
}

export function checkResetInputs(inputs: ResetInputs): Checked<ResetTarget> {
  if (inputs.confirmation !== RESET_CONFIRMATION) {
    return {
      ok: false,
      reason: `The confirmation is "${inputs.confirmation}": type ${RESET_CONFIRMATION} to replace the staging data with production's`,
    };
  }
  const { apiKey, projectId, branchId } = inputs;
  if (!apiKey) return { ok: false, reason: 'NEON_API_KEY is not set' };
  if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) {
    return { ok: false, reason: 'NEON_PROJECT_ID is not set, or is not a Neon project id' };
  }
  if (!branchId || !/^br-[a-z0-9-]+$/.test(branchId)) {
    return {
      ok: false,
      reason: 'NEON_STAGING_BRANCH_ID is not set, or is not a Neon branch id (br-…)',
    };
  }
  return { ok: true, value: { apiKey, projectId, branchId } };
}

/** What a reset did: the branch it restored from. */
export interface Reset {
  parentId: string;
}

/**
 * Restores the staging branch to the head of its parent (production's `main`)
 * with Neon's branch restore: two requests, and the data never leaves Neon.
 * Refuses a branch that is the project's default or protected one, or has no
 * parent, so a wrong id can never reset production.
 */
export async function resetStagingBranch(
  inputs: ResetInputs,
  fetch: typeof globalThis.fetch,
): Promise<Checked<Reset>> {
  const checked = checkResetInputs(inputs);
  if (!checked.ok) return checked;
  const { apiKey, projectId, branchId } = checked.value;
  const url = `${NEON_API}/projects/${projectId}/branches/${branchId}`;
  const headers = { Accept: 'application/json', Authorization: `Bearer ${apiKey}` };

  const found = await fetch(url, { headers });
  if (!found.ok)
    return { ok: false, reason: `Neon answered ${found.status} for the staging branch` };
  const branch = field(await found.json(), 'branch');
  const parentId = field(branch, 'parent_id');
  if (field(branch, 'default') === true || field(branch, 'protected') === true) {
    return {
      ok: false,
      reason: `The branch ${branchId} is the project's default or a protected branch: it is not staging`,
    };
  }
  if (typeof parentId !== 'string')
    return { ok: false, reason: `The branch ${branchId} has no parent to reset from` };

  const restored = await fetch(`${url}/restore`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_branch_id: parentId }),
  });
  if (!restored.ok) return { ok: false, reason: `Neon answered ${restored.status} to the restore` };
  return { ok: true, value: { parentId } };
}

/** One step of the owner's set-up: a title and what to do, in the owner's words. */
export interface WizardStep {
  title: string;
  lines: string[];
}

/** What the owner sets each staging variable to. */
const VARIABLE_HINTS: Record<string, string> = {
  DATABASE_URL: 'pooled connection string гілки staging з кроку 1 (…-pooler…?sslmode=require)',
  AUTH_SECRET: 'НОВЕ значення нижче, ніколи не production-ове',
  ZEPTOMAIL_API_URL: 'те саме, що в production',
  ZEPTOMAIL_TOKEN: 'те саме, що в production',
  MAIL_FROM: 'те саме, що в production',
  GOOGLE_CLIENT_IDS: 'те саме, що в production',
  SENTRY_DSN:
    'DSN проєкту бекенду в Sentry, той самий, що в production (звіти підуть з environment staging)',
  MEDIA_BASE: 'те саме, що в production: staging лише читає медіа',
  TRUSTED_PROXY_HOPS: 'те саме, що в production (Cloudflare перед Railway)',
  EDGE_SECRET:
    'НОВЕ значення (openssl rand -hex 32), те саме, що ставить Transform Rule зони Cloudflare для staging; порожнє вимикає перевірку',
};

/**
 * The owner's walk-through, in order: Neon branch, Railway environment and its
 * variables, GitHub secrets, the first deploy, DNS, EAS, the check. `preserved` comes
 * from the Railway project file, so a new staging variable shows up here.
 */
export function wizardSteps(preserved: string[], authSecret: string): WizardStep[] {
  const host = new URL(STAGING_ADDRESS).host;
  return [
    {
      title: 'Neon: гілка staging',
      lines: [
        'У проєкті Neon (план Launch) створи гілку `staging` від `main` (Branches → New branch).',
        'Compute гілки: фіксовано 0.25 CU (мінімум і максимум 0.25), Scale to zero — через 5 хвилин.',
        'Запиши три значення: pooled connection string гілки, ID гілки (br-…) і ID проєкту (Settings → General).',
        'Більше нічого не вмикай: жодних read replica, жодних запланованих задач.',
      ],
    },
    {
      title: 'Railway: порожнє середовище staging',
      lines: [
        'У проєкті Railway `slovo`: Environments → New Environment → Empty, назва `staging`.',
        'НЕ «Duplicate production»: копія принесе Cron-сервіси, які будять Neon щодня.',
        'Змінні сервісу backend у середовищі staging (DEPLOYMENT і PORT задає файл сам):',
        ...preserved.map(
          (name) =>
            `  ${name} — ${VARIABLE_HINTS[name] ?? 'див. docs/deploy.md, розділ The Staging Deployment'}`,
        ),
        `Новий AUTH_SECRET: ${authSecret}`,
        'Жодних POSTHOG_*, R2_*, TELEGRAM_*, GITHUB_TOKEN, EXPO_TOKEN: бекенд staging з ними не стартує або вони там зайві.',
        'Project Settings → Tokens: новий project token для середовища staging (не production!).',
      ],
    },
    {
      title: 'GitHub: секрети репозиторію',
      lines: [
        'Settings → Secrets and variables → Actions → New repository secret, чотири секрети:',
        '  RAILWAY_STAGING_TOKEN — project token середовища staging з кроку 2',
        '  NEON_API_KEY — ключ API Neon (Organization settings → API keys)',
        '  NEON_PROJECT_ID — ID проєкту Neon з кроку 1',
        '  NEON_STAGING_BRANCH_ID — ID гілки staging з кроку 1 (br-…)',
      ],
    },
    {
      title: 'Перший деплой',
      lines: [
        'GitHub → Actions → Staging deploy → Run workflow, ref `main`.',
        'Він застосує .railway/railway.ts до середовища staging і запустить міграції в release step, як у production.',
      ],
    },
    {
      title: `Cloudflare: DNS ${host}`,
      lines: [
        `У Railway, сервіс backend (staging) → Settings → Networking: домен ${host}; візьми ціль CNAME, яку він показує.`,
        'У Cloudflare, зона slovoapp.org: запис CNAME `staging` → ця ціль, Proxy status — Proxied (помаранчева хмара).',
        'Якщо Railway просить TXT-запис для перевірки домену — додай і його (без проксі).',
      ],
    },
    {
      title: 'EAS: змінні для збірки проти staging',
      lines: [
        `В EAS, середовище development: EXPO_PUBLIC_SLOVO_API_URL = ${STAGING_ADDRESS}.`,
        'Оновлення або development-збірка проти staging іде БЕЗ EXPO_PUBLIC_POSTHOG_KEY: у цьому середовищі його не має бути, щоб тести не потрапили в Аналітику.',
        'EXPO_TOKEN у GitHub уже є; нового секрету EAS не треба.',
      ],
    },
    {
      title: 'Перевірка',
      lines: [
        `Відкрий ${STAGING_ADDRESS}/health — має відповісти ok.`,
        'Скидання бази: Actions → Staging reset → Run workflow, у полі підтвердження слово staging.',
        'Через 5 хвилин без запитів: у Neon гілка staging — Idle, у Railway сервіс — Sleeping.',
      ],
    },
  ];
}

/** Where the wizard writes and how it waits for the owner. */
export interface WizardIo {
  write: (line: string) => void;
  /** Waits until the owner is done with a step; never called in a dry run. */
  waitForOwner: () => Promise<void>;
  /** A new AUTH_SECRET; never called in a dry run, which prints no secret. */
  newSecret: () => string;
}

/**
 * Walks the owner through every step. A dry run prints them all and waits for
 * no one, with no secret in its output; neither mode calls an API.
 */
export async function runWizard(preserved: string[], dryRun: boolean, io: WizardIo): Promise<void> {
  const secret = dryRun ? '<новий секрет, з’явиться в справжньому запуску>' : io.newSecret();
  const steps = wizardSteps(preserved, secret);
  io.write(
    dryRun
      ? 'Staging: налаштування (пробний прогін, нічого не змінюється)'
      : 'Staging: налаштування',
  );
  for (const [index, step] of steps.entries()) {
    io.write('');
    io.write(`Крок ${index + 1} з ${steps.length}. ${step.title}`);
    for (const line of step.lines) io.write(line);
    if (!dryRun) await io.waitForOwner();
  }
  io.write('');
  io.write('Готово: Staging Deployment налаштовано.');
}

/** A field of outside data, read without trusting its shape. */
function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

/** The project `.railway/railway.ts` (at `path`) declares for the `staging` environment. */
async function stagingDefinition(path: string): Promise<unknown> {
  const exported: unknown = await import(pathToFileURL(resolve(path)).href);
  const railway = field(exported, 'default');
  if (typeof railway !== 'function') throw new Error(`${path} exports no Railway project`);
  const context = {
    environment: 'staging',
    environmentName: 'staging',
    isEnvironment: (name: string) => name === 'staging',
    randomString: () => 'random',
    shared: {},
  };
  return railway(context, (name: string, definition: object) => ({ name, ...definition }));
}

function fail(reason: string): never {
  console.error(process.env['GITHUB_ACTIONS'] === 'true' ? `::error::${reason}` : reason);
  process.exit(1);
}

async function main(args: string[]): Promise<void> {
  const [command, argument = ''] = args;
  switch (command) {
    case 'check-ref': {
      const checked = checkRef(argument);
      if (!checked.ok) fail(checked.reason);
      console.log(`Deploying ${checked.value} to the Staging Deployment`);
      return;
    }
    case 'check-definition': {
      const checked = checkStagingDefinition(
        await stagingDefinition(argument || '.railway/railway.ts'),
      );
      if (!checked.ok) fail(checked.reason);
      console.log(
        'The Railway project file declares the Staging Deployment: the backend alone, asleep when idle',
      );
      return;
    }
    case 'reset': {
      const reset = await resetStagingBranch(
        {
          confirmation: argument,
          apiKey: process.env['NEON_API_KEY'],
          projectId: process.env['NEON_PROJECT_ID'],
          branchId: process.env['NEON_STAGING_BRANCH_ID'],
        },
        globalThis.fetch,
      );
      if (!reset.ok) fail(reset.reason);
      console.log(`The staging branch is restored from its parent ${reset.value.parentId}`);
      return;
    }
    case 'wizard': {
      const checked = checkStagingDefinition(
        await stagingDefinition(fileURLToPath(new URL('../.railway/railway.ts', import.meta.url))),
      );
      if (!checked.ok) fail(checked.reason);
      const terminal = createInterface({ input: process.stdin, output: process.stdout });
      try {
        await runWizard(checked.value.preserved, args.includes('--dry-run'), {
          write: (line) => console.log(line),
          waitForOwner: async () => {
            await terminal.question('Enter, коли зроблено… ');
          },
          newSecret: () => randomBytes(32).toString('base64'),
        });
      } finally {
        terminal.close();
      }
      return;
    }
    default:
      fail(
        'Usage: node scripts/staging.ts check-ref <ref> | check-definition <file> | reset staging | wizard [--dry-run]',
      );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
