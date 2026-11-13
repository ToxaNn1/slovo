import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { z } from 'zod';

import type { MailTransport } from './account/mailer';

/**
 * The `AUTH_SECRET` of `.env.example`, which anyone can read: a backend that
 * signed its Sessions with it would sign them with no secret (ADR 0030).
 */
const EXAMPLE_AUTH_SECRET = 'replace-with-at-least-32-random-characters';

/** An empty variable, as a host's form may leave it, counts as unset. */
function emptyAsUnset<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema);
}

/** A variable that may stay unset, an empty one included. */
function unsetWhenEmpty<Schema extends z.ZodType>(schema: Schema) {
  return emptyAsUnset(schema.optional());
}

/**
 * The ZeptoMail token and sender a production backend must be given: without
 * the token the emails go to Mailpit (`compose.yaml`), which a host lacks.
 */
const PRODUCTION_MAIL_VARIABLES = ['ZEPTOMAIL_TOKEN', 'MAIL_FROM'] as const;

/** Every variable the server reads at start. `.env.example` lists them. */
const ServerVariablesSchema = z.object({
  // `production` on a host: the server then refuses to send to Mailpit.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  // The sign-in emails go over ZeptoMail's HTTPS API (ADR 0115): its email
  // endpoint, https:// only, in the EU data centre by default, and the Send
  // Mail token of its Agent. No token sends them to Mailpit instead.
  ZEPTOMAIL_API_URL: unsetWhenEmpty(
    z.url({ protocol: /^https$/, error: 'must be an https:// URL' }),
  ),
  ZEPTOMAIL_TOKEN: unsetWhenEmpty(z.string().min(1)),
  // Mailpit's web address, whose send API takes the emails while
  // ZEPTOMAIL_TOKEN is unset; unset, http://localhost:8025.
  MAILPIT_URL: unsetWhenEmpty(z.url({ error: 'must be a URL' })),
  AUTH_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters')
    .refine(
      (secret) => secret !== EXAMPLE_AUTH_SECRET,
      'is the example value; make your own: openssl rand -base64 32',
    ),
  // The address the sign-in emails come from; the Edition names the sender.
  // Unset, no-reply@slovo.app.
  MAIL_FROM: unsetWhenEmpty(z.email({ error: 'must be an email address' })),
  // The OAuth client ids of SLOVO at Google, comma-separated: one per app
  // that signs in with Google (ADR 0047). A Google identity token must name
  // one as its audience. Empty, or unset, turns Google sign-in off.
  GOOGLE_CLIENT_IDS: z
    .string()
    .default('')
    .transform((ids) =>
      ids
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== ''),
    ),
  // Where the backend reports its unexpected failures (spec #603). Empty, or
  // unset, reports nothing; the repository holds no real DSN. Only https://,
  // so no report crosses the network in the clear.
  SENTRY_DSN: unsetWhenEmpty(
    z.url({ protocol: /^https$/, error: 'must be an https:// Sentry DSN' }),
  ),
  // PostHog's query API, for the admin's Аналітика (spec #1709): a personal
  // API key with the read-only `query` scope, the project's id and its host.
  // Unset, the Аналітика answers «PostHog недоступний»; the repository holds no key.
  POSTHOG_PERSONAL_API_KEY: unsetWhenEmpty(z.string()),
  POSTHOG_PROJECT_ID: unsetWhenEmpty(z.string().regex(/^\d+$/, 'must be a project number')),
  POSTHOG_HOST: unsetWhenEmpty(z.url({ protocol: /^https$/, error: 'must be an https:// URL' })),
  // Розробка's reads (spec #1709). A read-only fine-grained GitHub token and
  // an EAS read token; unset, that block of the admin answers unavailable.
  GITHUB_TOKEN: unsetWhenEmpty(z.string()),
  GITHUB_REPOSITORY: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, 'must be owner/name')
    .default('ToxaNn1/slovo'),
  EXPO_TOKEN: unsetWhenEmpty(z.string()),
  // The EAS project of the one app (apps/mobile/app.config.ts).
  EAS_PROJECT_ID: z.string().min(1).default('e2401ef2-2a47-407e-b0ff-03706421b71c'),
  // Якість reads Sentry's REST API with this token (scopes org:read,
  // project:read, event:read); unset, Якість shows Sentry unavailable.
  SENTRY_AUTH_TOKEN: unsetWhenEmpty(z.string().min(1)),
  // The Sentry organization's slug, and the numeric ids of the app's and the
  // backend's projects.
  SENTRY_ORG: unsetWhenEmpty(z.string().min(1)),
  SENTRY_APP_PROJECT: unsetWhenEmpty(z.string().regex(/^\d+$/, 'must be a numeric project id')),
  SENTRY_BACKEND_PROJECT: unsetWhenEmpty(z.string().regex(/^\d+$/, 'must be a numeric project id')),
  // The Bearer token CI pushes its history with (ADR 0096); unset, every push
  // is refused.
  CI_HISTORY_TOKEN: unsetWhenEmpty(z.string().min(32, 'must be at least 32 characters')),
  // The Telegram bot that tells the owner of alerts and the daily digest, and
  // the owner's chat id, the only chat it writes to; unset, alerts are kept
  // for Огляд and logged.
  TELEGRAM_BOT_TOKEN: unsetWhenEmpty(z.string().min(1)),
  TELEGRAM_CHAT_ID: unsetWhenEmpty(z.string().regex(/^-?\d+$/, 'must be a numeric chat id')),
  // The backend's health URL the Cron service checks; unset, it is not checked.
  BACKEND_HEALTH_URL: unsetWhenEmpty(z.url()),
  // How many proxies in front of the backend append to X-Forwarded-For, whose
  // addresses it trusts (ADR 0030): 0 when nothing is in front, as in local
  // Docker; 1 behind Railway's proxy.
  TRUSTED_PROXY_HOPS: z.coerce
    .number()
    .int('must be a whole number')
    .min(0, 'must be 0 or more')
    .default(0),
  // 0 takes any free port.
  PORT: z.coerce.number().int().min(0).max(65535).default(8787),
  // The folder that holds one folder per Edition (ADR 0035).
  EDITIONS_DIR: z.string().min(1).default(EDITIONS_DIR),
  // The URL root of the Media Store the snapshot and the Patch name (ADR
  // 0099), with no trailing slash: one setting moves it to media.<domain>.
  MEDIA_BASE: unsetWhenEmpty(
    z
      .url({ error: 'must be a URL' })
      .refine((url) => !url.endsWith('/'), 'must not end with a slash'),
  ),
  // The Cloudflare R2 bucket of the Media Store and an API token's S3 keys
  // with write access to it; all four or none, required in production. Unset,
  // the backend and the Recordings command keep their files in memory, which
  // suits development only.
  R2_ACCOUNT_ID: unsetWhenEmpty(z.string().min(1)),
  R2_BUCKET: unsetWhenEmpty(z.string().min(1)),
  R2_ACCESS_KEY_ID: unsetWhenEmpty(z.string().min(1)),
  R2_SECRET_ACCESS_KEY: unsetWhenEmpty(z.string().min(1)),
  // The Python and the model the Recording generator runs; the defaults are
  // where recordings.Dockerfile puts them.
  RECORDINGS_PYTHON: emptyAsUnset(z.string().min(1).default('/opt/recordings/venv/bin/python')),
  RECORDINGS_MODEL_DIR: emptyAsUnset(z.string().min(1).default('/opt/recordings/model')),
});

