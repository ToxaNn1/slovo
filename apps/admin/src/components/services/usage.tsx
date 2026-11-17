import { nearLimit, type LimitUsage, type ServiceUsage } from '@slovo/contracts/admin-api';

import { formatMoment } from '../../format';
import { Button } from '../ui/button';

/** What a Service's usage read answered. */
export type UsageAnswer = ServiceUsage['read'];

/** The names of the limits and units the usage ports answer, as the owner reads them. */
const WORDS: Readonly<Record<string, string>> = {
  errors: 'Помилки',
  events: 'Події',
  spend: 'Витрати',
  compute: 'Обчислення',
  storage: 'Сховище',
  egress: 'Вихідний трафік',
  minutes: 'Хвилини Actions',
  'r2-storage': 'Сховище R2',
  'r2-class-a': 'Операції R2 класу A',
  'r2-class-b': 'Операції R2 класу B',
  'worker-requests': 'Запити Worker за сьогодні',
};
const UNITS: Readonly<Record<string, string>> = {
  events: 'подій',
  'CU-hours': 'CU-год',
  GB: 'ГБ',
  minutes: 'хв',
  operations: 'операцій',
  requests: 'запитів',
};

const labelOf = (name: string) => WORDS[name] ?? name;
const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 1 });

/** The limits a reading has a bar for: a Cron has none. */
function limitsOf(read: UsageAnswer): readonly LimitUsage[] {
  return read.state === 'read' && read.reading.kind !== 'cron' ? read.reading.usage : [];
}

/** Whether a limit of the reading is used to 90 % or more: the block's yellow mark (ADR 0164). */
export const nearLimitOf = (read: UsageAnswer | undefined) =>
  read !== undefined && limitsOf(read).some(nearLimit);

/** The yellow mark of a Service at 90 % of a limit or more. */
function NearLimitMark({ read }: { readonly read: UsageAnswer }) {
  if (!nearLimitOf(read)) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-warn">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      Ліміт майже вичерпано
    </span>
  );
}

/** The minutes from now until the moment, rounded up, none below zero. */
const minutesUntil = (iso: string, now: Date) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000));

/**
 * A Railway service's or a Cron's state lines (ADR 0164): «Online» or
 * «Offline», or whether the Cron's last run succeeded and when the next is.
 */
function StateLines({ read }: { readonly read: UsageAnswer }) {
  if (read.state !== 'read' || read.reading.kind === 'metered') return null;
  const { reading } = read;
  if (reading.kind === 'railway') {
    const online = reading.state === 'online';
    return (
      <span
        className={`flex items-center gap-1.5 text-xs ${online ? 'text-ok' : 'text-destructive'}`}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        {online ? 'Online' : 'Offline'}
      </span>
    );
  }
  const { lastRun, nextRunAt } = reading;
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span
        className={
          lastRun === null
            ? 'text-muted-foreground'
            : lastRun.succeeded
              ? 'text-ok'
              : 'text-destructive'
        }
      >
        {lastRun === null
          ? 'Ще не запускався'
          : lastRun.succeeded
            ? 'Останній запуск успішний'
            : 'Останній запуск невдалий'}
      </span>
      {nextRunAt === null ? null : (
        <span className="text-muted-foreground">
          {`Наступний через ${String(minutesUntil(nextRunAt, new Date()))} хв`}
        </span>
      )}
    </span>
  );
}

/** One limit's bar, as full as the share of it used. */
function Bar({ usage }: { readonly usage: LimitUsage }) {
  const share = Math.min(1, usage.used / usage.limit);
  return (
    <div
      role="meter"
      aria-label={labelOf(usage.name)}
      aria-valuemin={0}
      aria-valuemax={usage.limit}
      aria-valuenow={usage.used}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`h-full rounded-full ${nearLimit(usage) ? 'bg-warn' : 'bg-ok'}`}
        style={{ width: `${String(share * 100)}%` }}
      />
    </div>
  );
}

/**
 * The usage on a block (ADR 0164): the state lines, a bar per limit with its share, a mark when
 * the reading is stale, or «не вдалося прочитати» while no read succeeded.
 */
export function BlockUsage({ id, read }: { readonly id: string; readonly read: UsageAnswer }) {
  if (read.state === 'unavailable') {
    return (
      <span id={id} className="text-xs text-muted-foreground">
        не вдалося прочитати
      </span>
    );
  }
  return (
    <span id={id} className="flex w-full flex-col gap-1">
      <NearLimitMark read={read} />
      <StateLines read={read} />
      {limitsOf(read).map((usage) => (
        <span key={usage.name} className="flex items-center gap-2">
          <Bar usage={usage} />
          <span className="flex-none text-[11px] tabular-nums text-muted-foreground">
            {Math.round((usage.used / usage.limit) * 100)}%
          </span>
        </span>
      ))}
      {read.stale ? <span className="text-[11px] text-warn">застаріло</span> : null}
    </span>
  );
}

/**
 * The usage in a Service's panel: each limit's numbers, the read time, the
 * stale mark, and «Оновити», which reads the provider again.
 */
export function PanelUsage({
  read,
  refreshing,
  onRefresh,
}: {
  readonly read: UsageAnswer;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}) {
  return (
    <section aria-label="Використання" className="flex flex-col gap-2 text-sm">
      {read.state === 'unavailable' ? (
        <p className="text-muted-foreground">Використання: не вдалося прочитати.</p>
      ) : (
        <>
          <NearLimitMark read={read} />
          <StateLines read={read} />
          {limitsOf(read).map((usage) => (
            <div key={usage.name} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{labelOf(usage.name)}</span>
              <span className="tabular-nums">
                {`${number(usage.used)} з ${number(usage.limit)} ${UNITS[usage.unit] ?? usage.unit}`}
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Прочитано {formatMoment(read.readAt)}
            {read.stale ? ' · застаріло: останнє читання не вдалося' : ''}
          </p>
        </>
      )}
      <div>
        <Button variant="secondary" disabled={refreshing} onClick={onRefresh}>
          Оновити
        </Button>
      </div>
    </section>
  );
}
