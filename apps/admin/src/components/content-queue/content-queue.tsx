import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { adminApi } from '../../api';
import { cn } from '../../lib/utils';
import { ConfirmDialog, type PendingWrite } from '../confirm-dialog';
import { CONTENT_KINDS, categoryOptionsOf } from '../content-editor/kinds';
import { readableField } from '../content-review/readable';
import { useAdminWrite } from '../admin-write';
import { Button } from '../ui/button';
import { formatMoment } from '../../format';
import { useQueueBatches, useQueueFlags, useQueueReports } from './queries';

type Batch = AdminApiOutputs['contentQueue']['batches']['batches'][number];
type Flag = AdminApiOutputs['contentQueue']['flags']['flags'][number];
type Report = AdminApiOutputs['contentQueue']['reports']['reports'][number];
type Confirm = (write: PendingWrite) => void;

const MISTAKE_TYPES: Readonly<Record<Report['type'], string>> = {
  typo: 'одрук',
  stress: 'наголос',
  definition: 'визначення',
  other: 'інше',
};

const RECORDS = new Intl.PluralRules('uk-UA');
const RECORD_FORMS: Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> = {
  one: 'запис',
  few: 'записи',
};

/** «1 запис», «2 записи», «5 записів». */
const records = (count: number) =>
  `${String(count)} ${RECORD_FORMS[RECORDS.select(count)] ?? 'записів'}`;

const itemClass =
  'flex flex-wrap items-center gap-3 border-t border-border px-[18px] py-[9px] text-[13px]';

const noticeClass = 'border-t border-border px-[18px] py-[9px] text-[13px]';

/** One panel of the queue: a header row with its title, then its rows. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl bg-surface shadow-panel">
      <h2 className="px-[18px] py-[13px] font-display text-[13px] font-medium">{title}</h2>
      {children}
    </section>
  );
}

/** The Агент who wrote a batch or a flag, tagged as in the design. */
function AgentTag({ author }: { author: string }) {
  return (
    <span className="rounded-[5px] border border-dashed border-agent bg-agent-soft px-1.5 py-px font-mono text-[10.5px] font-semibold text-agent">
      агент · {author}
    </span>
  );
}

/** Черга контенту (ADR 0090): the Агент batches, the open flags and the Mistake Reports. */
export function ContentQueue() {
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const batches = useQueueBatches();
  const flags = useQueueFlags();
  const reports = useQueueReports();
  const loaded =
    batches.data !== undefined && flags.data !== undefined && reports.data !== undefined;
  const empty =
    loaded &&
    batches.data.batches.length === 0 &&
    flags.data.flags.length === 0 &&
    reports.data.reports.length === 0;
  return (
    <section aria-label="Черга контенту" className="flex flex-col gap-4">
      {batches.isError || flags.isError || reports.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося завантажити чергу.
        </p>
      ) : null}
      {empty ? (
        <p className="rounded-2xl bg-surface shadow-panel p-12 text-center font-display text-lg font-medium">
          Усе перевірено
        </p>
      ) : (
        <>
          <Batches batches={batches.data?.batches ?? []} confirm={setPending} />
          <Flags flags={flags.data?.flags ?? []} confirm={setPending} />
          <Reports reports={reports.data?.reports ?? []} confirm={setPending} />
        </>
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
          refusalText={String}
        />
      )}
    </section>
  );
}

/** What one action over the ticked batches did. */
type BulkDone =
  | { readonly action: 'review'; readonly count: number }
  | { readonly action: 'rollback'; readonly count: number; readonly skipped: number };

/**
 * One action over many batches: each batch is written in turn with the one
 * reason, a rollback newest first so a later batch never shadows an earlier
 * one. The queue reloads however it ends.
 */
function useBulkWrite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      action,
      batches,
      reason,
    }: {
      action: BulkDone['action'];
      batches: readonly Batch[];
      reason: string;
    }): Promise<BulkDone> => {
      if (action === 'review') {
        for (const batch of batches) {
          await adminApi.contentQueue.review({ batchId: batch.id, reason });
        }
        return { action, count: batches.length };
      }
      let skipped = 0;
      for (const batch of batches.toReversed()) {
        const output = await adminApi.contentQueue.rollback({ batchId: batch.id, reason });
        skipped += output.skipped.length;
      }
      return { action, count: batches.length, skipped };
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}

const BATCHES_OF: Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> = {
  one: 'пачку',
  few: 'пачки',
};

/** «1 пачку», «2 пачки», «5 пачок». */
const batchesOf = (count: number) =>
  `${String(count)} ${BATCHES_OF[RECORDS.select(count)] ?? 'пачок'}`;

