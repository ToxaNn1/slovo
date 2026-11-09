import type { AdminApiOutputs } from '@slovo/contracts/admin-api';
import { useState, type ReactNode } from 'react';

import { adminApi } from '../../api';
import { cn } from '../../lib/utils';
import { ConfirmDialog, type PendingWrite } from '../confirm-dialog';
import { Button } from '../ui/button';
import { useQueueBatches, useQueueFlags, useQueueReports, useQueueWrite } from './queries';

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

const when = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

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
          onConfirm={(reason) => {
            pending.run(reason);
            return Promise.resolve();
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

function Batches({ batches, confirm }: { batches: readonly Batch[]; confirm: Confirm }) {
  const review = useQueueWrite(adminApi.contentQueue.review);
  const rollback = useQueueWrite(adminApi.contentQueue.rollback);
  const skipped = rollback.data?.skipped.length ?? 0;
  return (
    <Block title="Пачки Агентів">
      {rollback.isSuccess ? (
        <p role="status" className={noticeClass}>
          Пачку відкочено. {skipped === 0 ? null : <span>{records(skipped)} пропущено</span>}
        </p>
      ) : null}
      {review.isError || rollback.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося. Спробуйте ще раз.
        </p>
      ) : null}
      <ul aria-label="Пачки">
        {batches.map((batch) => (
          <li key={batch.id} className={itemClass}>
            <span className="flex grow flex-wrap items-center gap-2 text-[12.5px] text-subtle">
              <AgentTag author={batch.author} />
              <span>{when(batch.createdAt)}</span>
              <span>
                +{batch.added} нових · {batch.changed} змінено
              </span>
            </span>
            <Button
              size="sm"

              onClick={() => {
                confirm({
                  title: `Позначити пачку ${batch.author} перевіреною?`,
                  confirm: 'Позначити перевіреним',
                  run: (reason) => {
                    review.mutate({ batchId: batch.id, reason });
                  },
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
                  run: (reason) => {
                    rollback.mutate({ batchId: batch.id, reason });
                  },
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
  const resolve = useQueueWrite(adminApi.contentQueue.resolveFlag);
  const decide = (flag: Flag, decision: 'accept' | 'reject', label: string) => () => {
    confirm({
      title: `${label} прапорець на ${flag.recordId}?`,
      confirm: label,
      run: (reason) => {
        resolve.mutate({ id: flag.id, decision, reason });
      },
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
                {when(flag.at)}
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
  const resolve = useQueueWrite(adminApi.contentQueue.resolveReport);
  return (
    <Block title="Помилки в записах">
      {resolve.isError ? (
        <p role="alert" className={cn(noticeClass, 'text-destructive')}>
          Не вдалося. Спробуйте ще раз.
        </p>
      ) : null}
      <ul aria-label="Звіти">
        {reports.map((report) => (
          <li key={report.id} className={itemClass}>
            <strong className="w-[150px] font-semibold">{report.entryId}</strong>
            <span className="flex min-w-[200px] grow flex-col gap-0.5">
              <span>{report.comment}</span>
              <span className="text-xs text-subtle">
                {MISTAKE_TYPES[report.type]} · {when(report.receivedAt)} · версія застосунку{' '}
                {report.appVersion} · версія контенту {report.contentVersion}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                confirm({
                  title: `Позначити помилку в ${report.entryId} вирішеною? Звіт буде видалено.`,
                  confirm: 'Вирішено',
                  run: (reason) => {
                    resolve.mutate({ id: report.id, reason });
                  },
                });
              }}
            >
              Вирішено
            </Button>
          </li>
        ))}
      </ul>
    </Block>
  );
}
