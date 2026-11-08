import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

const SWITCHES = { rules: [], minimums: {} } satisfies AdminApiOutputs['switches'];

/** What `pnpm dev:admin --mock` and the screen tests answer, one per procedure. */
export const FIXTURES: AdminApiOutputs = {
  status: { on: true },
  switches: SWITCHES,
  setRules: SWITCHES,
  setMinimum: SWITCHES,
  kill: { editionIds: ['uk'] },
  editions: { editions: [{ id: 'uk', displayName: 'Рідкісні слова' }] },
};
