import { BackLink, ScreenTitle, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { MixChoices } from '@/mix/mix-choices';

const strings = editionStrings.mix;

/**
 * Settings › Мій Мікс (board 11, screen 87), with no line under the title: a
 * tile for every Category of the Edition under «N з M обрано» and «Усі», and
 * the switches of Corrections, Idioms, Synonym Rows and Tips, each when the
 * Edition turns it on. The Rarity Ceiling stays a Settings row of its own
 * (ADR 0072). A change applies at once (the Core's Mix, ADR 0019). The last
 * Category's tile is disabled, with a hint why.
 */
export default function MixScreen() {
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView
      testID="mix"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink
          testID="mix-back"
          label={editionStrings.settings.title}
          onPress={() => {
            router.back();
          }}
        />
        <View style={styles.header}>
          <ScreenTitle>{strings.title}</ScreenTitle>
        </View>
        <MixChoices />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { paddingTop: space[2], paddingBottom: space[5] },
});
