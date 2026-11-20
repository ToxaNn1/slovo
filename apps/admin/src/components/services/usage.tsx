import {
  nearLimit,
  type LimitUsage,
  type Service,
  type ServiceUsage,
} from '@slovo/contracts/admin-api';

import { formatWhen } from '../../format';
import { Button } from '../ui/button';
import { usd, useMoney } from './service-currency';

/** What a Service's usage read answered. */
export type UsageAnswer = ServiceUsage['read'];

/** The names of the limits the usage ports answer, as the owner reads them. */
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

/** What each limit counts, in a few plain words under its name. */
const HINTS: Readonly<Record<string, string>> = {
  errors: 'Помилки застосунку й сервера, які Sentry прийняв цього місяця',
  events: 'Події аналітики, які PostHog прийняв цього місяця',
  spend: 'Скільки Railway нарахував цього місяця з включених у тариф',
  compute: 'Час роботи бази даних цього місяця',
  storage: 'Скільки місця займає база даних',
  egress: 'Дані, які база віддала назовні цього місяця',
  minutes: 'Хвилини збірок і перевірок цього місяця',
  'r2-storage': 'Скільки місця займають файли в R2',
  'r2-class-a': 'Записи файлів у R2 цього місяця',
  'r2-class-b': 'Читання файлів з R2 цього місяця',
  'worker-requests': 'Запити до Worker сьогодні, ліміт скидається щодня',
};

/** The units of a count, as the owner reads them. */
const UNITS: Readonly<Record<string, string>> = {
  events: 'подій',
  'CU-hours': 'CU-год',
  minutes: 'хв',
  operations: 'операцій',
  requests: 'запитів',
};

const labelOf = (name: string) => WORDS[name] ?? name;

/** «used з limit» of two amounts, the unit said once when both end with it: «1 200 з 5 000 подій». */
function usedOf(used: string, limit: string): string {
  const unit = / \S+$/.exec(limit)?.[0];
  return unit !== undefined && used.endsWith(unit)
    ? `${used.slice(0, -unit.length)} з ${limit}`
    : `${used} з ${limit}`;
}
const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 1 });

/** Gigabytes as the owner reads them: megabytes below one, else gigabytes. */
const gigabytes = (value: number) =>
  value < 1 ? `${number(Math.round(value * 1024))} МБ` : `${number(value)} ГБ`;

/** An amount of a limit's unit: dollars in the picked currency, sizes in МБ or ГБ, counts with their word. */
function useAmount(): (value: number, unit: string) => string {
  const money = useMoney(usd);
  return (value, unit) => {
    if (unit === 'USD') return money(Math.round(value * 100));
    if (unit === 'GB') return gigabytes(value);
    const word = UNITS[unit];
    return word === undefined ? `${number(value)} ${unit}` : `${number(value)} ${word}`;
  };
}

/** The limits a reading has a bar for: a Cron has none. */
function limitsOf(read: UsageAnswer): readonly LimitUsage[] {
  return read.state === 'read' && read.reading.kind !== 'cron' ? read.reading.usage : [];
}

/** Whether a limit of the reading is used to 90 % or more: the block's yellow mark. */
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

