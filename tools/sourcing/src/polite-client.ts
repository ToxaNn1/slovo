import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** A plain HTTP response: what the sourcing tool needs from the network. */
export interface FetchResponse {
  readonly status: number;
  readonly body: string;
}

/** The network port. Rejects when the host can't be reached. */
export type Fetch = (url: string) => Promise<FetchResponse>;

/** The time port, so tests control the throttle. */
export interface Clock {
  /** Milliseconds since some fixed point. */
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RequestStats {
  /** Requests that went to the network. */
  network: number;
  /** Requests answered from the on-disk cache. */
  cached: number;
}

export interface GetOptions {
  /** Whether a 200 response is the real page rather than an error or a bot check. */
  readonly accept?: (body: string) => boolean;
  /** How many times to retry an unusable response or a failed connection. */
  readonly retries?: number;
}

/** Only answers that will be the same next time are cached. */
const CACHEABLE_STATUSES = new Set([200, 404]);

/** How long to back off before retrying, on top of the throttle. */
const RETRY_DELAY_MS = 15_000;

/**
 * Fetches politely: at most one network request every `minIntervalMs`, and
 * every usable answer is kept on disk so a re-run never asks the sites again.
 */
export class PoliteClient {
  readonly stats: RequestStats = { network: 0, cached: 0 };
  private lastRequestAt: number | undefined;

  constructor(
    private readonly fetch: Fetch,
    private readonly clock: Clock,
    private readonly cacheDir: string,
    private readonly minIntervalMs: number,
  ) {}

  /** Whether the answer for `url` is already on disk. */
  isCached(url: string): boolean {
    return existsSync(this.cacheFile(url));
  }

  async get(
    url: string,
    { accept = () => true, retries = 0 }: GetOptions = {},
  ): Promise<FetchResponse> {
    const cacheFile = this.cacheFile(url);
    if (existsSync(cacheFile)) {
      this.stats.cached += 1;
      return JSON.parse(readFileSync(cacheFile, 'utf8')) as FetchResponse;
    }

    for (let attempt = 0; ; attempt += 1) {
      const isLastAttempt = attempt >= retries;
      let response: FetchResponse;
      try {
        response = await this.request(url);
      } catch (error) {
        if (isLastAttempt) throw error;
        await this.clock.sleep(RETRY_DELAY_MS);
        continue;
      }
      const usable =
        CACHEABLE_STATUSES.has(response.status) &&
        (response.status !== 200 || accept(response.body));
      if (usable) {
        mkdirSync(this.cacheDir, { recursive: true });
        writeFileSync(cacheFile, JSON.stringify({ url, ...response }));
        return response;
      }
      if (isLastAttempt) {
        throw new Error(`Unusable response from ${url} (HTTP ${String(response.status)})`);
      }
      await this.clock.sleep(RETRY_DELAY_MS);
    }
  }

  private cacheFile(url: string): string {
    return join(this.cacheDir, `${createHash('sha256').update(url).digest('hex')}.json`);
  }

  private async request(url: string): Promise<FetchResponse> {
    if (this.lastRequestAt !== undefined) {
      const wait = this.lastRequestAt + this.minIntervalMs - this.clock.now();
      if (wait > 0) await this.clock.sleep(wait);
    }
    this.lastRequestAt = this.clock.now();
    this.stats.network += 1;
    return this.fetch(url);
  }
}