const R2_VARIABLES = [
  'R2_ACCOUNT_ID',
  'R2_BUCKET',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
] as const;

/** Where a development backend serves its Media Store from, MEDIA_BASE unset. */
const DEVELOPMENT_MEDIA_BASE = 'http://localhost:8787/media';

type R2Variables = Partial<Record<(typeof R2_VARIABLES)[number], string | undefined>>;

/** Names each R2 variable that is unset when production needs it, or when another one is set. */
function refineR2(variables: R2Variables & { NODE_ENV: string }, context: z.RefinementCtx): void {
  const unset = R2_VARIABLES.filter((name) => variables[name] === undefined);
  const production = variables.NODE_ENV === 'production';
  if (!production && unset.length === R2_VARIABLES.length) return;
  for (const name of unset) {
    context.addIssue({
      code: 'custom',
      path: [name],
      message: production ? 'is required in production' : 'is required with the other R2 variables',
    });
  }
}

/** The R2 bucket's options, or none while its variables are unset. */
function r2Of({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY }: R2Variables) {
  return R2_ACCOUNT_ID === undefined ||
    R2_BUCKET === undefined ||
    R2_ACCESS_KEY_ID === undefined ||
    R2_SECRET_ACCESS_KEY === undefined
    ? undefined
    : {
        accountId: R2_ACCOUNT_ID,
        bucket: R2_BUCKET,
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      };
}

