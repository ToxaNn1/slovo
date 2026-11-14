import { withoutStress, type CollectionEntry } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { EntryRow } from '../entries/EntryRow';
import { Button } from '../primitives/Button';
import { IconButton } from '../primitives/IconButton';
import { RowChevron } from '../primitives/RowChevron';
import { Wedge } from '../primitives/Wedge';
import { fill, useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { collectionScreen, space, typeStyle, wedges } from '../tokens';

/**
 * The head of a Collection's screen (board 09): the back tile on the left and
 * «⋯» on the right, red while the Collection menu is open; under them the
 * Collection's name and how many Words it holds.
 */
export function CollectionHeader({
  name,
  count,
  back,
  menu,
}: {
  name: string;
  /** «5 слів», in the Edition's words. */
  count: string;
  back: { label: string; onPress: () => void; testID?: string };
  /** «⋯»: none while the Collection is gone. */
  menu?: { label: string; open: boolean; onPress: () => void; testID?: string } | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View style={styles.header}>
      <View style={styles.tiles}>
        <IconButton
          testID={back.testID}
          icon="back"
          accessibilityLabel={back.label}
          onPress={back.onPress}
        />
        {menu !== undefined && (
          <IconButton
            testID={menu.testID}
            icon="more"
            fill={menu.open ? 'accent' : 'sunken'}
            accessibilityLabel={menu.label}
            onPress={menu.onPress}
          />
        )}
      </View>
      <Text
        accessibilityRole="header"
        {...voice}
        style={[typeStyle('collectionTitle', tokens), styles.title, { color: colors.ink }]}
      >
        {name}
      </Text>
      <Text
        testID="collection-count"
        {...voice}
        style={[typeStyle('collectionWordCount', tokens), { color: colors.muted }]}
      >
        {count}
      </Text>
    </View>
  );
}

/**
 * An Entry of a Collection on its screen (board 09): the Lemma over its short
 * meaning and the chevron on the right. A tap opens the Entry; a swipe (or the
 * VoiceOver action) takes it out of this Collection only. Needs a
 * `GestureHandlerRootView` above it.
 */
export function CollectionWordRow({
  entry: { row },
  collectionName,
  onPress,
  onRemove,
}: {
  entry: CollectionEntry;
  collectionName: string;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { strings } = useEdition();
  const { entries } = strings.collections;
  return (
    <EntryRow
      row={row}
      testID={`collection-row-${row.entryId}`}
      onPress={onPress}
      accessory={<RowChevron tone="ink" size={collectionScreen.chevron} />}
      actions={[
        {
          name: 'remove',
          label: entries.remove,
          accessibilityLabel: fill(entries.removeLabel, {
            title: withoutStress(row.title),
            name: collectionName,
          }),
          tone: 'destructive',
          onPress: onRemove,
        },
      ]}
    />
  );
}

/** «Поділитися посиланням» at the foot of a Collection's screen (board 09): the ink button with a red wedge. */
export function CollectionShareButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTokens();
  return (
    <View style={styles.footer}>
      <Button
        testID={testID}
        variant="inverse"
        label={label}
        mark={
          <Wedge
            points={wedges.wedge}
            color={colors.accent}
            width={collectionScreen.mark.width}
            height={collectionScreen.mark.height}
          />
        }
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[3] },
  tiles: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { marginTop: collectionScreen.titleTop, marginBottom: collectionScreen.countGap },
  footer: { paddingHorizontal: space[5], paddingVertical: collectionScreen.footerPadding },
});
