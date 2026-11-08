import { adminApiContract, type AdminApiOutputs } from '@slovo/contracts/admin-api';
import { HttpHandler, HttpResponse, type JsonBodyType } from 'msw';

import { FIXTURES } from './fixtures';

type Name = Exclude<keyof typeof adminApiContract, 'content'>;
type ContentName = keyof typeof adminApiContract.content;

/** A handler at a contract route, answering the fixture. */
function routeHandler(
  route: { method?: string; path?: string },
  name: string,
  fixture: JsonBodyType,
): HttpHandler {
  // `{param}` in the contract is `:param` in MSW; any origin, for the Vite middleware too.
  const path = `*${(route.path ?? `/${name}`).replace(/\{(\w+)\}/g, ':$1')}`;
  return new HttpHandler(route.method ?? 'POST', path, () => HttpResponse.json(fixture));
}

/**
 * The handler of one procedure, made from the contract: its method and path,
 * answering the fixture, which the contract's output type checks.
 */
function handlerOf<N extends Name>(name: N, fixture: AdminApiOutputs[N]): HttpHandler {
  return routeHandler(adminApiContract[name]['~orpc'].route, name, fixture);
}

/** The handler of one content write procedure, as `handlerOf`. */
function contentHandlerOf<N extends ContentName>(
  name: N,
  fixture: AdminApiOutputs['content'][N],
): HttpHandler {
  return routeHandler(adminApiContract.content[name]['~orpc'].route, name, fixture);
}

/** The MSW handlers of every admin API procedure; a new procedure needs a fixture to compile. */
export function mockHandlers(fixtures: AdminApiOutputs = FIXTURES): HttpHandler[] {
  const handlers: Record<Name, HttpHandler> = {
    requestCode: handlerOf('requestCode', fixtures.requestCode),
    verifyCode: handlerOf('verifyCode', fixtures.verifyCode),
    signIn: handlerOf('signIn', fixtures.signIn),
    me: handlerOf('me', fixtures.me),
    sessions: handlerOf('sessions', fixtures.sessions),
    signOut: handlerOf('signOut', fixtures.signOut),
    signOutEverywhere: handlerOf('signOutEverywhere', fixtures.signOutEverywhere),
    actions: handlerOf('actions', fixtures.actions),
    people: handlerOf('people', fixtures.people),
    invite: handlerOf('invite', fixtures.invite),
    setRole: handlerOf('setRole', fixtures.setRole),
    removePerson: handlerOf('removePerson', fixtures.removePerson),
    agentTokens: handlerOf('agentTokens', fixtures.agentTokens),
    issueAgentToken: handlerOf('issueAgentToken', fixtures.issueAgentToken),
    revokeAgentToken: handlerOf('revokeAgentToken', fixtures.revokeAgentToken),
    status: handlerOf('status', fixtures.status),
    switches: handlerOf('switches', fixtures.switches),
    setRules: handlerOf('setRules', fixtures.setRules),
    setMinimum: handlerOf('setMinimum', fixtures.setMinimum),
    kill: handlerOf('kill', fixtures.kill),
    editions: handlerOf('editions', fixtures.editions),
    editionCard: handlerOf('editionCard', fixtures.editionCard),
    development: handlerOf('development', fixtures.development),
    ownerChecks: handlerOf('ownerChecks', fixtures.ownerChecks),
    tickOwnerCheck: handlerOf('tickOwnerCheck', fixtures.tickOwnerCheck),
    addOwnerCheck: handlerOf('addOwnerCheck', fixtures.addOwnerCheck),
  };
  const content = fixtures.content;
  const contentHandlers: Record<ContentName, HttpHandler> = {
    openBatch: contentHandlerOf('openBatch', content.openBatch),
    create: contentHandlerOf('create', content.create),
    edit: contentHandlerOf('edit', content.edit),
    retire: contentHandlerOf('retire', content.retire),
    flag: contentHandlerOf('flag', content.flag),
    record: contentHandlerOf('record', content.record),
    report: contentHandlerOf('report', content.report),
    records: contentHandlerOf('records', content.records),
  };
  return [...Object.values(handlers), ...Object.values(contentHandlers)];
}
