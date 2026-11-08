import { createFileRoute } from '@tanstack/react-router';

import { OwnerChecks } from '../components/owner-checks';
import { sectionAt } from '../sections';

const section = sectionAt('/development');

export const Route = createFileRoute('/development')({
  component: () => (
    <section aria-labelledby="section-title" className="flex flex-1 flex-col gap-6">
      <h1 id="section-title" className="font-display text-2xl font-semibold">
        {section.title}
      </h1>
      <OwnerChecks />
      <p className="text-sm text-muted-foreground">{section.empty}</p>
    </section>
  ),
});
