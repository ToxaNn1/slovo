import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { adminApi } from '../../api';
import { cn } from '../../lib/utils';
import { refusalText } from '../../session';
import { CONTENT_KINDS, type KindEditor } from '../content-editor/kinds';
import { RecordForm } from '../content-editor/record-form';
import { Button } from '../ui/button';
import { readableField } from './readable';

interface Reviewed {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly recordVersion: number;
}

/** What the card shows under it: the three keys, the retire reason, or the record form in its place. */
type Mode = 'keys' | 'retire' | 'edit';

/** A record already reviewed here, so «Назад» can show it again; a retired one by the batch that can bring it back. */
type Step =
  | { readonly id: string; readonly outcome: 'checked' }
  | { readonly id: string; readonly outcome: 'retired'; readonly batchId: string };

const RESTORE_REASON = 'Повернуто з перегляду';

/**
 * «Перегляд»: per kind, the records no Admin user has checked since their last
 * change, one at a time as a card to read (ADR 0143). «Так» (key 1) checks it,
 * «Ні» (key 2) retires it with an optional reason, «Редагувати» (key 3) opens
 * the record form, whose save checks it at its new version; each shows the next.
 * «Назад» (←) shows the records reviewed here again, newest first, to edit one
 * or bring a retired one back; «Далі» (→) returns towards the queue.
 */
