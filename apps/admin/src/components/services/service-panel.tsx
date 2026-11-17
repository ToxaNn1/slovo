import type { Service } from '@slovo/contracts/admin-api';
import { useEffect, useId, useRef } from 'react';

import { Button } from '../ui/button';
import { ServiceMoneySection } from './service-money';

/**
 * The side panel of a Service: a native modal `<dialog>` at the right edge
 * (ADR 0160), so Esc and the back gesture close it and the page behind is
 * inert. It shows the Service's name and money; its usage and entries come
 * with their tickets.
 */
export function ServicePanel({
  service,
  onClose,
}: {
  readonly service: Service;
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
      <ServiceMoneySection service={service} />
    </dialog>
  );
}