function BulkNotice({ done }: { done: BulkDone }) {
  if (done.action === 'review') {
    return <>Позначено перевіреними {batchesOf(done.count)}.</>;
  }
  return (
    <>
      Відкочено {batchesOf(done.count)}.{' '}
      {done.skipped === 0 ? null : <span>{records(done.skipped)} пропущено</span>}
    </>
  );
}

/** «Вибрати всі»: ticked when every batch is, half-ticked when some are. */
function SelectAll({
  selected,
  total,
  onChange,
}: {
  selected: number;
  total: number;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label="Вибрати всі"
      className="size-4 accent-primary"
      checked={total > 0 && selected === total}
      disabled={total === 0}
      ref={(box) => {
        if (box !== null) box.indeterminate = selected > 0 && selected < total;
      }}
      onChange={onChange}
    />
  );
}

function Batches({ batches, confirm }: { batches: readonly Batch[]; confirm: Confirm }) {
  const review = useAdminWrite(adminApi.contentQueue.review);
  const rollback = useAdminWrite(adminApi.contentQueue.rollback);
  const bulk = useBulkWrite();
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const chosen = batches.filter((batch) => ticked.has(batch.id));
  const skipped = rollback.data?.skipped.length ?? 0;
  const tick = (id: string) => {
    setTicked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  };
  const runBulk = (action: BulkDone['action']) => async (reason: string) => {
    await bulk.mutateAsync({ action, batches: chosen, reason });
    setTicked(new Set());
  };
  return (
    <Block title="Пачки Агентів">
      {rollback.isSuccess ? (
        <p role="status" className={noticeClass}>
          Пачку відкочено. {skipped === 0 ? null : <span>{records(skipped)} пропущено</span>}
        </p>
      ) : null}
      {bulk.isSuccess ? (
        <p role="status" className={noticeClass}>
          <BulkNotice done={bulk.data} />
        </p>
      ) : null}
      {review.isError || rollback.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося. Спробуйте ще раз.
        </p>
      ) : null}
      <div className={cn(itemClass, 'bg-sunk/50')}>
        <label className="flex grow items-center gap-2 text-[12.5px] text-subtle">
          <SelectAll
            selected={chosen.length}
            total={batches.length}
            onChange={() => {
              setTicked(
                chosen.length === batches.length
                  ? new Set()
                  : new Set(batches.map((batch) => batch.id)),
              );
            }}
          />
          Вибрано {chosen.length} з {batches.length}
        </label>
        <Button
          size="sm"
          disabled={chosen.length === 0}
          onClick={() => {
            confirm({
              title: `Позначити перевіреними ${batchesOf(chosen.length)}?`,
              confirm: 'Позначити перевіреними',
              run: runBulk('review'),
            });
          }}
        >
          Позначити перевіреними ({chosen.length})
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={chosen.length === 0}
          onClick={() => {
            confirm({
              title: `Відкотити ${batchesOf(chosen.length)}? Записи, змінені після пачки, буде пропущено.`,
              confirm: 'Відкотити',
              danger: true,
              run: runBulk('rollback'),
            });
          }}
        >
          Відкотити ({chosen.length})
        </Button>
      </div>
      <ul aria-label="Пачки">
        {batches.map((batch) => (
          <li key={batch.id} className={itemClass}>
            <label className="flex grow flex-wrap items-center gap-2 text-[12.5px] text-subtle">
              <input
                type="checkbox"
                aria-label={`Вибрати пачку ${batch.author} ${formatMoment(batch.createdAt)}`}
                className="size-4 accent-primary"
                checked={ticked.has(batch.id)}
                onChange={() => {
                  tick(batch.id);
                }}
              />
              <AgentTag author={batch.author} />
              <span>{formatMoment(batch.createdAt)}</span>
              <span>
                +{batch.added} нових · {batch.changed} змінено
              </span>
            </label>
            <Button
              size="sm"
              onClick={() => {
                confirm({
                  title: `Позначити пачку ${batch.author} перевіреною?`,
                  confirm: 'Позначити перевіреним',
                  run: (reason) => review.mutateAsync({ batchId: batch.id, reason }),
                });
              }}
            >
              Позначити перевіреним
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                confirm({
                  title: `Відкотити пачку ${batch.author}? Записи, змінені після неї, буде пропущено.`,
                  confirm: 'Відкотити пачку',
                  danger: true,
                  run: (reason) => rollback.mutateAsync({ batchId: batch.id, reason }),
                });
              }}
            >
              Відкотити пачку
            </Button>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Flags({ flags, confirm }: { flags: readonly Flag[]; confirm: Confirm }) {
  const resolve = useAdminWrite(adminApi.contentQueue.resolveFlag);
  const decide = (flag: Flag, decision: 'accept' | 'reject', label: string) => () => {
    confirm({
      title: `${label} прапорець на ${flag.recordId}?`,
      confirm: label,
      run: (reason) => resolve.mutateAsync({ id: flag.id, decision, reason }),
    });
  };
  return (
    <Block title="Прапорці">
      {resolve.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося. Спробуйте ще раз.
        </p>
      ) : null}
      <ul aria-label="Відкриті прапорці">
        {flags.map((flag) => (
          <li key={flag.id} className={itemClass}>
            <strong className="w-[150px] font-semibold">{flag.recordId}</strong>
            <span className="flex min-w-[200px] grow flex-col gap-0.5">
              <span className="text-muted-foreground">{flag.explanation}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-subtle">
                <AgentTag author={flag.author} />
                {formatMoment(flag.at)}
              </span>
            </span>
            <Button size="sm" onClick={decide(flag, 'accept', 'Прийняти')}>
              Прийняти
            </Button>
            <Button size="sm" variant="secondary" onClick={decide(flag, 'reject', 'Відхилити')}>
              Відхилити
            </Button>
          </li>
        ))}
      </ul>
    </Block>
  );
}

function Reports({ reports, confirm }: { reports: readonly Report[]; confirm: Confirm }) {
  const resolve = useAdminWrite(adminApi.contentQueue.resolveReport);
  return (
    <Block title="Помилки в записах">
      {resolve.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося. Спробуйте ще раз.
        </p>
      ) : null}
      <ul aria-label="Звіти">
        {reports.map((report) => (
          <ReportRow
            key={report.id}
            report={report}
            resolve={() => {
              confirm({
                title: `Позначити помилку в ${report.entryId} вирішеною? Звіт буде видалено.`,
                confirm: 'Вирішено',
                run: (reason) => resolve.mutateAsync({ id: report.id, reason }),
              });
            }}
          />
        ))}
      </ul>
    </Block>
  );
}