export function ContentReview({ editionId }: { readonly editionId: string }) {
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<KindEditor>(CONTENT_KINDS[0] ?? never());
  const [done, setDone] = useState(0);
  const [mode, setMode] = useState<Mode>('keys');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [history, setHistory] = useState<readonly Step[]>([]);
  /** The place in `history` shown again, or none while the queue is shown. */
  const [back, setBack] = useState<number>();
  const kind = editor.kind;
  const unchecked = useQuery({
    queryKey: ['content', 'unchecked', editionId, kind],
    queryFn: () => adminApi.content.unchecked({ editionId, kind }),
  });
  const step = back === undefined ? undefined : history[back];
  const earlier = useQuery({
    queryKey: ['content', 'record', editionId, kind, step?.id],
    queryFn: () => adminApi.content.record({ editionId, kind, id: step?.id ?? '' }),
    enabled: step !== undefined,
  });
  const record: Reviewed | undefined =
    step === undefined ? unchecked.data?.record : earlier.data && { id: step.id, ...earlier.data };

  /** Runs one write, then shows the next record of the queue, or the reviewed one again. */
  const write = async (run: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await run();
      setMode('keys');
      setReason('');
    } catch (refusal) {
      setError(refusalText(refusal));
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ['content'] });
    }
  };
  /** Reviews the record of the queue and moves on to the next one. */
  const act = (run: (shown: Reviewed) => Promise<Step>) =>
    write(async () => {
      if (record === undefined || step !== undefined) return;
      const reviewed = await run(record);
      setHistory((steps) => [...steps, reviewed]);
      setDone((count) => count + 1);
    });

  const check = async (shown: Reviewed, recordVersion = shown.recordVersion): Promise<Step> => {
    await adminApi.content.check({ editionId, kind, id: shown.id, recordVersion });
    return { id: shown.id, outcome: 'checked' };
  };

  const retire = async (shown: Reviewed): Promise<Step> => {
    const { batchId } = await adminApi.content.openBatch({ editionId });
    const typed = reason.trim();
    await adminApi.content.retire({
      editionId,
      kind,
      id: shown.id,
      batchId,
      recordVersion: shown.recordVersion,
      ...(typed === '' ? {} : { reason: typed }),
    });
    return { id: shown.id, outcome: 'retired', batchId };
  };

  const restore = (retired: Step & { outcome: 'retired' }) =>
    write(() =>
      adminApi.contentQueue.rollback({ batchId: retired.batchId, reason: RESTORE_REASON }),
    );

  const goBack = () => {
    if (history.length === 0 || back === 0) return;
    setBack(back === undefined ? history.length - 1 : back - 1);
    setMode('keys');
    setError(undefined);
  };
  const goForward = () => {
    if (back === undefined) return;
    setBack(back + 1 < history.length ? back + 1 : undefined);
    setMode('keys');
    setError(undefined);
  };

  // The keys 1, 2 and 3, while no field takes the typing; listened anew each render, with its state.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (typing || mode !== 'keys' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowLeft') goBack();
      if (event.key === 'ArrowRight') goForward();
      if (event.key === '3') setMode('edit');
      if (step !== undefined) return;
      if (event.key === '1') void act((shown) => check(shown));
      if (event.key === '2') setMode('retire');
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  const total = unchecked.data?.total ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <div
        role="tablist"
        aria-label="Види записів"
        className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-sunk p-[3px]"
      >
        {CONTENT_KINDS.map((each) => (
          <button
            key={each.kind}
            type="button"
            role="tab"
            aria-selected={each.kind === kind}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[12.5px]',
              each.kind === kind
                ? 'bg-surface font-semibold shadow-panel'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => {
              setEditor(each);
              setDone(0);
              setHistory([]);
              setBack(undefined);
              setMode('keys');
              setError(undefined);
            }}
          >
            {each.name}
          </button>
        ))}
      </div>

      {step === undefined && unchecked.data !== undefined && record === undefined && (
        <p className="rounded-2xl bg-surface p-12 text-center font-display text-lg font-medium shadow-panel">
          Усе переглянуто
        </p>
      )}

      {record !== undefined && (
        <div className="flex max-w-[720px] flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={history.length === 0 || back === 0 || mode !== 'keys'}
              onClick={goBack}
            >
              ← Назад
            </Button>
            {step !== undefined && (
              <Button
                type="button"
                variant="secondary"
                disabled={mode !== 'keys'}
                onClick={goForward}
              >
                Далі →
              </Button>
            )}
            <p className="text-[13px] text-muted-foreground tabular-nums">
              {step === undefined
                ? `${String(done + 1)} з ${String(done + total)}`
                : `Уже переглянуто: ${pastOutcome(step, earlier.data?.retired === true)}`}
            </p>
          </div>
          {mode !== 'edit' && (
            <article
              aria-label="Запис на перегляді"
              className="flex flex-col gap-3 rounded-[16px] bg-surface p-6 shadow-panel"
            >
              <dl className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-5 gap-y-2.5 text-[14px]">
                {editor.fields.map((field) => {
                  const text = readableField(field, record.fields);
                  if (text === undefined) return null;
                  return (
                    <div key={field.name} className="contents">
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="whitespace-pre-wrap">{text}</dd>
                    </div>
                  );
                })}
              </dl>
            </article>
          )}

          {error !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {mode === 'keys' && step !== undefined && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setMode('edit');
                }}
              >
                Редагувати <kbd className="text-[11px] opacity-70">3</kbd>
              </Button>
              {step.outcome === 'retired' && earlier.data?.retired === true && (
                <Button type="button" disabled={busy} onClick={() => void restore(step)}>
                  Повернути в ужиток
                </Button>
              )}
            </div>
          )}

          {mode === 'keys' && step === undefined && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void act((shown) => check(shown))}
              >
                Так <kbd className="text-[11px] opacity-70">1</kbd>
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setMode('retire');
                }}
              >
                Ні <kbd className="text-[11px] opacity-70">2</kbd>
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setMode('edit');
                }}
              >
                Редагувати <kbd className="text-[11px] opacity-70">3</kbd>
              </Button>
            </div>
          )}

          {mode === 'retire' && (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void act(retire);
              }}
            >
              <label htmlFor="review-retire-reason" className="text-[13px]">
                Причина (необов&apos;язково)
              </label>
              <input
                id="review-retire-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                }}
                className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[14px]"
              />
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={busy}>
                  Вивести з ужитку
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode('keys');
                    setReason('');
                  }}
                >
                  Скасувати
                </Button>
              </div>
            </form>
          )}

          {mode === 'edit' && (
            <div className="flex flex-col gap-3">
              <RecordForm
                key={`${kind}:${record.id}:${String(record.recordVersion)}`}
                editionId={editionId}
                editor={editor}
                fields={record.fields}
                record={{ at: 'edit', id: record.id, recordVersion: record.recordVersion }}
                onWritten={(written) => {
                  if (step === undefined) void act((shown) => check(shown, written.recordVersion));
                  else void write(() => check(record, written.recordVersion));
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                onClick={() => {
                  setMode('keys');
                }}
              >
                Скасувати
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** What became of a record reviewed here, as it stands now. */
function pastOutcome(step: Step, retired: boolean): string {
  if (retired) return 'виведено з ужитку';
  return step.outcome === 'retired' ? 'повернуто в ужиток' : 'перевірено';
}

function never(): never {
  throw new Error('no kind of record');
}
