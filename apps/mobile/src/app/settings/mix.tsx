import { BackLink, ScreenTitle, space, typeSize, useEdition, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { MixChoices } from '@/mix/mix-choices';

const strings = editionStrings.mix;

/**
 * Settings › Мій Мікс: a chip for every Category of the Edition and «Усі»,
 * the Rarity Floor choice while its switch is on, and the switches of
 * Corrections, Idioms, Synonym Rows and Tips, each when the Edition turns it on. A change
 * applies at once (the Core's Mix, ADR 0019). The last Category's chip is
 * disabled, with a hint why.
 */
export default function MixScreen() {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
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
          <Text
            {...voice}
            style={[styles.subtitle, { color: colors.muted, fontFamily: fontFamilies.ui }]}
          >
            {strings.subtitle}
          </Text>
        </View>
        <MixChoices />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { gap: space[2], paddingTop: space[2], paddingBottom: space[5] },
  subtitle: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
});