/**
 * One Mistake Report: what the reader said, who sent it (the email of a
 * signed-in reader, to thank them) and, opened, the whole Entry it names as
 * the content database keeps it now.
 */
function ReportRow({ report, resolve }: { report: Report; resolve: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border">
      <div className={cn(itemClass, 'border-t-0')}>
        <strong className="w-[150px] font-semibold">{report.entryId}</strong>
        <span className="flex min-w-[200px] grow flex-col gap-0.5">
          <span>{report.comment}</span>
          <span className="text-xs text-subtle">
            {MISTAKE_TYPES[report.type]} · {formatMoment(report.receivedAt)} · версія застосунку{' '}
            {report.appVersion} · версія контенту {report.contentVersion} ·{' '}
            {report.accountEmail === null ? (
              'анонімно'
            ) : (
              <a className="underline" href={`mailto:${report.accountEmail}`}>
                {report.accountEmail}
              </a>
            )}
          </span>
        </span>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={open}
          aria-label={`${open ? 'Сховати' : 'Показати'} запис ${report.entryId}`}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? 'Сховати запис' : 'Показати запис'}
        </Button>
        <Button size="sm" variant="secondary" onClick={resolve}>
          Вирішено
        </Button>
      </div>
      {open ? <ReportedEntry report={report} /> : null}
    </li>
  );
}

/** The Entry a report names, every field the content database keeps of it, as «Перегляд» reads them. */
function ReportedEntry({ report }: { report: Report }) {
  const card = useQuery({
    queryKey: ['edition-card', report.editionId],
    queryFn: () => adminApi.editionCard({ editionId: report.editionId }),
  });
  const { entry } = report;
  if (entry === null) {
    return (
      <p className={cn(noticeClass, 'text-muted-foreground')}>Запису з таким id у виданні немає.</p>
    );
  }
  const categories = categoryOptionsOf(card.data);
  const fields = CONTENT_KINDS.find((editor) => editor.kind === entry.kind)?.fields ?? [];
  return (
    <article
      aria-label={`Запис ${report.entryId}`}
      className="mx-[18px] mb-3 flex flex-col gap-2 rounded-xl bg-sunk p-4"
    >
      {entry.retired ? <p className="text-xs text-destructive">Знято з використання</p> : null}
      <dl className="grid grid-cols-[minmax(120px,max-content)_1fr] gap-x-5 gap-y-2 text-[13px]">
        {fields.map((field) => {
          const text = readableField(field, entry.fields, categories);
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
  );
}
