import { ScreenStack } from '@/entries/screen-stack';
import { useEditionInEffect } from '@/edition/remote-switches';

/**
 * Expo Router 58 builds the stack from the route files and this anchor, never from the
 * stack's `initialRouteName`: a Settings screen opened from elsewhere, as the Feed's Later
 * Question or Account notice, lies over the Profile, so the tab still opens on the Profile.
 */
export const unstable_settings = { anchor: 'profile' };

/**
 * The fourth tab's own stack. While the Profile is shown, the tab is the
 * Profile, and Settings and the screens its rows open go over it; otherwise
 * the tab is Settings itself. Screens draw their own header.
 */
export default function SettingsLayout() {
  return (
    <ScreenStack
      initialRouteName={useEditionInEffect().isFeatureEnabled('profile') ? 'profile' : 'index'}
    />
  );
}
