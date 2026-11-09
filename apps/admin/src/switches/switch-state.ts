import type {
  FeatureSwitch,
  FeatureSwitchState,
  FeatureSwitches,
  Rule,
  RuleTargets,
} from '@slovo/contracts';

/** What the admin API answers of an Edition's switches. */
export interface EditionSwitchesAnswer {
  readonly states: FeatureSwitches;
  readonly rules: readonly Rule[];
}

/**
 * A feature in one Edition as the matrix shows it: the Edition hasn't got it,
 * or on or off for every reader (the verdict of its first Rule that targets
 * everyone, else the Edition's state), with how many Rules target some readers.
 */
export type Cell =
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'available';
      readonly on: boolean;
      readonly variants: readonly string[] | undefined;
      readonly targeted: number;
    };

/** Whether a Rule's targets are every reader of the Edition. */
export function targetsEveryone(targets: RuleTargets): boolean {
  return Object.values(targets).every((target) => target === undefined);
}

/** The Rules of one feature, in the order they are tried. */
export function rulesOf(answer: EditionSwitchesAnswer, feature: string): Rule[] {
  return answer.rules
    .filter((rule) => rule.feature === feature)
    .sort((one, other) => one.order - other.order);
}

export function cellOf(answer: EditionSwitchesAnswer, feature: FeatureSwitch): Cell {
  const state: FeatureSwitchState = answer.states[feature];
  if (state === 'unavailable') return { kind: 'unavailable' };
  const rules = rulesOf(answer, feature);
  const everyone = rules.find((rule) => targetsEveryone(rule.targets));
  const targeted = rules.filter((rule) => !targetsEveryone(rule.targets)).length;
  if (everyone === undefined)
    return { kind: 'available', on: state === 'on', variants: undefined, targeted };
  const { verdict } = everyone;
  return typeof verdict === 'string'
    ? { kind: 'available', on: verdict === 'on', variants: undefined, targeted }
    : { kind: 'available', on: true, variants: verdict.variants, targeted };
}

/** The exact state of a cell, in the admin's words. */
export function cellText(cell: Cell): string {
  if (cell.kind === 'unavailable') return 'недоступно';
  if (cell.variants !== undefined) return `увімкнено: ${cell.variants.join(' / ')}`;
  return cell.on ? 'увімкнено' : 'вимкнено';
}

/** A feature over every Edition: on in all, off in all, or on in some of those that have it. */
export function summaryText(cells: readonly Cell[]): string {
  const available = cells.filter((cell) => cell.kind === 'available');
  if (available.length === 0) return 'недоступно';
  const on = available.filter((cell) => cell.on).length;
  if (on === 0) return 'вимкнено';
  if (on === available.length) return 'увімкнено';
  return `увімкнено (${String(on)} з ${String(available.length)})`;
}

/** How many Rules target some readers, beside the state. */
export function targetedText(count: number): string | undefined {
  if (count === 0) return undefined;
  const last = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  if (last === 1 && !teen) return `${String(count)} правило`;
  if (last >= 2 && last <= 4 && !teen) return `${String(count)} правила`;
  return `${String(count)} правил`;
}

/**
 * The Rules of a feature with one Rule for every reader set to the verdict:
 * kept last, so the Rules that target some readers still decide for them.
 */
export function withEveryone(rules: readonly Rule[], on: boolean) {
  return [
    ...rules
      .filter((rule) => !targetsEveryone(rule.targets))
      .map(({ id, verdict, targets }) => ({ id, verdict, targets })),
    { id: 'everyone', verdict: on ? ('on' as const) : ('off' as const), targets: {} },
  ];
}

/** A string in the refusal's data, such as `feature`. */
function textOf(error: unknown, key: string): string | undefined {
  if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
  const { data } = error;
  if (typeof data !== 'object' || data === null) return undefined;
  const value: unknown = Object.getOwnPropertyDescriptor(data, key)?.value;
  return typeof value === 'string' ? value : undefined;
}

/** What the admin reads of a refused write of the switches. */
export function switchRefusalText(error: unknown): string {
  const feature = textOf(error, 'feature') ?? '';
  switch (textOf(error, 'refusal')) {
    case 'dependency-off': {
      return `Відхилено: світч «${feature}», від якого це залежить, вимкнено для всіх.`;
    }
    case 'unavailable-feature': {
      return `Відхилено: «${feature}» недоступний у цій Edition.`;
    }
    case 'unknown-feature': {
      return `Відхилено: невідомий світч «${feature}».`;
    }
    case 'unknown-edition': {
      return `Відхилено: невідома Edition «${feature}».`;
    }
    default: {
      return 'Не вдалося. Спробуйте ще раз.';
    }
  }
}
