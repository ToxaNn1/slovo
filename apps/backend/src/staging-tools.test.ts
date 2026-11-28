import { describe, expect, it } from 'vitest';

import railway from '../../../.railway/railway';
import {
  checkRef,
  checkStagingDefinition,
  resetStagingBranch,
  runWizard,
  type ResetInputs,
} from '../../../scripts/staging';

/** The project `.railway/railway.ts` declares for an environment, as Railway is given it. */
async function projectIn(environment: string): Promise<unknown> {
  const definition = await railway(
    {
      environment,
      environmentName: environment,
      isEnvironment: (name) => name === environment,
      randomString: () => 'random',
      shared: {},
    },
    (name, definition) => ({ name, ...definition }),
  );
  return JSON.parse(JSON.stringify(definition));
}

describe('the staging deploy inputs', () => {
  it('takes a branch, a tag or a commit', () => {
    for (const ref of ['main', 'feat/1961-release-channels', 'v1.2.0', '6e46c5dd']) {
      expect(checkRef(ref)).toEqual({ ok: true, value: ref });
    }
  });

  it('refuses a ref a command could read as an option or a shell could run', () => {
    for (const ref of [
      '',
      '--upload-pack=x',
      'main;rm -rf /',
      'a b',
      'main..dev',
      'feat/',
      'x.lock',
      '$(id)',
    ]) {
      expect(checkRef(ref).ok, ref).toBe(false);
    }
  });

  it("refuses a pull request's ref, whose code is anyone's, not the repository's", () => {
    for (const ref of ['refs/pull/12/head', 'refs/pull/12/merge', 'pull/12/head']) {
      expect(checkRef(ref).ok, ref).toBe(false);
    }
    expect(checkRef('feat/pull/12').ok).toBe(true);
  });

  it("takes the Railway file's staging environment: the backend alone, asleep, its variables kept", async () => {
    const checked = checkStagingDefinition(await projectIn('staging'));
    if (!checked.ok) throw new Error(checked.reason);
    expect(checked.value.preserved).toEqual(
      expect.arrayContaining(['DATABASE_URL', 'AUTH_SECRET', 'MEDIA_BASE']),
    );
    // Set by the file itself, so the owner never sets them.
    expect(checked.value.preserved).not.toContain('DEPLOYMENT');
  });

  it('refuses a ref whose Railway file would bring the Cron services to staging', async () => {
    // A ref from before the Staging Deployment existed declares production's
    // project for every environment.
    const checked = checkStagingDefinition(await projectIn('production'));
    expect(checked.ok).toBe(false);
  });
});

/** A fake Neon that answers the branch it is given and records every request. */
function fakeNeon(branch: object) {
  const requests: { url: string; method: string; body: unknown }[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    requests.push({ url, method, body });
    return Promise.resolve(
      Response.json(method === 'GET' ? { branch } : { branch, operations: [] }),
    );
  };
  return { fetch, requests };
}

const inputs: ResetInputs = {
  confirmation: 'staging',
  apiKey: 'neon-key',
  projectId: 'young-forest-12345678',
  branchId: 'br-staging-1',
};

describe('the staging reset', () => {
  it('restores the staging branch from its parent inside Neon, in two requests', async () => {
    const neon = fakeNeon({ id: 'br-staging-1', parent_id: 'br-main-0', default: false });

    const reset = await resetStagingBranch(inputs, neon.fetch);

    expect(reset).toEqual({ ok: true, value: { parentId: 'br-main-0' } });
    const branch =
      'https://console.neon.tech/api/v2/projects/young-forest-12345678/branches/br-staging-1';
    expect(neon.requests).toEqual([
      { url: branch, method: 'GET', body: undefined },
      { url: `${branch}/restore`, method: 'POST', body: { source_branch_id: 'br-main-0' } },
    ]);
  });

  it('asks Neon nothing without the confirmation or a well-formed id', async () => {
    const neon = fakeNeon({ id: 'br-staging-1', parent_id: 'br-main-0' });
    for (const wrong of [
      { ...inputs, confirmation: 'yes' },
      { ...inputs, apiKey: undefined },
      { ...inputs, projectId: 'x/../y' },
      { ...inputs, branchId: 'main' },
    ]) {
      expect((await resetStagingBranch(wrong, neon.fetch)).ok).toBe(false);
    }
    expect(neon.requests).toEqual([]);
  });

  it("never restores production's branch, whose id was given by mistake", async () => {
    for (const production of [
      { id: 'br-staging-1', default: true },
      { id: 'br-staging-1', parent_id: 'br-x', protected: true },
      { id: 'br-staging-1' },
    ]) {
      const neon = fakeNeon(production);
      expect((await resetStagingBranch(inputs, neon.fetch)).ok).toBe(false);
      expect(neon.requests.map((request) => request.method)).toEqual(['GET']);
    }
  });
});

describe("the owner's staging wizard", () => {
  it('runs end to end in dry mode, waiting for no one and printing no secret', async () => {
    const lines: string[] = [];
    const preserved = ['DATABASE_URL', 'AUTH_SECRET', 'NEW_STAGING_VARIABLE'];

    await runWizard(preserved, true, {
      write: (line) => lines.push(line),
      waitForOwner: () => Promise.reject(new Error('a dry run waits for no one')),
      newSecret: () => 'secret-that-must-not-print',
    });

    const text = lines.join('\n');
    expect(text).not.toContain('secret-that-must-not-print');
    // Every owner step, in order.
    const steps = ['Neon', 'Railway', 'GitHub', 'Перший деплой', 'Cloudflare', 'EAS', 'Перевірка'];
    const at = steps.map((step) =>
      lines.findIndex((line) => line.startsWith('Крок') && line.includes(step)),
    );
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    // The settings the cost rule and ADR 0168 ask for.
    expect(text).toContain('0.25 CU');
    expect(text).toContain('5 хвилин');
    expect(text).toContain('Empty');
    expect(text).toContain('Proxied');
    expect(text).toContain('БЕЗ EXPO_PUBLIC_POSTHOG_KEY');
    for (const name of [
      ...preserved,
      'RAILWAY_STAGING_TOKEN',
      'NEON_API_KEY',
      'NEON_STAGING_BRANCH_ID',
    ]) {
      expect(text).toContain(name);
    }
    expect(lines.at(-1)).toContain('Готово');
  });

  it('waits for the owner after each step and gives a new AUTH_SECRET in a real run', async () => {
    const lines: string[] = [];
    let waits = 0;

    await runWizard(['AUTH_SECRET'], false, {
      write: (line) => lines.push(line),
      waitForOwner: () => {
        waits += 1;
        return Promise.resolve();
      },
      newSecret: () => 'new-secret',
    });

    expect(waits).toBe(lines.filter((line) => line.startsWith('Крок')).length);
    expect(lines).toContain('Новий AUTH_SECRET: new-secret');
  });
});
