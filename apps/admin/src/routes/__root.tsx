import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';

import { FiltersBar } from '../components/filters-bar';
import { Sidebar } from '../components/sidebar';
import { SignIn } from '../components/sign-in';
import { Button } from '../components/ui/button';
import { FiltersSchema } from '../filters';
import { useWide } from '../screen-width';
import { ME_KEY, useSession } from '../session';
import { useTheme } from '../theme';

export const Route = createRootRoute({
  validateSearch: (search) => FiltersSchema.parse(search),
  component: Layout,
});

/**
 * The admin of a signed-in Admin user; the sign-in without a session; a
 * retry when the backend fails to answer who is signed in. On a
 * phone the sidebar folds behind «Меню» and closes once a section opens.
 */
function Layout() {
  const [theme, setTheme] = useTheme();
  const session = useSession();
  const wide = useWide();
  const { pathname } = useLocation();
  // The path the menu was opened on: opening a section closes it.
  const [menuOpenAt, setMenuOpenAt] = useState<string>();
  const menuOpen = menuOpenAt === pathname;
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => adminApi.signOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
  if (session.kind === 'pending') return null;
  if (session.kind === 'signed-out') return <SignIn />;
  if (session.kind === 'failed') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 font-sans text-foreground">
        <p role="alert" className="text-sm text-destructive">
          Не вдалося. Спробуйте ще раз.
        </p>
        <Button variant="outline" onClick={session.retry}>
          Спробувати ще раз
        </Button>
      </main>
    );
  }
  const { admin } = session;
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground md:flex-row">
      {wide ? (
        <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
          <p className="px-3 font-display text-lg font-bold tracking-tight">SLOVO Admin</p>
          <Sidebar role={admin.role} />
        </aside>
      ) : (
        <div className="flex flex-col gap-2 border-b border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="font-display text-lg font-bold tracking-tight">SLOVO Admin</p>
            <Button
              variant="outline"
              size="sm"
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpenAt(menuOpen ? undefined : pathname);
              }}
            >
              Меню
            </Button>
          </div>
          {menuOpen ? <Sidebar role={admin.role} /> : null}
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4 md:px-8">
          <FiltersBar />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{admin.email}</span>
            <Link
              to="/sessions"
              search={(previous) => previous}
              className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-muted"
            >
              Мої сесії
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={signOut.isPending}
              onClick={() => {
                signOut.mutate();
              }}
            >
              Вийти
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={theme === 'dark'}
              onClick={() => {
                setTheme(theme === 'dark' ? 'light' : 'dark');
              }}
            >
              Темна тема
            </Button>
          </div>
        </header>
        <main className="flex flex-1 flex-col p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
