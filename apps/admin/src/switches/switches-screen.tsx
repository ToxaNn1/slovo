import { FeatureSwitchesSchema, type FeatureSwitch } from '@slovo/contracts';
import type { AdminEdition } from '@slovo/contracts/admin-api';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Button } from '../components/ui/button';
import { MinimumsEditor, RuleEditor } from './rule-editor';
import {
  cellOf,
  cellText,
  rulesOf,
  summaryText,
  switchRefusalText,
  targetedText,
  withEveryone,
  type Cell,
} from './switch-state';

const FEATURES: readonly FeatureSwitch[] = FeatureSwitchesSchema.keyof().options;

/** The key of every Edition's switches; a write refetches them all. */
const SWITCHES_KEY = ['switches'] as const;

const selectClass =
  'h-9 rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

/** A write the admin is confirming. */
type Pending =
  | {
      readonly kind: 'toggle';
      readonly feature: FeatureSwitch;
      readonly edition: AdminEdition;
      readonly on: boolean;
    }
  | {
      readonly kind: 'kill';
      readonly feature: FeatureSwitch;
      readonly edition: AdminEdition | undefined;
    };

/**
 * Свічі: every feature against the Editions, the Rules of one feature in one
 * Edition, the force-update minimums and the Kill switch.
 */
