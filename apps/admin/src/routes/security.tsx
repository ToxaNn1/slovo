import type { AdminApiOutputs, AlertThresholdKey } from '@slovo/contracts/admin-api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, useSearch } from '@tanstack/react-router';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { adminApi } from '../api';
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

const inputClass = 'h-9 rounded-md border border-border bg-surface px-3 text-sm';

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

/** Безпека: a Власник only; an Адмін reads why it stays closed. */
function Security() {
  const admin = useSignedInAdmin();
  if (admin?.role !== 'owner') {
    return (
      <section aria-labelledby="section-title" className="flex flex-col gap-2">
        <h1 id="section-title" className="font-display text-2xl font-semibold">
          Безпека
        </h1>
        <p className="text-sm text-muted-foreground">Безпека відкрита лише Власнику.</p>
      </section>
    );
  }
  return <OwnerSecurity email={admin.email} />;
}

function OwnerSecurity({ email }: { email: string }) {
  const [pending, setPending] = useState<PendingWrite | null>(null);
  return (
    <section aria-labelledby="section-title" className="flex flex-col gap-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 id="section-title" className="font-display text-2xl font-semibold">
          Безпека
        </h1>
        <Link to="/sessions" className="text-sm underline">
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

/** A write of Безпека that refreshes what it changed and keeps its refusal to show. */
function useSecurityWrite<I, O>(write: (input: I) => Promise<O>, onDone?: (output: O) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: write,
    onSuccess: async (output) => {
      onDone?.(output);
      await queryClient.invalidateQueries();
    },
  });
}

