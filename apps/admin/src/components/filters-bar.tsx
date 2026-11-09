import { useQuery } from '@tanstack/react-query';
import { useMatchRoute, useNavigate, useSearch } from '@tanstack/react-router';

import { adminApi } from '../api';
import {
  DEFAULT_PERIOD,
  FiltersSchema,
  PERIOD_LABELS,
  PERIODS,
  QUALITY_CAP_HINT,
  qualityPeriod,
} from '../filters';

const ALL_EDITIONS = '';

const selectClass =
  'h-9 rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

/** The global Edition and period filters, written to the URL. */
export function FiltersBar() {
  const search = useSearch({ from: '__root__' });
  const navigate = useNavigate();
  // Якість reads Sentry, which keeps 30 days: a longer period reads as 30 days there.
  const onQuality = Boolean(useMatchRoute()({ to: '/quality' }));
  const chosen = search.period ?? DEFAULT_PERIOD;
  const period = onQuality ? qualityPeriod(chosen) : chosen;
  const editions = useQuery({ queryKey: ['editions'], queryFn: () => adminApi.editions() });

  const choose = (patch: Record<string, string | undefined>) =>
    void navigate({
      to: '.',
      search: (previous) => FiltersSchema.parse({ ...previous, ...patch }),
    });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Edition</span>
        <select
          className={selectClass}
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
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Період</span>
        <select
          className={selectClass}
          value={period}
          onChange={(event) => {
            choose({ period: event.target.value });
          }}
        >
          {PERIODS.map((option) => (
            <option
              key={option}
              value={option}
              disabled={onQuality && qualityPeriod(option) !== option}
            >
              {PERIOD_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      {period === chosen ? null : (
        <span className="text-sm text-muted-foreground">{QUALITY_CAP_HINT}</span>
      )}
    </div>
  );
}
