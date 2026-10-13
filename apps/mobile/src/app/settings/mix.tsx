import {
  BackLink,
  MixChip,
  ScreenTitle,
  SettingsGroup,
  SwitchRow,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { edition, editionStrings } from '../../edition';
import { LoadFailed } from '../../language-pack';
import { useMixChanges, useMixState } from '../../mix';
import { mixScreenModel } from '../../mix-screen';

const strings = editionStrings.mix;

/**
 * Settings › Мій Мікс: a chip for every Category of the Edition and «Усі»,
 * and the Corrections switch when the Edition turns Corrections on. A change
 * applies at once (the Core's Mix, ADR 0019). The last Category's chip is
 * disabled, with a hint why.
 */
export default function MixScreen() {
  const composition = useComposition();
  const state = useMixState();
  const { toggleCategory, turnAllOn, setCorrections } = useMixChanges();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  const model = state === undefined ? undefined : mixScreenModel({ edition, mix: state });

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
        {model !== undefined && (
          <>
            <View style={styles.chips}>
              <MixChip
                testID="mix-chip-all"
                label={strings.all}
                on={model.allOn}
                feature
                onPress={turnAllOn}
              />
              {model.chips.map((chip) => (
                <MixChip
                  key={chip.id}
                  testID={`mix-chip-${chip.id}`}
                  label={chip.name}
                  on={chip.on}
                  disabled={chip.disabled}
                  accessibilityHint={strings.lastCategoryHint}
                  onPress={() => {
                    toggleCategory(chip.id, !chip.on);
                  }}
                />
              ))}
            </View>
            {model.lastCategoryHint && (
              <Text
                testID="mix-last-category-hint"
                {...voice}
                style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
              >
                {strings.lastCategoryHint}
              </Text>
            )}
            {model.corrections !== undefined && (
              <View style={styles.corrections}>
                <SettingsGroup>
                  <SwitchRow
                    testID="mix-corrections"
                    label={strings.corrections.title}
                    subtitle={strings.corrections.subtitle}
                    value={model.corrections.on}
                    onChange={setCorrections}
                  />
                </SettingsGroup>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[8] },
  header: { gap: space[2], paddingTop: space[2], paddingBottom: space[5] },
  subtitle: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { fontSize: typeSize.body, marginTop: space[3] },
  corrections: { marginTop: space[6] },
});
