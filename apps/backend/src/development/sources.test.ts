import { describe, expect, it } from 'vitest';

import { silentLogger } from '../test-support';
import { createEasSource } from './eas-source';
import { createGitHubSource } from './github-source';

/** A fetch that answers each URL path with its JSON, and 404 for any other; it keeps the requests. */
function fakeFetch(answers: Record<string, unknown>) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    requests.push({ url, init });
    const path = new URL(url).pathname;
    return Promise.resolve(
      path in answers ? Response.json(answers[path]) : new Response('no', { status: 404 }),
    );
  };
  return { fetch, requests };
}

const github = (fetch: typeof globalThis.fetch) =>
  createGitHubSource({ token: 'gh-token', repository: 'owner/repo', logger: silentLogger, fetch });

describe('the GitHub source', () => {
  it('reads the repository with the token, and maps its answers', async () => {
    const { fetch, requests } = fakeFetch({
      '/repos/owner/repo/pulls': [
        {
          number: 7,
          title: 'A change',
          user: { login: 'anton' },
          html_url: 'https://github.com/owner/repo/pull/7',
          draft: true,
          updated_at: '2026-11-08T09:00:00Z',
        },
      ],
      '/repos/owner/repo/actions/workflows/ci.yml/runs': {
        workflow_runs: [
          {
            status: 'in_progress',
            conclusion: null,
            html_url: 'run',
            updated_at: '2026-11-08T09:00:00Z',
          },
        ],
      },
      '/repos/owner/repo/releases': [
        {
          tag_name: 'v1',
          name: null,
          draft: false,
          published_at: '2026-11-01T00:00:00Z',
          html_url: 'r1',
        },
        { tag_name: 'v2', name: 'Draft', draft: true, published_at: null, html_url: 'r2' },
      ],
    });
    const source = github(fetch);

    expect(await source.pullRequests()).toEqual({
      ok: true,
      value: [
        {
          number: 7,
          title: 'A change',
          author: 'anton',
          url: 'https://github.com/owner/repo/pull/7',
          draft: true,
          updatedAt: '2026-11-08T09:00:00Z',
        },
      ],
    });
    expect(await source.mainCi()).toEqual({ ok: true, value: { state: 'pending', url: 'run' } });
    expect(await source.releases()).toEqual({
      ok: true,
      value: [{ tag: 'v1', name: 'v1', publishedAt: '2026-11-01T00:00:00Z', url: 'r1' }],
    });
    expect(new Headers(requests[0]?.init?.headers).get('authorization')).toBe('Bearer gh-token');
  });

  it('answers unavailable for a refusal, an unknown shape, a network failure or no token', async () => {
    const refusing = github(fakeFetch({}).fetch);
    const odd = github(fakeFetch({ '/repos/owner/repo/milestones': { message: 'odd' } }).fetch);
    const broken = github(() => Promise.reject(new TypeError('fetch failed')));
    const noToken = createGitHubSource({
      token: undefined,
      repository: 'o/r',
      logger: silentLogger,
    });
    const unavailable = { ok: false, reason: 'unavailable' };

    expect(await refusing.pullRequests()).toEqual(unavailable);
    expect(await odd.milestones()).toEqual(unavailable);
    expect(await broken.releases()).toEqual(unavailable);
    expect(await noToken.mainCi()).toEqual(unavailable);
  });
});

describe('the EAS source', () => {
  it('reads the newest builds of the project with the token, and maps them', async () => {
    const { fetch, requests } = fakeFetch({
      '/graphql': {
        data: {
          app: {
            byId: {
              slug: 'slovo',
              ownerAccount: { name: 'anton_de' },
              builds: [
                {
                  id: 'b1',
                  platform: 'ANDROID',
                  status: 'IN_QUEUE',
                  buildProfile: 'preview',
                  appVersion: '0.8.0',
                  appBuildVersion: null,
                  createdAt: '2026-11-07T18:00:00.000Z',
                },
              ],
            },
          },
        },
      },
    });
    const source = createEasSource({ token: 'eas', projectId: 'p1', logger: silentLogger, fetch });

    expect(await source.latestBuilds(5)).toEqual({
      ok: true,
      value: [
        {
          id: 'b1',
          platform: 'android',
          profile: 'preview',
          status: 'in-progress',
          appVersion: '0.8.0',
          buildNumber: null,
          createdAt: '2026-11-07T18:00:00.000Z',
          url: 'https://expo.dev/accounts/anton_de/projects/slovo/builds/b1',
        },
      ],
    });
    const sent = requests[0]?.init?.body;
    const body: unknown = JSON.parse(typeof sent === 'string' ? sent : '');
    expect(body).toMatchObject({ variables: { appId: 'p1', limit: 5 } });
  });

  it('answers unavailable for an error answer or no token', async () => {
    const errors = fakeFetch({ '/graphql': { errors: [{ message: 'no access' }] } }).fetch;
    const unavailable = { ok: false, reason: 'unavailable' };

    expect(
      await createEasSource({
        token: 'eas',
        projectId: 'p',
        logger: silentLogger,
        fetch: errors,
      }).latestBuilds(5),
    ).toEqual(unavailable);
    expect(
      await createEasSource({
        token: undefined,
        projectId: 'p',
        logger: silentLogger,
      }).latestBuilds(5),
    ).toEqual(unavailable);
  });
});
