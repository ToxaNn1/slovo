import type { Service } from '@slovo/contracts/admin-api';
import { useEffect, useId, useRef } from 'react';

import { Button } from '../ui/button';
import { ServiceEntries } from './service-entries';
import { ServiceMoneySection } from './service-money';
import { PanelUsage, type UsageAnswer } from './usage';

/**
 * The side panel of a Service: a native modal `<dialog>` at the right edge
 * (ADR 0160), so Esc and the back gesture close it and the page behind is
 * inert. It shows the Service's name, money, and usage with «Оновити»; its
 * entries come with their ticket.
 */
export function ServicePanel({
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
      className="m-0 ml-auto h-full max-h-none w-full max-w-[420px] flex-col gap-4 border-0 border-l border-border bg-surface p-6 text-foreground shadow-[0_24px_70px_rgb(0_0_0/0.3)] overscroll-contain open:flex backdrop:bg-scrim"
      onCancel={(event) => {
        // Esc or the back gesture: React unmounts the dialog, the browser does not close it.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {service.name}
        </h2>
        <Button variant="secondary" onClick={onClose}>
          Закрити
        </Button>
      </div>
      <ServiceEntries service={service} />
      <ServiceMoneySection service={service} />
      {usage === undefined ? null : <PanelUsage {...usage} />}
    </dialog>
  );
}
