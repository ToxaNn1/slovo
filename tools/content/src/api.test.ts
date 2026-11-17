import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFromEnv, recordKind } from './api';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('recordKind', () => {
  it('names a kind the write API writes, and nothing else', () => {
    expect(recordKind('synonymRow')).toBe('synonymRow');
    expect(recordKind('crosswordDay')).toBeUndefined();
    expect(recordKind(undefined)).toBeUndefined();
  });
});

describe('apiFromEnv', () => {
  it('says which variable is missing when no API is named', () => {
    vi.stubEnv('SLOVO_API_URL', '');
    const problems: string[] = [];

    expect(apiFromEnv((line) => problems.push(line))).toBeUndefined();
    expect(problems).toEqual([expect.stringContaining('SLOVO_API_URL is not set')]);
  });

  /** The requests a client of the environment sends, answered with an empty batch. */
  async function sent(token: string | undefined): Promise<Request[]> {
    vi.stubEnv('SLOVO_API_URL', 'https://api.example.test/v1/');
    vi.stubEnv('SLOVO_AGENT_TOKEN', token);
    const requests: Request[] = [];
    vi.stubGlobal('fetch', (request: Request) => {
      requests.push(request);
      return Promise.resolve(Response.json({ batchId: '0b0a7c1e-1a2b-4c3d-8e4f-5a6b7c8d9e0f' }));
    });
    const api = apiFromEnv(() => {
      throw new Error('No problem expected');
    });
    await api?.admin.content.openBatch({ editionId: 'uk' });
    return requests;
  }

  it('calls the named backend once, with the Агент token as its bearer', async () => {
    const [request, ...more] = await sent('agent-token');

    expect(more).toEqual([]);
    expect(request?.url).toBe('https://api.example.test/v1/admin/content/uk/batches');
    expect(request?.headers.get('authorization')).toBe('Bearer agent-token');
  });

  it('calls without a token when none is set, so the API answers for itself', async () => {
    const [request] = await sent(undefined);

    expect(request?.headers.get('authorization')).toBeNull();
  });
});
