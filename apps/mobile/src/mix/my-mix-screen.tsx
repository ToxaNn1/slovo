import { RARITIES } from '@slovo/contracts';
import { BackHeader, RarityRangePicker, space, useTokens } from '@slovo/ui';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { MixChoices } from './mix-choices';
import { useRarityRange } from './rarity-range';
import { useEditionInEffect } from '@/edition/remote-switches';

const strings = editionStrings.mix;

/**
 * «Мій Мікс» (board 11, screen 87), with no line under the title: «Рідкість»
 * while the rarityCeiling switch is on, the same control as in Settings
 * (ADR 0156), then a tile for every Category of the Edition under «N з M
 * обрано» and «Усі», and the switches of Corrections, Idioms, Synonym Rows and
 * Tips, each when the Edition turns it on. A change applies at once (the Core's
 * Mix). The header stays above the scroll. It is the root of the tab
 * «Мікс», with no way back (ADR 0201), and a screen of Settings, with `back`.
 */
export function MyMixScreen({
  back,
}: {
  back?: { label: string; onPress: () => void } | undefined;
}) {
  const { colors } = useTokens();
  const inEffect = useEditionInEffect();
  const { range, setRange } = useRarityRange();

  return (
    <SafeAreaView
      testID="mix"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <BackHeader
          titleRole="settingsSubTitle"
          title={strings.title}
          back={back === undefined ? undefined : { ...back, testID: 'mix-back' }}
        />
      </View>
      <ScrollView testID="mix-scroll" contentContainerStyle={styles.content}>
        {inEffect.isFeatureEnabled('rarityCeiling') && (
          <View style={styles.rarity}>
            <RarityRangePicker
              testID="mix-rarity"
              rarities={RARITIES}
              range={range}
              onChange={setRange}
            />
          </View>
        )}
        <MixChoices />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The back header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: { paddingHorizontal: space[5], paddingTop: space[2] },
  content: { paddingHorizontal: space[5], paddingBottom: space[8] },
  rarity: { paddingBottom: space[4] },
});
