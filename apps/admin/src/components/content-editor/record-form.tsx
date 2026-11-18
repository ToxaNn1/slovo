import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';

import { adminApi } from '../../api';
import { refusalText } from '../../session';
import { ConfirmDialog, type PendingWrite } from '../confirm-dialog';
import { Button } from '../ui/button';
import { FieldRow } from './field-controls';
import {
  categoryOptionsOf,
  type FormValue,
  formValueOf,
  type KindEditor,
  recordValueOf,
  shownOf,
} from './kinds';

type Fields = Record<string, unknown>;

/** What a write answers, as the editor shows it. */
export interface Written {
  readonly id: string;
  readonly recordVersion: number;
  readonly contentVersion: number;
  readonly needsNewRecording?: boolean | undefined;
}

/** A record the form writes: a new one, or one read at its record version. */
export type FormRecord =
  | { readonly at: 'create' }
  | { readonly at: 'edit'; readonly id: string; readonly recordVersion: number };

export const RefusedSchema = z.object({
  code: z.literal('REFUSED'),
  data: z.object({
    refusals: z.array(
      z.object({ rule: z.string(), field: z.string().optional(), message: z.string() }),
    ),
  }),
});
const StaleSchema = z.object({
  code: z.literal('STALE'),
  data: z.object({ currentVersion: z.number() }),
});

/** The record's current version, read after a STALE answer. */
interface Stale {
  readonly fields: Fields;
  readonly recordVersion: number;
}

/**
 * The fields of one record of a kind. A save opens a batch and writes it;
 * an edit's reason is optional, while adding and retiring ask for one in the
 * confirmation. A refused rule shows at its field; a STALE answer shows the
 * diff against the current version, which the save then writes over.
 */
