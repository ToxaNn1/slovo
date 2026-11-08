import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

import { adminApi } from '../api';

import { FiltersBar } from '../components/filters-bar';
import { Sidebar } from '../components/sidebar';
import { SignIn } from '../components/sign-in';
import { Button } from '../components/ui/button';
import { FiltersSchema } from '../filters';
import { ME_KEY, useSignedInAdmin } from '../session';
import { useTheme } from '../theme';

export const Route = createRootRoute({
  validateSearch: (search) => FiltersSchema.parse(search),
  component: Layout,
});

/** The admin of a signed-in Admin user; the sign-in without a session. */
function Layout() {
  const [theme, setTheme] = useTheme();
  const admin = useSignedInAdmin();
  const queryClient = useQueryClient();
  const signOut = useMutation({
    mutationFn: () => adminApi.signOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  });
  if (admin === undefined) return null;
  if (admin === null) return <SignIn />;
  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
        <p className="px-3 font-display text-lg font-bold tracking-tight">SLOVO Admin</p>
        <Sidebar role={admin.role} />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-8 py-4">
          <FiltersBar />
          <div className="flex items-center gap-2">
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
        <main className="flex flex-1 flex-col p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
