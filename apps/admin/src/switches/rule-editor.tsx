import {
  DEPENDS_ON,
  ForceUpdateMinimumSchema,
  RuleTargetsSchema,
  RuleVerdictSchema,
  type FeatureSwitch,
  type ForceUpdateMinimum,
  type ForceUpdateMinimums,
  type Platform,
  type Rule,
  type RuleTargets,
  type RuleVerdict,
} from '@slovo/contracts';
import type { AdminEdition } from '@slovo/contracts/admin-api';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { adminApi } from '../api';
import { ConfirmDialog } from '../components/confirm-dialog';
import { Button } from '../components/ui/button';
import { switchRefusalText } from './switch-state';

/** A Rule as the admin writes it: its place in the list is its order. */
interface Draft {
  readonly id: string;
  readonly verdict: RuleVerdict;
  readonly targets: RuleTargets;
}

const inputClass =
  'h-9 rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring';

const PLATFORMS: readonly Platform[] = ['ios', 'android'];

/** A Rule's verdict in the admin's words. */
function verdictText(verdict: RuleVerdict): string {
  if (verdict === 'on') return 'увімкнено';
  if (verdict === 'off') return 'вимкнено';
  return `Variants: ${verdict.variants.join(' / ')}`;
}

/** A Rule's targets in the admin's words; none is every reader. */
function targetsText(targets: RuleTargets): string {
  const parts = [
    targets.appVersion === undefined
      ? undefined
      : `версія ${targets.appVersion.from ?? '…'}–${targets.appVersion.until ?? '…'}`,
    targets.platform,
    targets.region === undefined ? undefined : `регіон ${targets.region.join(', ')}`,
    targets.share === undefined ? undefined : `${String(targets.share)}% читачів`,
    targets.signedIn === undefined ? undefined : targets.signedIn ? 'з акаунтом' : 'без акаунта',
    targets.schedule === undefined
      ? undefined
      : `з ${targets.schedule.from ?? '…'} до ${targets.schedule.until ?? '…'}`,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? 'усі читачі' : parts.join(' · ');
}

const textOf = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
};

/** The moment of a `datetime-local` field, as the contract keeps it. */
const momentOf = (form: FormData, name: string) => {
  const value = textOf(form, name);
  return value === undefined ? undefined : new Date(value).toISOString();
};

