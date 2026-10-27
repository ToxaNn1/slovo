import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { createForeground } from './foreground';

/** The shell's one source of whether the app is in the foreground, for the Feed and the Game. */
const foreground = createForeground(AppState);

/** Whether the app is in the foreground, kept up to date. */
export function useInForeground(): boolean {
  return useSyncExternalStore(foreground.subscribe, foreground.active);
}
