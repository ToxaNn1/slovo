import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import type { ContentApi, ContentApiFailure, PackVersion } from '../ports';

/** A pack the fake backend has published, with the bytes of its file. */
export interface FakePublishedPack extends PackVersion {
  readonly bytes: Uint8Array;
  /** The SHA-256 the backend announces; without it, that of the bytes. */
  readonly fileSha256?: string;
}

/** A content API for tests: the test publishes packs and makes requests fail. */
export interface FakeContentApi extends ContentApi {
  /** The pack format of each `latest` request, in order, failed ones included. */
  readonly asked: readonly number[];
  /** The content version of each `download` request, in order, failed ones included. */
  readonly downloaded: readonly number[];
  /** Publishes a pack, which `latest` announces while it is the newest of its format. */
  publish(pack: FakePublishedPack): void;
  /** Fails the next requests of the procedure, one per reason, in order. */
  fail(procedure: 'latest' | 'download', ...reasons: readonly ContentApiFailure['reason'][]): void;
}

/** A content API held in memory, for tests; it answers like the backend's content procedures. */
export function createFakeContentApi(): FakeContentApi {
  const packs: FakePublishedPack[] = [];
  const failures = {
    latest: [] as ContentApiFailure['reason'][],
    download: [] as ContentApiFailure['reason'][],
  };
  const asked: number[] = [];
  const downloaded: number[] = [];

  function answer<A>(
    procedure: keyof typeof failures,
    value: () => A,
  ): Promise<A | ContentApiFailure> {
    const reason = failures[procedure].shift();
    return Promise.resolve(reason === undefined ? value() : { ok: false, reason });
  }

  return {
    asked,
    downloaded,
    publish(pack) {
      packs.push(pack);
    },
    fail(procedure, ...reasons) {
      failures[procedure].push(...reasons);
    },
    latest(packFormat) {
      asked.push(packFormat);
      return answer('latest', () => {
        const newest = packs
          .filter((pack) => pack.packFormat === packFormat)
          .reduce<FakePublishedPack | undefined>(
            (found, pack) =>
              found === undefined || pack.contentVersion > found.contentVersion ? pack : found,
            undefined,
          );
        if (newest === undefined) return { ok: true, pack: undefined } as const;
        const { contentVersion, bytes, fileSha256 = bytesToHex(sha256(bytes)) } = newest;
        return {
          ok: true,
          pack: { contentVersion, packFormat, size: bytes.length, fileSha256 },
        } as const;
      });
    },
    download(contentVersion) {
      downloaded.push(contentVersion);
      return answer('download', () => {
        const pack = packs.find((published) => published.contentVersion === contentVersion);
        return pack === undefined
          ? ({ ok: false, reason: 'not-found' } as const)
          : ({ ok: true, bytes: pack.bytes } as const);
      });
    },
  };
}
