import { useState } from 'react';

import { Button } from './ui/button';

/** A write waiting for its confirmation: what it does, and how it runs with the reason. */
export interface PendingWrite {
  readonly title: string;
  readonly confirm: string;
  readonly run: (reason: string) => void;
}

/**
 * The confirmation every admin write opens (ADR 0088): the write runs only
 * with a reason, which the Action log keeps, so its button stays disabled
 * until one is typed.
 */
export function ConfirmDialog({ write, onClose }: { write: PendingWrite; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const ready = reason.trim() !== '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6"
      >
        <h2 id="confirm-title" className="font-display text-lg font-semibold">
          {write.title}
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          Причина
          <textarea
            className="min-h-20 rounded-md border border-border bg-background px-3 py-2"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Скасувати
          </Button>
          <Button
            disabled={!ready}
            onClick={() => {
              write.run(reason.trim());
              onClose();
            }}
          >
            {write.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
