import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { ServiceVault } from '@slovo/server-core';

/** The Vault while the Deployment has no `VAULT_KEY`: no Service entry is written. */
export const VAULT_OFF: ServiceVault = { state: 'off' };

/**
 * The Vault (ADR 0164): seals a Service entry's value with AES-256-GCM under
 * `VAULT_KEY`, a fresh 12-byte IV each time, as `iv.tag.body` in base64url.
 * A sealed value opens only under the same key; a changed one is refused.
 */
export function createVault(
  key: Uint8Array,
  iv: () => Uint8Array = () => randomBytes(12),
): ServiceVault {
  return {
    state: 'on',
    seal(plain) {
      const nonce = iv();
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [Buffer.from(nonce), cipher.getAuthTag(), body]
        .map((part) => part.toString('base64url'))
        .join('.');
    },
    open(sealed) {
      const [nonce = '', tag = '', body = ''] = sealed.split('.');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(body, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
