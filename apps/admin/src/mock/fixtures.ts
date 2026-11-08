import type { AdminApiOutputs } from '@slovo/contracts/admin-api';

/** What `pnpm dev:admin --mock` and the screen tests answer, one per procedure. */
export const FIXTURES: AdminApiOutputs = {
  editions: { editions: [{ id: 'uk', displayName: 'Рідкісні слова' }] },
};
