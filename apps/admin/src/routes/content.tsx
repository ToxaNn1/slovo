import { createFileRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/content')({
  component: Content,
});

const tabClass =
  'rounded-lg px-3.5 py-[7px] text-[13px] text-muted-foreground hover:text-foreground data-[status=active]:bg-surface data-[status=active]:font-semibold data-[status=active]:text-foreground data-[status=active]:shadow-panel';

/** Контент: the records of the Editions and the Content queue, as two tabs. */
function Content() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <nav
        aria-label="Контент"
        className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-sunk p-[3px]"
      >
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
