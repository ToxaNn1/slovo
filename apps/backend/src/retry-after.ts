/** Tells the answer when, in seconds, a request over a limit may come again. */
export function retryAfter(
  { resHeaders }: { readonly resHeaders?: Headers },
  { retryAfterSeconds }: { readonly retryAfterSeconds: number },
): void {
  resHeaders?.set('retry-after', String(retryAfterSeconds));
}
