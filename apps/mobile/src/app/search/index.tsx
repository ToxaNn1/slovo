import {
  BackLink,
  EntryRow,
  OutlinedChip,
  RecentQueries,
  space,
  TextField,
  typeSize,
  useEdition,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import {
  resultLabel,
  useOpenSearchResult,
  useRecentQueries,
  useSearchScreen,
  type SearchGroup,
} from '@/search/search';

const strings = editionStrings.search;

/**
 * Search («Пошук»), from the magnifier of the «Головна» header: a field and,
 * from 2 letters, what it finds, each kind in its group under its chip and
 * from 3 «За значенням», or «Нічого не знайдено». A result opens its Entry
 * card, which makes nothing Seen, and keeps the query among the recent ones,
 * which the empty field lists with «Очистити»; a tap on one runs it again.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const { groups, nothingFound } = useSearchScreen(query);
  const openResult = useOpenSearchResult(query);
  const fieldEmpty = query.trim() === '';
  const recent = useRecentQueries(fieldEmpty);
  const { colors } = useTokens();
  const router = useRouter();

  return (
    <SafeAreaView
      testID="search"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <SectionList<SearchGroup['data'][number], SearchGroup>
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        sections={groups}
        keyExtractor={({ entryId }) => entryId}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { name, title } }) => (
          <View style={styles.group}>
            <OutlinedChip
              testID={`search-group-${name}`}
              text={title}
              accessibilityLabel={title}
              accessibilityRole="header"
              size="roomy"
            />
          </View>
        )}
        renderItem={({ item: row, section: { name } }) => (
          <EntryRow
            testID={`${name === 'byMeaning' ? 'search-meaning' : 'search-result'}-${row.entryId}`}
            row={row}
            accessibilityLabel={resultLabel(row)}
            onPress={() => {
              openResult(row.entryId);
            }}
          />
        )}
        ListHeaderComponent={
          <>
            <SearchHeader
              query={query}
              onQueryChange={setQuery}
              onBack={() => {
                router.back();
              }}
            />
            {fieldEmpty && recent.queries.length > 0 && (
              <View style={styles.recent}>
                <RecentQueries queries={recent.queries} onRun={setQuery} onClear={recent.clear} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={nothingFound ? <NothingFound /> : null}
      />
    </SafeAreaView>
  );
}

/** Above the results: the link back to «Головна» and the field. */
function SearchHeader({
  query,
  onQueryChange,
  onBack,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.header}>
      <BackLink testID="search-back" label={editionStrings.tabs.home} onPress={onBack} />
      <TextField
        testID="search-field"
        label={strings.title}
        value={query}
        onChangeText={onQueryChange}
        autoFocus
        returnKeyType="search"
      />
    </View>
  );
}

/**
 * «Нічого не знайдено», for a query Search answered with no Entry. VoiceOver
 * stays in the field while the reader types, so the screen says it aloud.
 */
function NothingFound() {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(strings.nothingFound);
  }, []);
  return (
    <Text
      testID="search-nothing-found"
      {...voice}
      style={[styles.nothingFound, { color: colors.muted, fontFamily: fontFamilies.ui }]}
    >
      {strings.nothingFound}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  header: { gap: space[3], paddingHorizontal: space[5], paddingTop: space[2] },
  recent: { marginHorizontal: space[5], marginTop: space[2] },
  group: { flexDirection: 'row', marginHorizontal: space[6], marginTop: space[4] },
  nothingFound: {
    marginHorizontal: space[5],
    marginTop: space[6],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.5,
  },
});
