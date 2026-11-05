import type { CuratedCollectionEntry, CuratedCollectionScreen as Screen } from '@slovo/core';
import {
  BackLink,
  Button,
  EntryRow,
  fill,
  ScreenTitle,
  space,
  typeStyle,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCuratedCollectionScreen } from '@/dashboard/curated-collection';
import { editionStrings } from '@/edition/edition';

const {
  add: addLabel,
  added: addedLabel,
  known: knownCount,
} = editionStrings.dashboard.curatedCollection;

/** A Curated Collection's screen, from its card on the Dashboard; an id with no screen returns home. */
export default function CuratedCollectionRoute() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const { screen, add, openEntry } = useCuratedCollectionScreen(collectionId);
  const { colors } = useTokens();
  const router = useRouter();
  if (screen === null) return <Redirect href="/" />;
  return (
    <SafeAreaView
      testID="curated-collection"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <FlatList<CuratedCollectionEntry>
        data={screen?.entries ?? []}
        keyExtractor={({ entryId }) => entryId}
        renderItem={({ item: { entryId, row, known } }) => (
          <EntryRow
            testID={`curated-collection-entry-${entryId}`}
            row={row}
            {...(known && { trailing: editionStrings.knowledge.known })}
            onPress={() => {
              openEntry(entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.bar}>
              <BackLink
                testID="curated-collection-back"
                label={editionStrings.tabs.home}
                onPress={() => {
                  router.back();
                }}
              />
            </View>
            {screen !== undefined && <Header screen={screen} onAdd={add} />}
          </>
        }
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

/** The name, the description, «Знаю X з N» and «+ Додати», or «Додано ✓» once a copy is kept. */
function Header({ screen, onAdd }: { screen: Screen; onAdd: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const { collection, known, total, added } = screen;
  return (
    <View style={styles.header}>
      <ScreenTitle>{collection.name}</ScreenTitle>
      <Text {...voice} style={[typeStyle('rowSub', tokens), { color: colors.ink }]}>
        {collection.description}
      </Text>
      <Text
        {...voice}
        testID="curated-collection-known"
        style={[typeStyle('meta', tokens), { color: colors.muted }]}
      >
        {fill(knownCount, { x: String(known), n: String(total) })}
      </Text>
      <Button
        testID="curated-collection-add"
        variant={added ? 'neutral' : 'primary'}
        size="small"
        label={added ? addedLabel : addLabel}
        disabled={added}
        onPress={onAdd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { paddingLeft: space[3], paddingTop: space[2] },
  header: {
    paddingHorizontal: space[6],
    paddingTop: space[2],
    paddingBottom: space[3],
    gap: space[2],
  },
  content: { paddingBottom: space[8] },
});
