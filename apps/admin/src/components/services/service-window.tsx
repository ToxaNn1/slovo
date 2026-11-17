import type { Service } from '@slovo/contracts/admin-api';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from '../ui/button';
import { ServiceEntries } from './service-entries';
import { KIND_LABELS, ServiceMoneySection } from './service-money';
import { RailwayState, WindowUsage, type UsageAnswer } from './usage';

/** One column of the window: a card with its heading, a hover lift, its turn in the entrance. */
function Column({
  title,
  turn,
  children,
}: {
  readonly title: string;
  readonly turn: number;
  readonly children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      style={{ animationDelay: `${String(60 + turn * 50)}ms` }}
      className="service-window-column flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-sunk/60 p-4 text-sm hover:border-border-strong hover:shadow-panel motion-safe:transition-[border-color,box-shadow] motion-safe:duration-200"
    >
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/**
 * The window of a Service (ADR 0173): a wide native modal `<dialog>` in the
 * middle (ADR 0160), so Esc and the back gesture close it and the page behind
 * is inert. Its money, its usage and its entries stand side by side, all on
 * one laptop screen, and stack on a narrow one.
 */
export function ServiceWindow({
  service,
  usage,
  onClose,
}: {
  readonly service: Service;
  /** The Service's usage and how to read it again, when it has a usage port. */
  readonly usage?: {
    readonly read: UsageAnswer;
    readonly refreshing: boolean;
    readonly onRefresh: () => void;
  };
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="service-window m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[1180px] flex-col gap-5 overflow-y-auto rounded-[24px] border border-border bg-surface p-6 text-foreground shadow-[0_24px_70px_rgb(0_0_0/0.3)] overscroll-contain open:flex backdrop:bg-scrim"
      onCancel={(event) => {
        // Esc or the back gesture: React unmounts the dialog, the browser does not close it.
        event.preventDefault();
        onClose();
      }}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {service.name}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{KIND_LABELS[service.kind]}</span>
            <RailwayState read={usage?.read} />
          </div>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Закрити
        </Button>
      </header>
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Гроші" turn={0}>
          <ServiceMoneySection service={service} read={usage?.read} />
        </Column>
        <Column title="Використання" turn={1}>
          <WindowUsage service={service} usage={usage} />
        </Column>
        <Column title="Записи" turn={2}>
          <ServiceEntries service={service} />
        </Column>
      </div>
    </dialog>
  );
}
