import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

/** A plain HTTP response: what the sourcing tool needs from the network. */
export interface FetchResponse {
  readonly status: number;
  readonly body: string;
}

/** The network port. Rejects when the host can't be reached or doesn't answer in time. */
export type Fetch = (url: string, options: { timeoutMs: number }) => Promise<FetchResponse>;

/** The time port, so tests control the throttle. */
export interface Clock {
  /** Milliseconds since the Unix epoch; shared by every process on the machine. */
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface RequestStats {
  /** Requests that went to the network. */
  network: number;
  /** Requests answered from the on-disk cache. */
  cached: number;
  /** Times a host was given a rest after refusing, failing or rate-limiting. */
  backoffs: number;
  /** Hosts skipped for the rest of the run, with the reason. */
  unreachable: Record<string, string>;
}

export interface GetOptions {
  /** Whether a 200 response is the real page rather than an error page or a bot check. */
  readonly accept?: (body: string) => boolean;
  /**
   * A fallback host: one quick try, and the first failure (no answer, or a
   * rate limit) takes the host out for the rest of the run.
   */
  readonly fallback?: boolean;
}

/** Raised for a host taken out of the run; nothing is sent to it. */
export class HostUnreachableError extends Error {}

/** Only answers that will be the same next time are cached. */
const CACHEABLE_STATUSES = new Set([200, 404]);
/** Answers that mean "slow down". */
const BACK_OFF_STATUSES = new Set([429, 503]);
const TIMEOUT_MS = 20_000;
const FALLBACK_TIMEOUT_MS = 5000;
const FIRST_BACKOFF_MS = 5000;
const MAX_BACKOFFS = 4;
/** A host lock older than this was left by a crashed process. */
const STALE_LOCK_MS = 10_000;
const LOCK_RETRY_MS = 25;

/**
 * Fetches politely, together with every other run on the machine that shares
 * the cache folder:
 *
 * - every usable answer is kept on disk, so no page is fetched twice;
 * - each host gets at most one request every `minIntervalMs`, across processes;
 * - a host that refuses, fails or rate-limits gets an exponential rest, which
 *   every process honours.
 */
export class PoliteClient {
  readonly stats: RequestStats = { network: 0, cached: 0, backoffs: 0, unreachable: {} };

  constructor(
    private readonly fetch: Fetch,
    private readonly clock: Clock,
    private readonly cacheDir: string,
    private readonly minIntervalMs: number,
    private readonly log: (message: string) => void = () => undefined,
  ) {}

  /** Whether the answer for `url` is already on disk. */
  isCached(url: string): boolean {
    return existsSync(this.cacheFile(url));
  }

  async get(
    url: string,
    { accept = () => true, fallback = false }: GetOptions = {},
  ): Promise<FetchResponse> {
    const cacheFile = this.cacheFile(url);
    if (existsSync(cacheFile)) {
      this.stats.cached += 1;
      return JSON.parse(readFileSync(cacheFile, 'utf8')) as FetchResponse;
    }

    const host = new URL(url).hostname;
    for (let attempt = 0; ; attempt += 1) {
      const reason = this.stats.unreachable[host];
      if (reason !== undefined)
        throw new HostUnreachableError(`${host} is skipped for this run: ${reason}`);

      await this.waitTurn(host);
      // A parallel run may have fetched the page while this one waited its turn.
      if (existsSync(cacheFile)) {
        this.stats.cached += 1;
        return JSON.parse(readFileSync(cacheFile, 'utf8')) as FetchResponse;
      }
      this.stats.network += 1;
      let trouble: string;
      try {
        const response = await this.fetch(url, {
          timeoutMs: fallback ? FALLBACK_TIMEOUT_MS : TIMEOUT_MS,
        });
        if (
          CACHEABLE_STATUSES.has(response.status) &&
          (response.status !== 200 || accept(response.body))
        ) {
          this.writeCache(cacheFile, url, response);
          return response;
        }
        if (!BACK_OFF_STATUSES.has(response.status) && response.status !== 200) return response;
        trouble =
          response.status === 200
            ? 'an error page instead of the content'
            : `HTTP ${String(response.status)}`;
      } catch (error) {
        trouble = `no connection (${(error as Error).message})`;
      }

      if (fallback || attempt >= MAX_BACKOFFS) {
        this.stats.unreachable[host] = trouble;
        this.log(`${host}: ${trouble}; skipping it for the rest of this run`);
        throw new HostUnreachableError(`${host}: ${trouble}`);
      }
      const rest = FIRST_BACKOFF_MS * 2 ** attempt;
      this.stats.backoffs += 1;
      this.log(
        `${host}: ${trouble}; backing off for ${String(rest / 1000)} s (${String(attempt + 1)}/${String(MAX_BACKOFFS)})`,
      );
      await this.withHostLock(host, (next) => Math.max(next, this.clock.now() + rest));
    }
  }

  private cacheFile(url: string): string {
    return join(this.cacheDir, 'pages', `${createHash('sha256').update(url).digest('hex')}.json`);
  }

  /** Writes through a temporary file, so a parallel run never reads half a page. */
  private writeCache(cacheFile: string, url: string, response: FetchResponse): void {
    mkdirSync(join(this.cacheDir, 'pages'), { recursive: true });
    const temporary = `${cacheFile}.${String(process.pid)}.tmp`;
    writeFileSync(temporary, JSON.stringify({ url, ...response }));
    renameSync(temporary, cacheFile);
  }

  /** Books the host's next free slot, shared by every process, and waits for it. */
  private async waitTurn(host: string): Promise<void> {
    let slot = 0;
    await this.withHostLock(host, (next) => {
      slot = Math.max(this.clock.now(), next);
      return slot + this.minIntervalMs;
    });
    const wait = slot - this.clock.now();
    if (wait > 0) await this.clock.sleep(wait);
  }

  /**
   * Updates the time a host may next be asked, under a lock folder that only
   * one process can create at a time.
   */
  private async withHostLock(host: string, update: (next: number) => number): Promise<void> {
    while (!this.tryLock(host)) await this.clock.sleep(LOCK_RETRY_MS);
    this.updateNext(host, update);
  }

  private tryLock(host: string): boolean {
    const hostsDir = join(this.cacheDir, 'hosts');
    const lock = join(hostsDir, `${host}.lock`);
    mkdirSync(hostsDir, { recursive: true });
    try {
      mkdirSync(lock);
      return true;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS)
          rmSync(lock, { recursive: true, force: true });
      } catch {
        // The lock went away in the meantime.
      }
      return false;
    }
  }

  private updateNext(host: string, update: (next: number) => number): void {
    const hostsDir = join(this.cacheDir, 'hosts');
    const nextFile = join(hostsDir, `${host}.next`);
    try {
      const next = existsSync(nextFile) ? Number(readFileSync(nextFile, 'utf8')) || 0 : 0;
      writeFileSync(nextFile, String(update(next)));
    } finally {
      rmSync(join(hostsDir, `${host}.lock`), { recursive: true, force: true });
    }
  }
}
