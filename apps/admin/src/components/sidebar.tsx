import { Link } from '@tanstack/react-router';

import { FiltersSchema } from '../filters';
import { sectionsOf } from '../sections';
import { useQueueBatches } from './content-queue/queries';

/** The admin's mark: the accent tile with «с», beside «slovo · адмінка» where there is room. */
export function Logo({ withName = true }: { readonly withName?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        aria-hidden
        className="grid size-[30px] place-items-center rounded-[9px] bg-primary font-display text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-4px_var(--primary)]"
      >
        с
      </div>
      {withName ? (
        <div className="flex flex-col leading-[1.15]">
          <span className="font-display text-sm font-semibold">slovo</span>
          <span className="text-[11.5px] text-side-muted">адмінка</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The sections of the role; a link keeps the global filters of the URL.
 * Контент counts the Агент batches not reviewed yet for the Edition filter.
 */
export function Sidebar({ role }: { readonly role: 'owner' | 'admin' }) {
  const open = useQueueBatches().data?.batches.length ?? 0;
  return (
    <nav aria-label="Розділи" className="flex flex-col gap-px">
      {sectionsOf(role).map((section) => (
        <Link
          key={section.path}
          to={section.path}
          search={(previous) => FiltersSchema.parse(previous)}
          activeOptions={{ exact: section.path === '/', includeSearch: false }}
          className="group flex items-center gap-2.5 rounded-[9px] px-2.5 py-[9px] text-[13.5px] text-side-muted hover:bg-side-hover data-[status=active]:bg-side-active data-[status=active]:font-semibold data-[status=active]:text-side-foreground data-[status=active]:shadow-[inset_0_0_0_1px_var(--primary-line),0_0_22px_-6px_var(--primary)]"
        >
          <span
            aria-hidden
            className="size-1.5 flex-none rounded-full bg-transparent group-data-[status=active]:bg-primary"
          />
          <span className="flex-1">{section.title}</span>
          {section.path === '/content' && open > 0 ? (
            <span
              title="Пачки Агента, не перевірені"
              className="rounded-full bg-warn-soft px-[7px] py-px font-mono text-[11px] font-semibold text-warn"
            >
              {open}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
