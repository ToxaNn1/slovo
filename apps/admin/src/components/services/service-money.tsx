import {
  SERVICE_KINDS,
  type RailwaySpendPart,
  ServiceRefusalSchema,
  type Service,
  type ServiceCosts,
} from '@slovo/contracts/admin-api';
import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react';

import { adminApi } from '../../api';
import { refusalData } from '../../session';
import { useAdminWrite } from '../admin-write';
import { ConfirmDialog, type PendingWrite } from '../confirm-dialog';
import { Button } from '../ui/button';
import { CurrencySwitch, usd, useMoney } from './service-currency';
import type { UsageAnswer } from './usage';

const inputClass = 'h-9 rounded-lg border border-border bg-background px-3 text-sm';

/** What the Власник reads of each kind of Service. */
export const KIND_LABELS: Readonly<Record<Service['kind'], string>> = {
  railway: 'Сервіс Railway',
  cron: 'Cron',
  metered: 'Інший, з лімітами',
};

/** «28 лютого» of a day `YYYY-MM-DD`. */
const dayOf = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

function refusalOf(error: unknown): string {
  switch (ServiceRefusalSchema.safeParse(refusalData(error)).data?.refusal) {
    case 'name-taken':
      return 'Сервіс з такою назвою вже є.';
    case 'unknown':
      return 'Цього сервісу вже немає.';
    case undefined:
      return 'Не вдалося. Спробуйте ще раз.';
  }
}

/** The money fields as the Власник types them, before they parse. */
interface MoneyDraft {
  readonly plan: string;
  readonly price: string;
  readonly billingDay: string;
}

const draftOf = (service: Pick<Service, 'plan' | 'monthlyPriceUsdCents' | 'billingDay'>) => ({
  plan: service.plan ?? '',
  price: service.monthlyPriceUsdCents === null ? '' : String(service.monthlyPriceUsdCents / 100),
  billingDay: service.billingDay === null ? '' : String(service.billingDay),
});

/** The money fields of a draft, or `undefined` while one of them does not parse; an empty field is none. */
function moneyOf(draft: MoneyDraft) {
  const plan = draft.plan.trim() === '' ? null : draft.plan.trim();
  const price = draft.price.trim().replace(',', '.');
  const dollars = price === '' ? null : Number(price);
  const day = draft.billingDay.trim() === '' ? null : Number(draft.billingDay.trim());
  if (dollars !== null && (!/^\d+(\.\d{1,2})?$/.test(price) || dollars > 1_000_000)) return;
  if (day !== null && (!Number.isInteger(day) || day < 1 || day > 31)) return;
  return {
    plan,
    monthlyPriceUsdCents: dollars === null ? null : Math.round(dollars * 100),
    billingDay: day,
  };
}

/** The plan, price and billing day inputs of a draft. */
function MoneyInputs({
  draft,
  onChange,
}: {
  readonly draft: MoneyDraft;
  readonly onChange: (draft: MoneyDraft) => void;
}) {
  const field = (key: keyof MoneyDraft, label: string, inputMode?: 'decimal' | 'numeric') => (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        className={inputClass}
        inputMode={inputMode}
        value={draft[key]}
        onChange={(event) => {
          onChange({ ...draft, [key]: event.target.value });
        }}
      />
    </label>
  );
  return (
    <>
      {field('plan', 'План')}
      {field('price', 'Ціна, $ / місяць', 'decimal')}
      {field('billingDay', 'День списання', 'numeric')}
    </>
  );
}

/** The confirmation of a pending «Сервіси» write, over whatever is open. */
function Confirmation({
  pending,
  onClose,
}: {
  readonly pending: PendingWrite;
  readonly onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title={pending.title}
      confirmLabel={pending.confirm}
      onConfirm={async (reason) => {
        await pending.run(reason);
      }}
      onClose={onClose}
      refusalText={refusalOf}
    />
  );
}

