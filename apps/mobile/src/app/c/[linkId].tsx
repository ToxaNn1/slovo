import type { CollectionLinkPreview } from '@slovo/core';
import {
  BackLink,
  EntryRow,
  PrimaryButton,
  ScreenTitle,
  space,
  typeSize,
  UndoToastProvider,
  useEdition,
  useTokens,
  useUndoToast,
} from '@slovo/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logError } from '@/diagnostics/log';
import { editionStrings } from '@/edition/edition';
import { useOpenScreen } from '@/entries/use-open-screen';
import { useCollectionLinkPreview } from '@/saved/collection-link';

const { collections: collectionStrings } = editionStrings;
const strings = collectionStrings.link;

/**
 * The recipient sheet of a Collection Link opened from outside the app,
 * `https://<domain>/<edition>/c/<id>` or `slovo://c/<id>?edition=<edition>` (ADR 0058, 0065):
 * the shared Collection's name, how many Entries it holds and its first 5
 * Entries this Language Pack has, how many it lacks, and «Додати собі», which
 * makes the reader's own copy and opens it, or says in a toast that it could
 * not; with none of its Entries in the pack, «Додати собі» is disabled.
 * Offline it says there is no connection; an unknown link, one of another Edition or one with Collection
 * Links off says the link isn't available.
 */
export default function CollectionLinkScreen() {
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const preview = useCollectionLinkPreview(linkId);
  const { colors } = useTokens();
  const router = useRouter();

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
        {preview !== undefined &&
          (preview.ok ? (
            <Preview preview={preview} />
          ) : (
            <Failure text={preview.reason === 'offline' ? strings.offline : strings.notFound} />
          ))}
      </SafeAreaView>
    </UndoToastProvider>
  );
}

/**
 * The link's name, count, first Entries and «Додати собі», disabled with
 * nothing to copy; the copy opens once made, or a toast says it wasn't.
 */
function Preview({ preview }: { preview: Extract<CollectionLinkPreview, { ok: true }> }) {
  const { colors, fontFamilies } = useTokens();
  const { count, voice } = useEdition();
  const openScreen = useOpenScreen();
  const showToast = useUndoToast();
  const [adding, setAdding] = useState(false);
  const { add } = preview;

  return (
    <FlatList
      data={preview.firstEntries}
      keyExtractor={(row) => row.entryId}
      renderItem={({ item }) => <EntryRow row={item} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenTitle>{preview.name}</ScreenTitle>
          <Text
            testID="collection-link-count"
            {...voice}
            style={[styles.line, { color: colors.muted, fontFamily: fontFamilies.ui }]}
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
              style={[styles.line, { color: colors.muted, fontFamily: fontFamilies.ui }]}
            >
              {count(strings.unavailable, preview.skipped)}
            </Text>
          )}
          <PrimaryButton
            testID="collection-link-add"
            label={strings.add}
            busy={adding}
            disabled={add === undefined}
            onPress={() => {
              if (add === undefined) return;
              setAdding(true);
              add().then(
                (copy) => {
                  setAdding(false);
                  openScreen(`/saved/collections/${copy.id}`);
                },
                (error: unknown) => {
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

/** Why the link opens no preview. */
function Failure({ text }: { text: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <Text
      testID="collection-link-failure"
      {...voice}
      style={[styles.failure, { color: colors.ink, fontFamily: fontFamilies.ui }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: space[8] },
  bar: { paddingHorizontal: space[3], paddingTop: space[2] },
  header: { paddingHorizontal: space[6], paddingTop: space[2], paddingBottom: space[4] },
  line: { marginTop: space[2], fontSize: typeSize.body },
  footer: { gap: space[4], paddingHorizontal: space[6], paddingTop: space[5] },
  failure: {
    paddingHorizontal: space[6],
    paddingTop: space[6],
    fontSize: typeSize.body,
    lineHeight: typeSize.body * 1.5,
  },
});
