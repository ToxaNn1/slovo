import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` writes a migration from the schema into `migrations/`.
// The migrations run by `pnpm db:migrate`, never at server start.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema.ts',
  out: './migrations',
});
