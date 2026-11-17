import {
  OPEN_ENTRY_TYPES,
  ServiceEntryTypeSchema,
  type Service,
  type ServiceEntry,
  type ServiceEntryType,
} from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { adminApi } from '../../api';
import { codeOf } from '../../session';
import { useAdminWrite } from '../admin-write';
import { ConfirmDialog, type PendingWrite } from '../confirm-dialog';
import { Button } from '../ui/button';
import { VaultUnlockDialog } from './vault-unlock-dialog';

/** What the Власник reads of each entry type. */
export const ENTRY_TYPE_LABELS: Readonly<Record<ServiceEntryType, string>> = {
  login: 'Логін',
  password: 'Пароль',
  token: 'Токен / API-ключ',
  'recovery-codes': 'Коди відновлення',
  link: 'Посилання',
};

const VAULT_OFF_TEXT =
  'Сховище вимкнене: на сервері не задано VAULT_KEY. Записи не можна додати, змінити чи видалити.';

/** What a sealed value shows in its place. */
const MASK = '••••••••';

/** How long a shown value stays on screen. */
const SHOWN_MS = 30_000;

const inputClass = 'h-9 rounded-lg border border-border bg-background px-3 text-sm';

const isOpen = (type: ServiceEntryType) => OPEN_ENTRY_TYPES.some((open) => open === type);

/** What the Власник reads of a refused entry write. */
function refusalOf(error: unknown): string {
  return codeOf(error) === 'VAULT_OFF' ? VAULT_OFF_TEXT : 'Не вдалося. Спробуйте ще раз.';
}

/**
 * The entries of a Service in its window (ADR 0164, 0173): a login and a link
 * in the open, a password, token or recovery codes masked, since no read
 * brings their value. Every write goes through the confirmation with a reason.
 * A new entry's form opens with «Додати запис». Without `VAULT_KEY` the
 * section says the Vault is off.
 */
export function ServiceEntries({ service }: { readonly service: Service }) {
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [editing, setEditing] = useState<string>();
  const [adding, setAdding] = useState(false);
  /** The read waiting for the TOTP prompt to open the Vault. */
  const [unlocking, setUnlocking] = useState<{ readonly retry: () => void } | null>(null);
  const entries = useQuery({
    queryKey: ['services', service.id, 'entries'],
    queryFn: () => adminApi.services.entries({ serviceId: service.id }),
  });
  const remove = useAdminWrite(adminApi.services.deleteEntry);
  const vaultOn = entries.data?.vault === 'on';

  return (
    <>
      {entries.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Не вдалося завантажити записи.
        </p>
      ) : null}
      {entries.data?.vault === 'off' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {VAULT_OFF_TEXT}
        </p>
      ) : null}
      {entries.data === undefined ? null : entries.data.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Записів ще немає.</p>
      ) : (
        <ul aria-label="Записи" className="flex flex-col gap-2">
          {entries.data.entries.map((entry) => (
            <li
              key={entry.id}
              aria-label={entry.label}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-3 py-2.5 motion-safe:transition-colors hover:border-border-strong"
            >
              {editing === entry.id ? (
                <EntryForm
                  service={service}
                  entry={entry}
                  confirm={setPending}
                  onDone={() => {
                    setEditing(undefined);
                  }}
                />
              ) : (
                <>
                  <span className="text-xs text-muted-foreground">
                    {ENTRY_TYPE_LABELS[entry.type]} · {entry.label}
                  </span>
                  {entry.type === 'login' || entry.type === 'link' ? (
                    <span className="break-all">{entry.value}</span>
                  ) : (
                    <SealedValue
                      entry={entry}
                      vaultOn={vaultOn}
                      askCode={(retry) => {
                        setUnlocking({ retry });
                      }}
                    />
                  )}
                  {entry.note === null ? null : (
                    <span className="text-xs text-muted-foreground">
                      Де використовується: {entry.note}
                    </span>
                  )}
                  {vaultOn ? (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditing(entry.id);
                        }}
                      >
                        Змінити
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPending({
                            title: `Видалити запис «${entry.label}» з ${service.name}?`,
                            confirm: 'Видалити',
                            danger: true,
                            run: (reason) => remove.mutateAsync({ id: entry.id, reason }),
                          });
                        }}
                      >
                        Видалити
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!vaultOn ? null : adding ? (
        <div className="rounded-xl border border-border bg-surface p-3">
          <EntryForm
            service={service}
            confirm={setPending}
            onDone={() => {
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => {
            setAdding(true);
          }}
        >
          <span aria-hidden>+</span>
          Додати запис
        </Button>
      )}
      {unlocking === null ? null : (
        <VaultUnlockDialog
          onOpen={unlocking.retry}
          onClose={() => {
            setUnlocking(null);
          }}
        />
      )}
      {pending === null ? null : (
        <ConfirmDialog
          title={pending.title}
          confirmLabel={pending.confirm}
          danger={pending.danger}
          onConfirm={async (reason) => {
            await pending.run(reason);
          }}
          onClose={() => {
            setPending(null);
          }}
          refusalText={refusalOf}
        />
      )}
    </>
  );
}

/**
 * A sealed value, masked (ADR 0164). «Показати» shows it for 30 s and
 * «Копіювати» puts it on the clipboard without rendering it; on a locked
 * Vault either asks for the TOTP first, and then runs.
 */
function SealedValue({
  entry,
  vaultOn,
  askCode,
}: {
  readonly entry: ServiceEntry;
  readonly vaultOn: boolean;
  readonly askCode: (retry: () => void) => void;
}) {
  const [shown, setShown] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  // The hide starts with the value itself, so the 30 s never wait for a render.
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hide = () => {
    clearTimeout(hideTimer.current);
    setShown(null);
  };
  const show = (value: string) => {
    clearTimeout(hideTimer.current);
    setShown(value);
    hideTimer.current = setTimeout(hide, SHOWN_MS);
  };
  useEffect(
    () => () => {
      clearTimeout(hideTimer.current);
    },
    [],
  );

  /** Runs the read, asking for the code first when the Vault is locked. */
  const read = (how: 'reveal' | 'copy') => {
    setNote(undefined);
    const call = how === 'reveal' ? adminApi.services.revealEntry : adminApi.services.copyEntry;
    call({ id: entry.id })
      .then(async ({ value }) => {
        if (how === 'reveal') {
          show(value);
          return;
        }
        await navigator.clipboard.writeText(value);
        setNote('Скопійовано');
      })
      .catch((error: unknown) => {
        if (codeOf(error) === 'LOCKED') {
          askCode(() => {
            read(how);
          });
          return;
        }
        setNote(refusalOf(error));
      });
  };

  return (
    <>
      {shown === null ? (
        <span aria-label="Приховано">{MASK}</span>
      ) : (
        <span className="font-mono break-all">{shown}</span>
      )}
      {vaultOn ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (shown === null) read('reveal');
              else hide();
            }}
          >
            {shown === null ? 'Показати' : 'Сховати'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              read('copy');
            }}
          >
            Копіювати
          </Button>
          {note === undefined ? null : (
            <span role="status" className="text-xs text-muted-foreground">
              {note}
            </span>
          )}
        </div>
      ) : null}
    </>
  );
}

