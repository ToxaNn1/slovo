import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { z } from 'zod';

/**
 * The `AUTH_SECRET` of `.env.example`, which anyone can read: a backend that
 * signed its Sessions with it would sign them with no secret (ADR 0030).
 */
const EXAMPLE_AUTH_SECRET = 'replace-with-at-least-32-random-characters';

/** An empty variable, as a host's form may leave it, counts as unset. */
function unsetWhenEmpty<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

/**
 * The SMTP settings and sender a production backend must be given: their
 * development defaults are Mailpit's (`compose.yaml`), which a host lacks.
 */
const PRODUCTION_MAIL_VARIABLES = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
] as const;

/** Every variable the server reads at start. `.env.example` lists them. */
const ServerVariablesSchema = z.object({
  // `production` on a host: the server then refuses Mailpit's defaults.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  // Where the sign-in emails go; unset, Mailpit's localhost:1025.
  SMTP_HOST: unsetWhenEmpty(z.string()),
  SMTP_PORT: unsetWhenEmpty(z.coerce.number().int().min(1).max(65535)),
  // The login at the SMTP server, both or neither; unset, none (Mailpit).
  SMTP_USER: unsetWhenEmpty(z.string()),
  SMTP_PASSWORD: unsetWhenEmpty(z.string()),
  // `true` speaks TLS from the first byte (port 465, usually); otherwise the
  // client upgrades with STARTTLS when the server offers it.
  SMTP_TLS: z.stringbool({ error: 'must be true or false' }).default(false),
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
  SENTRY_DSN: z.preprocess(
    (dsn) => (dsn === '' ? undefined : dsn),
    z.url({ protocol: /^https$/, error: 'must be an https:// Sentry DSN' }).optional(),
  ),
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
});

/**
 * The environment the server reads at start, with the SMTP settings gathered
 * into the options of the SMTP client.
 */
export const ServerConfigSchema = ServerVariablesSchema.superRefine((variables, context) => {
  const login = variables.SMTP_USER !== undefined || variables.SMTP_PASSWORD !== undefined;
  const [required, message] =
    variables.NODE_ENV === 'production'
      ? [PRODUCTION_MAIL_VARIABLES, 'must be set in production']
      : login
        ? [
            ['SMTP_USER', 'SMTP_PASSWORD'] as const,
            'must be set with the other of SMTP_USER and SMTP_PASSWORD',
          ]
        : [[], ''];
  for (const name of required) {
    if (variables[name] === undefined) context.addIssue({ code: 'custom', path: [name], message });
  }
}).transform(
  ({
    NODE_ENV: _environment,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_TLS,
    MAIL_FROM,
    ...rest
  }) => ({
    ...rest,
    smtp: {
      host: SMTP_HOST ?? 'localhost',
      port: SMTP_PORT ?? 1025,
      tls: SMTP_TLS,
      credentials:
        SMTP_USER === undefined || SMTP_PASSWORD === undefined
          ? undefined
          : { user: SMTP_USER, password: SMTP_PASSWORD },
      from: MAIL_FROM ?? 'no-reply@slovo.app',
    },
  }),
);

/** The environment the migrate and reports commands read. */
export const MigrateConfigSchema = ServerVariablesSchema.pick({ DATABASE_URL: true });

/** The environment the publish command reads. */
export const PublishConfigSchema = ServerVariablesSchema.pick({
  DATABASE_URL: true,
  EDITIONS_DIR: true,
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
