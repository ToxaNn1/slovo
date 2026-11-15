import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useSearch } from '@tanstack/react-router';

import { ContentReview } from '../components/content-review/content-review';
import { editionsQuery } from '../queries';

export const Route = createFileRoute('/content/review')({
  component: Review,
});

/** Перегляд: the records not checked yet of the Edition the filter names, else of the first Edition. */
function Review() {
  const search = useSearch({ from: '__root__' });
  const editions = useQuery(editionsQuery);
  const editionId = search.edition ?? editions.data?.editions[0]?.id;
  return (
    <section aria-label="Перегляд" className="flex flex-col gap-6">
      {editionId !== undefined && <ContentReview key={editionId} editionId={editionId} />}
    </section>
  );
}
