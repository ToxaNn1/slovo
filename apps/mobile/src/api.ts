import { createApiClient } from '@slovo/contracts/api';
import type { Backend } from '@slovo/core';

/**
 * The backend's address: `EXPO_PUBLIC_SLOVO_API_URL`, or in development the
 * backend on this Mac, which the iOS Simulator reaches on its localhost.
 */
const API_URL = process.env.EXPO_PUBLIC_SLOVO_API_URL ?? 'http://localhost:8787';

/**
 * The Core's Backend port of this device: the API contract's client (spec
 * #333, ADR 0064). The Core answers, retries and maps every call itself; the
 * shell supplies only the client.
 */
export const backend: Backend = createApiClient({ url: API_URL });
