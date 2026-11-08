import { createAdminApiClient } from '@slovo/contracts/admin-api';

/** The admin API on the origin the admin is served from (ADR 0088). */
export const adminApi = createAdminApiClient(window.location.origin);
