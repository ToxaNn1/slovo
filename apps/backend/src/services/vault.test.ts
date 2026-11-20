import { randomBytes } from 'node:crypto';

import type { ServiceVault } from '@slovo/server-core';
import { describe, expect, it } from 'vitest';

import { createVault } from './vault';

/** The Vault on, or a failed test. */
function on(vault: ServiceVault) {
  if (vault.state !== 'on') throw new Error('the Vault is off');
  return vault;
}

/** IVs from a counter: each seal takes the next. */
function countingIv() {
  let next = 0;
  return () => {
    next += 1;
    return Buffer.alloc(12, next);
  };
}

describe('the Vault', () => {
  const secret = `fake-token-${randomBytes(8).toString('hex')}`;

  it('opens what it sealed, and the sealed text holds no trace of the value', () => {
    const vault = on(createVault(randomBytes(32)));

    const sealed = vault.seal(secret);

    expect(sealed).not.toContain(secret);
    expect(sealed).not.toContain(Buffer.from(secret).toString('base64url'));
    expect(vault.open(sealed)).toBe(secret);
  });

  it('seals the same value differently under each IV', () => {
    const vault = on(createVault(randomBytes(32), countingIv()));

    const first = vault.seal(secret);
    const second = vault.seal(secret);

    expect(first).not.toBe(second);
    expect(first.split('.')[0]).toBe(Buffer.alloc(12, 1).toString('base64url'));
    expect([vault.open(first), vault.open(second)]).toEqual([secret, secret]);
  });

  it('refuses a value sealed under another key, or changed', () => {
    const vault = on(createVault(randomBytes(32)));
    const sealed = vault.seal(secret);
    const [iv = '', tag = '', body = ''] = sealed.split('.');
    const flipped = Buffer.from(body, 'base64url').map((byte, at) => (at === 0 ? byte ^ 1 : byte));
    const changed = [iv, tag, Buffer.from(flipped).toString('base64url')].join('.');

    expect(() => on(createVault(randomBytes(32))).open(sealed)).toThrow();
    expect(() => vault.open(changed)).toThrow();
  });

  it('refuses a value whose tag was cut short', () => {
    const vault = on(createVault(randomBytes(32)));
    const [iv = '', tag = '', body = ''] = vault.seal(secret).split('.');
    const short = Buffer.from(tag, 'base64url').subarray(0, 4).toString('base64url');

    expect(() => vault.open([iv, short, body].join('.'))).toThrow();
  });
});
