import { WrongCodeSchema } from '@slovo/contracts/admin-api';
import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';

import { adminApi } from '../../api';
import { codeOf, refusalData } from '../../session';
import { Button } from '../ui/button';

/** What the Власник reads of a refused unlock. */
function refusalOf(error: unknown): string {
  switch (codeOf(error)) {
    case 'WRONG_CODE': {
      const left = WrongCodeSchema.safeParse(refusalData(error)).data?.attemptsLeft;
      return left === undefined
        ? 'Невірний код.'
        : `Невірний код. Спроб лишилося: ${String(left)}.`;
    }
    case 'TOO_MANY_REQUESTS':
      return 'Забагато невірних кодів. Спробуйте пізніше.';
    case 'VAULT_OFF':
      return 'Сховище вимкнене: на сервері не задано VAULT_KEY.';
    default:
      return 'Не вдалося. Спробуйте ще раз.';
  }
}

/**
 * The TOTP prompt of a locked Vault (ADR 0164): a fresh code from the
 * authenticator opens «Показати» and «Копіювати» for 15 minutes in this
 * session, and then the read it was asked for runs.
 */
export function VaultUnlockDialog({
  onOpen,
  onClose,
}: {
  /** Runs once the Vault is open. */
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  const titleId = useId();
  const codeId = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    codeRef.current?.focus();
  }, []);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    adminApi.services
      .unlockVault({ code: code.trim() })
      .then(() => {
        onClose();
        onOpen();
      })
      .catch((refusal: unknown) => {
        setCode('');
        setError(refusalOf(refusal));
      })
      .finally(() => {
        setBusy(false);
      });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-[400px] flex-col rounded-[20px] border-0 bg-surface p-0 text-foreground shadow-[0_24px_70px_rgb(0_0_0/0.3)] open:flex backdrop:bg-scrim"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form className="flex flex-col gap-3.5 px-6 py-5 text-[13px]" onSubmit={submit}>
        <h2 id={titleId} className="font-display text-[17px] font-medium">
          Відкрити сховище
        </h2>
        <p className="text-muted-foreground">
          Введіть свіжий код із застосунку: «Показати» й «Копіювати» працюватимуть 15 хвилин у цій
          сесії.
        </p>
        <label htmlFor={codeId} className="flex flex-col gap-1.5">
          <span className="text-[12.5px] text-muted-foreground">Код із застосунку</span>
          <input
            ref={codeRef}
            id={codeId}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={20}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
            }}
          />
        </label>
        {error === undefined ? null : (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Скасувати
          </Button>
          <Button type="submit" disabled={busy || code.trim() === ''}>
            Відкрити
          </Button>
        </div>
      </form>
    </dialog>
  );
}