/**
 * The form of a new entry, or of a change to `entry`: a sealed value is never
 * filled in, and left empty it stays as it was.
 */
function EntryForm({
  service,
  entry,
  confirm,
  onDone,
}: {
  readonly service: Service;
  readonly entry?: ServiceEntry;
  readonly confirm: (write: PendingWrite) => void;
  readonly onDone: () => void;
}) {
  const [type, setType] = useState<ServiceEntryType>(entry?.type ?? 'login');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [note, setNote] = useState(entry?.note ?? '');
  const [value, setValue] = useState(
    entry !== undefined && (entry.type === 'login' || entry.type === 'link') ? entry.value : '',
  );
  const reset = () => {
    setLabel('');
    setNote('');
    setValue('');
    onDone();
  };
  const add = useAdminWrite(adminApi.services.addEntry, reset);
  const edit = useAdminWrite(adminApi.services.editEntry, onDone);
  const noteOrNull = note.trim() === '' ? null : note.trim();

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (entry === undefined) {
      confirm({
        title: `Додати запис «${label.trim()}» до ${service.name}?`,
        confirm: 'Додати',
        run: (reason) =>
          add.mutateAsync({
            serviceId: service.id,
            type,
            label: label.trim(),
            note: noteOrNull,
            value,
            reason,
          }),
      });
      return;
    }
    confirm({
      title: `Змінити запис «${entry.label}» у ${service.name}?`,
      confirm: 'Зберегти',
      run: (reason) =>
        edit.mutateAsync({
          id: entry.id,
          label: label.trim(),
          note: noteOrNull,
          ...(value === '' ? {} : { value }),
          reason,
        }),
    });
  };

  const sealed = !isOpen(type);
  return (
    <form
      aria-label={entry === undefined ? 'Новий запис' : `Зміна запису ${entry.label}`}
      className="flex flex-col gap-2"
      onSubmit={submit}
    >
      {entry === undefined ? (
        <label className="flex flex-col gap-1 text-sm">
          Тип
          <select
            className={inputClass}
            value={type}
            onChange={(event) => {
              const chosen = ServiceEntryTypeSchema.safeParse(event.target.value);
              if (chosen.success) setType(chosen.data);
            }}
          >
            {ServiceEntryTypeSchema.options.map((option) => (
              <option key={option} value={option}>
                {ENTRY_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        Назва
        <input
          className={inputClass}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {entry !== undefined && sealed ? 'Нове значення (порожнє — без змін)' : 'Значення'}
        <input
          className={inputClass}
          type={sealed ? 'password' : 'text'}
          autoComplete="off"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Де використовується
        <input
          className={inputClass}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={label.trim() === '' || (entry === undefined && value === '')}
        >
          {entry === undefined ? 'Додати запис' : 'Зберегти'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Скасувати
        </Button>
      </div>
    </form>
  );
}
