import { FEATURE_SWITCHES, type FeatureSwitch, type FeatureSwitchGroup } from '@slovo/contracts';

import { FEATURES } from './switches-data';

/** The parts of the app the Feature Switches table groups its rows by, in table order. */
export const SWITCH_GROUPS = {
  content: 'Записи й контент',
  feed: 'Стрічка й картки',
  games: 'Ігри',
  crossword: 'Кросворд',
  progress: 'Прогрес, серії й відзнаки',
  notifications: 'Сповіщення',
  widgets: 'Віджети',
  account: 'Обліковий запис',
  onboarding: 'Знайомство',
  look: 'Вигляд і налаштування',
  analytics: 'Аналітика',
} as const satisfies Record<FeatureSwitchGroup, string>;

/** The Feature Switches by group, in table order; a group with none is left out. */
export const GROUPED_FEATURES: readonly {
  readonly group: FeatureSwitchGroup;
  readonly features: readonly FeatureSwitch[];
}[] = Object.keys(SWITCH_GROUPS)
  .filter((group): group is FeatureSwitchGroup => group in SWITCH_GROUPS)
  .map((group) => ({
    group,
    features: FEATURES.filter((feature) => FEATURE_SWITCHES[feature].group === group),
  }))
  .filter(({ features }) => features.length > 0);
