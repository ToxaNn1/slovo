import { entryIdOf, type EntryFeedCard } from '@slovo/core';
import { BackLink, DecorBackground, EntryCard, space, useTokens } from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useComposition } from './composition';
import { EntryActions } from './entry-actions';
import { LoadFailed } from './language-pack';

/**
 * The Entry screen a list opens: one Entry card with its action row, under a
 * link back to the list, named `back`. It shows the Entry by id whether or
 * not the list still holds it, so it stays open when a tap on the heart takes
 * the Entry out, until the reader goes back. Opening it never makes the
 * Entry Seen.
 */
export function EntryScreen({ entryId, back }: { entryId: string; back: string }) {
  const composition = useComposition();
  const { colors } = useTokens();
  const router = useRouter();
  const [card, setCard] = useState<EntryFeedCard>();
  const open = composition.status === 'ready' ? composition.composition : undefined;

  useEffect(() => {
    if (open === undefined) return;
    let active = true;
    open.entryCard(entryId).then(
      (opened) => {
        if (active) setCard(opened);
      },
      (error: unknown) => {
        console.error('Could not open the Entry', error);
      },
    );
    return () => {
      active = false;
    };
  }, [open, entryId]);

  if (composition.status === 'failed') return <LoadFailed onRetry={composition.retry} />;
  return (
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
      {card !== undefined && entryIdOf(card) === entryId && (
        <ScrollView contentContainerStyle={styles.content}>
          <EntryCard card={card} actions={<EntryActions entryId={entryId} />} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { paddingHorizontal: space[3], paddingTop: space[2] },
  content: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[6] },
});
