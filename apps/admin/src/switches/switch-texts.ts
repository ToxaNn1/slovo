import { FEATURE_SWITCHES, type FeatureSwitch } from '@slovo/contracts';

/** A Feature Switch as the owner reads it: a Ukrainian name and one plain line on what it turns on in the app. */
export interface SwitchText {
  readonly name: string;
  readonly line: string;
}

/** The text of every Feature Switch, from the catalogue (ADR 0199). */
export const SWITCH_TEXTS: Readonly<Record<FeatureSwitch, SwitchText>> = FEATURE_SWITCHES;
