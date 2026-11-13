import type { AdminApiOutputs, AlertThresholdKey } from '@slovo/contracts/admin-api';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { adminApi } from '../api';
import { useAdminWrite } from '../components/admin-write';
import { ConfirmDialog, type PendingWrite } from '../components/confirm-dialog';
import { Button } from '../components/ui/button';
import { useSignedInAdmin } from '../session';

export const Route = createFileRoute('/security')({
  component: Security,
});

type Role = 'owner' | 'admin';
type Action = AdminApiOutputs['actions']['actions'][number];
type AlertThreshold = AdminApiOutputs['alertThresholds']['thresholds'][number];

const ROLE_LABELS: Readonly<Record<Role, string>> = { owner: 'Власник', admin: 'Адмін' };

const REFUSALS: Readonly<Record<string, string>> = {
  taken: 'Ця пошта вже має доступ.',
  self: 'Свою роль і свій доступ змінює інший Власник.',
  unknown: 'Цього вже немає: оновіть сторінку.',
  'name-taken': 'Цю назву вже видано; оберіть іншу.',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

const inputClass = 'h-9 rounded-lg border border-border bg-background px-3 text-sm';

/** What the Власник reads of a refused write. */
function refusalOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const { data } = error;
    if (typeof data === 'object' && data !== null && 'refusal' in data) {
      const text = REFUSALS[String(data.refusal)];
      if (text !== undefined) return text;
    }
  }
  return 'Не вдалося. Спробуйте ще раз.';
}

/** Who wrote a row of the Action log. */
function authorOf(who: Action['who']): string {
  switch (who.kind) {
    case 'admin-user':
      return who.email;
    case 'agent':
      return `Агент ${who.name}`;
    case 'command':
      return `команда ${who.command}`;
  }
}

const shown = (value: unknown) => (value === null ? '—' : JSON.stringify(value));

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

type Confirm = (write: PendingWrite) => void;

/** Безпека: a Власник only; an Адмін reads why it stays closed. */
function Security() {
  const admin = useSignedInAdmin();
  if (admin?.role !== 'owner') {
    return (
      <section aria-label="Безпека" className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">Безпека відкрита лише Власнику.</p>
      </section>
    );
  }
  return <OwnerSecurity email={admin.email} />;
}

function OwnerSecurity({ email }: { email: string }) {
  const [pending, setPending] = useState<PendingWrite | null>(null);
  return (
    <section aria-label="Безпека" className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <Link
          to="/sessions"
          className="rounded-lg bg-sunk px-3 py-1.5 text-[12.5px] text-foreground no-underline hover:bg-border"
        >
          Мої сесії
        </Link>
      </div>
      <People self={email} confirm={setPending} />
      <AgentTokens confirm={setPending} />
      <AlertThresholds confirm={setPending} />
      <ActionLog />
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
    </section>
  );
}

