import type { TestProject } from 'vitest/node';

import { createTestDatabase, testDatabaseServer } from './test-support';

declare module 'vitest' {
  export interface ProvidedContext {
    /** The fresh database of this test run, migrated. */
    databaseUrl: string;
  }
}

/** Gives the whole run one fresh database and drops it when the run ends. */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = await createTestDatabase(testDatabaseServer());
  project.provide('databaseUrl', database.url);
  return () => database.drop();
}