/** The Rule of the add form, parsed as the contract parses it; undefined when it doesn't hold. */
function draftOf(form: FormData, id: string): Draft | undefined {
  const verdictName = textOf(form, 'verdict');
  const verdict = RuleVerdictSchema.safeParse(
    verdictName === 'variants'
      ? { variants: (textOf(form, 'variants') ?? '').split(',').map((part) => part.trim()) }
      : verdictName,
  );
  const range = (from: string | undefined, until: string | undefined) =>
    from === undefined && until === undefined ? undefined : { from, until };
  const signedIn = textOf(form, 'signedIn');
  const share = textOf(form, 'share');
  const targets = RuleTargetsSchema.safeParse({
    appVersion: range(textOf(form, 'versionFrom'), textOf(form, 'versionUntil')),
    platform: textOf(form, 'platform'),
    region: textOf(form, 'region')
      ?.split(',')
      .map((part) => part.trim().toUpperCase()),
    share: share === undefined ? undefined : Number(share),
    signedIn: signedIn === undefined ? undefined : signedIn === 'yes',
    schedule: range(momentOf(form, 'scheduleFrom'), momentOf(form, 'scheduleUntil')),
  });
  if (!verdict.success || !targets.success) return undefined;
  return { id, verdict: verdict.data, targets: targets.data };
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/**
 * The Rules of one feature in one Edition, in the order they are tried: the
 * first that matches decides, the Edition's state when none does.
 */
export function RuleEditor({
  edition,
  feature,
  rules,
  onSaved,
  onClose,
}: {
  readonly edition: AdminEdition;
  readonly feature: FeatureSwitch;
  readonly rules: readonly Rule[];
  readonly onSaved: () => Promise<void>;
  readonly onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<readonly Draft[]>(
    rules.map(({ id, verdict, targets }) => ({ id, verdict, targets })),
  );
  const [invalid, setInvalid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dependsOn = DEPENDS_ON[feature] ?? [];

  const move = (index: number, by: number) => {
    const next = [...drafts];
    const [rule] = next.splice(index, 1);
    if (rule === undefined) return;
    next.splice(index + by, 0, rule);
    setDrafts(next);
  };
  const add = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = draftOf(new FormData(event.currentTarget), crypto.randomUUID().slice(0, 8));
    setInvalid(draft === undefined);
    if (draft === undefined) return;
    setDrafts([...drafts, draft]);
    event.currentTarget.reset();
  };

  return (
    <section
      aria-labelledby="rule-editor-title"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="rule-editor-title" className="font-display text-lg font-semibold">
            Правила {feature} у {edition.displayName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Перше збігання вирішує: правила пробуються згори вниз, а коли жодне не збіглося — стан
            Edition.
          </p>
          <p className="text-sm text-muted-foreground">
            {dependsOn.length === 0
              ? 'Ні від чого не залежить.'
              : `Залежить від: ${dependsOn.join(', ')}.`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрити
        </Button>
      </div>

      {drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Правил немає.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {drafts.map((draft, index) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm"
            >
              <span className="font-medium">{verdictText(draft.verdict)}</span>
              <span className="text-muted-foreground">{targetsText(draft.targets)}</span>
              <span className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => {
                    move(index, -1);
                  }}
                >
                  Вище
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={index === drafts.length - 1}
                  onClick={() => {
                    move(index, 1);
                  }}
                >
                  Нижче
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDrafts(drafts.filter((other) => other !== draft));
                  }}
                >
                  Прибрати
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <form className="grid gap-3 sm:grid-cols-3" onSubmit={add}>
        <Field label="Вердикт">
          <select name="verdict" className={inputClass} defaultValue="on">
            <option value="on">увімкнено</option>
            <option value="off">вимкнено</option>
            <option value="variants">Variants</option>
          </select>
        </Field>
        <Field label="Variants, 2 або 3 через кому">
          <input name="variants" className={inputClass} />
        </Field>
        <Field label="Платформа">
          <select name="platform" className={inputClass} defaultValue="">
            <option value="">усі</option>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Версія від">
          <input name="versionFrom" className={inputClass} placeholder="1.2.0" />
        </Field>
        <Field label="Версія до">
          <input name="versionUntil" className={inputClass} placeholder="1.4.0" />
        </Field>
        <Field label="Регіони через кому">
          <input name="region" className={inputClass} placeholder="UA, PL" />
        </Field>
        <Field label="Частка читачів, %">
          <input name="share" type="number" min={0} max={100} className={inputClass} />
        </Field>
        <Field label="Акаунт">
          <select name="signedIn" className={inputClass} defaultValue="">
            <option value="">усі</option>
            <option value="yes">з акаунтом</option>
            <option value="no">без акаунта</option>
          </select>
        </Field>
        <Field label="Розклад від">
          <input name="scheduleFrom" type="datetime-local" className={inputClass} />
        </Field>
        <Field label="Розклад до">
          <input name="scheduleUntil" type="datetime-local" className={inputClass} />
        </Field>
        <div className="flex items-end gap-2 sm:col-span-3">
          <Button type="submit" variant="outline">
            Додати правило
          </Button>
          <Button
            type="button"
            onClick={() => {
              setConfirming(true);
            }}
          >
            Зберегти правила
          </Button>
          {invalid ? (
            <p role="alert" className="text-sm text-destructive">
              Перевірте правило: вердикт і цілі не сходяться.
            </p>
          ) : null}
        </div>
      </form>

      {confirming ? (
        <ConfirmDialog
          title={`Зберегти правила ${feature} у ${edition.displayName}`}
          onConfirm={async (reason) => {
            await adminApi.setRules({
              editionId: edition.id,
              feature,
              rules: [...drafts],
              reason,
            });
            await onSaved();
          }}
          onClose={() => {
            setConfirming(false);
          }}
          refusalText={switchRefusalText}
        />
      ) : null}
    </section>
  );
}

/** The force-update minimums of an Edition, soft and hard, per platform. */
export function MinimumsEditor({
  edition,
  minimums,
  onSaved,
}: {
  readonly edition: AdminEdition;
  readonly minimums: ForceUpdateMinimums;
  readonly onSaved: () => Promise<void>;
}) {
  const [pending, setPending] = useState<{
    readonly platform: Platform;
    readonly minimum: ForceUpdateMinimum;
  }>();
  const [invalid, setInvalid] = useState<Platform>();

  return (
    <section
      aria-labelledby="minimums-title"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id="minimums-title" className="font-display text-lg font-semibold">
        Примусове оновлення
      </h2>
      <p className="text-sm text-muted-foreground">
        Нижче м’якої версії застосунок просить оновитися, нижче жорсткої — чекає на оновлення.
      </p>
      {PLATFORMS.map((platform) => (
        <form
          key={`${platform}-${minimums[platform]?.soft ?? ''}-${minimums[platform]?.hard ?? ''}`}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const minimum = ForceUpdateMinimumSchema.safeParse({
              soft: textOf(form, 'soft'),
              hard: textOf(form, 'hard'),
            });
            setInvalid(minimum.success ? undefined : platform);
            if (minimum.success) setPending({ platform, minimum: minimum.data });
          }}
        >
          <span className="w-20 font-medium">{platform}</span>
          <Field label="М’яка">
            <input
              name="soft"
              className={inputClass}
              placeholder="1.2.0"
              defaultValue={minimums[platform]?.soft}
            />
          </Field>
          <Field label="Жорстка">
            <input
              name="hard"
              className={inputClass}
              placeholder="1.0.0"
              defaultValue={minimums[platform]?.hard}
            />
          </Field>
          <Button type="submit" variant="outline">
            Зберегти
          </Button>
          {invalid === platform ? (
            <p role="alert" className="text-sm text-destructive">
              Версія має вигляд 1.2.0.
            </p>
          ) : null}
        </form>
      ))}
      {pending === undefined ? null : (
        <ConfirmDialog
          title={`Мінімальна версія ${pending.platform} у ${edition.displayName}`}
          onConfirm={async (reason) => {
            await adminApi.setMinimum({
              editionId: edition.id,
              platform: pending.platform,
              minimum: pending.minimum,
              reason,
            });
            await onSaved();
          }}
          onClose={() => {
            setPending(undefined);
          }}
          refusalText={switchRefusalText}
        />
      )}
    </section>
  );
}
