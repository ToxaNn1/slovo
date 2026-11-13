import {
  SignInBlockedSchema,
  WrongCodeSchema,
  type AdminApiOutputs,
} from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';

import { adminApi } from './api';

/** The signed-in Admin user. */
export type SignedInAdmin = AdminApiOutputs['me'];

/** The query key of the signed-in Admin user, which a sign-in or a sign-out refreshes. */
export const ME_KEY = ['me'] as const;

/** The query of the Admin user of the session cookie: `null` without a session. */
function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await adminApi.me();
      } catch (error) {
        if (codeOf(error) === 'UNAUTHORIZED') return null;
        throw error;
      }
    },
    retry: false,
  });
}

/** The session cookie as the backend answers it, or why it has not. */
export type Session =
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly retry: () => void }
  | { readonly kind: 'signed-out' }
  | { readonly kind: 'signed-in'; readonly admin: SignedInAdmin };

/** The session of the admin: who is signed in, or a failed answer to try again. */
export function useSession(): Session {
  const me = useMe();
  // A failed refetch keeps the answer it had: only a first answer that failed shows.
  if (me.data === null) return { kind: 'signed-out' };
  if (me.data !== undefined) return { kind: 'signed-in', admin: me.data };
  if (me.isError) {
    return {
      kind: 'failed',
      retry: () => {
        void me.refetch();
      },
    };
  }
  return { kind: 'pending' };
}

/**
 * The Admin user of the session cookie: `null` without a session, `undefined`
 * while the backend has not answered yet.
 */
export function useSignedInAdmin(): SignedInAdmin | null | undefined {
  return useMe().data;
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

/** The data of a refusal, or undefined when the error carries none. */
export function refusalData(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'data' in error ? error.data : undefined;
}

/** What the owner reads of a refused sign-in step. */
export function refusalText(error: unknown): string {
  switch (codeOf(error)) {
    case 'UNAUTHORIZED': {
      const left = WrongCodeSchema.safeParse(refusalData(error)).data?.attemptsLeft;
      return left === undefined
        ? 'Код неправильний або застарів.'
        : `Код неправильний або застарів. Спроб лишилося: ${String(left)}.`;
    }
    case 'TOO_MANY_REQUESTS': {
      const seconds = SignInBlockedSchema.safeParse(refusalData(error)).data?.retryAfterSeconds ?? 60;
      return `Забагато невдалих спроб. Спробуйте за ${String(Math.ceil(seconds / 60))} хв.`;
    }
    default:
      return 'Не вдалося. Спробуйте ще раз.';
  }
}
