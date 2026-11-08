import { useId, useState, type ReactNode } from 'react';

import { Button } from './ui/button';

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
}: {
  readonly title: string;
  /** What the write changes. */
  readonly children?: ReactNode;
  /** The write; the dialog closes once it succeeds. */
  readonly onConfirm: (reason: string) => Promise<void>;
  readonly onClose: () => void;
  /** What the admin reads of a refused write. */
  readonly refusalText: (error: unknown) => string;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-surface p-6"
      >
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {children}
        <label htmlFor={reasonId} className="flex flex-col gap-1 text-sm">
          <span>Причина</span>
          <textarea
            id={reasonId}
            className="min-h-20 rounded-lg border border-border bg-surface p-2"
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </label>
        {error === undefined ? null : (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button disabled={busy || reason.trim() === ''} onClick={confirm}>
            Підтвердити
          </Button>
        </div>
      </div>
    </div>
  );
}
