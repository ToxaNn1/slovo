import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminApi } from '../api';

const OWNER_CHECKS_KEY = ['owner-checks'];

/** Newest milestone first: `1.0` before `0.10` before `0.9`. */
const byVersionDesc = (a: string, b: string) => {
  const [aMajor = 0, aMinor = 0] = a.split('.').map(Number);
  const [bMajor = 0, bMinor = 0] = b.split('.').map(Number);
  return bMajor - aMajor || bMinor - aMinor;
};

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('uk-UA');

/** The Owner checks per version: one click ticks a check, with no reason (ADR 0088). */
export function OwnerChecks() {
  const queryClient = useQueryClient();
  const checks = useQuery({ queryKey: OWNER_CHECKS_KEY, queryFn: () => adminApi.ownerChecks({}) });
  const tick = useMutation({
    mutationFn: (id: number) => adminApi.tickOwnerCheck({ id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OWNER_CHECKS_KEY }),
  });

  if (!checks.data) return null;
  const { open } = checks.data;
  const versions = [...new Set(checks.data.checks.map(({ version }) => version))].sort(
    byVersionDesc,
  );

  return (
    <section aria-labelledby="owner-checks-title" className="flex flex-col gap-4">
      <h2 id="owner-checks-title" className="font-display text-lg font-semibold">
        Перевірки власника
      </h2>
      {versions.length === 0 && <p className="text-sm text-muted-foreground">Перевірок ще немає</p>}
      {versions.map((version) => {
        const openCount = open[version] ?? 0;
        return (
          <section
            key={version}
            aria-labelledby={`owner-checks-${version}`}
            className="flex flex-col gap-3 rounded-2xl bg-surface shadow-panel p-5"
          >
            <header className="flex items-baseline justify-between gap-4">
              <h3 id={`owner-checks-${version}`} className="font-display text-base font-semibold">
                {version}
              </h3>
              <p className="text-sm text-muted-foreground">
                {openCount === 0 ? 'усе перевірено' : `відкрито ${String(openCount)}`}
              </p>
            </header>
            <ul className="flex flex-col gap-2">
              {checks.data.checks
                .filter((check) => check.version === version)
                .map((check) => (
                  <li key={check.id}>
                    <label className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={check.ticked !== null}
                        disabled={check.ticked !== null || tick.isPending}
                        onChange={() => {
                          tick.mutate(check.id);
                        }}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span>{check.text}</span>
                        {check.ticked && (
                          <span className="text-xs text-muted-foreground">
                            позначив {check.ticked.by} {dateOf(check.ticked.at)}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
