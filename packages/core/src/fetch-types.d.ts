/**
 * The web platform's request types the API contract's client names (`Request`,
 * `Response`, `Headers`), the pack file a download answers with (`File`) and
 * `URL`, which the client's types tell a file from, as types only, so the Core
 * reads what the Backend port hands it (ADR 0064) without the DOM lib. Each
 * member is declared as the platform declares it, and only those the Core
 * reads. A name left out would resolve to nothing and pass for any type in
 * the client's conditional types, so every web type they test against is
 * here. The Core builds and sends nothing itself: ESLint bans the browser's
 * and the network's globals, `fetch` among them.
 */
declare global {
  interface Headers {
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
  }

  interface Request {
    readonly headers: Headers;
    readonly method: string;
    readonly url: string;
  }

  interface Response {
    readonly headers: Headers;
    readonly ok: boolean;
    readonly status: number;
  }

  interface Blob {
    readonly size: number;
    readonly type: string;
    arrayBuffer(): Promise<ArrayBuffer>;
  }

  interface File extends Blob {
    readonly name: string;
  }

  /** The pack file's class, which the contract's schema tells a file by; the Core never builds one. */
  var File: { readonly prototype: File; new (): File };

  interface URL {
    readonly href: string;
    readonly origin: string;
    readonly pathname: string;
  }
}

export {};
