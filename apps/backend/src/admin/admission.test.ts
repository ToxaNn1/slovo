import { randomUUID } from 'node:crypto';

import { apiContract } from '@slovo/contracts/api';
import { describe, expect, it } from 'vitest';

import { adminHeaders, newIp, signedInAdmin, testApp } from '../test-support';
import { type Admission, admissionAt } from './admission';

interface Walked {
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly admission: Admission;
}

/** The route of a contract procedure; undefined for a router. */
function routeOf(value: object): { method: string; path: string } | undefined {
  if (!('~orpc' in value)) return undefined;
  const orpc: unknown = value['~orpc'];
  if (typeof orpc !== 'object' || orpc === null || !('route' in orpc)) return undefined;
  const { route } = orpc;
  if (typeof route !== 'object' || route === null || !('path' in route)) return undefined;
  const method = 'method' in route && typeof route.method === 'string' ? route.method : 'POST';
  return typeof route.path === 'string' ? { method, path: route.path } : undefined;
}

/** Every procedure of the admin contract: its name, its route, and its declared admission. */
function walk(router: object, keys: readonly string[] = []): Walked[] {
  return Object.entries(router).flatMap(([key, value]: [string, unknown]): Walked[] => {
    if (typeof value !== 'object' || value === null) return [];
    const path = [...keys, key];
    const route = routeOf(value);
    if (route === undefined) return walk(value, path);
    return [
      {
        name: path.join('.'),
        method: route.method,
        path: route.path.replace(/\{(\w+)\}/g, '$1'),
        admission: admissionAt(['admin', ...path]),
      },
    ];
  });
}

const procedures = walk(apiContract.admin);

/** A backend with a signed-in Власник and Адмін, and an Агент token. */
async function backendWithCallers() {
  const backend = testApp();
  const owner = await signedInAdmin(backend, 'owner');
  const admin = await signedInAdmin(backend, 'admin');
  const { token } = await owner.client.admin.issueAgentToken({
    name: `agent-${randomUUID().slice(0, 8)}`,
    reason: 'the admission walk',
  });
  const bearer = (value: string) => ({ ...adminHeaders(), authorization: `Bearer ${value}` });
  return {
    owner: adminHeaders(owner.cookie),
    ownerNoHeader: { cookie: owner.cookie },
    admin: adminHeaders(admin.cookie),
    adminNoHeader: { cookie: admin.cookie },
    agent: bearer(token),
    unknownBearer: bearer('not-a-known-token'),
    /** What the procedure answers the headers with, as `name as caller: status`. */
    answer: async (
      { name, method, path }: Walked,
      caller: string,
      headers: Record<string, string>,
    ) =>
      `${name} as ${caller}: ${String((await backend.request(path, { method, headers }, newIp())).status)}`,
  };
}

/** A caller as the walk names it, and the status a procedure must refuse it with. */
type Refusal = readonly [caller: string, status: number];

/** How a procedure must refuse, by its declaration alone. */
function refusalsOf({ admission: { callers, access } }: Walked): Refusal[] {
  const kinds: readonly string[] = callers;
  if (kinds.includes('sign-in')) return [['without the header', 403]];
  if (kinds.includes('ci')) {
    return [
      ['without a session', 401],
      ['unknown bearer', 401],
      ['owner', 401],
      ['agent', 401],
    ];
  }
  const refusals: Refusal[] = [
    ['without a session', 401],
    ['unknown bearer', 401],
  ];
  if (access === 'write') refusals.push(['owner without the header', 403]);
  if (access === 'write' && kinds.includes('admin')) {
    refusals.push(['admin without the header', 403]);
  }
  if (!kinds.includes('admin')) refusals.push(['admin', 403]);
  if (!kinds.includes('agent')) refusals.push(['agent', 403]);
  return refusals;
}

describe('the admission of every admin procedure (ADR 0198)', () => {
  it('walks the whole admin contract', () => {
    expect(procedures.length).toBeGreaterThan(60);
    expect(procedures.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['requestCode', 'pushCiRun', 'services.revealEntry', 'content.check']),
    );
  });

  it('refuses without a session, a write without the header, and a caller left out', async () => {
    const callers = await backendWithCallers();
    const headersOf: Record<string, Record<string, string>> = {
      'without the header': {},
      'without a session': adminHeaders(),
      'unknown bearer': callers.unknownBearer,
      owner: callers.owner,
      'owner without the header': callers.ownerNoHeader,
      admin: callers.admin,
      'admin without the header': callers.adminNoHeader,
      agent: callers.agent,
    };
    const expected: string[] = [];
    const answered: string[] = [];
    for (const procedure of procedures) {
      for (const [caller, status] of refusalsOf(procedure)) {
        expected.push(`${procedure.name} as ${caller}: ${String(status)}`);
        answered.push(await callers.answer(procedure, caller, headersOf[caller] ?? {}));
      }
    }
    expect(answered).toEqual(expected);
  });

  it('lets every declared caller of a read in', async () => {
    const callers = await backendWithCallers();
    const refused: string[] = [];
    for (const procedure of procedures.filter(({ admission }) => admission.access === 'read')) {
      const kinds: readonly string[] = procedure.admission.callers;
      const admitted = Object.entries({
        owner: callers.owner,
        ...(kinds.includes('admin') ? { admin: callers.admin } : {}),
        ...(kinds.includes('agent') ? { agent: callers.agent } : {}),
      });
      for (const [caller, headers] of admitted) {
        const answer = await callers.answer(procedure, caller, headers);
        if (/: 40[13]$/.test(answer)) refused.push(answer);
      }
    }
    expect(refused).toEqual([]);
  });
});
