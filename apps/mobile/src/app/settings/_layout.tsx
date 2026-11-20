import { ScreenStack } from '@/entries/screen-stack';
import { useEditionInEffect } from '@/edition/remote-switches';

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
