import {
  readSwitches,
  rulesOf as rulesInOrder,
  type FeatureSwitch,
  type FeatureSwitches,
  type Rule,
} from '@slovo/contracts';
import { SwitchRefusalSchema } from '@slovo/contracts/admin-api';

import { refusalData } from '../session';

/** What the admin API answers of an Edition's switches. */
export interface EditionSwitchesAnswer {
  readonly states: FeatureSwitches;
  readonly rules: readonly Rule[];
}

/**
 * A feature in one Edition as the matrix shows it: the Edition hasn't got it,
 * or on or off for the readers no Rule singles out (the verdict of its first
 * Rule in force for every reader, else the Edition's state, and off while a
 * switch it depends on is), with how many other Rules it has.
 */
export type Cell =
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'available';
      readonly on: boolean;
      readonly variants: readonly string[] | undefined;
      readonly targeted: number;
    };

/** The Rules of one feature, in the order they are tried. */
export function rulesOf(answer: EditionSwitchesAnswer, feature: string): Rule[] {
  return rulesInOrder(answer.rules, feature);
}

/** The cell of a feature at the moment, read as the backend and the device read its Rules. */
export function cellOf(answer: EditionSwitchesAnswer, feature: FeatureSwitch, now: Date): Cell {
  if (answer.states[feature] === 'unavailable') return { kind: 'unavailable' };
  const switches = readSwitches({ ...answer, now });
  const rest = switches.forTheRest(feature);
  const verdict = rest.on ? rest.by?.verdict : undefined;
  return {
    kind: 'available',
    on: rest.on,
    variants: typeof verdict === 'object' ? verdict.variants : undefined,
    targeted:
      rulesOf(answer, feature).length - (switches.everyoneRule(feature) === undefined ? 0 : 1),
  };
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
 * The Rules of a feature with one Rule for every reader set to the verdict,
 * in the place of the first Rule in force for every reader at the moment
 * (last when there is none): the first matching Rule decides, so the Rules
 * before it still decide for their readers and those after it, which never
 * matched, still do not.
 */
export function withEveryone(
  answer: EditionSwitchesAnswer,
  feature: FeatureSwitch,
  on: boolean,
  now: Date,
) {
  const everyone = {
    id: 'everyone',
    verdict: on ? ('on' as const) : ('off' as const),
    targets: {},
  };
  const replaced = readSwitches({ ...answer, now }).everyoneRule(feature);
  const kept = rulesOf(answer, feature).map(({ id, verdict, targets }) => ({
    id,
    verdict,
    targets,
  }));
  const at = replaced === undefined ? -1 : kept.findIndex(({ id }) => id === replaced.id);
  return at === -1 ? [...kept, everyone] : [...kept.slice(0, at), everyone, ...kept.slice(at + 1)];
}

/** What the admin reads of a refused write of the switches. */
export function switchRefusalText(error: unknown): string {
  const refused = SwitchRefusalSchema.safeParse(refusalData(error)).data;
  const feature = refused?.feature ?? '';
  switch (refused?.refusal) {
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
