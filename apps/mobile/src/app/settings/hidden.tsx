import { featureOfKind, withoutStress, type CategoryKind, type MixKind } from '@slovo/core';
import {
  BackLink,
  EntryRow,
  fill,
  OutlineButton,
  rowPadding,
  ScreenTitle,
  SectionLabel,
  space,
  STACK_AT_FONT_SCALE,
  typeSize,
  UndoToastProvider,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '../../edition/edition';
import { useHiddenChanges, useHiddenScreenModel } from '../../mix/hidden';
import type { HiddenEntryModel, HiddenScreenModel } from '../../mix/hidden-screen';

const strings = editionStrings.hidden;

/**
 * Settings › Приховане: the Hidden Entries newest first, each with its kind
 * and labels and «Повернути», Synonym Rows and Tips each in their own
 * section, and the Hidden Categories, of Words and of
 * Corrections, and Corrections and
 * Idioms when they are out of the Mix, each with «Увімкнути», which puts it
 * back in the Mix. Bringing an Entry back shows an
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
  const model = useHiddenScreenModel();
  const sections = useMemo(() => hiddenSections(model), [model]);
  const { restoreEntry, turnCategoryOn, turnKindOn } = useHiddenChanges();
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView
      testID="hidden"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <SectionList<HiddenEntryModel, HiddenSection>
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={({ entryId }) => entryId}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { testID, title } }) => (
          <View testID={testID} style={styles.section}>
            <SectionLabel style={styles.sectionLabel}>{title}</SectionLabel>
          </View>
        )}
        renderItem={({ item: { entryId, row, labels } }) => (
          <EntryRow
            testID={`hidden-entry-${entryId}`}
            row={row}
            subtitle={labels.text}
            accessibilityLabel={`${row.title}, ${labels.spoken}`}
            accessory={
              <OutlineButton
                testID={`hidden-entry-${entryId}-restore`}
                label={strings.restore}
                accessibilityLabel={fill(strings.restoreLabel, { title: withoutStress(row.title) })}
                onPress={() => {
                  restoreEntry(entryId);
                }}
              />
            }
          />
        )}
        ListHeaderComponent={
          <HiddenHeader
            empty={model.empty}
            onBack={() => {
              router.back();
            }}
          />
        }
        ListFooterComponent={
          model.categories.length > 0 || model.kinds.length > 0 ? (
            <CategoriesSection
              model={model}
              onTurnCategoryOn={turnCategoryOn}
              onTurnKindOn={turnKindOn}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

/** A section of Hidden Entries: the Words, Corrections and Idioms, or the Hidden Entries of one kind as a whole. */
interface HiddenSection {
  readonly testID: string;
  readonly title: string;
  readonly data: readonly HiddenEntryModel[];
}

/** The sections of Hidden Entries that hold any: «Записи», then Synonym Rows and Tips. */
function hiddenSections(model: HiddenScreenModel): HiddenSection[] {
  return [
    ...(model.entries.length > 0
      ? [{ testID: 'hidden-entries', title: strings.entries, data: model.entries }]
      : []),
    ...model.sections.map(({ name, title, entries }) => ({
      testID: `hidden-section-${name}`,
      title,
      data: entries,
    })),
  ];
}

/** Above the list: back link, title, and the empty line. */
function HiddenHeader({ empty, onBack }: { empty: boolean; onBack: () => void }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <>
      <View style={styles.padded}>
        <BackLink testID="hidden-back" label={editionStrings.settings.title} onPress={onBack} />
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
      {empty && (
        <Text
          testID="hidden-empty"
          {...voice}
          style={[styles.empty, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {strings.empty}
        </Text>
      )}
    </>
  );
}

/** Below the list: the Hidden Categories and each kind out of the Mix as a whole, each with the button that turns it on. */
function CategoriesSection({
  model,
  onTurnCategoryOn,
  onTurnKindOn,
}: {
  model: HiddenScreenModel;
  onTurnCategoryOn: (id: string, of: CategoryKind) => void;
  onTurnKindOn: (entryKind: MixKind) => void;
}) {
  return (
    <View testID="hidden-categories" style={styles.section}>
      <SectionLabel style={styles.sectionLabel}>{strings.categories}</SectionLabel>
      {model.categories.map(({ id, of, name }) => (
        <TurnOnRow
          key={`${of}-${id}`}
          testID={of === 'word' ? `hidden-category-${id}` : `hidden-correction-category-${id}`}
          name={name}
          accessibilityLabel={fill(strings.turnOnLabel, { name })}
          onTurnOn={() => {
            onTurnCategoryOn(id, of);
          }}
        />
      ))}
      {model.kinds.map(({ entryKind, name, turnOnLabel }) => (
        <TurnOnRow
          key={entryKind}
          testID={`hidden-${featureOfKind(entryKind)}`}
          name={name}
          accessibilityLabel={turnOnLabel}
          onTurnOn={() => {
            onTurnKindOn(entryKind);
          }}
        />
      ))}
    </View>
  );
}

/** A row of the Categories section: a name and the button that puts it back in the Mix. */
function TurnOnRow({
  testID,
  name,
  accessibilityLabel,
  onTurnOn,
}: {
  testID: string;
  name: string;
  accessibilityLabel: string;
  onTurnOn: () => void;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  const stacked = useWindowDimensions().fontScale > STACK_AT_FONT_SCALE;
  return (
    <View
      testID={testID}
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
        style={[styles.categoryName, { color: colors.ink, fontFamily: fontFamilies.ui }]}
      >
        {name}
      </Text>
      <OutlineButton
        testID={`${testID}-turn-on`}
        label={strings.turnOn}
        accessibilityLabel={accessibilityLabel}
        onPress={onTurnOn}
      />
    </View>
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
    paddingVertical: rowPadding,
    borderBottomWidth: 1,
  },
  // At the largest text sizes the button drops under the name instead of squeezing it.
  categoryRowStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  categoryName: { flexShrink: 1, fontSize: typeSize.rowLemma, fontWeight: '600' },
});
