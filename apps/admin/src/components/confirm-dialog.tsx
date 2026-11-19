import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { cn } from '../lib/utils';
import { Button } from './ui/button';

/** A write waiting for its confirmation: what it does, and how it runs with the reason; the dialog stays open until `run` settles. */
export interface PendingWrite {
  readonly title: string;
  readonly confirm: string;
  /** A write that takes something away or rolls it back: the dialog reads «небезпечна дія». */
  readonly danger?: boolean;
  readonly run: (reason: string) => Promise<unknown>;
}

/**
 * The confirmation every admin write goes through: what changes, the reason
 * the Action log keeps (ADR 0088), and a confirm button that stays disabled
 * until a reason is typed. A refused write stays open with the refusal.
 * A native modal `<dialog>`: the browser keeps focus inside, makes the page
 * inert and turns Esc or the back gesture into Скасувати.
 */
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
  refusalText,
  confirmLabel = 'Підтвердити',
  danger = false,
  asksReason = true,
}: {
  readonly title: string;
  /** What the write changes. */
  readonly children?: ReactNode;
  /** The write; the dialog closes once it succeeds. */
  readonly onConfirm: (reason: string) => Promise<void>;
  readonly onClose: () => void;
  /** What the admin reads of a refused write. */
  readonly refusalText: (error: unknown) => string;
  /** What the confirm button says. */
  readonly confirmLabel?: string;
  /** Marks the write «небезпечна дія» and turns the confirm button red. */
  readonly danger?: boolean | undefined;
  /** Whether the write takes a reason; one that takes none confirms with an empty one. */
  readonly asksReason?: boolean;
}) {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    reasonRef.current?.focus();
  }, []);
  const missingReason = asksReason && reason.trim() === '';

  const confirm = () => {
    setBusy(true);
    setError(undefined);
    onConfirm(reason.trim())
      .then(onClose)
      .catch((refusal: unknown) => {
        setError(refusalText(refusal));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-[520px] flex-col rounded-[20px] border-0 bg-surface p-0 text-foreground shadow-[0_24px_70px_rgb(0_0_0/0.3)] overscroll-contain open:flex backdrop:overflow-hidden backdrop:overscroll-contain backdrop:bg-scrim"
      onCancel={(event) => {
        // Esc or the back gesture: React unmounts the dialog, the browser does not close it.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex flex-col gap-2 px-6 pt-[22px]">
        <span
          className={cn(
            'self-start rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold',
            danger ? 'bg-destructive-soft text-destructive' : 'bg-side-active text-primary',
          )}
        >
          {danger ? 'небезпечна дія' : 'підтвердження'}
        </span>
        <h2 id={titleId} className="font-display text-[17px] leading-[1.35] font-medium">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3.5 px-6 py-4 text-[13px]">
        {children}
        {asksReason && (
          <label htmlFor={reasonId} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-muted-foreground after:content-['_*']">
              Причина
            </span>
            <textarea
              ref={reasonRef}
              id={reasonId}
              rows={2}
              placeholder="Обов’язково: піде в Журнал дій"
              className="resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px] placeholder:text-subtle"
              maxLength={500}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </label>
        )}
        {error === undefined ? null : (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 px-6 pt-3.5 pb-5">
        <Button variant="secondary" onClick={onClose}>
          Скасувати
        </Button>
        <Button
          className={cn(
            'font-semibold',
            danger && 'bg-destructive text-white hover:bg-destructive/90',
          )}
          disabled={busy || missingReason}
          onClick={confirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
