import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import { ContentEditor } from '../components/content-editor/content-editor';
import { sectionAt } from '../sections';

export const Route = createFileRoute('/content/')({
  component: Records,
});

/** Записи: the content editor of the Edition the filter names, else of the first Edition. */
function Records() {
  const search = useSearch({ from: '__root__' });
  const editions = useQuery({ queryKey: ['editions'], queryFn: () => adminApi.editions() });
  const editionId = search.edition ?? editions.data?.editions[0]?.id;
  return (
    <section aria-labelledby="section-title" className="flex flex-col gap-6">
      <h1 id="section-title" className="font-display text-2xl font-semibold">
        {sectionAt('/content').title}
      </h1>
      {editionId !== undefined && <ContentEditor key={editionId} editionId={editionId} />}
    </section>
  );
}
