import { EAS_TTL_MS, GITHUB_TTL_MS } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import {
  createFakeEas,
  createFakeGitHub,
  EAS_FIXTURE,
  GITHUB_FIXTURE,
  passTime,
  signedInAdmin,
  testApp,
} from '../test-support';

/** A backend with a Власник, so the admin API is on, and fakes of GitHub and EAS. */
async function backendWithFakes() {
  const github = createFakeGitHub();
  const eas = createFakeEas();
  const backend = testApp({ github, eas });
  await signedInAdmin(backend, 'owner');
  return { backend, github, eas };
}

const versions = GITHUB_FIXTURE.milestones.filter(({ title }) => title !== 'Backlog').reverse();

describe('Розробка at /v1/admin/development', () => {
  it('answers what GitHub and EAS hold, read once within the ttl', async () => {
    const { backend, github, eas } = await backendWithFakes();
    const { client } = await signedInAdmin(backend, 'admin');
    const readAt = new Date().toISOString();

    const first = await client.admin.development();

    expect(first).toEqual({
      github: {
        state: 'ok',
        fetchedAt: readAt,
        pullRequests: GITHUB_FIXTURE.pullRequests,
        mainCi: GITHUB_FIXTURE.mainCi,
        milestones: versions,
        releases: GITHUB_FIXTURE.releases,
      },
      eas: { state: 'ok', fetchedAt: readAt, builds: EAS_FIXTURE },
    });
    const [githubCalls, easCalls] = [github.calls, eas.calls];
    expect([githubCalls, easCalls]).toEqual([4, 1]);

    passTime(GITHUB_TTL_MS - 1);
    expect(await client.admin.development()).toEqual(first);
    expect([github.calls, eas.calls]).toEqual([githubCalls, easCalls]);

    passTime(1);
    const later = await client.admin.development();
    expect(later.github).toMatchObject({ state: 'ok', fetchedAt: new Date().toISOString() });
    expect(later.eas).toEqual(first.eas);
    expect([github.calls, eas.calls]).toEqual([8, 1]);

    passTime(EAS_TTL_MS - GITHUB_TTL_MS);
    expect((await client.admin.development()).eas).toMatchObject({
      fetchedAt: new Date().toISOString(),
    });
    expect(eas.calls).toBe(2);
  });

  it('answers a failing GitHub or EAS as unavailable, not as an error', async () => {
    const { backend, github } = await backendWithFakes();
    const { client } = await signedInAdmin(backend, 'admin');
    github.fail();

    const answer = await client.admin.development();

    expect(answer.github).toEqual({ state: 'unavailable' });
    expect(answer.eas).toMatchObject({ state: 'ok', builds: EAS_FIXTURE });
    expect(backend.reports).toEqual([]);

    const failingEas = createFakeEas();
    failingEas.fail();
    const other = testApp({ eas: failingEas });
    const owner = await signedInAdmin(other, 'owner');
    const fromOther = await owner.client.admin.development();
    expect(fromOther.eas).toEqual({ state: 'unavailable' });
    expect(fromOther.github).toMatchObject({ state: 'ok' });
  });

  it('keeps the last good read, with its time, when a later read fails', async () => {
    const { backend, github } = await backendWithFakes();
    const { client } = await signedInAdmin(backend, 'admin');
    const first = await client.admin.development();
    github.fail();
    passTime(GITHUB_TTL_MS);

    expect((await client.admin.development()).github).toEqual(first.github);
  });

  it('refuses a caller with no session', async () => {
    const { backend } = await backendWithFakes();

    expect((await backend.request('/v1/admin/development')).status).toBe(401);
  });
});
