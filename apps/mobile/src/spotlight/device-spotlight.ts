import { requireNativeModule } from 'expo';

import { nativeModules } from '../device/device-native-modules';
import { activeEditionId } from '../edition/edition';
import { createSpotlightIndex, type SpotlightModule } from './spotlight-index';

/**
 * The iPhone search's index of the app, through the app's own Spotlight
 * module (`modules/spotlight`); it writes nothing where the installed binary
 * lacks the module. Its items open in the active Edition.
 */
export const deviceSpotlight = createSpotlightIndex(
  nativeModules.load('spotlight', () => requireNativeModule<SpotlightModule>('SlovoSpotlight')),
  activeEditionId,
);