/**
 * The top of the canvas: what SLOVO pays a month, «≈ $X / місяць», and the
 * next charge, both as the backend counts them by the Kyiv day.
 */
export function ServiceCostsHeader({
  costs,
  services,
}: {
  readonly costs: ServiceCosts;
  readonly services: readonly Service[];
}) {
  const shown = useMoney(usd);
  const next = costs.nextCharge;
  const names = next?.serviceIds
    .map((id) => services.find((service) => service.id === id)?.name)
    .filter((name) => name !== undefined)
    .join(', ');
  return (
    <div
      aria-label="Витрати"
      role="group"
      className="flex flex-wrap items-baseline gap-x-6 gap-y-1"
    >
      <p className="font-display text-xl font-semibold">
        ≈ {shown(costs.monthlyTotalUsdCents)} / місяць
      </p>
      <p className="text-sm text-muted-foreground">
        {next === null
          ? 'Наступного списання немає'
          : `Наступне списання ${dayOf(next.on)}: ${shown(next.amountUsdCents)} · ${names ?? ''}`}
      </p>
      <CurrencySwitch />
    </div>
  );
}

/** The parts of Railway's spend as the owner reads them. */
const SPEND_PART_LABELS: Readonly<Record<RailwaySpendPart, string>> = {
  cpu: 'Процесор',
  memory: 'Пам’ять',
  egress: 'Вихідний трафік',
  disk: 'Диск',
};

