import { createApiClient, type ApiFetch } from '@slovo/contracts/api';
import type { Backend, Schedule } from '@slovo/core';

/**
 * The backend's address: `EXPO_PUBLIC_SLOVO_API_URL`, or in development the
 * backend on this Mac, which the iOS Simulator reaches on its localhost.
 */
const API_URL = process.env.EXPO_PUBLIC_SLOVO_API_URL ?? 'http://localhost:8787';

/**
 * How long a try of a request waits for an answer, in milliseconds, before it
 * gives up as no answer: the Core then tries it again or says there is no
 * connection (ADR 0064), instead of waiting for the system's minute.
 */
export const REQUEST_TIMEOUT = 8_000;

/** `fetch`, aborted and failed as no answer when it has none after `REQUEST_TIMEOUT`. */
function timed(fetch: ApiFetch, schedule: Schedule): ApiFetch {
  return (request) =>
    new Promise<Response>((resolve, reject) => {
      const controller = new AbortController();
      const cancel = schedule(() => {
        controller.abort();
        reject(new Error(`No answer in ${String(REQUEST_TIMEOUT)} ms`));
      }, REQUEST_TIMEOUT);
      fetch(new Request(request, { signal: controller.signal }))
        .then(resolve, reject)
        .finally(cancel);
    });
}

/**
 * The Core's Backend port over `fetch`: the API contract's client (spec #333,
 * ADR 0064), each try of a request given up after `REQUEST_TIMEOUT`. The
 * Core answers, retries and maps every call itself; the shell supplies only
 * the client.
 */
export function createDeviceBackend({
  url,
  fetch,
  schedule,
}: {
  url: string;
  fetch: ApiFetch;
  schedule: Schedule;
}): Backend {
  return createApiClient({ url, fetch: timed(fetch, schedule) });
}

/** The Backend port of this device. */
export const backend: Backend = createDeviceBackend({
  url: API_URL,
  fetch: (request) => globalThis.fetch(request),
  // The real clock, as `systemSchedule` of `@slovo/ui`, which this module can't import outside React Native.
  schedule: (run, delay) => {
    const timer = setTimeout(run, delay);
    return () => {
      clearTimeout(timer);
    };
  },
});