/** The options of PostHog's query API, or none while its key or project is unset. */
function posthogOf({
  POSTHOG_PERSONAL_API_KEY,
  POSTHOG_PROJECT_ID,
  POSTHOG_HOST,
}: {
  POSTHOG_PERSONAL_API_KEY?: string | undefined;
  POSTHOG_PROJECT_ID?: string | undefined;
  POSTHOG_HOST?: string | undefined;
}) {
  return POSTHOG_PERSONAL_API_KEY === undefined || POSTHOG_PROJECT_ID === undefined
    ? undefined
    : {
        apiKey: POSTHOG_PERSONAL_API_KEY,
        projectId: POSTHOG_PROJECT_ID,
        host: POSTHOG_HOST ?? 'https://eu.posthog.com',
      };
}

/** Where the emails go: ZeptoMail with a token, otherwise Mailpit. */
function mailOf({
  ZEPTOMAIL_API_URL,
  ZEPTOMAIL_TOKEN,
  MAILPIT_URL,
  MAIL_FROM,
}: {
  ZEPTOMAIL_API_URL?: string | undefined;
  ZEPTOMAIL_TOKEN?: string | undefined;
  MAILPIT_URL?: string | undefined;
  MAIL_FROM?: string | undefined;
}): MailTransport {
  const from = MAIL_FROM ?? 'no-reply@slovo.app';
  return ZEPTOMAIL_TOKEN === undefined
    ? { kind: 'mailpit', url: MAILPIT_URL ?? 'http://localhost:8025', from }
    : {
        kind: 'zeptomail',
        apiUrl: ZEPTOMAIL_API_URL ?? 'https://api.zeptomail.eu/v1.1/email',
        token: ZEPTOMAIL_TOKEN,
        from,
      };
}

/**
 * The environment the server reads at start, with the mail settings gathered
 * into the transport of the mail client.
 */
export const ServerConfigSchema = ServerVariablesSchema.superRefine((variables, context) => {
  if (variables.NODE_ENV === 'production') {
    for (const name of [...PRODUCTION_MAIL_VARIABLES, 'MEDIA_BASE'] as const) {
      if (variables[name] === undefined) {
        context.addIssue({ code: 'custom', path: [name], message: 'must be set in production' });
      }
    }
  }
  refineR2(variables, context);
}).transform(
  ({
    NODE_ENV: _environment,
    ZEPTOMAIL_API_URL,
    ZEPTOMAIL_TOKEN,
    MAILPIT_URL,
    MAIL_FROM,
    POSTHOG_PERSONAL_API_KEY,
    POSTHOG_PROJECT_ID,
    POSTHOG_HOST,
    MEDIA_BASE,
    R2_ACCOUNT_ID,
    R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    ...rest
  }) => ({
    ...rest,
    posthog: posthogOf({ POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST }),
    mediaBase: MEDIA_BASE ?? DEVELOPMENT_MEDIA_BASE,
    r2: r2Of({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY }),
    mail: mailOf({ ZEPTOMAIL_API_URL, ZEPTOMAIL_TOKEN, MAILPIT_URL, MAIL_FROM }),
  }),
);

