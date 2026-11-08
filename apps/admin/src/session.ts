import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from './api';

/** The signed-in Admin user. */
export type SignedInAdmin = AdminApiOutputs['me'];

/** The query key of the signed-in Admin user, which a sign-in or a sign-out refreshes. */
export const ME_KEY = ['me'] as const;

/**
 * The Admin user of the session cookie: `null` without a session, `undefined`
 * while the backend has not answered yet.
 */
export function useSignedInAdmin(): SignedInAdmin | null | undefined {
  const me = useQuery({
    queryKey: ME_KEY,
    queryFn: () =>
      adminApi
        .me()
        .catch((error: unknown) =>
          codeOf(error) === 'UNAUTHORIZED' ? null : Promise.reject(error),
        ),
    retry: false,
  });
  return me.data;
}

/** The error code of an admin API refusal, such as `UNAUTHORIZED`. */
export function codeOf(error: unknown): string | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

/** A number in the refusal's data, such as `attemptsLeft`. */
export function dataOf(error: unknown, key: string): number | undefined {
  if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
  const { data } = error;
  if (typeof data !== 'object' || data === null) return undefined;
  const value: unknown = Object.getOwnPropertyDescriptor(data, key)?.value;
  return typeof value === 'number' ? value : undefined;
}

/** What the owner reads of a refused sign-in step. */
export function refusalText(error: unknown): string {
  switch (codeOf(error)) {
    case 'UNAUTHORIZED': {
      const left = dataOf(error, 'attemptsLeft');
      return left === undefined
        ? 'Код неправильний або застарів.'
        : `Код неправильний або застарів. Спроб лишилося: ${String(left)}.`;
    }
    case 'TOO_MANY_REQUESTS': {
      const seconds = dataOf(error, 'retryAfterSeconds') ?? 60;
      return `Забагато невдалих спроб. Спробуйте за ${String(Math.ceil(seconds / 60))} хв.`;
    }
    default:
      return 'Не вдалося. Спробуйте ще раз.';
  }
}
