import {
  BackLink,
  EntryRow,
  OutlineButton,
  fill,
  ScreenTitle,
  SectionLabel,
  UndoToastProvider,
  space,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from '../../composition';
import { editionStrings } from '../../edition';
import { useHiddenChanges, useHiddenScreenModel } from '../../hidden';
import { LoadFailed } from '../../language-pack';

const strings = editionStrings.hidden;

/** The text size scale above which a row puts its button under the name. */
const STACK_AT_FONT_SCALE = 1.3;

/**
 * Settings › Приховане: the Hidden Entries newest first, each with its kind
 * and labels and «Повернути», and the Hidden Categories with «Увімкнути»,
 * which puts the Category back in the Mix. Bringing an Entry back shows an
 * undo toast. Nothing hidden says so.
 */
export default function HiddenScreen() {
  return (
    <UndoToastProvider>
      <HiddenList />
    </UndoToastProvider>
  );
}

function HiddenList() {
  const composition = useComposition();
  const model = useHiddenScreenModel();
  const { restoreEntry, turnCategoryOn } = useHiddenChanges();
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const router = useRouter();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;

  return (
    <SafeAreaView
      testID="hidden"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <GestureHandlerRootView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.padded}>
            <BackLink
              testID="hidden-back"
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
          </View>
          {model?.empty === true && (
            <Text
              testID="hidden-empty"
              {...voice}
              style={[styles.empty, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {strings.empty}
            </Text>
          )}
          {model !== undefined && model.entries.length > 0 && (
            <View testID="hidden-entries" style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>{strings.entries}</SectionLabel>
              {model.entries.map(({ entryId, row, labels }) => (
                <EntryRow
                  key={entryId}
                  testID={`hidden-entry-${entryId}`}
                  row={row}
                  subtitle={labels.text}
                  accessibilityLabel={`${row.title}, ${labels.spoken}`}
                  accessory={
                    <OutlineButton
                      testID={`hidden-entry-${entryId}-restore`}
                      label={strings.restore}
                      accessibilityLabel={fill(strings.restoreLabel, { title: row.title })}
                      onPress={() => {
                        restoreEntry({ entryId, title: row.title });
                      }}
                    />
                  }
                />
              ))}
            </View>
          )}
          {model !== undefined && model.categories.length > 0 && (
            <View testID="hidden-categories" style={styles.section}>
              <SectionLabel style={styles.sectionLabel}>{strings.categories}</SectionLabel>
              {model.categories.map(({ id, name }) => (
                <View
                  key={id}
                  testID={`hidden-category-${id}`}
                  style={[
                    styles.categoryRow,
                    { borderColor: colors.line },
                    stacked && styles.categoryRowStacked,
                  ]}
                >
                  <Text
                    {...voice}
                    // A name stops growing at 1.3×, so it never breaks a word.
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.categoryName,
                      { color: colors.ink, fontFamily: fontFamilies.ui },
                    ]}
                  >
                    {name}
                  </Text>
                  <OutlineButton
                    testID={`hidden-category-${id}-turn-on`}
                    label={strings.turnOn}
                    accessibilityLabel={fill(strings.turnOnLabel, { name })}
                    onPress={() => {
                      turnCategoryOn(id);
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  padded: { paddingHorizontal: space[5], paddingTop: space[2] },
  header: { gap: space[2], paddingTop: space[2], paddingBottom: space[3] },
  subtitle: { fontSize: typeSize.body, lineHeight: typeSize.body * 1.5 },
  empty: {
    marginHorizontal: space[5],
    marginTop: space[6],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.5,
  },
  section: { marginTop: space[4] },
  sectionLabel: { marginHorizontal: space[6], marginBottom: space[2] },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    marginHorizontal: space[6],
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  // At the largest text sizes the button drops under the name instead of squeezing it.
  categoryRowStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  categoryName: { flexShrink: 1, fontSize: 20, fontWeight: '600' },
});
