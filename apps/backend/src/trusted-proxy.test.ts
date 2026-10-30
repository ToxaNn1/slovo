import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { newIp, testApp } from './test-support';

/** An email no other test uses. */
const newEmail = () => `reader-${randomUUID()}@example.com`;

/** The code requests an IP address may make in 10 minutes (ADR 0030). */
const CODE_REQUESTS = 20;

/**
 * A backend behind a proxy that trusts the hops given: every request comes
 * on a connection from the proxy, with the forwarded header it brings.
 */
function behindProxy(trustedProxyHops: number) {
  const backend = testApp({ trustedProxyHops });
  const proxy = newIp();
  const requestCode = (forwardedFor: string) =>
    backend.request(
      '/v1/account/sign-in-codes',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': forwardedFor },
        body: JSON.stringify({ email: newEmail(), editionId: 'uk' }),
      },
      proxy,
    );
  /** Sends as many code requests as one IP address may with the forwarded headers it is given. */
  const useUpTheLimit = async (forwardedFor: () => string) => {
    for (let sent = 0; sent < CODE_REQUESTS; sent++) {
      expect((await requestCode(forwardedFor())).status).toBe(200);
    }
  };
  return { requestCode, useUpTheLimit };
}

describe('with one trusted proxy hop', () => {
  it('counts each client behind the proxy by its own address', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(1);
    const client = newIp();
    await useUpTheLimit(() => client);

    expect((await requestCode(client)).status).toBe(429);
    expect((await requestCode(newIp())).status).toBe(200);
  });

  it('counts only the address the proxy appended, whatever the client wrote before it', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(1);
    const client = newIp();
    // A forged address of its own before the one the proxy appends, each time another.
    await useUpTheLimit(() => `${newIp()}, ${client}`);

    expect((await requestCode(`${newIp()}, ${client}`)).status).toBe(429);
    // The forged address is no client's count.
    const forged = newIp();
    expect((await requestCode(`${forged}, ${newIp()}`)).status).toBe(200);
    expect((await requestCode(forged)).status).toBe(200);
  });
});

describe('with no trusted proxy hop', () => {
  it('ignores the forwarded header and counts the connection', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(0);
    await useUpTheLimit(() => newIp());

    expect((await requestCode(newIp())).status).toBe(429);
  });
});
