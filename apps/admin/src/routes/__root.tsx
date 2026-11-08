import { createRootRoute, Outlet } from '@tanstack/react-router';

import { FiltersBar } from '../components/filters-bar';
import { Sidebar } from '../components/sidebar';
import { Button } from '../components/ui/button';
import { FiltersSchema } from '../filters';
import { useTheme } from '../theme';

export const Route = createRootRoute({
  validateSearch: (search) => FiltersSchema.parse(search),
  component: Layout,
});

function Layout() {
  const [theme, setTheme] = useTheme();
  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
        <p className="px-3 font-display text-lg font-bold tracking-tight">SLOVO Admin</p>
        <Sidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-8 py-4">
          <FiltersBar />
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
        </header>
        <main className="flex flex-1 flex-col p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
