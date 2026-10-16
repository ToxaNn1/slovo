import { entryIdOf, type Composition, type EntryFeedCard } from '@slovo/core';
import {
  BackLink,
  DecorBackground,
  EntryCard,
  space,
  UndoToastProvider,
  useTokens,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition, useOpenedRead } from './composition';
import { EntryActions } from './entry-actions';
import type { OpenedFrom } from './entry-link';
import { LoadFailed } from './language-pack';
import { useOpenScreen } from './use-open-screen';

/**
 * The Entry screen a list opens: one Entry card with its action row, under a
 * link back to the screen before, named `back`. It shows the Entry by id
 * whether or not the list still holds it, so it stays open when a tap on the
 * heart takes the Entry out, until the reader goes back. A Correction a Word
 * card links opens as the next Entry screen of the same `route`, its link
 * back named for the Word. Opening it never makes the Entry Seen, unless it
 * opens from a notification or the widget. Hiding its Entry hides it and
 * keeps the screen open, with the undo toast.
 */
export function EntryScreen({
  entryId,
  back,
  route,
  openedFrom,
}: {
  entryId: string;
  back: string;
  /** The route of the list's Entry screen, such as `/saved/favorites`. */
  route: string;
  /**
   * Where outside the app it opened from, if it did: the Entry is Seen, in
   * History and today is an Active Day. An id the Language Pack doesn't have
   * opens the Feed.
   */
  openedFrom?: OpenedFrom | undefined;
}) {
  const composition = useComposition();
  const { colors } = useTokens();
  const router = useRouter();
  const openScreen = useOpenScreen();
  // `null` once read for an id the Language Pack doesn't have.
  const read = useCallback(
    async (open: Composition) => (await openEntry(open, entryId, openedFrom)) ?? null,
    [entryId, openedFrom],
  );
  const card = useOpenedRead(read, 'Could not open the Entry');
  useEffect(() => {
    if (openedFrom !== undefined && card === null) router.replace('/');
  }, [openedFrom, card, router]);

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  return (
    <UndoToastProvider>
      <SafeAreaView
        testID="entry-screen"
        edges={['top']}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <DecorBackground />
        <View style={styles.back}>
          <BackLink
            testID="entry-screen-back"
            label={back}
            onPress={() => {
              router.back();
            }}
          />
        </View>
        {card !== undefined && card !== null && entryIdOf(card) === entryId && (
          <ScrollView
            // The sheet of the action row is a child in React's tree, so a tap in its
            // name field must not be swallowed to put the keyboard away.
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <EntryCard
              card={card}
              onOpenCorrection={(correctionId) => {
                const word = card.kind === 'word' ? card.wordCard.lemma : back;
                openScreen(`${route}/${correctionId}?back=${encodeURIComponent(word)}`);
              }}
              actions={<EntryActions card={card} />}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </UndoToastProvider>
  );
}

/** The Entry card, opened through the composition's path for where it opened from. */
function openEntry(
  composition: Composition,
  entryId: string,
  openedFrom: OpenedFrom | undefined,
): Promise<EntryFeedCard | undefined> {
  switch (openedFrom) {
    case 'notification':
      return composition.openedFromNotification(entryId);
    case 'widget':
      return composition.widget.opened(entryId);
    case undefined:
      return composition.entryCard(entryId);
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  content: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[6] },
});