export function RecordForm({
  editionId,
  editor,
  fields,
  record,
  appeared = false,
  onWritten,
}: {
  readonly editionId: string;
  readonly editor: KindEditor;
  readonly fields: Fields;
  readonly record: FormRecord;
  /** Whether the Curated Collection appeared on the rail, so its publish date stays. */
  readonly appeared?: boolean;
  readonly onWritten: (written: Written) => void;
}) {
  const [values, setValues] = useState<Readonly<Record<string, FormValue>>>(() =>
    Object.fromEntries(
      editor.fields.map((field) => [field.name, formValueOf(field.control, fields[field.name])]),
    ),
  );
  const [base, setBase] = useState<{ fields: Fields; recordVersion: number }>({
    fields,
    recordVersion: record.at === 'edit' ? record.recordVersion : 1,
  });
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<readonly string[]>([]);
  const [stale, setStale] = useState<Stale>();
  const [pending, setPending] = useState<PendingWrite>();
  const [busy, setBusy] = useState(false);
  const kind = editor.kind;
  // The record as last written: a retired one is brought back instead of retired.
  const retired = base.fields['retired'] === true;
  const card = useQuery({
    queryKey: ['edition-card', editionId],
    queryFn: () => adminApi.editionCard({ editionId }),
  });
  const categories = categoryOptionsOf(card.data);

  /** The record's fields as the form holds them over `onto`, or undefined when one can't be read. */
  const read = (onto: Fields): Fields | undefined => {
    const edited = new Set(editor.fields.map((field) => field.name));
    const next: Fields = Object.fromEntries(
      Object.entries(onto).filter(([name]) => !edited.has(name)),
    );
    const unread: Record<string, string> = {};
    for (const field of editor.fields) {
      const value = recordValueOf(field.control, values[field.name]);
      if (!value.ok) {
        unread[field.name] = value.message;
      } else if (value.value !== undefined) {
        next[field.name] = value.value;
      }
    }
    setFieldErrors(unread);
    return Object.keys(unread).length === 0 ? next : undefined;
  };

  /** Writes `fields` with `run`; once written they are the form's base. */
  const write = async (
    fields: Fields,
    run: (batchId: string) => Promise<Written>,
  ): Promise<Written | undefined> => {
    setBusy(true);
    setErrors([]);
    try {
      const { batchId } = await adminApi.content.openBatch({ editionId });
      const written = await run(batchId);
      setStale(undefined);
      setFieldErrors({});
      setBase({ fields, recordVersion: written.recordVersion });
      onWritten(written);
      return written;
    } catch (error) {
      await refused(error);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const refused = async (error: unknown) => {
    const refusal = RefusedSchema.safeParse(error);
    if (refusal.success) {
      const at: Record<string, string> = {};
      const general: string[] = [];
      for (const { rule, field, message } of refusal.data.data.refusals) {
        const text = `${rule}: ${message}`;
        if (field !== undefined && editor.fields.some((known) => known.name === field)) {
          at[field] = text;
        } else {
          general.push(text);
        }
      }
      setFieldErrors(at);
      setErrors(general);
      return;
    }
    if (StaleSchema.safeParse(error).success && record.at === 'edit') {
      try {
        const current = await adminApi.content.record({ editionId, kind, id: record.id });
        setStale({ fields: current.fields, recordVersion: current.recordVersion });
      } catch (reread) {
        setErrors([refusalText(reread)]);
      }
      return;
    }
    setErrors([refusalText(error)]);
  };

  const withReason = (text: string) => (text.trim() === '' ? {} : { reason: text.trim() });

  const save = (over: { fields: Fields; recordVersion: number }) => {
    const next = read(over.fields);
    if (next === undefined) return;
    if (record.at === 'create') {
      setPending({
        title: 'Додати запис',
        confirm: 'Додати',
        run: (confirmed) =>
          write(next, (batchId) =>
            adminApi.content.create({ editionId, kind, batchId, fields: next, reason: confirmed }),
          ),
      });
      return;
    }
    setBase(over);
    void write(next, (batchId) =>
      adminApi.content.edit({
        editionId,
        kind,
        id: record.id,
        batchId,
        recordVersion: over.recordVersion,
        fields: next,
        ...withReason(reason),
      }),
    );
  };

  const retire = () => {
    if (record.at !== 'edit') return;
    setPending({
      title: 'Вивести запис з ужитку',
      confirm: 'Вивести з ужитку',
      run: (confirmed) =>
        write({ ...base.fields, retired: true }, (batchId) =>
          adminApi.content.retire({
            editionId,
            kind,
            id: record.id,
            batchId,
            recordVersion: base.recordVersion,
            reason: confirmed,
          }),
        ),
    });
  };

  /**
   * Brings a retired record back into use: an edit of its saved fields with
   * `retired: false`, leaving the form's unsaved edits for a later save.
   */
  const bringBack = () => {
    if (record.at !== 'edit') return;
    const next = { ...base.fields, retired: false };
    setPending({
      title: 'Повернути запис в ужиток',
      confirm: 'Повернути в ужиток',
      run: (confirmed) =>
        write(next, (batchId) =>
          adminApi.content.edit({
            editionId,
            kind,
            id: record.id,
            batchId,
            recordVersion: base.recordVersion,
            fields: next,
            reason: confirmed,
          }),
        ),
    });
  };

  const changed =
    stale === undefined
      ? []
      : editor.fields.filter(
          (field) =>
            JSON.stringify(
              recordValueOf(field.control, formValueOf(field.control, stale.fields[field.name])),
            ) !== JSON.stringify(recordValueOf(field.control, values[field.name])),
        );

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save(base);
        }}
      >
        {editor.fields.map((field) => (
          <FieldRow
            key={field.name}
            id={`field-${field.name}`}
            label={field.label}
            control={field.control}
            value={values[field.name]}
            siblings={values}
            categories={categories}
            editionId={editionId}
            error={fieldErrors[field.name]}
            fixed={appeared && field.control.type === 'publish-date'}
            onChange={(value) => {
              setValues((previous) => ({ ...previous, [field.name]: value }));
            }}
          />
        ))}
        {record.at === 'edit' && (
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="edit-reason">Причина (необов&apos;язково)</label>
            <input
              id="edit-reason"
              className="rounded-lg border border-border bg-background px-3 py-2"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </div>
        )}
        {errors.map((error) => (
          <p key={error} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ))}
        {stale !== undefined && (
          <section
            aria-label="Запис змінився, поки ви редагували"
            className="flex flex-col gap-3 rounded-[14px] bg-sunk p-4"
          >
            <h3 className="font-display font-semibold">Запис змінився, поки ви редагували</h3>
            {changed.map((field) => (
              <dl key={field.name} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="col-span-2 font-medium">{field.label}</dt>
                <dt className="text-muted-foreground">Ваша версія</dt>
                <dd>{shownOf(field.control, values[field.name])}</dd>
                <dt className="text-muted-foreground">Поточна версія</dt>
                <dd>
                  {shownOf(field.control, formValueOf(field.control, stale.fields[field.name]))}
                </dd>
              </dl>
            ))}
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                save(stale);
              }}
            >
              {`Зберегти поверх версії ${String(stale.recordVersion)}`}
            </Button>
          </section>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            Зберегти
          </Button>
          {record.at === 'edit' && retired && (
            <Button type="button" variant="secondary" disabled={busy} onClick={bringBack}>
              Повернути в ужиток
            </Button>
          )}
          {record.at === 'edit' && !retired && (
            <Button type="button" variant="danger" disabled={busy} onClick={retire}>
              Вивести з ужитку
            </Button>
          )}
        </div>
      </form>
      {pending !== undefined && (
        <ConfirmDialog
          title={pending.title}
          confirmLabel={pending.confirm}
          onConfirm={async (reason) => {
            await pending.run(reason);
          }}
          onClose={() => {
            setPending(undefined);
          }}
          refusalText={String}
        />
      )}
    </>
  );
}
