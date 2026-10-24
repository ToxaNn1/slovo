import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { z } from 'zod';

/**
 * The `AUTH_SECRET` of `.env.example`, which anyone can read: a backend that
 * signed its Sessions with it would sign them with no secret (ADR 0030).
 */
const EXAMPLE_AUTH_SECRET = 'replace-with-at-least-32-random-characters';

/** The environment the server reads at start. `.env.example` lists every variable. */
export const ServerConfigSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  SMTP_URL: z.url({ protocol: /^smtps?$/, error: 'must be an smtp:// or smtps:// URL' }),
  AUTH_SECRET: z
    .string()
    .min(32, 'must be at least 32 characters')
    .refine(
      (secret) => secret !== EXAMPLE_AUTH_SECRET,
      'is the example value; make your own: openssl rand -base64 32',
    ),
  // The address the sign-in emails come from; the Edition names the sender.
  MAIL_FROM: z.email({ error: 'must be an email address' }).default('no-reply@slovo.app'),
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
  // unset, reports nothing; the repository holds no real DSN.
  SENTRY_DSN: z.preprocess(
    (dsn) => (dsn === '' ? undefined : dsn),
    z.url({ protocol: /^https?$/, error: 'must be an https:// Sentry DSN' }).optional(),
  ),
  // 0 takes any free port.
  PORT: z.coerce.number().int().min(0).max(65535).default(8787),
  // The folder that holds one folder per Edition (ADR 0035).
  EDITIONS_DIR: z.string().min(1).default(EDITIONS_DIR),
});

/** The environment the migrate command reads. */
export const MigrateConfigSchema = ServerConfigSchema.pick({ DATABASE_URL: true });

/** The environment the publish command reads. */
export const PublishConfigSchema = ServerConfigSchema.pick({
  DATABASE_URL: true,
  EDITIONS_DIR: true,
});

/**
 * Reads a configuration from the environment, or stops the process with a
 * message that names every missing or wrong variable.
 */
export function readConfig<Schema extends z.ZodObject>(
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
