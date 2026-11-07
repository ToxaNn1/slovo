import { MascotIn } from '@/mascot/mascot';
import { EmptyState, LearningRow, space, typeStyle, useEdition, useTokens } from '@slovo/ui';
import { FlatList, StyleSheet, Text } from 'react-native';

import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/use-open-screen';
import type { ListHeader } from '@/saved/list-header';
import { useLearningList } from '@/saved/learning';

const { learning: strings } = editionStrings;

/**
 * The «Вчу» list: every Entry the reader is learning, the next Review first,
 * each row with its Review day. A tap opens the Entry screen. The list is the
 * Core's own: it has no rename, delete or swipe action, and an Entry leaves it
 * once it is Learned or its mark is removed.
 */
export function LearningList({ header }: { header: ListHeader }) {
  const list = useLearningList();
  const tokens = useTokens();
  const { voice } = useEdition();
  const openScreen = useOpenScreen();

  return (
    <FlatList
      testID="learning"
      data={list}
      keyExtractor={(entry) => entry.entryId}
      renderItem={({ item: entry }) => (
        <LearningRow
          entry={entry}
          onPress={() => {
            openScreen(`/saved/learning/${entry.entryId}`);
          }}
        />
      )}
      ListHeaderComponent={header(null)}
      ListFooterComponent={
        list.length > 0 ? (
          <Text
            {...voice}
            style={[typeStyle('meta', tokens), styles.footer, { color: tokens.colors.muted }]}
          >
            {strings.footer}
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyState
          mascot={<MascotIn state="empty" />}
          testID="learning-empty"
          title={strings.empty.title}
          message={strings.empty.message}
        />
      }
      contentContainerStyle={styles.content}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space[8] },
  footer: { marginHorizontal: space[6], marginTop: space[4] },
});
