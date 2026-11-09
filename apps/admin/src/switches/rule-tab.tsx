import type { FeatureSwitch } from '@slovo/contracts';
import { useNavigate } from '@tanstack/react-router';

import { RuleEditor } from './rule-editor';
import { rulesOf } from './switch-state';
import { FEATURES, useSwitches } from './switches-data';

const selectClass =
  'h-9 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

/**
 * Правило: the Rules of one feature in the Edition the filter picks; the
 * feature is in the URL, so a cell's «Правила» opens it here.
 */
export function RuleTab({ feature }: { readonly feature: FeatureSwitch | undefined }) {
  const { picked, pickedAnswer, refetch } = useSwitches();
  const navigate = useNavigate();
  const open = (next: FeatureSwitch | undefined) =>
    navigate({
      to: '/switches/rule',
      search: (previous) => ({ ...previous, feature: next }),
    });

  return (
    <>
      <label className="flex items-center gap-2 self-start text-sm">
        <span className="text-muted-foreground">Світч</span>
        <select
          className={selectClass}
          value={feature ?? ''}
          onChange={(event) => {
            void open(FEATURES.find((name) => name === event.target.value));
          }}
        >
          <option value="">—</option>
          {FEATURES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {picked === undefined ? (
        <p className="text-sm text-muted-foreground">Оберіть одну Edition, щоб змінити правила.</p>
      ) : null}

      {picked !== undefined && feature !== undefined && pickedAnswer !== undefined ? (
        <RuleEditor
          // Keyed by the Rules too: a write made elsewhere (a matrix toggle, a
          // Kill switch) starts its drafts afresh, so saving never undoes it.
          key={`${picked.id}-${feature}-${JSON.stringify(rulesOf(pickedAnswer, feature))}`}
          edition={picked}
          feature={feature}
          rules={rulesOf(pickedAnswer, feature)}
          onSaved={refetch}
          onClose={() => {
            void open(undefined);
          }}
        />
      ) : null}
    </>
  );
}