function People({ self, confirm }: { self: string; confirm: Confirm }) {
  const people = useQuery({ queryKey: ['people'], queryFn: () => adminApi.people() });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const invite = useAdminWrite(adminApi.invite, () => {
    setEmail('');
  });
  const changeRole = useAdminWrite(adminApi.setRole);
  const remove = useAdminWrite(adminApi.removePerson);

  function onInvite(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const invitee = email.trim();
    if (invitee === '') return;
    confirm({
      title: `Запросити ${invitee} як ${ROLE_LABELS[role]}а?`,
      confirm: 'Запросити',
      run: (reason) => invite.mutateAsync({ email: invitee, role, reason }),
    });
  }

  return (
    <Block title="Люди і доступ">
      <ul
        aria-label="Люди"
        className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-panel"
      >
        {(people.data?.people ?? []).map((person) => {
          const other: Role = person.role === 'owner' ? 'admin' : 'owner';
          return (
            <li
              key={person.email}
              className="flex flex-wrap items-center gap-3 px-[18px] py-3 text-[13px]"
            >
              <span className="grow">
                {person.email}{' '}
                <span
                  className={`ml-2 rounded-md px-2 py-0.5 text-[11.5px] font-semibold ${person.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-sunk text-muted-foreground'}`}
                >
                  {ROLE_LABELS[person.role]}
                </span>
                {person.signedInYet ? '' : <span className="ml-2 text-warn">ще не входили</span>}
              </span>
              {person.email === self ? (
                <span className="text-muted-foreground">це ви</span>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      confirm({
                        title: `Зробити ${person.email} ${ROLE_LABELS[other]}ом?`,
                        confirm: 'Змінити роль',
                        danger: true,
                        run: (reason) =>
                          changeRole.mutateAsync({ email: person.email, role: other, reason }),
                      });
                    }}
                  >
                    Зробити {ROLE_LABELS[other]}ом
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      confirm({
                        title: `Забрати доступ у ${person.email}?`,
                        confirm: 'Забрати доступ',
                        danger: true,
                        run: (reason) => remove.mutateAsync({ email: person.email, reason }),
                      });
                    }}
                  >
                    Забрати доступ
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={onInvite} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Пошта
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Роль
          <select
            className={inputClass}
            value={role}
            onChange={(event) => {
              setRole(event.target.value === 'owner' ? 'owner' : 'admin');
            }}
          >
            <option value="admin">Адмін</option>
            <option value="owner">Власник</option>
          </select>
        </label>
        <Button type="submit" disabled={invite.isPending}>
          Запросити
        </Button>
      </form>
    </Block>
  );
}

function AgentTokens({ confirm }: { confirm: Confirm }) {
  const tokens = useQuery({ queryKey: ['agent-tokens'], queryFn: () => adminApi.agentTokens() });
  const [name, setName] = useState('');
  // The one-time token lives here alone: once closed, only names render.
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const issue = useAdminWrite(adminApi.issueAgentToken, (output) => {
    setIssued(output);
    setName('');
  });
  const revoke = useAdminWrite(adminApi.revokeAgentToken);

  function onIssue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const agent = name.trim();
    if (agent === '') return;
    confirm({
      title: `Видати токен Агенту ${agent}?`,
      confirm: 'Видати токен',
      run: (reason) => issue.mutateAsync({ name: agent, reason }),
    });
  }

  return (
    <Block title="Токени Агентів">
      {issued === null ? null : (
        <div role="status" className="flex flex-col gap-2 rounded-[14px] bg-sunk px-4 py-3 text-sm">
          <p>Токен Агента {issued.name}. Його видно лише зараз: скопіюйте і збережіть.</p>
          <code className="break-all font-mono">{issued.token}</code>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(issued.token);
              }}
            >
              Скопіювати
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIssued(null);
              }}
            >
              Закрити
            </Button>
          </div>
        </div>
      )}
      <ul
        aria-label="Токени"
        className="flex flex-col divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-panel"
      >
        {(tokens.data?.tokens ?? []).map((token) => (
          <li
            key={token.name}
            className="flex flex-wrap items-center gap-3 px-[18px] py-3 text-[13px]"
          >
            <span className="grow">
              {token.name} · видано {when(token.createdAt)}
              {token.revokedAt === null ? '' : ` · відкликано ${when(token.revokedAt)}`}
            </span>
            {token.revokedAt === null ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  confirm({
                    title: `Відкликати токен Агента ${token.name}?`,
                    confirm: 'Відкликати',
                    danger: true,
                    run: (reason) => revoke.mutateAsync({ name: token.name, reason }),
                  });
                }}
              >
                Відкликати
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <form onSubmit={onIssue} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Назва Агента
          <input
            className={inputClass}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <Button type="submit" disabled={issue.isPending}>
          Видати токен
        </Button>
      </form>
    </Block>
  );
}

