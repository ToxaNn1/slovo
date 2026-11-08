import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { useState } from 'react';

import { routeTree } from './routeTree.gen';

/** The admin's router, under `/admin` where the backend serves it (ADR 0088). */
export function createAdminRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    basepath: '/admin',
    ...(history === undefined ? {} : { history }),
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAdminRouter>;
  }
}

/** The whole admin: its data cache and its routes, made once per mount. */
export function Admin() {
  const [router] = useState(() => createAdminRouter());
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