export function SwitchesScreen() {
  const search = useSearch({ from: '__root__' });
  const queryClient = useQueryClient();
  const editionsQuery = useQuery({ queryKey: ['editions'], queryFn: () => adminApi.editions() });
  const editions = editionsQuery.data?.editions ?? [];
  const answers = useQueries({
    queries: editions.map((edition) => ({
      queryKey: [...SWITCHES_KEY, edition.id],
      queryFn: () => adminApi.switches({ editionId: edition.id }),
    })),
  });
  const [pending, setPending] = useState<Pending>();
  const [editing, setEditing] = useState<FeatureSwitch>();

  const picked = editions.find((edition) => edition.id === search.edition);
  const loaded = editions.flatMap((edition, index) => {
    const answer = answers[index]?.data;
    return answer === undefined ? [] : [{ edition, answer }];
  });
  const columns =
    picked === undefined ? loaded : loaded.filter(({ edition }) => edition === picked);
  const refetch = () => queryClient.invalidateQueries({ queryKey: SWITCHES_KEY });
  const answerOf = (edition: AdminEdition) =>
    loaded.find((column) => column.edition === edition)?.answer;

  const write = async (reason: string) => {
    if (pending === undefined) return;
    if (pending.kind === 'toggle') {
      const answer = answerOf(pending.edition);
      await adminApi.setRules({
        editionId: pending.edition.id,
        feature: pending.feature,
        rules: withEveryone(
          answer === undefined ? [] : rulesOf(answer, pending.feature),
          pending.on,
        ),
        reason,
      });
    } else {
      await adminApi.kill({ feature: pending.feature, editionId: pending.edition?.id, reason });
    }
    await refetch();
  };

  const pickedAnswer = picked === undefined ? undefined : answerOf(picked);

  return (
    <section aria-labelledby="section-title" className="flex flex-1 flex-col gap-6">
      <h1 id="section-title" className="font-display text-2xl font-semibold">
        Свічі
      </h1>

      <KillSwitch
        scope={picked}
        onKill={(feature) => {
          setPending({ kind: 'kill', feature, edition: picked });
        }}
      />

      {picked === undefined ? (
        <p className="text-sm text-muted-foreground">
          Оберіть одну Edition, щоб змінити правила або мінімальні версії.
        </p>
      ) : null}

      {picked !== undefined && editing !== undefined && pickedAnswer !== undefined ? (
        <RuleEditor
          key={`${picked.id}-${editing}`}
          edition={picked}
          feature={editing}
          rules={rulesOf(pickedAnswer, editing)}
          onSaved={refetch}
          onClose={() => {
            setEditing(undefined);
          }}
        />
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="p-3 font-medium">
                Світч
              </th>
              {picked === undefined ? (
                <th scope="col" className="p-3 font-medium">
                  Усі Editions
                </th>
              ) : null}
              {columns.map(({ edition }) => (
                <th key={edition.id} scope="col" className="p-3 font-medium">
                  {edition.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loaded.length < editions.length || editions.length === 0
              ? null
              : FEATURES.map((feature) => {
                  const cells = columns.map(({ edition, answer }) => ({
                    edition,
                    cell: cellOf(answer, feature),
                  }));
                  return (
                    <tr key={feature} className="border-b border-border last:border-0">
                      <th scope="row" className="p-3 text-left font-mono font-normal">
                        {feature}
                      </th>
                      {picked === undefined ? (
                        <td className="p-3">{summaryText(cells.map(({ cell }) => cell))}</td>
                      ) : null}
                      {cells.map(({ edition, cell }) => (
                        <td key={edition.id} className="p-3">
                          <CellView
                            feature={feature}
                            edition={edition}
                            cell={cell}
                            exact={picked !== undefined}
                            onToggle={(on) => {
                              setPending({ kind: 'toggle', feature, edition, on });
                            }}
                            onRules={() => {
                              setEditing(feature);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {picked !== undefined && pickedAnswer !== undefined ? (
        <MinimumsEditor edition={picked} minimums={pickedAnswer.minimums} onSaved={refetch} />
      ) : null}

      {pending === undefined ? null : (
        <ConfirmDialog
          title={
            pending.kind === 'kill'
              ? `Kill switch: вимкнути ${pending.feature} для всіх читачів`
              : `${pending.feature}: ${pending.on ? 'увімкнути' : 'вимкнути'} для всіх у ${pending.edition.displayName}`
          }
          onConfirm={write}
          onClose={() => {
            setPending(undefined);
          }}
          refusalText={switchRefusalText}
        >
          <p className="text-sm text-muted-foreground">
            {pending.kind === 'kill'
              ? `Для: ${pending.edition?.displayName ?? 'Усі Editions'}. Усі правила світча замінить одне: вимкнено для всіх.`
              : 'Правила, що цілять у частину читачів, лишаються й вирішують першими.'}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}

/** A feature in one Edition: its state and switch, or text only when the Edition hasn't got it. */
function CellView({
  feature,
  edition,
  cell,
  exact,
  onToggle,
  onRules,
}: {
  readonly feature: FeatureSwitch;
  readonly edition: AdminEdition;
  readonly cell: Cell;
  /** One Edition picked: the exact state and its Rules. */
  readonly exact: boolean;
  readonly onToggle: (on: boolean) => void;
  readonly onRules: () => void;
}) {
  if (cell.kind === 'unavailable') return <span className="text-muted-foreground">недоступно</span>;
  const targeted = targetedText(cell.targeted);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={cell.on}
        aria-label={`${feature} у ${edition.displayName}`}
        className="relative h-5 w-9 shrink-0 rounded-full bg-muted transition-colors aria-checked:bg-primary focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => {
          onToggle(!cell.on);
        }}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-surface transition-all ${cell.on ? 'left-4.5' : 'left-0.5'}`}
        />
      </button>
      {exact ? <span>{cellText(cell)}</span> : null}
      {targeted === undefined ? null : (
        <span className="text-xs text-muted-foreground">{targeted}</span>
      )}
      {exact ? (
        <Button variant="ghost" size="sm" onClick={onRules}>
          Правила
        </Button>
      ) : null}
    </div>
  );
}

/** One feature off for every reader of the picked Edition, or of every Edition. */
function KillSwitch({
  scope,
  onKill,
}: {
  readonly scope: AdminEdition | undefined;
  readonly onKill: (feature: FeatureSwitch) => void;
}) {
  const [feature, setFeature] = useState<FeatureSwitch>(FEATURES[0] ?? 'game');
  return (
    <section
      aria-labelledby="kill-switch-title"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-surface p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1">
        <h2 id="kill-switch-title" className="font-display text-lg font-semibold">
          Kill switch
        </h2>
        <p className="text-sm text-muted-foreground">Для: {scope?.displayName ?? 'Усі Editions'}</p>
      </div>
      <label className="flex flex-col gap-1 text-sm sm:ml-auto">
        <span className="text-muted-foreground">Світч</span>
        <select
          className={selectClass}
          value={feature}
          onChange={(event) => {
            const chosen = FEATURES.find((name) => name === event.target.value);
            if (chosen !== undefined) setFeature(chosen);
          }}
        >
          {FEATURES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <Button
        className="bg-destructive text-primary-foreground hover:bg-destructive/90"
        onClick={() => {
          onKill(feature);
        }}
      >
        Вимкнути для всіх
      </Button>
    </section>
  );
}
