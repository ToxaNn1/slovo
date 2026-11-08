import type { FeatureSwitch } from '@slovo/contracts';

import type { Actor } from './admin-access';

/** What the owner hears of at once: a feature turned off by the Kill switch. */
export interface Alert {
  readonly kind: 'kill-switch';
  readonly feature: FeatureSwitch;
  /** The Editions the feature was turned off in. */
  readonly editionIds: readonly string[];
  readonly who: Actor;
  readonly reason: string;
}

/** Tells the owner of an Alert (Telegram in the backend). */
export interface Alerts {
  send(alert: Alert): Promise<void>;
}
