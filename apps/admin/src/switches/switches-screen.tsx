import type { FeatureSwitch } from '@slovo/contracts';
import type { AdminEdition } from '@slovo/contracts/admin-api';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Button } from '../components/ui/button';
import { MinimumsEditor } from './rule-editor';
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
import { FEATURES, useSwitches } from './switches-data';

const tabClass =
  'rounded-lg px-3.5 py-[7px] text-[13px] text-muted-foreground no-underline hover:text-foreground data-[status=active]:bg-surface data-[status=active]:font-semibold data-[status=active]:text-foreground data-[status=active]:shadow-panel';

/** Свічі: the matrix, the Rules of one feature and the Kill switch, as three tabs. */
export function SwitchesScreen() {
  return (
    <section aria-label="Свічі" className="flex flex-1 flex-col gap-6">
      <nav
        aria-label="Свічі"
        className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-sunk p-[3px]"
      >
        <Link
          to="/switches"
          search={(previous) => previous}
          activeOptions={{ exact: true, includeSearch: false }}
          className={tabClass}
        >
          Feature Switch
        </Link>
        <Link
          to="/switches/rule"
          search={(previous) => previous}
          activeOptions={{ includeSearch: false }}
          className={tabClass}
        >
          Правило
        </Link>
        <Link
          to="/switches/kill"
          search={(previous) => previous}
          activeOptions={{ includeSearch: false }}
          className={tabClass}
        >
          Аварійний вимикач
        </Link>
      </nav>
      <Outlet />
    </section>
  );
}

/** A matrix switch waiting for its confirmation. */
interface Toggle {
  readonly feature: FeatureSwitch;
  readonly edition: AdminEdition;
  readonly on: boolean;
}

/**
 * Feature Switch: every feature against the Editions, a switch per cell and,
 * with one Edition picked, its Rules and force-update minimums.
 */
export function SwitchesMatrix() {
  const { editions, loaded, ready, picked, pickedAnswer, answerOf, refetch } = useSwitches();
  const navigate = useNavigate();
  const [pending, setPending] = useState<Toggle>();
  const columns =
    picked === undefined ? loaded : loaded.filter(({ edition }) => edition === picked);

  const write = async (reason: string) => {
    if (pending === undefined) return;
    const answer = answerOf(pending.edition);
    await adminApi.setRules({
      editionId: pending.edition.id,
      feature: pending.feature,
      rules: withEveryone(answer === undefined ? [] : rulesOf(answer, pending.feature), pending.on),
      reason,
    });
    await refetch();
  };

  return (
    <>
      {picked === undefined ? (
        <p className="text-sm text-muted-foreground">
          Оберіть одну Edition, щоб змінити правила або мінімальні версії.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-surface shadow-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-subtle">
              <th scope="col" className="px-4 py-3 text-left font-normal">
                Feature Switch
              </th>
              {picked === undefined ? (
                <th scope="col" className="px-2.5 py-3 text-center font-semibold">
                  Усі Editions
                </th>
              ) : null}
              {columns.map(({ edition }) => (
                <th key={edition.id} scope="col" className="px-2.5 py-3 text-center font-normal">
                  {edition.displayName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!ready || editions.length === 0
              ? null
              : FEATURES.map((feature) => {
                  const cells = columns.map(({ edition, answer }) => ({
                    edition,
                    cell: cellOf(answer, feature),
                  }));
                  return (
                    <tr key={feature} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-2 text-left font-mono text-xs font-normal">
                        {feature}
                      </th>
                      {picked === undefined ? (
                        <td className="px-2.5 py-2">
                          <SummaryPill cells={cells.map(({ cell }) => cell)} />
                        </td>
                      ) : null}
                      {cells.map(({ edition, cell }) => (
                        <td key={edition.id} className="px-2.5 py-2">
                          <CellView
                            feature={feature}
                            edition={edition}
                            cell={cell}
                            exact={picked !== undefined}
                            onToggle={(on) => {
                              setPending({ feature, edition, on });
                            }}
                            onRules={() => {
                              void navigate({
                                to: '/switches/rule',
                                search: (previous) => ({ ...previous, feature }),
                              });
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
      <span className="text-[12.5px] text-subtle">
        Клік по клітинці Edition перемикає свіч після підтвердження з причиною. «Недоступно» — у
        Edition немає контенту для функції, керування немає.
      </span>

      {picked !== undefined && pickedAnswer !== undefined ? (
        <MinimumsEditor edition={picked} minimums={pickedAnswer.minimums} onSaved={refetch} />
      ) : null}

      {pending === undefined ? null : (
        <ConfirmDialog
          title={`${pending.feature}: ${pending.on ? 'увімкнути' : 'вимкнути'} для всіх у ${pending.edition.displayName}`}
          onConfirm={write}
          onClose={() => {
            setPending(undefined);
          }}
          refusalText={switchRefusalText}
        >
          <p className="text-sm text-muted-foreground">
            Правила, що цілять у частину читачів, лишаються й вирішують першими.
          </p>
        </ConfirmDialog>
      )}
    </>
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
  if (cell.kind === 'unavailable')
    return <span className={pillClass('unavailable')}>недоступно</span>;
  const targeted = targetedText(cell.targeted);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={cell.on}
        aria-label={`${feature} у ${edition.displayName}`}
        className={`${pillClass(cell.on ? 'on' : 'off')} cursor-pointer focus-visible:outline-2 focus-visible:outline-ring`}
        onClick={() => {
          onToggle(!cell.on);
        }}
      >
        {exact ? cellText(cell) : cell.on ? 'увімкнено' : 'вимкнено'}
      </button>
      {targeted === undefined ? null : (
        <span className="text-xs whitespace-nowrap text-muted-foreground">{targeted}</span>
      )}
      {exact ? (
        <Button variant="ghost" size="sm" onClick={onRules}>
          Правила
        </Button>
      ) : null}
    </div>
  );
}

type PillTone = 'on' | 'off' | 'unavailable';

/** A state as the v4 matrix draws it: soft green on, outlined off, sunk unavailable. */
function pillClass(tone: PillTone): string {
  const look = {
    on: 'border-transparent bg-ok-soft text-ok',
    off: 'border-border-strong bg-surface text-muted-foreground',
    unavailable: 'border-transparent bg-sunk text-subtle',
  }[tone];
  return `inline-flex min-h-8 w-full min-w-28 items-center justify-center rounded-[9px] border-[1.5px] px-2 py-1.5 text-center text-xs font-semibold ${look}`;
}

/** The state over every Edition: on when any Edition that has it has it on. */
function SummaryPill({ cells }: { readonly cells: readonly Cell[] }) {
  const available = cells.filter((cell) => cell.kind === 'available');
  const tone: PillTone =
    available.length === 0 ? 'unavailable' : available.some((cell) => cell.on) ? 'on' : 'off';
  return <span className={pillClass(tone)}>{summaryText(cells)}</span>;
}
