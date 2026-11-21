import type { CollectionLinkPreview } from '@slovo/core';
import {
  BackLink,
  EntryRow,
  Button,
  ScreenTitle,
  space,
  typeStyle,
  UndoToastProvider,
  useEdition,
  useTokens,
  useUndoToast,
} from '@slovo/ui';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logError } from '@/diagnostics/log';
import { editionStrings } from '@/edition/edition';
import { MascotAs } from '@/mascot/mascot';
import { useCollectionLinkPreview } from '@/saved/collection-link';
import { useSegmentParam } from '@/route-params';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.link;

/**
 * The recipient sheet of a Collection Link opened from outside the app,
 * `https://<domain>/<edition>/c/<id>` or `slovo://c/<id>?edition=<edition>` (ADR 0065):
 * the shared Collection's name, how many Entries it holds and its first 5
 * Entries this Language Pack has, how many it lacks, and «Додати собі», which
 * makes the reader's own copy and opens it in the link screen's place, or says
 * in a toast that it could not; a second tap opens the copy made, never a «(2)»;
 * with none of its Entries in the pack, «Додати собі» is disabled. A spinner
 * shows until the link is read.
 * Offline it says there is no connection, with «Спробувати ще», which reads
 * the link again; an unknown link, one of another Edition or one with Collection
 * Links off says the link isn't available.
 */
export default function CollectionLinkScreen() {
  const linkId = useSegmentParam('linkId');
  const { colors } = useTokens();
  const router = useRouter();
  // Each «Спробувати ще» mounts the read afresh, so it reads the link again.
  const [attempt, setAttempt] = useState(0);

  return (
    <UndoToastProvider>
      <SafeAreaView
        testID="collection-link"
        edges={['top']}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <View style={styles.bar}>
          <BackLink
            testID="collection-link-back"
            label={editionStrings.tabs.home}
            onPress={() => {
              router.navigate('/');
            }}
          />
        </View>
        <LinkPreview
          key={attempt}
          linkId={linkId}
          onRetry={() => {
            setAttempt((done) => done + 1);
          }}
        />
      </SafeAreaView>
    </UndoToastProvider>
  );
}

/** The link as read: a spinner until then, its preview, or why there is none. */
function LinkPreview({ linkId, onRetry }: { linkId: string; onRetry: () => void }) {
  const preview = useCollectionLinkPreview(linkId);
  const { colors } = useTokens();
  if (preview === undefined)
    return (
      <ActivityIndicator
        testID="collection-link-loading"
        color={colors.muted}
        style={styles.loading}
      />
    );
  if (preview.ok) return <Preview preview={preview} />;
  return preview.reason === 'offline' ? (
    <Failure text={strings.offline} onRetry={onRetry} />
  ) : (
    <Failure text={strings.notFound} />
  );
}

/**
 * The link's name, count, first Entries and «Додати собі», disabled with
 * nothing to copy; the copy opens once made, or a toast says it wasn't.
 */
function Preview({ preview }: { preview: Extract<CollectionLinkPreview, { ok: true }> }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { count, voice } = useEdition();
  const router = useRouter();
  const showToast = useUndoToast();
  const [adding, setAdding] = useState(false);
  // The copy under way, so a second tap before the screen draws again makes none.
  const addingNow = useRef(false);
  // The copy once made, which a second tap opens instead of a copy of it.
  const made = useRef<string | undefined>(undefined);
  const { add } = preview;
  const openCopy = (copyId: string) => {
    router.replace(`/saved/collections/${copyId}`);
  };

  return (
    <FlatList
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      data={preview.firstEntries}
      keyExtractor={(row) => row.entryId}
      renderItem={({ item }) => <EntryRow row={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle>{preview.name}</ScreenTitle>
          <Text
            testID="collection-link-count"
            {...voice}
            style={[typeStyle('sub', tokens), styles.line, { color: colors.muted }]}
          >
            {count(collectionStrings.count, preview.count)}
          </Text>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {preview.skipped > 0 && (
            <Text
              testID="collection-link-skipped"
              {...voice}
              style={[typeStyle('sub', tokens), styles.line, { color: colors.muted }]}
            >
              {count(strings.unavailable, preview.skipped)}
            </Text>
          )}
          <Button
            testID="collection-link-add"
            label={strings.add}
            busy={adding}
            disabled={add === undefined}
            onPress={() => {
              if (add === undefined || addingNow.current) return;
              if (made.current !== undefined) {
                openCopy(made.current);
                return;
              }
              addingNow.current = true;
              setAdding(true);
              add().then(
                (copy) => {
                  made.current = copy.id;
                  addingNow.current = false;
                  setAdding(false);
                  openCopy(copy.id);
                },
                (error: unknown) => {
                  addingNow.current = false;
                  setAdding(false);
                  logError('Could not copy the Collection Link', error);
                  showToast({ message: strings.addFailed });
                },
              );
            }}
          />
        </View>
      }
      contentContainerStyle={styles.content}
    />
  );
}

/**
 * Why the link opens no preview; offline, under the Mascot asleep and with
 * «Спробувати ще», which reads it again.
 */
function Failure({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  return (
    <View style={styles.failure}>
      {onRetry !== undefined && <MascotAs state="sleeps" />}
      <Text
        testID="collection-link-failure"
        {...voice}
        style={[typeStyle('sub', tokens), { color: colors.ink }]}
      >
        {text}
      </Text>
      {onRetry !== undefined && (
        <Button testID="collection-link-retry" label={strings.retry} onPress={onRetry} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  bar: { paddingHorizontal: space[3], paddingTop: space[2] },
  header: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[4] },
  line: { marginTop: space[2] },
  footer: { gap: space[4], paddingHorizontal: space[6], paddingTop: space[5] },
  failure: { gap: space[4], paddingHorizontal: space[6], paddingTop: space[6] },
  loading: { paddingTop: space[6] },
});
