import { ALL_EDITIONS, type QualityKpi } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { adminApi } from '../../api';
import { analyticsQuery, qualityQuery } from '../../queries';
import { DEFAULT_PERIOD, periodDays, qualityPeriod } from '../../filters';
import { useWide } from '../../screen-width';
import { useSignedInAdmin } from '../../session';
import { useQueueBatches } from '../content-queue/queries';
import { CiBadge } from '../development/blocks';

/** A time as `HH:mm` in Kyiv. */
const kyivTime = (iso: string) =>
  new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

const kyivDateTime = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 1 });

/** What a block shows of its source: still loading, unavailable, or read at a time. */
type Read =
  | { readonly state: 'pending' }
  | { readonly state: 'unavailable'; readonly text: string }
  | { readonly state: 'ok'; readonly fetchedAt?: string };

function readOf(
  query: { readonly isPending: boolean; readonly isError: boolean },
  unavailable: string,
  fetchedAt?: string,
): Read {
  if (query.isError) return { state: 'unavailable', text: unavailable };
  if (query.isPending) return { state: 'pending' };
  return fetchedAt === undefined ? { state: 'ok' } : { state: 'ok', fetchedAt };
}

const Quiet = ({ children }: { readonly children: ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

/** One block of Огляд: its title, what it reads, and the time its source was read. */
function Block({
  title,
  read,
  children,
}: {
  readonly title: string;
  readonly read: Read;
  readonly children?: ReactNode;
}) {
  return (
    <li className="flex">
      <section
        aria-label={title}
        className="flex flex-1 flex-col gap-2 rounded-2xl bg-surface shadow-panel p-5"
      >
        <h2 className="text-sm text-muted-foreground">{title}</h2>
        {read.state === 'unavailable' ? (
          <p role="status" className="font-medium text-destructive">
            {read.text}
          </p>
        ) : null}
        {read.state === 'ok' ? children : null}
        {read.state === 'ok' && read.fetchedAt !== undefined ? (
          <p className="mt-auto text-xs text-muted-foreground">
            Останні дані за {kyivTime(read.fetchedAt)}
          </p>
        ) : null}
      </section>
    </li>
  );
}

const Figure = ({ children }: { readonly children: ReactNode }) => (
  <p className="font-display text-2xl font-semibold">{children}</p>
);

/** A Sentry number of Якість, or why there is none. */
function KpiValue({ kpi, unit = '' }: { readonly kpi: QualityKpi; readonly unit?: string }) {
  if (kpi.state === 'unavailable') return <Quiet>Sentry недоступний</Quiet>;
  if (kpi.value === null) return <Quiet>Немає даних</Quiet>;
  return (
    <Figure>
      {number(kpi.value)}
      {unit}
    </Figure>
  );
}

/** A day `YYYY-MM-DD` as `DD.MM`. */
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;

/**
 * Огляд: whether today is fine, for the global Edition and period, each block
 * from the procedure its section reads: PostHog of Аналітика, Sentry of
 * Якість, CI on `main` of Розробка, the open batches of the Content queue,
 * and the latest alerts the owner was told of (a Власник reads them).
 */
export function Overview() {
  const search = useSearch({ from: '__root__' });
  const period = search.period ?? DEFAULT_PERIOD;
  const editionId = search.edition ?? ALL_EDITIONS;
  const days = periodDays(period, new Date());
  const owner = useSignedInAdmin()?.role === 'owner';
  const wide = useWide();

  const analytics = useQuery(analyticsQuery(editionId, days));
  const quality = useQuery(qualityQuery({ editionId: search.edition, period: qualityPeriod(period) }));
  const development = useQuery({
    queryKey: ['development'],
    queryFn: () => adminApi.development(),
  });
  const batches = useQueueBatches();
  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => adminApi.latestAlerts(),
    enabled: owner,
  });

  const posthog = readOf(analytics, 'PostHog недоступний', analytics.data?.fetchedAt);
  const newestActive = analytics.data?.activeByDay.at(-1);
  const visits = (analytics.data?.visitsByDay ?? []).reduce((sum, { count }) => sum + count, 0);
  const kpis = quality.data?.kpis;
  const sentry = (kpi: QualityKpi | undefined) =>
    readOf(quality, 'Sentry недоступний', kpi?.state === 'ok' ? kpi.fetchedAt : undefined);
  const github = development.data?.github;
  const ci: Read =
    github === undefined
      ? readOf(development, 'GitHub недоступний')
      : github.state === 'ok'
        ? { state: 'ok', fetchedAt: github.fetchedAt }
        : { state: 'unavailable', text: 'GitHub недоступний' };
  const latest = alerts.data?.alerts ?? [];

  return (
    <section aria-label="Огляд" className="flex flex-col gap-6">
      <ul
        aria-label="Блоки"
        data-layout={wide ? 'grid' : 'stack'}
        className={wide ? 'grid gap-4 lg:grid-cols-2 xl:grid-cols-4' : 'flex flex-col gap-3'}
      >
        <Block title="Активні люди" read={posthog}>
          {newestActive === undefined ? (
            <Quiet>Немає даних</Quiet>
          ) : (
            <>
              <Figure>{number(newestActive.count)}</Figure>
              <Quiet>за {shortDay(newestActive.key)}</Quiet>
            </>
          )}
        </Block>
        <Block title="Відвідини" read={posthog}>
          <Figure>{number(visits)}</Figure>
        </Block>
        <Block title="Збої" read={sentry(kpis?.crashes)}>
          {kpis ? <KpiValue kpi={kpis.crashes} /> : null}
        </Block>
        <Block title="Помилки" read={sentry(kpis?.errors)}>
          {kpis ? <KpiValue kpi={kpis.errors} /> : null}
        </Block>
        <Block title="p95 бекенду" read={sentry(kpis?.backendP95)}>
          {kpis ? <KpiValue kpi={kpis.backendP95} unit=" мс" /> : null}
        </Block>
        <Block title="CI на main" read={ci}>
          {github?.state === 'ok' ? <CiBadge ci={github.mainCi} /> : null}
        </Block>
        <Block title="Відкриті пачки" read={readOf(batches, 'Черга контенту недоступна')}>
          <Figure>{batches.data?.batches.length ?? 0}</Figure>
          <ul className="flex flex-col gap-1 text-sm">
            {(batches.data?.batches ?? []).slice(0, 3).map((batch) => (
              <li key={batch.id}>
                {batch.author}: +{batch.added}, змінено {batch.changed}
              </li>
            ))}
          </ul>
          <Link
            to="/content/queue"
            search={(previous) => previous}
            className="text-sm font-medium text-primary hover:underline"
          >
            До Черги контенту
          </Link>
        </Block>
        {owner ? (
          <Block title="Останні сповіщення" read={readOf(alerts, 'Сповіщення недоступні')}>
            {latest.length === 0 ? (
              <Quiet>Сповіщень немає</Quiet>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {latest.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="flex flex-col">
                    <span className="whitespace-pre-line">{alert.text}</span>
                    <span className="text-muted-foreground">
                      {kyivDateTime(alert.at)}
                      {alert.sentAt === null ? ' · не надіслано' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        ) : null}
      </ul>
    </section>
  );
}
