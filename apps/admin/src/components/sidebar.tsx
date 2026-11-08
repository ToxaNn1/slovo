import { Link } from '@tanstack/react-router';

import { SECTIONS } from '../sections';

/** The seven sections; a link keeps the global filters of the URL. */
export function Sidebar() {
  return (
    <nav aria-label="Розділи" className="flex flex-col gap-1">
      {SECTIONS.map((section) => (
        <Link
          key={section.path}
          to={section.path}
          search={(previous) => previous}
          activeOptions={{ exact: section.path === '/', includeSearch: false }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
        >
          {section.title}
        </Link>
      ))}
    </nav>
  );
}
