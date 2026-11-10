import { describe, expect, it } from 'vitest';

import { MediaImportConfigSchema, RecordingsConfigSchema } from '../config';
import { memoryMediaStore, r2MediaStore, signS3Request } from './media-store';

describe('the memory Media Store', () => {
  it('keeps a put file until it is deleted', async () => {
    const store = memoryMediaStore();
    await store.put('recordings/a.mp3', new Uint8Array([1, 2, 3]), 'audio/mpeg');
    expect(await store.head('recordings/a.mp3')).toEqual({ size: 3, contentType: 'audio/mpeg' });
    await store.delete('recordings/a.mp3');
    expect(await store.head('recordings/a.mp3')).toBeUndefined();
  });
});

describe('the S3 signature R2 takes', () => {
  // The GET Object example of AWS's Signature Version 4 documentation.
  it('signs the documented example request', () => {
    const headers = signS3Request({
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      headers: { range: 'bytes=0-9' },
      payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
      now: new Date('2013-05-24T00:00:00Z'),
    });
    expect(headers['authorization']).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request,' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date,' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });
});

describe('the R2 Media Store', () => {
  const config = {
    accountId: 'acc',
    bucket: 'media',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
  };

  it('puts a file at its key in the bucket', async () => {
    const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
    const store = r2MediaStore(config, {
      clock: { now: () => new Date('2026-11-10T00:00:00Z') },
      fetch: (url, init) => {
        calls.push({
          url: url instanceof Request ? url.url : url.toString(),
          method: init?.method ?? 'GET',
          headers: init?.headers as Record<string, string>,
        });
        return Promise.resolve(new Response(null, { status: 200 }));
      },
    });
    await store.put('recordings/v/plain/w.h.mp3', new Uint8Array([1]), 'audio/mpeg');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://acc.r2.cloudflarestorage.com/media/recordings/v/plain/w.h.mp3',
    );
    expect(calls[0]?.method).toBe('PUT');
    expect(calls[0]?.headers['content-type']).toBe('audio/mpeg');
    expect(calls[0]?.headers['authorization']).toMatch(
      /^AWS4-HMAC-SHA256 Credential=key\/20261110\/auto\/s3/,
    );
  });

  it('answers no file for a key R2 does not hold, and fails on an error', async () => {
    const answers = [new Response(null, { status: 404 }), new Response(null, { status: 500 })];
    const store = r2MediaStore(config, {
      clock: { now: () => new Date('2026-11-10T00:00:00Z') },
      fetch: () => Promise.resolve(answers.shift() ?? new Response(null, { status: 500 })),
    });
    expect(await store.head('missing.mp3')).toBeUndefined();
    await expect(store.put('a.mp3', new Uint8Array([1]), 'audio/mpeg')).rejects.toThrow(/500/);
  });
});

describe('the Recordings configuration', () => {
  const base = { DATABASE_URL: 'postgres://localhost/slovo' };
  const r2 = {
    R2_ACCOUNT_ID: 'acc',
    R2_BUCKET: 'media',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
  };

  it('keeps the files in memory in development when no R2 variable is set', () => {
    expect(RecordingsConfigSchema.parse({ ...base, R2_BUCKET: '' }).r2).toBeUndefined();
  });

  it('takes the R2 bucket when all four variables are set', () => {
    expect(RecordingsConfigSchema.parse({ ...base, ...r2 }).r2).toEqual({
      accountId: 'acc',
      bucket: 'media',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });
  });

  it('refuses some R2 variables without the others, and none in production', () => {
    const partial = RecordingsConfigSchema.safeParse({ ...base, R2_BUCKET: 'media' });
    expect(partial.error?.issues.map((issue) => issue.path[0])).toEqual([
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ]);
    expect(RecordingsConfigSchema.safeParse({ ...base, NODE_ENV: 'production' }).success).toBe(
      false,
    );
  });
});

describe('the media import configuration', () => {
  const base = { DATABASE_URL: 'postgres://localhost/slovo' };
  const r2 = {
    R2_ACCOUNT_ID: 'acc',
    R2_BUCKET: 'media',
    R2_ACCESS_KEY_ID: 'key',
    R2_SECRET_ACCESS_KEY: 'secret',
  };

  it('takes the R2 bucket the import puts the files in', () => {
    expect(MediaImportConfigSchema.parse({ ...base, ...r2 }).r2).toEqual({
      accountId: 'acc',
      bucket: 'media',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });
  });

  it('refuses to run without every R2 variable, even in development', () => {
    const missing = MediaImportConfigSchema.safeParse({ ...base, ...r2, R2_BUCKET: '' });
    expect(missing.error?.issues.map((issue) => issue.path[0])).toEqual(['R2_BUCKET']);
    expect(MediaImportConfigSchema.safeParse({ ...r2 }).success).toBe(false);
  });
});
