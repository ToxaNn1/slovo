import type { Collection } from '@slovo/core';
import { useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BottomSheet } from '../primitives/BottomSheet';
import { fill, useEdition } from '../providers/EditionProvider';
import { PrimaryButton } from '../primitives/PrimaryButton';
import { SHEET_ROW_HEIGHT, SheetTitle } from '../primitives/SheetParts';
import { checkboxRadius, minTouchTarget, space, typeSize } from '../tokens';
import { useTokens } from '../providers/TokensProvider';

/** The checkbox's side, from the design. */
const CHECKBOX_SIZE = 26;

/** A checkbox: an outline, or filled with the accent and a tick while checked. */
function Checkbox({ checked }: { checked: boolean }) {
  const { colors } = useTokens();
  return (
    <View
      style={[
        styles.checkbox,
        checked
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { borderColor: colors.muted },
      ]}
    >
      {checked && (
        <Svg width={16} height={16} viewBox="0 0 16 16">
          <Path
            d="M3 8.5l3.2 3.2L13 4.8"
            fill="none"
            stroke={colors.background}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
    </View>
  );
}

/**
 * The «До колекції» sheet (design 2c): the reader's Collections with a
 * checkbox and a count each, which apply at once; «+ Нова колекція» opens a
 * name field, and «Створити» makes the Collection with the Entry in it;
 * «Готово» only closes. The Collections are the Core's, and with none yet the
 * name field is open at once, without the keyboard. Needs a `SafeAreaProvider` above it.
 */
export function CollectionSheet({
  visible,
  entryTitle,
  collections,
  isFiled,
  onToggle,
  onCreate,
  onClose,
}: {
  visible: boolean;
  /** What the Entry's row leads with, shown over the Collections. */
  entryTitle: string;
  /** The Collections, newest first. */
  collections: readonly Collection[];
  /** Whether the Entry is in the Collection. */
  isFiled: (collectionId: string) => boolean;
  /** Files the Entry in the Collection, or takes it out. */
  onToggle: (collectionId: string, filed: boolean) => void;
  /**
   * Makes a Collection with the Entry in it; resolves to why the name is
   * refused, in the Edition's words, or nothing when it is made. Rejects when
   * the Collection could not be kept.
   */
  onCreate: (name: string) => Promise<string | undefined>;
  onClose: () => void;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} testID="collection-sheet">
      <SheetContent
        entryTitle={entryTitle}
        collections={collections}
        isFiled={isFiled}
        onToggle={onToggle}
        onCreate={onCreate}
        onClose={onClose}
      />
    </BottomSheet>
  );
}

function SheetContent({
  entryTitle,
  collections,
  isFiled,
  onToggle,
  onCreate,
  onClose,
}: Omit<Parameters<typeof CollectionSheet>[0], 'visible'>) {
  const { colors, fontFamilies, radii } = useTokens();
  const { strings, voice, count } = useEdition();
  const sheet = strings.collections.sheet;
  const [creating, setCreating] = useState(collections.length === 0);
  /** The keyboard rises for a field the reader asked for, not along with the sheet's own slide. */
  const [focusName, setFocusName] = useState(false);
  const [name, setName] = useState('');
  const [refusal, setRefusal] = useState<string>();
  /** A second tap while the first one is being made must not make a second Collection. */
  const making = useRef(false);

  async function create() {
    if (making.current) return;
    making.current = true;
    try {
      const reason = await onCreate(name);
      setRefusal(reason);
      if (reason === undefined) {
        setName('');
        setCreating(false);
      } else {
        AccessibilityInfo.announceForAccessibility(reason);
      }
    } catch (error) {
      // Nothing was kept: the field stays as the reader typed it, to try again.
      console.error('Could not make the Collection', error);
    } finally {
      making.current = false;
    }
  }

  return (
    <>
      <View style={styles.header}>
        <SheetTitle>{sheet.title}</SheetTitle>
        <Text
          {...voice}
          style={[styles.entry, { color: colors.accent, fontFamily: fontFamilies.word }]}
          numberOfLines={2}
        >
          {entryTitle}
        </Text>
      </View>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {collections.map((collection, index) => {
          const filed = isFiled(collection.id);
          return (
            <Pressable
              key={collection.id}
              testID={`collection-row-${collection.id}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: filed }}
              accessibilityLabel={fill(sheet.rowLabel, {
                name: collection.name,
                count: count(strings.collections.count, collection.count),
              })}
              {...voice}
              onPress={() => {
                onToggle(collection.id, !filed);
              }}
              style={[
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
              ]}
            >
              <Checkbox checked={filed} />
              <Text
                style={[styles.name, { color: colors.ink, fontFamily: fontFamilies.ui }]}
                {...voice}
              >
                {collection.name}
              </Text>
              <Text
                style={[styles.count, { color: colors.muted, fontFamily: fontFamilies.ui }]}
                {...voice}
              >
                {count(strings.collections.count, collection.count)}
              </Text>
            </Pressable>
          );
        })}
        {creating ? (
          <View style={styles.creation}>
            <View style={styles.creationRow}>
              <TextInput
                testID="collection-name"
                accessibilityLabel={sheet.namePlaceholder}
                {...voice}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setRefusal(undefined);
                }}
                onSubmitEditing={() => void create()}
                placeholder={sheet.namePlaceholder}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                autoFocus={focusName}
                autoCapitalize="sentences"
                autoCorrect={false}
                spellCheck={false}
                selectionColor={colors.accent}
                style={[
                  styles.field,
                  {
                    backgroundColor: colors.background,
                    borderColor: refusal === undefined ? colors.accent : colors.heart,
                    borderRadius: radii.button,
                    color: colors.ink,
                    fontFamily: fontFamilies.ui,
                  },
                ]}
              />
              <Pressable
                testID="collection-create"
                accessibilityRole="button"
                {...voice}
                onPress={() => void create()}
                style={[
                  styles.create,
                  { backgroundColor: colors.accent, borderRadius: radii.button },
                ]}
              >
                <Text
                  style={[
                    styles.createLabel,
                    { color: colors.background, fontFamily: fontFamilies.ui },
                  ]}
                >
                  {sheet.create}
                </Text>
              </Pressable>
            </View>
            {refusal !== undefined && (
              <Text
                testID="collection-refusal"
                {...voice}
                style={[styles.refusal, { color: colors.ink, fontFamily: fontFamilies.ui }]}
              >
                {refusal}
              </Text>
            )}
          </View>
        ) : (
          <Pressable
            testID="collection-new"
            accessibilityRole="button"
            {...voice}
            onPress={() => {
              setCreating(true);
              setFocusName(true);
            }}
            style={styles.newCollection}
          >
            <Text style={[styles.newLabel, { color: colors.accent, fontFamily: fontFamilies.ui }]}>
              {sheet.newCollection}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={styles.done}>
        <PrimaryButton testID="collection-done" label={sheet.done} onPress={onClose} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: space[3],
    paddingBottom: space[3],
  },
  entry: { flexShrink: 1, fontSize: typeSize.rowLemma, fontWeight: '600', textAlign: 'right' },
  list: { flexGrow: 0, flexShrink: 1 },
  row: {
    minHeight: SHEET_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[2],
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderWidth: 1.5,
    borderRadius: checkboxRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flex: 1, fontSize: typeSize.listItem, fontWeight: '600' },
  count: { fontSize: typeSize.body },
  newCollection: { minHeight: minTouchTarget, justifyContent: 'center', marginTop: space[3] },
  newLabel: { fontSize: typeSize.blockHeading, fontWeight: '700' },
  creation: { marginTop: space[3], gap: space[2] },
  creationRow: { flexDirection: 'row', gap: space[3] },
  field: {
    flex: 1,
    minHeight: SHEET_ROW_HEIGHT,
    borderWidth: 1,
    paddingHorizontal: space[4],
    fontSize: typeSize.listItem,
  },
  create: {
    minHeight: SHEET_ROW_HEIGHT,
    paddingHorizontal: space[5],
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: { fontSize: typeSize.blockHeading, fontWeight: '700' },
  refusal: { fontSize: typeSize.caption, fontWeight: '600' },
  done: { marginTop: space[4] },
});
