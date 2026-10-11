import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { editionStrings } from '../edition';
import { LanguagePackProvider } from '../language-pack';

const { tabs } = editionStrings;

/** The four tabs in their final order: Home, Settings, Game, Saved. */
export default function RootLayout() {
  return (
    <LanguagePackProvider>
      <StatusBar style="auto" />
      <Tabs screenOptions={{ headerShown: false, tabBarIcon: () => null }}>
        <Tabs.Screen name="index" options={{ title: tabs.home, tabBarButtonTestID: 'tab-home' }} />
        <Tabs.Screen
          name="settings"
          options={{ title: tabs.settings, tabBarButtonTestID: 'tab-settings' }}
        />
        <Tabs.Screen name="game" options={{ title: tabs.game, tabBarButtonTestID: 'tab-game' }} />
        <Tabs.Screen
          name="saved"
          options={{ title: tabs.saved, tabBarButtonTestID: 'tab-saved' }}
        />
      </Tabs>
    </LanguagePackProvider>
  );
}
