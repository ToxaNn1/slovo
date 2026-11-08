import { adminApiContract, type AdminApiOutputs } from '@slovo/contracts/admin-api';
import { HttpHandler, HttpResponse } from 'msw';

import { FIXTURES } from './fixtures';

type Name = keyof typeof adminApiContract;

/**
 * The handler of one procedure, made from the contract: its method and path,
 * answering the fixture, which the contract's output type checks.
 */
function handlerOf<N extends Name>(name: N, fixture: AdminApiOutputs[N]): HttpHandler {
  const { route } = adminApiContract[name]['~orpc'];
  // `{param}` in the contract is `:param` in MSW; any origin, for the Vite middleware too.
  const path = `*${(route.path ?? `/${name}`).replace(/\{(\w+)\}/g, ':$1')}`;
  return new HttpHandler(route.method ?? 'POST', path, () => HttpResponse.json(fixture));
}

/** The MSW handlers of every admin API procedure; a new procedure needs a fixture to compile. */
export function mockHandlers(fixtures: AdminApiOutputs = FIXTURES): HttpHandler[] {
  const handlers: Record<Name, HttpHandler> = {
    status: handlerOf('status', fixtures.status),
    editions: handlerOf('editions', fixtures.editions),
  };
  return Object.values(handlers);
}
