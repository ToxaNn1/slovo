import { UpdateChannelSchema, type UpdateChannel } from '@slovo/contracts';
import type { ForceUpdateFacts } from '@slovo/core';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { nativeModules } from './device-native-modules';

/** What the app knows of its own build, as the Rules, the force-update minimums and About read it. */
export interface DeviceFacts extends ForceUpdateFacts {
  /**
   * The Update channel the build listens to, which its store build profile
   * names (ADR 0167); undefined in a development build, under Metro and on a
   * binary that lacks `expo-updates`.
   */
  readonly updateChannel: UpdateChannel | undefined;
}

type UpdatesModule = typeof import('expo-updates');

/** The Update channel `expo-updates` reports from the native project, parsed once here. */
function installedUpdateChannel(): UpdateChannel | undefined {
  const updates = nativeModules.load(
    'updates',
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    () => require('expo-updates') as UpdatesModule,
  );
  const parsed = UpdateChannelSchema.safeParse(updates?.channel);
  return parsed.success ? parsed.data : undefined;
}

/** The channel once read: the native project's never changes while the app runs. */
let channelRead: { readonly channel: UpdateChannel | undefined } | undefined;

/**
 * The app version, platform and Update channel of this build. The channel is
 * read when first asked, not at import, so no native module loads before the
 * app needs it.
 */
export const deviceFacts: DeviceFacts = {
  appVersion: Constants.expoConfig?.version ?? '',
  platform: Platform.OS === 'android' ? 'android' : 'ios',
  get updateChannel() {
    channelRead ??= { channel: installedUpdateChannel() };
    return channelRead.channel;
  },
};
