import { EDITIONS_DIR } from '@slovo/language-pack/edition';
import { z } from 'zod';

/** The environment the server reads at start. `.env.example` lists every variable. */
export const ServerConfigSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
  SMTP_URL: z.url({ protocol: /^smtps?$/, error: 'must be an smtp:// or smtps:// URL' }),
  AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  // 0 takes any free port.
  PORT: z.coerce.number().int().min(0).max(65535).default(8787),
  // The folder that holds one folder per Edition (ADR 0035).
  EDITIONS_DIR: z.string().min(1).default(EDITIONS_DIR),
});

/** The environment the migrate command reads. */
export const MigrateConfigSchema = ServerConfigSchema.pick({ DATABASE_URL: true });

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
