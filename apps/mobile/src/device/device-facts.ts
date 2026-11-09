import type { ForceUpdateFacts } from '@slovo/core';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** The app version and platform of this build, as the Rules and the force-update minimums read them. */
export const deviceFacts: ForceUpdateFacts = {
  appVersion: Constants.expoConfig?.version ?? '',
  platform: Platform.OS === 'android' ? 'android' : 'ios',
};