function People({ self, confirm }: { self: string; confirm: (write: PendingWrite) => void }) {
  const people = useQuery({ queryKey: ['people'], queryFn: () => adminApi.people() });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const invite = useSecurityWrite(adminApi.invite, () => {
    setEmail('');
  });
  const changeRole = useSecurityWrite(adminApi.setRole);
  const remove = useSecurityWrite(adminApi.removePerson);
  const failed = [invite, changeRole, remove].find((write) => write.isError);

  function onInvite(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const invitee = email.trim();
    if (invitee === '') return;
    confirm({
      title: `Запросити ${invitee} як ${ROLE_LABELS[role]}а?`,
      confirm: 'Запросити',
      run: (reason) => {
        invite.mutate({ email: invitee, role, reason });
      },
    });
  }

  return (
    <Block title="Люди і доступ">
      <ul aria-label="Люди" className="flex flex-col gap-2">
        {(people.data?.people ?? []).map((person) => {
          const other: Role = person.role === 'owner' ? 'admin' : 'owner';
          return (
            <li
              key={person.email}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            >
              <span className="grow">
                {person.email} · {ROLE_LABELS[person.role]}
                {person.signedInYet ? '' : ' · ще не входили'}
              </span>
              {person.email === self ? (
                <span className="text-muted-foreground">це ви</span>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      confirm({
                        title: `Зробити ${person.email} ${ROLE_LABELS[other]}ом?`,
                        confirm: 'Змінити роль',
                        run: (reason) => {
                          changeRole.mutate({ email: person.email, role: other, reason });
                        },
                      });
                    }}
                  >
                    Зробити {ROLE_LABELS[other]}ом
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      confirm({
                        title: `Забрати доступ у ${person.email}?`,
                        confirm: 'Забрати доступ',
                        run: (reason) => {
                          remove.mutate({ email: person.email, reason });
                        },
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
        <Button type="submit">Запросити</Button>
      </form>
      {failed === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {refusalOf(failed.error)}
        </p>
      )}
    </Block>
  );
}

function AgentTokens({ confirm }: { confirm: (write: PendingWrite) => void }) {
  const tokens = useQuery({ queryKey: ['agent-tokens'], queryFn: () => adminApi.agentTokens() });
  const [name, setName] = useState('');
  // The one-time token lives here alone: once closed, only names render.
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);
  const issue = useSecurityWrite(adminApi.issueAgentToken, (output) => {
    setIssued(output);
    setName('');
  });
  const revoke = useSecurityWrite(adminApi.revokeAgentToken);
  const failed = [issue, revoke].find((write) => write.isError);

  function onIssue(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const agent = name.trim();
    if (agent === '') return;
    confirm({
      title: `Видати токен Агенту ${agent}?`,
      confirm: 'Видати токен',
      run: (reason) => {
        issue.mutate({ name: agent, reason });
      },
    });
  }

  return (
    <Block title="Токени Агентів">
      {issued === null ? null : (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm"
        >
          <p>Токен Агента {issued.name}. Його видно лише зараз: скопіюйте і збережіть.</p>
          <code className="break-all font-mono">{issued.token}</code>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
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
      <ul aria-label="Токени" className="flex flex-col gap-2">
        {(tokens.data?.tokens ?? []).map((token) => (
          <li
            key={token.name}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
          >
            <span className="grow">
              {token.name} · видано {when(token.createdAt)}
              {token.revokedAt === null ? '' : ` · відкликано ${when(token.revokedAt)}`}
            </span>
            {token.revokedAt === null ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  confirm({
                    title: `Відкликати токен Агента ${token.name}?`,
                    confirm: 'Відкликати',
                    run: (reason) => {
                      revoke.mutate({ name: token.name, reason });
                    },
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
        <Button type="submit">Видати токен</Button>
      </form>
      {failed === undefined ? null : (
        <p role="alert" className="text-sm text-destructive">
          {refusalOf(failed.error)}
        </p>
      )}
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

function AlertThresholds({ confirm }: { confirm: (write: PendingWrite) => void }) {
  const thresholds = useQuery({
    queryKey: ['alert-thresholds'],
    queryFn: () => adminApi.alertThresholds(),
  });
  const change = useSecurityWrite(adminApi.setAlertThreshold);
  return (
    <Block title="Пороги сповіщень">
      <ul className="flex flex-col gap-2">
        {(thresholds.data?.thresholds ?? []).map((threshold) => (
          // Keyed by value too: a changed threshold starts its field afresh.
          <li key={`${threshold.key}-${String(threshold.value)}`}>
            <ThresholdForm threshold={threshold} confirm={confirm} change={change.mutate} />
          </li>
        ))}
      </ul>
      {change.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {refusalOf(change.error)}
        </p>
      ) : null}
    </Block>
  );
}

function ThresholdForm({
  threshold,
  confirm,
  change,
}: {
  threshold: AlertThreshold;
  confirm: (write: PendingWrite) => void;
  change: (input: { key: AlertThresholdKey; value: number; reason: string }) => void;
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
      run: (reason) => {
        change({ key: threshold.key, value, reason });
      },
    });
  }

  return (
    <form
      aria-label={`Поріг: ${label}`}
      onSubmit={onChange}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
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
      <span className="text-muted-foreground">Типово {number(threshold.default)}</span>
      <Button type="submit" variant="outline" disabled={!valid || value === threshold.value}>
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
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Хто</th>
              <th className="px-2 py-1">Коли</th>
              <th className="px-2 py-1">Що</th>
              <th className="px-2 py-1">Було</th>
              <th className="px-2 py-1">Стало</th>
              <th className="px-2 py-1">Причина</th>
            </tr>
          </thead>
          <tbody>
            {(actions.data?.actions ?? []).map((row, index) => (
              <tr key={`${row.at}-${String(index)}`} className="border-t border-border">
                <td className="px-2 py-1">{authorOf(row.who)}</td>
                <td className="px-2 py-1">{when(row.at)}</td>
                <td className="px-2 py-1 font-mono">{row.what}</td>
                <td className="px-2 py-1 font-mono">{shown(row.before)}</td>
                <td className="px-2 py-1 font-mono">{shown(row.after)}</td>
                <td className="px-2 py-1">{row.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Block>
  );
}
