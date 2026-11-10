import { ALL_EDITIONS } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import { BarList } from '../components/bar-list';
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

/** The A/B Feature Switches of the Editions read: those with a Rule of Variants. */
async function variantFeatures(edition: string | undefined): Promise<string[]> {
  const editionIds =
    edition === undefined ? (await adminApi.editions()).editions.map(({ id }) => id) : [edition];
  const switches = await Promise.all(
    editionIds.map((editionId) => adminApi.switches({ editionId })),
  );
  const features = switches.flatMap(({ rules }) =>
    rules.filter(({ verdict }) => typeof verdict === 'object').map(({ feature }) => feature),
  );
  return [...new Set(features)];
}

/**
 * Аналітика: the Edition's aggregates from PostHog over the period, the
 * Community Counters, and the result of each A/B Feature Switch. Countries
 * stay «Немає даних»: the app sends no location (ADR 0068).
 */
function Analytics() {
  const search = useSearch({ from: '__root__' });
  const editionId = search.edition ?? ALL_EDITIONS;
  const days = periodDays(search.period ?? DEFAULT_PERIOD, new Date());
  const overview = useQuery({
    queryKey: ['analytics', editionId, days],
    queryFn: () => adminApi.analytics({ editionId, ...days }),
    // PostHog down answers at once: the backend queues and caches its reads already.
    retry: false,
  });
  const counters = useQuery({
    queryKey: ['counters', editionId],
    queryFn: () => adminApi.counters({ editionId }),
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
        <div className="flex flex-col gap-3 rounded-2xl bg-surface px-[18px] py-4 shadow-panel">
          <h2 className="font-display text-[13px] font-medium">Лічильники</h2>
          <ul aria-label="Лічильники" className="flex flex-col gap-1.5 text-sm">
            <li>Знаю: {counters.data.known}</li>
            <li>Не знаю: {counters.data.unknown}</li>
            <li>Збережено: {counters.data.saved}</li>
            {counters.data.answers.map(({ question, answer, count }) => (
              <li key={`${question}-${answer}`}>
                {question} · {answer}: {count}
              </li>
            ))}
          </ul>
        </div>
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