/** The Kyiv day of `now` as `YYYY-MM-DD`. */
const kyivDay = (now: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/**
 * The next day a Service charges on, as `YYYY-MM-DD`: this month's billing
 * day from the Kyiv day of `now`, else next month's; a day past a month's end
 * is its last day.
 */
function nextBillingDay(billingDay: number, now: Date): string {
  const [year = 0, month = 1, day = 1] = kyivDay(now).split('-').map(Number);
  const on = (y: number, m: number) => {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${String(y)}-${String(m).padStart(2, '0')}-${String(Math.min(billingDay, last)).padStart(2, '0')}`;
  };
  const thisMonth = on(year, month);
  if (Number(thisMonth.slice(8)) >= day) return thisMonth;
  return month === 12 ? on(year + 1, 1) : on(year, month + 1);
}

/** What the Service spent this month as its port read it: Railway's spend and its parts. */
function Spent({ read }: { readonly read: UsageAnswer | undefined }) {
  const shown = useMoney(usd);
  if (read?.state !== 'read' || read.reading.kind !== 'railway') {
    return <p className="text-muted-foreground">Провайдер не повідомляє, скільки вже витрачено.</p>;
  }
  const spend = read.reading.usage.find((usage) => usage.name === 'spend');
  return (
    <div className="flex flex-col gap-2">
      {spend === undefined ? null : (
        <p>
          <span className="font-display text-lg font-semibold tabular-nums">
            {shown(Math.round(spend.used * 100))}
          </span>{' '}
          <span className="text-muted-foreground">
            з {shown(Math.round(spend.limit * 100))}, включених у тариф
          </span>
        </p>
      )}
      <ul aria-label="З чого складаються витрати" className="flex flex-col gap-1">
        {read.reading.spendParts.map(({ part, usd: dollars }) => (
          <li key={part} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{SPEND_PART_LABELS[part]}</span>
            <span className="tabular-nums">{shown(Math.round(dollars * 100))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The money of a Service in its window: the plan, the price, the billing day
 * and the next charge, what it spent this month as its port read it; changed
 * through a confirmation with a reason.
 */
export function ServiceMoneySection({
  service,
  read,
}: {
  readonly service: Service;
  readonly read: UsageAnswer | undefined;
}) {
  const [draft, setDraft] = useState<MoneyDraft>();
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const shown = useMoney(usd);
  const edit = useAdminWrite(adminApi.services.editMoney, () => {
    setDraft(undefined);
  });
  const money = draft === undefined ? undefined : moneyOf(draft);

  const onSave = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (money === undefined) return;
    setPending({
      title: `Змінити план і ціну сервісу ${service.name}?`,
      confirm: 'Зберегти',
      run: (reason) => edit.mutateAsync({ id: service.id, ...money, reason }),
    });
  };

  return (
    <>
      {draft === undefined ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">План</dt>
            <dd>{service.plan ?? '—'}</dd>
            <dt className="text-muted-foreground">Ціна</dt>
            <dd className="tabular-nums">
              {service.monthlyPriceUsdCents === null
                ? '—'
                : `${shown(service.monthlyPriceUsdCents)} / місяць`}
            </dd>
            <dt className="text-muted-foreground">День списання</dt>
            <dd>
              {service.billingDay === null ? (
                '—'
              ) : (
                <>
                  {`${String(service.billingDay)}-го щомісяця`}
                  <span className="block text-xs text-muted-foreground">
                    Наступне {dayOf(nextBillingDay(service.billingDay, new Date()))}
                  </span>
                </>
              )}
            </dd>
          </dl>
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Витрачено цього місяця
            </h4>
            <Spent read={read} />
          </div>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <CurrencySwitch />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(draftOf(service));
              }}
            >
              Змінити
            </Button>
          </div>
        </>
      ) : (
        <form aria-label="План і ціна" onSubmit={onSave} className="flex flex-col gap-3">
          <MoneyInputs draft={draft} onChange={setDraft} />
          <div className="flex gap-2">
            <Button type="submit" disabled={money === undefined}>
              Зберегти
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDraft(undefined);
              }}
            >
              Скасувати
            </Button>
          </div>
        </form>
      )}
      {pending === null ? null : (
        <Confirmation
          pending={pending}
          onClose={() => {
            setPending(null);
          }}
        />
      )}
    </>
  );
}

const EMPTY_SERVICE = { name: '', kind: 'metered', plan: '', price: '', billingDay: '' } as const;

/** «Додати сервіс»: a form in a native modal dialog, then the confirmation with a reason. */
export function AddService() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Додати сервіс
      </Button>
      {open ? (
        <AddServiceDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function AddServiceDialog({ onClose }: { readonly onClose: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<MoneyDraft & { name: string; kind: Service['kind'] }>(
    EMPTY_SERVICE,
  );
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const add = useAdminWrite(adminApi.services.add, onClose);
  const money = moneyOf(draft);
  const name = draft.name.trim();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (money === undefined || name === '') return;
    setPending({
      title: `Додати сервіс ${name}?`,
      confirm: 'Додати',
      run: (reason) => add.mutateAsync({ name, kind: draft.kind, ...money, reason }),
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-[440px] flex-col gap-4 rounded-[20px] border-0 bg-surface p-6 text-foreground shadow-[0_24px_70px_rgb(0_0_0/0.3)] overscroll-contain open:flex backdrop:bg-scrim"
      onCancel={(event) => {
        // Esc or the back gesture: React unmounts the dialog, the browser does not close it.
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="font-display text-lg font-semibold">
        Додати сервіс
      </h2>
      <form aria-label="Новий сервіс" onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Назва
          <input
            className={inputClass}
            maxLength={80}
            value={draft.name}
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value });
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Вид
          <select
            className={inputClass}
            value={draft.kind}
            onChange={(event) => {
              const kind = SERVICE_KINDS.find((each) => each === event.target.value);
              if (kind !== undefined) setDraft({ ...draft, kind });
            }}
          >
            {SERVICE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
        <MoneyInputs
          draft={draft}
          onChange={(money) => {
            setDraft({ ...draft, ...money });
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={money === undefined || name === ''}>
            Додати
          </Button>
        </div>
      </form>
      {pending === null ? null : (
        <Confirmation
          pending={pending}
          onClose={() => {
            setPending(null);
          }}
        />
      )}
    </dialog>
  );
}
