import type { FeatureSwitch } from '@slovo/contracts';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { adminApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { cellOf, summaryText, switchRefusalText } from './switch-state';
import { FEATURES, useSwitches } from './switches-data';

const segmentClass =
  'rounded-lg px-4 py-2 text-[13px] text-muted-foreground aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-foreground aria-pressed:shadow-panel';

/**
 * Аварійний вимикач: one feature off for every reader of the Edition the
 * filter picks, or of every Edition, over every Rule.
 */
export function KillTab() {
  const { editions, loaded, picked, refetch } = useSwitches();
  const navigate = useNavigate();
  const [feature, setFeature] = useState<FeatureSwitch>(FEATURES[0] ?? 'game');
  const [confirming, setConfirming] = useState(false);
  const scope = picked === undefined ? loaded : loaded.filter(({ edition }) => edition === picked);
  const where = picked === undefined ? 'усі Editions' : `Edition ${picked.displayName}`;
  const choose = (editionId: string | undefined) =>
    navigate({
      to: '/switches/kill',
      search: (previous) => ({ ...previous, edition: editionId }),
    });

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] text-muted-foreground">1 · Що вимкнути</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
          {FEATURES.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={feature === name}
              onClick={() => {
                setFeature(name);
              }}
              className="group flex flex-col gap-2 rounded-[14px] bg-surface px-4 py-3.5 text-left text-foreground shadow-panel aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:shadow-[0_0_24px_-6px_var(--primary)]"
            >
              <span className="flex w-full items-center gap-2">
                <strong className="flex-1 font-mono text-[14px]">{name}</strong>
                <span
                  aria-hidden
                  className="size-[18px] rounded-full border-[1.5px] border-border-strong group-aria-pressed:border-[5px] group-aria-pressed:border-primary-foreground"
                />
              </span>
              <span className="text-xs opacity-75">
                {summaryText(scope.map(({ answer }) => cellOf(answer, name)))}
              </span>
            </button>
          ))}
        </div>
        <span className="mt-2 text-[13px] text-muted-foreground">2 · Де</span>
        <div className="flex flex-wrap gap-0.5 self-start rounded-[11px] bg-sunk p-[3px]">
          <button
            type="button"
            aria-pressed={picked === undefined}
            className={segmentClass}
            onClick={() => {
              void choose(undefined);
            }}
          >
            Усі Editions
          </button>
          {editions.map((edition) => (
            <button
              key={edition.id}
              type="button"
              aria-pressed={edition === picked}
              className={segmentClass}
              onClick={() => {
                void choose(edition.id);
              }}
            >
              {edition.displayName}
            </button>
          ))}
        </div>
      </div>

      <section
        aria-labelledby="kill-switch-title"
        className="sticky top-24 flex flex-col gap-3.5 rounded-[18px] bg-surface p-5 shadow-[0_0_0_1.5px_var(--destructive)]"
      >
        <h2 id="kill-switch-title" className="text-[13px] font-normal text-muted-foreground">
          Аварійний вимикач
        </h2>
        <p className="rounded-xl bg-sunk px-3.5 py-3 text-[13.5px] leading-normal">
          Вимкнеться «{feature}» · {where}
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className="rounded-[14px] bg-destructive p-4 text-base font-semibold text-white hover:bg-destructive/90"
        >
          Вимкнути зараз
        </button>
        <span className="text-center text-xs text-subtle">Далі лише причина.</span>
      </section>

      {confirming ? (
        <ConfirmDialog
          title={`Аварійний вимикач: вимкнути ${feature} для всіх читачів`}
          confirmLabel="Вимкнути зараз"
          danger
          onConfirm={async (reason) => {
            await adminApi.kill({ feature, editionId: picked?.id, reason });
            await refetch();
          }}
          onClose={() => {
            setConfirming(false);
          }}
          refusalText={switchRefusalText}
        >
          <p className="text-sm text-muted-foreground">
            Для: {picked?.displayName ?? 'Усі Editions'}. Усі правила світча замінить одне: вимкнено
            для всіх.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
