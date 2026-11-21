import { BackHeader, space, typeStyle, useEdition, useTokens } from '@slovo/ui';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { MixChoices, useMixCount } from './mix-choices';

const strings = editionStrings.mix;

/**
 * «Мої Теми» (board XMix, variant E): the title with how many Categories of
 * Words are in, «12 з 16», beside it; the setting tiles «Рідкість», «Типи»
 * and «Питання», each opening its sheet; then the Categories as covers in
 * the Edition's groups. A change applies at once (the Core's Mix). The header
 * stays above the scroll. It is the root of the tab «Теми», with no way back
 * (ADR 0201), and a screen of Settings, with `back`.
 */
export function MyMixScreen({
  back,
}: {
  back?: { label: string; onPress: () => void } | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const count = useMixCount();

  return (
    <SafeAreaView
      testID="mix"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.bar}>
        <View style={styles.title}>
          <BackHeader
            titleRole="screenTitle"
            title={strings.title}
            back={back === undefined ? undefined : { ...back, testID: 'mix-back' }}
          />
        </View>
        <Text
          testID="mix-selected"
          {...voice}
          style={[typeStyle('progressCount', tokens), styles.count, { color: colors.muted }]}
        >
          {count}
        </Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        testID="mix-scroll"
        contentContainerStyle={styles.content}
      >
        <MixChoices />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The header stays above the list, so the list scrolls under it, not the header under the status bar.
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingTop: space[2],
    paddingBottom: space[3],
  },
  title: { flex: 1, minWidth: 0 },
  count: { paddingBottom: space[1] },
  content: { paddingHorizontal: space[4], paddingBottom: space[8] },
});
