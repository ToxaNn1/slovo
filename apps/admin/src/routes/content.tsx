import { createFileRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/content')({
  component: Content,
});

const tabClass =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary';

/** Контент: the records of the Editions and the Content queue, as two tabs. */
function Content() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <nav aria-label="Контент" className="flex gap-2">
        <Link
          to="/content"
          search={(previous) => previous}
          activeOptions={{ exact: true, includeSearch: false }}
          className={tabClass}
        >
          Записи
        </Link>
        <Link
          to="/content/queue"
          search={(previous) => previous}
          activeOptions={{ includeSearch: false }}
          className={tabClass}
        >
          Черга контенту
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
