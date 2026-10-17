import { createApiClient, ORPCError } from '@slovo/contracts/api';
import type { RequestFailure } from '@slovo/core';

/**
 * The backend's address: `EXPO_PUBLIC_SLOVO_API_URL`, or in development the
 * backend on this Mac, which the iOS Simulator reaches on its localhost.
 */
const API_URL = process.env.EXPO_PUBLIC_SLOVO_API_URL ?? 'http://localhost:8787';

/** The app's client of the API, built from the contract (spec #333). */
export const apiClient = createApiClient({ url: API_URL });

/**
 * The failure a call of the API ended in, of those that may pass by
 * themselves: no answer, a server error (5xx) or too many requests (429). It
 * throws the error again when the backend answered with another error, which
 * the caller handles or no retry changes.
 */
export function requestFailure(error: unknown): RequestFailure {
  if (!(error instanceof ORPCError)) return { ok: false, reason: 'offline' };
  if (error.status === 429) return { ok: false, reason: 'too-many-requests' };
  if (error.status >= 500) return { ok: false, reason: 'server-error' };
  throw error;
}
