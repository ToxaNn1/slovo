import { setupServer } from 'msw/node';

import { mockHandlers } from './handlers';

/** The screen tests' MSW server: the same handlers as `pnpm dev:admin --mock`. */
export const server = setupServer(...mockHandlers());
