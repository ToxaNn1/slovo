import type { ReaderCounts as Counts } from '@slovo/contracts/admin-api';
import type { ReactNode } from 'react';

const number = (value: number) => value.toLocaleString('uk-UA');

/** One count of readers: its name, the number, and one line saying what it counts. */
function Count({
  label,
  explanation,
  children,
}: {
  readonly label: string;
  readonly explanation: string;
  readonly children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
      <span className="text-xs text-muted-foreground">{explanation}</span>
    </li>
  );
}

const Figure = ({ children }: { readonly children: ReactNode }) => (
  <span className="font-display text-2xl font-semibold tabular-nums">{children}</span>
);

/**
 * How many people read SLOVO (ADR 0163): the registered readers of every
 * Edition, the unregistered ones at least, and the switch-offs of statistics.
 */
export function ReaderCounts({ counts }: { readonly counts: Counts }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-surface px-[18px] py-4 shadow-panel">
      <h2 className="font-display text-[13px] font-medium">Читачі</h2>
      <ul aria-label="Читачі" className="grid gap-4 md:grid-cols-3">
        <Count
          label="Зареєстровані"
          explanation="Читачі з SLOVO ID. Фільтр видання на це число не діє: тут усі SLOVO ID."
        >
          <Figure>{number(counts.registered)}</Figure>
        </Count>
        <Count
          label="Без реєстрації, щонайменше"
          explanation="Активні за останній день у PostHog мінус зареєстровані. Оцінка знизу: PostHog бачить лише тих, хто ділиться статистикою."
        >
          {counts.unregisteredAtLeast === null ? (
            <span role="status" className="font-medium text-destructive">
              PostHog недоступний
            </span>
          ) : (
            <Figure>щонайменше {number(counts.unregisteredAtLeast)}</Figure>
          )}
        </Count>
        <Count
          label="Вимкнули статистику"
          explanation="Скільки разів «Ділитися анонімною статистикою» вимкнули за період. Кожне вимкнення окремо, а не скільки читачів мають її вимкненою зараз."
        >
          <Figure>{number(counts.statisticsOff)}</Figure>
        </Count>
      </ul>
    </div>
  );
}
