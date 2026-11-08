import type { AdminApiOutputs, QualityKpi } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { adminApi } from '../api';
import { DEFAULT_PERIOD, qualityPeriod } from '../filters';

export const Route = createFileRoute('/quality')({
  component: Quality,
});

type Kpis = AdminApiOutputs['quality']['kpis'];
type CiRun = AdminApiOutputs['ciHistory']['runs'][number];

/** The tiles of Якість, in order: each with its title and unit. */
const TILES: readonly { key: keyof Kpis; title: string; unit: string }[] = [
  { key: 'crashFree', title: 'Без збоїв', unit: '%' },
  { key: 'crashes', title: 'Збої', unit: '' },
  { key: 'errors', title: 'Помилки', unit: '' },
  { key: 'newIssues', title: 'Нові помилки', unit: '' },
  { key: 'backendP95', title: 'p95 бекенду', unit: ' мс' },
  { key: 'appStart', title: 'Запуск застосунку', unit: ' мс' },
];

const NO_DATA = 'Немає даних';

const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 1 });

const time = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

/** The change against the day before, signed. */
function delta(value: number, yesterday: number) {
  const change = value - yesterday;
  return `${change > 0 ? '+' : change < 0 ? '−' : '±'}${number(Math.abs(change))} проти вчора`;
}

/** Якість: the Sentry numbers of the period, and the CI history of `main`. */
function Quality() {
  const search = useSearch({ from: '__root__' });
  const period = qualityPeriod(search.period ?? DEFAULT_PERIOD);
  const quality = useQuery({
    queryKey: ['quality', search.edition, period],
    queryFn: () => adminApi.quality({ editionId: search.edition, period }),
    retry: false,
  });
  const ci = useQuery({
    queryKey: ['ciHistory', period],
    queryFn: () => adminApi.ciHistory({ period }),
    retry: false,
  });
  const fetched = quality.data ? freshness(quality.data.kpis) : undefined;

  return (
    <section aria-labelledby="section-title" className="flex flex-col gap-6">
      <h1 id="section-title" className="font-display text-2xl font-semibold">
        Якість
      </h1>
      {quality.isError ? <Notice>Sentry недоступний</Notice> : null}
      {fetched === undefined ? null : (
        <p className="text-sm text-muted-foreground">Останні дані за {time(fetched)}</p>
      )}
      {quality.data ? (
        <ul aria-label="Показники" className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {TILES.map((tile) => (
            <Tile
              key={tile.key}
              id={tile.key}
              title={tile.title}
              unit={tile.unit}
              kpi={quality.data.kpis[tile.key]}
            />
          ))}
        </ul>
      ) : null}
      {ci.isError ? <Notice>GitHub недоступний</Notice> : null}
      {ci.data ? <CiCharts runs={ci.data.runs} /> : null}
    </section>
  );
}

/** When the oldest number shown was read of Sentry. */
function freshness(kpis: Kpis): string | undefined {
  const times = Object.values(kpis).flatMap((kpi) => (kpi.state === 'ok' ? [kpi.fetchedAt] : []));
  return times.sort()[0];
}

function Notice({ children }: { readonly children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      {children}
    </p>
  );
}

function Tile({
  id,
  title,
  unit,
  kpi,
}: {
  readonly id: keyof Kpis;
  readonly title: string;
  readonly unit: string;
  readonly kpi: QualityKpi;
}) {
  return (
    <li
      aria-label={title}
      className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3"
    >
      <span className="text-sm text-muted-foreground">{title}</span>
      <TileValue kpi={kpi} unit={unit} isNewIssues={id === 'newIssues'} />
    </li>
  );
}

function TileValue({
  kpi,
  unit,
  isNewIssues,
}: {
  readonly kpi: QualityKpi;
  readonly unit: string;
  readonly isNewIssues: boolean;
}) {
  if (kpi.state === 'unavailable') return <span className="text-sm">Sentry недоступний</span>;
  if (kpi.value === null) return <span className="text-sm">{NO_DATA}</span>;
  if (isNewIssues && kpi.value === 0) return <span className="text-sm">Нових помилок немає</span>;
  return (
    <>
      <span className="font-display text-2xl font-semibold">
        {number(kpi.value)}
        {unit}
      </span>
      {kpi.yesterday === null ? null : (
        <span className="text-xs text-muted-foreground">{delta(kpi.value, kpi.yesterday)}</span>
      )}
    </>
  );
}

/** «Покриття», «Нестабільні тести» and «Тривалість CI» of the CI runs of the period. */
function CiCharts({ runs }: { readonly runs: readonly CiRun[] }) {
  const latest = runs.at(-1);
  const flaky = new Map<string, number>();
  for (const run of runs)
    for (const test of run.flakyTests) flaky.set(test, (flaky.get(test) ?? 0) + 1);
  const durations = runs.map((run) => ({
    label: `${run.sha.slice(0, 7)} · ${time(run.at)}`,
    seconds: run.jobs.reduce((total, job) => total + job.seconds, 0),
  }));
  const longest = Math.max(1, ...durations.map((run) => run.seconds));

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Chart title="Покриття">
        {latest === undefined || latest.coverage.length === 0
          ? null
          : latest.coverage.map((item) => (
              <BarRow
                key={item.package}
                label={item.package}
                text={`${number(item.lines)}%`}
                share={item.lines / 100}
              />
            ))}
      </Chart>
      <Chart title="Нестабільні тести">
        {runs.length === 0
          ? null
          : flaky.size === 0
            ? [
                <li key="none" className="text-sm">
                  Нестабільних тестів немає
                </li>,
              ]
            : [...flaky].map(([test, count]) => (
                <li key={test} className="text-sm">
                  {test} · {count}
                </li>
              ))}
      </Chart>
      <Chart title="Тривалість CI">
        {durations.length === 0
          ? null
          : durations.map((run) => (
              <BarRow
                key={run.label}
                label={run.label}
                text={`${number(run.seconds / 60)} хв`}
                share={run.seconds / longest}
              />
            ))}
      </Chart>
    </div>
  );
}

function Chart({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode[] | null;
}) {
  return (
    <figure
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <figcaption className="font-display font-medium">{title}</figcaption>
      {children === null ? (
        <p className="text-sm text-muted-foreground">{NO_DATA}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </figure>
  );
}

function BarRow({
  label,
  text,
  share,
}: {
  readonly label: string;
  readonly text: string;
  readonly share: number;
}) {
  return (
    <li className="flex flex-col gap-1 text-sm">
      <span>
        {label} · {text}
      </span>
      <span aria-hidden className="h-2 rounded-full bg-border">
        <span
          className="block h-2 rounded-full bg-primary"
          style={{ width: `${String(Math.round(Math.min(1, share) * 100))}%` }}
        />
      </span>
    </li>
  );
}
