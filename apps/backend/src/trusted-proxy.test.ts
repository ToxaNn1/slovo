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
function behindProxy(trustedProxyHops: number, edgeSecret?: string) {
  const backend = testApp({ trustedProxyHops, edgeSecret });
  const proxy = newIp();
  const requestCode = (forwardedFor: string, headers: Record<string, string> = {}) =>
    backend.request(
      '/v1/account/sign-in-codes',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': forwardedFor,
          ...headers,
        },
        body: JSON.stringify({ email: newEmail(), editionId: 'uk' }),
      },
      proxy,
    );
  /** Sends as many code requests as one IP address may with the forwarded headers it is given. */
  const useUpTheLimit = async (
    forwardedFor: () => string,
    headers: () => Record<string, string> = () => ({}),
  ) => {
    for (let sent = 0; sent < CODE_REQUESTS; sent++) {
      expect((await requestCode(forwardedFor(), headers())).status).toBe(200);
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

describe('with two trusted proxy hops, Cloudflare in front of Railway', () => {
  /** An address in Cloudflare's published ranges: the hop Railway's proxy appends behind Cloudflare. */
  const cloudflare = '172.64.1.10';

  it('counts the client Cloudflare forwarded for, whatever it wrote before', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(2);
    const client = newIp();
    await useUpTheLimit(() => `${newIp()}, ${client}, ${cloudflare}`);

    expect((await requestCode(`${client}, ${cloudflare}`)).status).toBe(429);
    expect((await requestCode(`${newIp()}, ${cloudflare}`)).status).toBe(200);
  });

  it('trusts a Cloudflare IPv6 hop and an IPv4-mapped one', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(2);
    const client = newIp();
    let sent = 0;
    await useUpTheLimit(() =>
      sent++ % 2 === 0 ? `${client}, 2606:4700::6810:1` : `${client}, ::ffff:104.16.0.1`,
    );

    expect((await requestCode(`${client}, ${cloudflare}`)).status).toBe(429);
  });

  it('counts the caller, not its forged header, when the request skipped Cloudflare', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(2);
    const caller = newIp();
    // Straight to Railway's domain: the last hop is the caller itself.
    await useUpTheLimit(() => `${newIp()}, ${caller}`);

    expect((await requestCode(`${newIp()}, ${caller}`)).status).toBe(429);
  });
});

describe("with two trusted proxy hops and the secret header of the app's Cloudflare zone", () => {
  const cloudflare = '172.64.1.10';
  const secret = `edge-${randomUUID()}`;
  const ours = { 'x-slovo-edge-secret': secret };

  it('counts the client Cloudflare forwarded for when the zone set the header', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(2, secret);
    const client = newIp();
    await useUpTheLimit(
      () => `${newIp()}, ${client}, ${cloudflare}`,
      () => ours,
    );

    expect((await requestCode(`${client}, ${cloudflare}`, ours)).status).toBe(429);
    expect((await requestCode(`${newIp()}, ${cloudflare}`, ours)).status).toBe(200);
  });

  it("counts Cloudflare's hop, not the forged client, when another zone or a Worker sent it", async () => {
    const { requestCode, useUpTheLimit } = behindProxy(2, secret);
    // Through Cloudflare, but not the app's zone: no header, or a wrong one.
    let sent = 0;
    await useUpTheLimit(
      () => `${newIp()}, ${cloudflare}`,
      () => (sent++ % 2 === 0 ? {} : { 'x-slovo-edge-secret': `${secret}x` }),
    );

    expect((await requestCode(`${newIp()}, ${cloudflare}`)).status).toBe(429);
  });
});

describe('with no trusted proxy hop', () => {
  it('ignores the forwarded header and counts the connection', async () => {
    const { requestCode, useUpTheLimit } = behindProxy(0);
    await useUpTheLimit(() => newIp());

    expect((await requestCode(newIp())).status).toBe(429);
  });
});
