import { createFileRoute } from '@tanstack/react-router';

import { EmptyState } from '../components/empty-state';
import { sectionAt } from '../sections';
import { useSignedInAdmin } from '../session';

export const Route = createFileRoute('/security')({
  component: Security,
});

/** Безпека: a Власник only; an Адмін reads why it stays closed. */
function Security() {
  const admin = useSignedInAdmin();
  if (admin?.role !== 'owner') {
    return (
      <section aria-labelledby="section-title" className="flex flex-col gap-2">
        <h1 id="section-title" className="font-display text-2xl font-semibold">
          Безпека
        </h1>
        <p className="text-sm text-muted-foreground">Безпека відкрита лише Власнику.</p>
      </section>
    );
  }
  return <EmptyState section={sectionAt('/security')} />;
}