/** A Railway service's «Online» or «Offline», as a dot and a word. */
export function RailwayState({ read }: { readonly read: UsageAnswer | undefined }) {
  if (read?.state !== 'read' || read.reading.kind !== 'railway') return null;
  const online = read.reading.state === 'online';
  return (
    <span
      className={`flex items-center gap-1.5 text-xs ${online ? 'text-ok' : 'text-destructive'}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {online ? 'Online' : 'Offline'}
    </span>
  );
}

/** A Cron's last run and its next on a block: whether it succeeded, the minutes to the next. */
function CronLines({ read }: { readonly read: UsageAnswer }) {
  if (read.state !== 'read' || read.reading.kind !== 'cron') return null;
  const { lastRun, nextRunAt } = read.reading;
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

/** One limit's bar, as full as the share of it used; it fills as it appears, unless motion is reduced. */
function Bar({ usage, thick = false }: { readonly usage: LimitUsage; readonly thick?: boolean }) {
  const share = Math.min(1, usage.used / usage.limit);
  return (
    <div
      role="meter"
      aria-label={labelOf(usage.name)}
      aria-valuemin={0}
      aria-valuemax={usage.limit}
      aria-valuenow={usage.used}
      className={`${thick ? 'h-2' : 'h-1.5'} w-full overflow-hidden rounded-full bg-bar`}
    >
      <div
        className={`usage-fill h-full rounded-full ${nearLimit(usage) ? 'bg-warn' : 'bg-ok'}`}
        style={{ width: `${String(share * 100)}%` }}
      />
    </div>
  );
}

const percentOf = (usage: LimitUsage) => Math.round((usage.used / usage.limit) * 100);

/**
 * The usage on a block: the state lines, a bar per limit with its share, a mark when
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
      <RailwayState read={read} />
      <CronLines read={read} />
      {limitsOf(read).map((usage) => (
        <span key={usage.name} className="flex items-center gap-2">
          <Bar usage={usage} />
          <span className="flex-none text-[11px] tabular-nums text-muted-foreground">
            {percentOf(usage)}%
          </span>
        </span>
      ))}
      {read.stale ? <span className="text-[11px] text-warn">застаріло</span> : null}
    </span>
  );
}

/** One limit in the window: its name and what it counts, used of the limit, the share, what is left. */
function LimitRow({ usage }: { readonly usage: LimitUsage }) {
  const amount = useAmount();
  const left = Math.max(0, usage.limit - usage.used);
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{labelOf(usage.name)}</span>
        <span
          className={`flex-none text-xs tabular-nums ${nearLimit(usage) ? 'text-warn' : 'text-muted-foreground'}`}
        >
          {percentOf(usage)} %
        </span>
      </div>
      <Bar usage={usage} thick />
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="tabular-nums">
          {usedOf(amount(usage.used, usage.unit), amount(usage.limit, usage.unit))}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {`лишилося ${amount(left, usage.unit)}`}
        </span>
      </div>
      {HINTS[usage.name] === undefined ? null : (
        <span className="text-xs text-subtle">{HINTS[usage.name]}</span>
      )}
    </li>
  );
}

/** A Cron's runs in the window: when the last one ended and how, when the next starts. */
function CronRuns({ read }: { readonly read: UsageAnswer }) {
  if (read.state !== 'read' || read.reading.kind !== 'cron') return null;
  const { lastRun, nextRunAt } = read.reading;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <dt className="text-muted-foreground">Останній запуск</dt>
      <dd>
        {lastRun === null ? (
          'Ще не запускався'
        ) : (
          <>
            {formatWhen(lastRun.at)} ·{' '}
            <span className={lastRun.succeeded ? 'text-ok' : 'text-destructive'}>
              {lastRun.succeeded ? 'успішний' : 'невдалий'}
            </span>
          </>
        )}
      </dd>
      <dt className="text-muted-foreground">Наступний запуск</dt>
      <dd>
        {nextRunAt === null
          ? 'Не заплановано'
          : `${formatWhen(nextRunAt)} · через ${String(minutesUntil(nextRunAt, new Date()))} хв`}
      </dd>
    </dl>
  );
}

/** The limits of a Service's plan as the Власник entered them, while no port reads its usage. */
function PlanLimits({ service }: { readonly service: Service }) {
  const amount = useAmount();
  if (service.limits.length === 0) {
    return <p className="text-muted-foreground">Цей сервіс не повідомляє про використання.</p>;
  }
  return (
    <>
      <p className="text-muted-foreground">Використання не читається, ось ліміти тарифу:</p>
      <ul className="flex flex-col gap-1">
        {service.limits.map((limit) => (
          <li key={limit.name} className="flex justify-between gap-3">
            <span>{labelOf(limit.name)}</span>
            <span className="tabular-nums">{amount(limit.limit, limit.unit)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * The usage in a Service's window: the near-limit mark, a Cron's runs, each
 * limit's numbers with its bar, when it was read and «Оновити», which reads
 * the provider again; a Service without a usage port shows its plan limits.
 */
export function WindowUsage({
  service,
  usage,
}: {
  readonly service: Service;
  readonly usage:
    | {
        readonly read: UsageAnswer;
        readonly refreshing: boolean;
        readonly onRefresh: () => void;
      }
    | undefined;
}) {
  if (usage === undefined) return <PlanLimits service={service} />;
  const { read, refreshing, onRefresh } = usage;
  return (
    <>
      {read.state === 'unavailable' ? (
        <p className="text-muted-foreground">Не вдалося прочитати використання.</p>
      ) : (
        <>
          <NearLimitMark read={read} />
          <CronRuns read={read} />
          <ul className="flex flex-col gap-4">
            {limitsOf(read).map((usage) => (
              <LimitRow key={usage.name} usage={usage} />
            ))}
          </ul>
        </>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          {read.state === 'unavailable'
            ? 'Ще жодного читання'
            : `Оновлено ${formatWhen(read.readAt)}`}
          {read.state === 'read' && read.stale ? (
            <span className="block text-warn">Застаріло: останнє читання не вдалося</span>
          ) : null}
        </p>
        <Button variant="secondary" size="sm" disabled={refreshing} onClick={onRefresh}>
          {refreshing ? 'Оновлюю…' : 'Оновити'}
        </Button>
      </div>
    </>
  );
}