/** The environment the migrate and reports commands read. */
export const MigrateConfigSchema = ServerVariablesSchema.pick({ DATABASE_URL: true });

/** The Telegram bot of the owner's alerts, read by the server and every command that alerts. */
export const TelegramConfigSchema = ServerVariablesSchema.pick({
  TELEGRAM_BOT_TOKEN: true,
  TELEGRAM_CHAT_ID: true,
});

export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

/** The environment the Cron service's `pnpm cron` reads. */
export const CronConfigSchema = ServerVariablesSchema.pick({
  DATABASE_URL: true,
  EDITIONS_DIR: true,
  POSTHOG_PERSONAL_API_KEY: true,
  POSTHOG_PROJECT_ID: true,
  POSTHOG_HOST: true,
  SENTRY_AUTH_TOKEN: true,
  SENTRY_ORG: true,
  SENTRY_APP_PROJECT: true,
  SENTRY_BACKEND_PROJECT: true,
  TELEGRAM_BOT_TOKEN: true,
  TELEGRAM_CHAT_ID: true,
  BACKEND_HEALTH_URL: true,
}).transform(({ POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST, ...rest }) => ({
  ...rest,
  posthog: posthogOf({ POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, POSTHOG_HOST }),
}));

/** The environment the Recordings service's `pnpm recordings` reads. */
export const RecordingsConfigSchema = ServerVariablesSchema.pick({
  NODE_ENV: true,
  DATABASE_URL: true,
  EDITIONS_DIR: true,
  R2_ACCOUNT_ID: true,
  R2_BUCKET: true,
  R2_ACCESS_KEY_ID: true,
  R2_SECRET_ACCESS_KEY: true,
  RECORDINGS_PYTHON: true,
  RECORDINGS_MODEL_DIR: true,
})
  .superRefine(refineR2)
  .transform(({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ...rest }) => ({
    ...rest,
    r2: r2Of({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY }),
  }));

/** An R2 variable the media import can't run without. */
const requiredR2 = emptyAsUnset(
  z.string({ error: 'is required: the media import puts the files in R2' }).min(1),
);

/**
 * The environment `pnpm import-media` reads: the database and the R2 bucket,
 * every R2 variable required, so the files never land in a memory store.
 */
export const MediaImportConfigSchema = ServerVariablesSchema.pick({
  DATABASE_URL: true,
  EDITIONS_DIR: true,
})
  .extend({
    R2_ACCOUNT_ID: requiredR2,
    R2_BUCKET: requiredR2,
    R2_ACCESS_KEY_ID: requiredR2,
    R2_SECRET_ACCESS_KEY: requiredR2,
  })
  .transform(({ R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ...rest }) => ({
    ...rest,
    r2: {
      accountId: R2_ACCOUNT_ID,
      bucket: R2_BUCKET,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  }));

/** The environment the publish command reads. */
export const PublishConfigSchema = ServerVariablesSchema.pick({
  DATABASE_URL: true,
  EDITIONS_DIR: true,
  TELEGRAM_BOT_TOKEN: true,
  TELEGRAM_CHAT_ID: true,
});

/**
 * Reads a configuration from the environment, or stops the process with a
 * message that names every missing or wrong variable.
 */
export function readConfig<Schema extends z.ZodType>(
  schema: Schema,
  env: NodeJS.ProcessEnv,
): z.output<Schema> {
  const result = schema.safeParse(env);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.');
    return `  ${name}: ${env[name] === undefined ? 'is not set' : issue.message}`;
  });
  process.stderr.write(
    `The backend's environment is missing or wrong:\n${problems.join('\n')}\n` +
      'See apps/backend/.env.example.\n',
  );
  process.exit(1);
}
