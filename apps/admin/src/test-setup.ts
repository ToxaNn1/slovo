import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';

import { server } from './mock/server';

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

// jsdom has no modal dialogs (jsdom 26): open and close only toggle `open`.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
};
