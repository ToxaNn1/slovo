import { useQuery } from '@tanstack/react-query';
import { useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import {
  DEFAULT_PERIOD,
  FILTERS_OFF_HINT,
  FiltersSchema,
  PERIOD_LABELS,
  PERIODS,
  QUALITY_CAP_HINT,
  qualityPeriod,
} from '../filters';

const ALL_EDITIONS = '';

/** The label of the Edition filter's choice: an Edition's name or «Усі Editions». */
export function useEditionLabel(): string {
  const search = useSearch({ from: '__root__' });
  const editions = useQuery({ queryKey: ['editions'], queryFn: () => adminApi.editions() });
  if (search.edition === undefined) return 'Усі Editions';
  return (
    editions.data?.editions.find((edition) => edition.id === search.edition)?.displayName ??
    search.edition
  );
}

/** The global Edition and period filters, written to the URL. */
export function FiltersBar() {
  const search = useSearch({ from: '__root__' });
  const navigate = useNavigate();
  // Якість reads Sentry, which keeps 30 days: a longer period reads as 30 days there.
  const matchRoute = useMatchRoute();
  const onQuality = Boolean(matchRoute({ to: '/quality' }));
  // GitHub, EAS and the owner's own sessions belong to no Edition and no period.
  const off = Boolean(matchRoute({ to: '/development' }) || matchRoute({ to: '/sessions' }));
  const chosen = search.period ?? DEFAULT_PERIOD;
  const period = onQuality ? qualityPeriod(chosen) : chosen;
  const editions = useQuery({ queryKey: ['editions'], queryFn: () => adminApi.editions() });

  const choose = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '.',
      search: (previous) => FiltersSchema.parse({ ...previous, ...patch }),
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <fieldset disabled={off} className="flex flex-wrap items-center gap-2 disabled:opacity-35">
        <label className="relative flex items-center gap-2 rounded-[10px] bg-surface py-2 pr-7 pl-3 text-[13px] shadow-panel focus-within:outline-2 focus-within:outline-ring">
          <span className="text-subtle">Edition</span>
          <select
            className="appearance-none bg-transparent font-semibold text-foreground outline-none"
            value={search.edition ?? ALL_EDITIONS}
            onChange={(event) => {
              choose({
                edition: event.target.value === ALL_EDITIONS ? undefined : event.target.value,
              });
            }}
          >
            <option value={ALL_EDITIONS}>Усі Editions</option>
            {editions.data?.editions.map((edition) => (
              <option key={edition.id} value={edition.id}>
                {edition.displayName}
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 text-[11px] text-subtle"
          >
            ▾
          </span>
        </label>
        <div
          role="group"
          aria-label="Період"
          className="flex gap-0.5 rounded-[10px] bg-surface p-[3px] shadow-panel"
        >
          {PERIODS.map((option) => {
            const capped = onQuality && qualityPeriod(option) !== option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={period === option}
                disabled={capped}
                title={capped ? QUALITY_CAP_HINT : undefined}
                onClick={() => {
                  choose({ period: option });
                }}
                // A capped period dims on its own; a switched-off bar dims whole.
                className={`rounded-[7px] px-[11px] py-[5px] text-[12.5px] whitespace-nowrap text-muted-foreground aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground ${capped ? 'opacity-35' : ''}`}
              >
                {PERIOD_LABELS[option]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {off ? <span className="text-xs text-subtle">{FILTERS_OFF_HINT}</span> : null}
      {period === chosen ? null : <span className="text-xs text-subtle">{QUALITY_CAP_HINT}</span>}
    </div>
  );
}
