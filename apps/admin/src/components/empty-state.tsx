import type { Section } from '../sections';

/** A section before its own ticket fills it: its title and what will be here. */
export function EmptyState({ section }: { readonly section: Section }) {
  return (
    <section aria-labelledby="section-title" className="flex flex-1 flex-col gap-6">
      <h1 id="section-title" className="font-display text-2xl font-semibold">
        {section.title}
      </h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="font-display text-lg font-medium">Поки що порожньо</p>
        <p className="max-w-md text-sm text-muted-foreground">{section.empty}</p>
      </div>
    </section>
  );
}
