import type { AnyEntryCard, Composition, EntryLinkSource } from '@slovo/core';
import { EntryDetails, UndoToastProvider, useTokens } from '@slovo/ui';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCompositionRead } from '../composition';
import { useShell } from '../shell-value';
import { useShown } from '../shown-in-effect';
import { EntryActions } from './entry-actions';
import { useOpenScreen } from './use-open-screen';

/**
 * The Entry screen a list opens: Entry details, the red panel with the back
 * tile to the screen before, named `back`, over the Entry and its action row. It shows the Entry by id
 * whether or not the list still holds it, so it stays open when a tap on the
 * heart takes the Entry out, until the reader goes back. A Correction a Word
 * card links opens as the next Entry screen of the same `route`, its link
 * back named for the Word, and so does the Synonym Row a Word card names; a
 * Word a member of a Synonym Row links opens the same way, its link back
 * named as this screen's. Opening it never makes the
 * Entry Seen, unless it
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
   * History and today is an Active Day. A Search result, or the Word the mood
   * roulette landed on, opens through its own way in, which makes nothing
   * Seen (`search`, `mood`). On any way in, an id the Language Pack doesn't
   * have opens the Feed, such as a plain link's or a Spotlight result's to an
   * Entry a pack update took out (ADR 0057).
   */
  openedFrom?: EntryLinkSource | 'search' | 'mood' | undefined;
}) {
  const { colors } = useTokens();
  const { top } = useSafeAreaInsets();
  const router = useRouter();
  const openScreen = useOpenScreen();
  const { stressFall } = useShown();
  // `null` once read for an id the Language Pack doesn't have.
  const read = useCallback(
    async (open: Composition) => (await openEntry(open, entryId, openedFrom)) ?? null,
    [entryId, openedFrom],
  );
  const card = useCompositionRead(read, 'Could not open the Entry');
  useEffect(() => {
    if (card === null) router.replace('/');
  }, [card, router]);
  // The Word History drawn is the history opened for Analytics (ADR 0068); stable, so it counts once per Entry.
  const composition = useShell().composition;
  const onWordHistoryShown = useCallback(() => {
    const open = composition.state;
    if (open.status === 'ready') void open.value.analytics.wordHistoryOpened(entryId);
  }, [composition, entryId]);

  return (
    <UndoToastProvider>
      <View testID="entry-screen" style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* The status bar sits on the red panel in both Themes. */}
        <StatusBar style="dark" />
        {card?.entryId === entryId && (
          <ScrollView
            // The sheet of the action row is a child in React's tree, so a tap in its
            // name field must not be swallowed to put the keyboard away.
            keyboardShouldPersistTaps="handled"
          >
            <EntryDetails
              card={card}
              back={back}
              onBack={() => {
                router.back();
              }}
              topInset={top}
              onOpenCorrection={(correctionId) => {
                const word = card.kind === 'word' ? card.model.lemma : back;
                openScreen(`${route}/${correctionId}?back=${encodeURIComponent(word)}`);
              }}
              onOpenWord={(wordId) => {
                openScreen(`${route}/${wordId}?back=${encodeURIComponent(back)}`);
              }}
              onOpenSynonymRow={(synonymRowId) => {
                const word = card.kind === 'word' ? card.model.lemma : back;
                openScreen(`${route}/${synonymRowId}?back=${encodeURIComponent(word)}`);
              }}
              onWordHistoryShown={onWordHistoryShown}
              actions={<EntryActions card={card} place="details" />}
              stressFalls={stressFall}
            />
          </ScrollView>
        )}
        {/* Scrolled, the content passes under a red band behind the status bar. */}
        <View
          pointerEvents="none"
          style={[styles.statusBand, { height: top, backgroundColor: colors.accent }]}
        />
      </View>
    </UndoToastProvider>
  );
}

/** The Entry card, opened through the composition's path for where it opened from. */
function openEntry(
  composition: Composition,
  entryId: string,
  openedFrom: EntryLinkSource | 'search' | 'mood' | undefined,
): Promise<AnyEntryCard | undefined> {
  switch (openedFrom) {
    case 'search':
      return composition.openedFromSearch(entryId);
    case 'mood':
      return composition.openedFromMood(entryId);
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
  statusBand: { position: 'absolute', top: 0, left: 0, right: 0 },
});