/** What each alert threshold measures, as the Власник reads it. */
const THRESHOLD_LABELS: Readonly<Record<AlertThresholdKey, string>> = {
  crashFree: 'Сесії без падінь, %',
  issueEvents: 'Подій нової помилки за годину',
  apiErrors: 'Помилки API 5xx за 15 хв, %',
  batchRecords: 'Записів у пакеті',
  activityDrop: 'Падіння активності, %',
};

const number = (value: number) => value.toLocaleString('uk-UA', { maximumFractionDigits: 2 });

function AlertThresholds({ confirm }: { confirm: Confirm }) {
  const thresholds = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: () => adminApi.alertThresholds(),
  });
  const change = useAdminWrite(adminApi.setAlertThreshold);
  return (
    <Block title="Пороги сповіщень">
      <ul className="flex flex-col gap-2">
        {(thresholds.data?.thresholds ?? []).map((threshold) => (
          // Keyed by value too: a changed threshold starts its field afresh.
          <li key={`${threshold.key}-${String(threshold.value)}`}>
            <ThresholdForm threshold={threshold} confirm={confirm} change={change.mutateAsync} />
          </li>
        ))}
      </ul>
    </Block>
  );
}

function ThresholdForm({
  threshold,
  confirm,
  change,
}: {
  threshold: AlertThreshold;
  confirm: Confirm;
  change: (input: { key: AlertThresholdKey; value: number; reason: string }) => Promise<unknown>;
}) {
  const label = THRESHOLD_LABELS[threshold.key];
  const [draft, setDraft] = useState(String(threshold.value));
  const value = Number(draft.replace(',', '.'));
  const valid = draft.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100_000;

  function onChange(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || value === threshold.value) return;
    confirm({
      title: `Змінити поріг «${label}» з ${number(threshold.value)} на ${number(value)}?`,
      confirm: 'Змінити поріг',
      run: (reason) => change({ key: threshold.key, value, reason }),
    });
  }

  return (
    <form
      aria-label={`Поріг: ${label}`}
      onSubmit={onChange}
      className="flex flex-wrap items-end gap-3 rounded-[14px] bg-surface px-4 py-3 shadow-panel text-sm"
    >
      <label className="flex grow flex-col gap-1">
        {label}
        <input
          inputMode="decimal"
          className={inputClass}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
      </label>
      <span className="flex h-9 min-w-24 items-center text-muted-foreground">
        Типово {number(threshold.default)}
      </span>
      <Button type="submit" variant="secondary" disabled={!valid || value === threshold.value}>
        Змінити поріг
      </Button>
    </form>
  );
}

function ActionLog() {
  const { edition } = useSearch({ from: '__root__' });
  const actions = useQuery({
    queryKey: ['actions', edition],
    queryFn: () => adminApi.actions(edition === undefined ? {} : { editionId: edition }),
  });
  return (
    <Block title="Журнал дій">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="text-xs text-subtle">
            <tr>
              <th className="px-2 py-[9px] font-normal">Хто</th>
              <th className="px-2 py-[9px] font-normal">Коли</th>
              <th className="px-2 py-[9px] font-normal">Що</th>
              <th className="px-2 py-[9px] font-normal">Було</th>
              <th className="px-2 py-[9px] font-normal">Стало</th>
              <th className="px-2 py-[9px] font-normal">Причина</th>
            </tr>
          </thead>
          <tbody>
            {(actions.data?.actions ?? []).map((row, index) => (
              <tr key={`${row.at}-${String(index)}`} className="border-t border-border">
                <td className="px-2 py-[9px]">{authorOf(row.who)}</td>
                <td className="px-2 py-[9px]">{when(row.at)}</td>
                <td className="px-2 py-[9px] font-mono">{row.what}</td>
                <td className="px-2 py-[9px] font-mono">{shown(row.before)}</td>
                <td className="px-2 py-[9px] font-mono">{shown(row.after)}</td>
                <td className="px-2 py-[9px]">{row.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
