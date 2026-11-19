import type { FeatureSwitch } from './edition';
import { FEATURE_SWITCHES } from './feature-switch-catalogue';

/**
 * What each Feature Switch depends on, from the catalogue (ADR 0196): a
 * feature is in effect only while every switch it names here is in effect
 * too (ADR 0040). A feature not listed depends on nothing. Every rule between
 * two switches lives in the catalogue, so the shell and the Core ask one
 * question of the Edition.
 */
export const DEPENDS_ON: Partial<Record<FeatureSwitch, readonly FeatureSwitch[]>> =
  Object.fromEntries(
    Object.entries(FEATURE_SWITCHES).flatMap(([feature, { dependsOn }]) =>
      dependsOn === undefined ? [] : [[feature, dependsOn]],
    ),
  );

/**
 * Whether a feature is in effect, from whether each switch is on by itself:
 * its own switch on and every switch it depends on in effect, such as a Game
 * Mode only while `game` is on too (ADR 0052).
 */
export function switchedOn(isOn: (feature: FeatureSwitch) => boolean) {
  const inEffect = (feature: FeatureSwitch): boolean =>
    isOn(feature) && (DEPENDS_ON[feature] ?? []).every(inEffect);
  return inEffect;
}
