import { useId, useState, type ReactNode } from 'react';

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
 */
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
  refusalText,
  confirmLabel = 'Підтвердити',
  danger = false,
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
}) {
  const titleId = useId();
  const reasonId = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-[20px] bg-surface shadow-[0_24px_70px_rgb(0_0_0/0.3)]"
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
          <label htmlFor={reasonId} className="flex flex-col gap-1.5">
            <span className="text-[12.5px] text-muted-foreground after:content-['_*']">
              Причина
            </span>
            <textarea
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
            disabled={busy || reason.trim() === ''}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
