import {
  createEditionRegistry,
  type Clock,
  type Edition,
  type EditionRegistry,
} from '@slovo/server-core';

import type { Database } from '../database/database';
import { createRemoteSwitchStore } from './remote-switch-store';

/**
 * Turns a feature off in an Edition remotely, or clears its remote switch,
 * by the server Core's rules (ADR 0040), and answers the features off now.
 */
export function setRemoteSwitch({
  database,
  clock,
  editions,
  editionId,
  feature,
  off,
}: {
  database: Database;
  clock: Clock;
  /** The Editions as their folders hold them now. */
  editions: readonly Edition[];
  editionId: string;
  /** The name of the Feature Switch, as the owner typed it. */
  feature: string;
  /** Off turns the feature off; not off clears the switch. */
  off: boolean;
}): ReturnType<EditionRegistry['switchOff']> {
  const registry = createEditionRegistry({
    editions,
    remoteSwitches: createRemoteSwitchStore(database),
    clock,
  });
  return off ? registry.switchOff(editionId, feature) : registry.clearSwitch(editionId, feature);
}
