import { ALL_EDITIONS } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import { analyticsQuery, readerCountsQuery } from '../queries';
import { BarList } from '../components/bar-list';
import { CommunityCounters } from '../components/counters';
import { ReaderCounts } from '../components/reader-counts';
import { VariantResult } from '../components/variant-result';
import { DEFAULT_PERIOD, periodDays } from '../filters';

export const Route = createFileRoute('/analytics')({
  component: Analytics,
});

/** A time as `HH:mm` in Kyiv. */
const kyivTime = (iso: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/** A day `YYYY-MM-DD` as `DD.MM`. */
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

const duration = (seconds: number) =>
  `${String(Math.floor(seconds / 60))} хв ${String(seconds % 60)} с`;

/** The ids of the Editions read: the one chosen, or every Edition. */
async function editionIdsOf(edition: string | undefined): Promise<string[]> {
  return edition === undefined
    ? (await adminApi.editions()).editions.map(({ id }) => id)
    : [edition];
}

/** The A/B Feature Switches of the Editions read: those with a Rule of Variants. */
async function variantFeatures(edition: string | undefined): Promise<string[]> {
  const editionIds = await editionIdsOf(edition);
  const switches = await Promise.all(
    editionIds.map((editionId) => adminApi.switches({ editionId })),
  );
  const features = switches.flatMap(({ rules }) =>
    rules.filter(({ verdict }) => typeof verdict === 'object').map(({ feature }) => feature),
  );
  return [...new Set(features)];
}

/**
 * Аналітика: the reader counts, the Edition's aggregates from PostHog over
 * the period, the Community Counters, and the result of each A/B Feature Switch. Countries
 * stay «Немає даних»: the app sends no location (ADR 0068).
 */
function Analytics() {
  const search = useSearch({ from: '__root__' });
  const editionId = search.edition ?? ALL_EDITIONS;
  const days = periodDays(search.period ?? DEFAULT_PERIOD, new Date());
  const overview = useQuery(analyticsQuery(editionId, days));
  const readers = useQuery(readerCountsQuery(editionId, days));
  const counters = useQuery({
    queryKey: ['counters', editionId],
    queryFn: () => adminApi.counters({ editionId }),
  });
  // The Editions' questionnaire options name the counted answers.
  const cards = useQuery({
    queryKey: ['editionCards', search.edition],
    queryFn: async () =>
      Promise.all(
        (await editionIdsOf(search.edition)).map((id) => adminApi.editionCard({ editionId: id })),
      ),
  });
  const features = useQuery({
    queryKey: ['variantFeatures', search.edition],
    queryFn: () => variantFeatures(search.edition),
  });
  const data = overview.data;
  return (
    <section aria-label="Аналітика" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {data !== undefined && (
          <p className="text-sm text-muted-foreground">
            Останні дані за {kyivTime(data.fetchedAt)}
          </p>
        )}
      </div>
      {readers.data !== undefined && <ReaderCounts counts={readers.data} />}
      {overview.isError && <p className="text-sm text-destructive">PostHog недоступний</p>}
      {overview.isPending && <p className="text-sm text-muted-foreground">Завантаження…</p>}
      {data !== undefined && (
        <div className="grid gap-4 md:grid-cols-2">
          <BarList label="Активні за днями" rows={data.activeByDay} keyLabel={shortDay} />
          <BarList
            label="Відвідини"
            rows={data.visitsByDay}
            keyLabel={shortDay}
            note={`Медіана відвідин: ${duration(data.medianVisitSeconds)}`}
          />
          <BarList label="Країни" rows={[]} />
          <BarList label="Пристрої" rows={data.devices} />
          <BarList label="Версії застосунку" rows={data.appVersions} />
        </div>
      )}
      {counters.data !== undefined && (
        <CommunityCounters counters={counters.data} cards={cards.data ?? []} />
      )}
      <div className="flex flex-col gap-3">
        <h2 className="font-display text-[15px] font-medium">Варіанти</h2>
        {features.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Немає A/B-тестів</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {(features.data ?? []).map((feature) => (
            <VariantResult key={feature} editionId={editionId} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
