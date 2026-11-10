import type { AnalyticsCount } from '@slovo/contracts/admin-api';
import type { ReactNode } from 'react';

/**
 * A chart of counts as horizontal bars, one row per key, the longest bar the
 * largest count; with no row, «Немає даних». The figure is named by `label`;
 * a `note` closes it, inside the card.
 */
export function BarList({
  label,
  rows,
  keyLabel = (key) => key,
  note,
}: {
  readonly label: string;
  readonly rows: readonly AnalyticsCount[];
  readonly keyLabel?: (key: string) => string;
  readonly note?: ReactNode;
}) {
  const largest = Math.max(1, ...rows.map(({ count }) => count));
  return (
    <figure
      aria-label={label}
      className="flex flex-col gap-3 rounded-2xl bg-surface px-[18px] py-4 shadow-panel"
    >
      <figcaption className="font-display text-[13px] font-medium">{label}</figcaption>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Немає даних</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {rows.map(({ key, count }) => (
            <li key={key} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="truncate">{keyLabel(key)}</span>
              <span className="h-2.5 rounded-full bg-sunk">
                <span
                  className="block h-2.5 rounded-full bg-primary"
                  style={{ width: `${String((count / largest) * 100)}%` }}
                />
              </span>
              <span className="text-right font-mono text-xs font-semibold tabular-nums">
                {count}
              </span>
            </li>
          ))}
        </ul>
      )}
      {note !== undefined && <p className="mt-auto text-sm text-muted-foreground">{note}</p>}
    </figure>
  );
}
