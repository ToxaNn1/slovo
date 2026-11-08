import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { mockHandlers } from './mock/handlers';

// The screens talk to the same handlers as `pnpm dev:admin --mock`.
const server = setupServer(...mockHandlers());

// jsdom has no scrolling; the router scrolls to the top on every navigation.
window.scrollTo = () => undefined;

beforeAll(() => {
  server.listen();
});
beforeEach(() => {
  window.history.replaceState(null, '', '/admin/');
  window.localStorage.clear();
  delete document.documentElement.dataset['theme'];
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
