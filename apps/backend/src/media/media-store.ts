import { createHash, createHmac } from 'node:crypto';

import type { Clock } from '@slovo/server-core';

/** A file the Media Store holds. */
export interface StoredFile {
  readonly size: number;
  readonly contentType: string;
}

/**
 * The Media Store (ADR 0099): the bucket that holds the Recording and
 * Illustration files under their content-hashed keys.
 */
export interface MediaStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** The file at the key, or undefined when the store holds none. */
  head(key: string): Promise<StoredFile | undefined>;
}

/** A Media Store in memory: development without R2, and tests. */
export function memoryMediaStore(): MediaStore {
  const files = new Map<string, StoredFile>();
  return {
    put(key, bytes, contentType) {
      files.set(key, { size: bytes.byteLength, contentType });
      return Promise.resolve();
    },
    delete(key) {
      files.delete(key);
      return Promise.resolve();
    },
    head(key) {
      return Promise.resolve(files.get(key));
    },
  };
}

export interface R2Config {
  readonly accountId: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** The Media Store in a Cloudflare R2 bucket, through R2's S3 API. */
export function r2MediaStore(
  config: R2Config,
  { clock, fetch: send = fetch }: { clock: Clock; fetch?: typeof fetch },
): MediaStore {
  const credentials = { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey };

  async function request(method: string, key: string, body?: Uint8Array, contentType?: string) {
    const url = new URL(
      `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`,
    );
    const headers = contentType === undefined ? {} : { 'content-type': contentType };
    const signed = signS3Request({
      method,
      url,
      headers,
      payloadHash: sha256Hex(body ?? new Uint8Array()),
      region: 'auto',
      credentials,
      now: clock.now(),
    });
    return send(url, {
      method,
      headers: signed,
      ...(body === undefined ? {} : { body: new Uint8Array(body) }),
    });
  }

  function fail(method: string, key: string, response: Response): never {
    throw new Error(`R2 ${method} ${key} answered ${String(response.status)}`);
  }

  return {
    async put(key, bytes, contentType) {
      const response = await request('PUT', key, bytes, contentType);
      if (!response.ok) fail('PUT', key, response);
    },
    async delete(key) {
      const response = await request('DELETE', key);
      if (!response.ok && response.status !== 404) fail('DELETE', key, response);
    },
    async head(key) {
      const response = await request('HEAD', key);
      if (response.status === 404) return undefined;
      if (!response.ok) fail('HEAD', key, response);
      return {
        size: Number(response.headers.get('content-length') ?? 0),
        contentType: response.headers.get('content-type') ?? '',
      };
    },
  };
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * Signs an S3 request with AWS Signature Version 4: the request's headers
 * plus host, x-amz-date, x-amz-content-sha256 and authorization.
 */
export function signS3Request({
  method,
  url,
  headers,
  payloadHash,
  region,
  credentials,
  now,
}: {
  method: string;
  url: URL;
  headers: Readonly<Record<string, string>>;
  payloadHash: string;
  region: string;
  credentials: { accessKeyId: string; secretAccessKey: string };
  now: Date;
}): Record<string, string> {
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const day = amzDate.slice(0, 8);
  const all: Record<string, string> = {
    ...headers,
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const names = Object.keys(all)
    .map((name) => name.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(all).map(([k, v]) => [k.toLowerCase(), v]));
  const signedHeaders = names.join(';');
  const path = url.pathname
    .split('/')
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join('/');
  const canonical = [
    method,
    path,
    url.searchParams.toString(),
    names.map((name) => `${name}:${String(lower[name]).trim()}\n`).join(''),
    signedHeaders,
    payloadHash,
  ].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonical)].join('\n');
  const key = hmac(
    hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, day), region), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', key).update(toSign).digest('hex');
  const { host: _host, ...sent } = lower;
  return {
    ...sent,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope},SignedHeaders=${signedHeaders},Signature=${signature}`,
  };
}
