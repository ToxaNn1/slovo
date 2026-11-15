import {
  EmptyState,
  EntryRow,
  LabelChip,
  RecentQueries,
  SearchField,
  SearchLabel,
  minTouchTarget,
  space,
  typeStyle,
  useEdition,
  useTokens,
  useListScroll,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { editionStrings } from '@/edition/edition';
import { MascotAs } from '@/mascot/mascot';
import { ListTopButton } from '@/shell/list-top';
import {
  resultLabel,
  useOpenSearchResult,
  useRecentQueries,
  useSearchScreen,
  type SearchGroup,
  type SearchScreenModel,
} from '@/search/search';

const strings = editionStrings.search;

/**
 * Search («Пошук»), from the magnifier of the «Стрічка» header (board 09,
 * screens 78 and 79): the field with «Скасувати», which closes Search, and
 * under a label what it shows. The empty field lists the recent queries under
 * «Нещодавно» with «Очистити»; a tap on one runs it again. A query too short
 * reads «Продовжуй вводити»; what it finds comes under «Знайдено», each kind
 * in its group under its chip, «За значенням» last; from 3 letters a query
 * that finds nothing reads «Нічого не знайдено» with the sleeping Rupor. A
 * result opens its Entry card, which makes nothing Seen, and keeps the query
 * among the recent ones.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const model = useSearchScreen(query);
  const openResult = useOpenSearchResult(query);
  const fieldEmpty = query.trim() === '';
  const recent = useRecentQueries(fieldEmpty);
  const { colors } = useTokens();
  const router = useRouter();
  const scroll = useListScroll<SectionList<SearchGroup['data'][number], SearchGroup>>();
  const { list: listRef, onScroll: onListScroll } = scroll;

  return (
    <SafeAreaView
      testID="search"
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <SectionList<SearchGroup['data'][number], SearchGroup>
        ref={listRef}
        onScroll={onListScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        sections={!fieldEmpty && model.state === 'found' ? model.groups : []}
        keyExtractor={({ entryId }) => entryId}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { name, title } }) => (
          <View style={styles.group}>
            <LabelChip
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
              onCancel={() => {
                router.back();
              }}
            />
            {fieldEmpty ? (
              recent.queries.length > 0 && (
                <View style={styles.label}>
                  <SearchLabel testID="search-label" text={strings.recent} onClear={recent.clear} />
                  <RecentQueries queries={recent.queries} onRun={setQuery} />
                </View>
              )
            ) : (
              <StateLabel model={model} />
            )}
          </>
        }
        ListEmptyComponent={
          !fieldEmpty && model.state === 'nothingFound' ? <NothingFound /> : undefined
        }
      />
      <ListTopButton scroll={scroll} />
    </SafeAreaView>
  );
}

/** Above the results: the field and «Скасувати», which closes Search. */
function SearchHeader({
  query,
  onQueryChange,
  onCancel,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onCancel: () => void;
}) {
  const tokens = useTokens();
  const { voice } = useEdition();
  return (
    <View style={styles.header}>
      <View style={styles.field}>
        <SearchField
          testID="search-field"
          label={strings.title}
          placeholder={strings.inputPlaceholder}
          value={query}
          onChangeText={onQueryChange}
          returnKeyType="search"
        />
      </View>
      <Pressable
        testID="search-cancel"
        accessibilityRole="button"
        accessibilityLabel={strings.cancel}
        {...voice}
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={[typeStyle('searchCancel', tokens), { color: tokens.colors.ink }]}>
          {strings.cancel}
        </Text>
      </Pressable>
    </View>
  );
}

/** The label over a typed query: «Продовжуй вводити» or «Знайдено»; none while searching or for nothing found. */
function StateLabel({ model }: { model: SearchScreenModel }) {
  const text =
    model.state === 'keepTyping'
      ? strings.keepTyping
      : model.state === 'found'
        ? strings.found
        : undefined;
  if (text === undefined) return null;
  return (
    <View style={styles.label}>
      <SearchLabel testID="search-label" text={text} />
    </View>
  );
}

/**
 * «Нічого не знайдено» with the sleeping Rupor and the hint, for a query of 3
 * letters or more that found no Entry. VoiceOver stays in the field while the
 * reader types, so the screen says it aloud.
 */
function NothingFound() {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(strings.nothingFound);
  }, []);
  return (
    <EmptyState
      testID="search-nothing-found"
      mascot={(width) => <MascotAs state="sleeps" width={width} />}
      title={strings.nothingFound}
      message={strings.nothingFoundHint}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // The list grows to the screen, so «Нічого не знайдено» sits in the middle of it.
  content: { flexGrow: 1, paddingBottom: space[8] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[1],
  },
  field: { flex: 1, minWidth: 0 },
  cancel: { minHeight: minTouchTarget, justifyContent: 'center' },
  label: { marginHorizontal: space[5], marginTop: space[3] },
  group: { flexDirection: 'row', marginHorizontal: space[6], marginTop: space[4] },
});
