import { Link } from '@tanstack/react-router';

import { sectionsOf } from '../sections';
import { useQueueBatches } from './content-queue/queries';

/**
 * The sections of the role; a link keeps the global filters of the URL.
 * Контент counts the Агент batches not reviewed yet for the Edition filter.
 */
export function Sidebar({ role }: { readonly role: 'owner' | 'admin' }) {
  const open = useQueueBatches().data?.batches.length ?? 0;
  return (
    <nav aria-label="Розділи" className="flex flex-col gap-1">
      {sectionsOf(role).map((section) => (
        <Link
          key={section.path}
          to={section.path}
          search={(previous) => previous}
          activeOptions={{ exact: section.path === '/', includeSearch: false }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
        >
          {section.title}
          {section.path === '/content' && open > 0 ? (
            <span className="ml-2 rounded-full bg-primary px-2 text-xs text-primary-foreground">
              {open}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
