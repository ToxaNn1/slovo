import { createEntries, type Entries } from '@slovo/core';
import { DecorBackground, FeedError, useTokens } from '@slovo/ui';
import Constants from 'expo-constants';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import languagePack from 'slovo-edition/language-pack';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { edition, editionStrings } from './edition';
import { FeedLoadingScreen } from './feed-loading';
import { openedPack, openPackOver } from './opened-pack';

const DATABASE_NAME = 'language-pack.db';

/** The Edition in the app's Expo config (see app.config.ts), if the build reports one. */
function nativeEditionId(): string | undefined {
  const reported: unknown = Constants.expoConfig?.extra?.['edition'];
  if (typeof reported !== 'object' || reported === null || !('id' in reported)) return undefined;
  return typeof reported.id === 'string' ? reported.id : undefined;
}

async function prepare(db: SQLiteDatabase): Promise<void> {
  // expo-sqlite has no read-only open mode; this refuses every write instead.
  await db.execAsync('PRAGMA query_only = ON');
  await openPackOver(db, { bundle: edition.id, native: nativeEditionId() });
}

/** Calls `onMount` once drawn: inside the provider, that is when the pack is open. */
function OnMount({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
  }, [onMount]);
  return null;
}

/**
 * Copies the Language Pack bundled with the app into place on every launch,
 * so the app always reads the pack it shipped with, and opens it read-only.
 * It refuses to run when the pack is of another Edition than the app. While
 * the pack opens, the Feed's loading state covers the screen.
 */
export function LanguagePackProvider({ children }: { children: ReactNode }) {
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Counts the tries to open the pack, so a retry opens it again. */
  const [attempt, setAttempt] = useState(0);
  const markOpened = useCallback(() => {
    setOpened(true);
  }, []);
  if (failed)
    return (
      <LoadFailed
        testID="language-pack-failed"
        onRetry={() => {
          setFailed(false);
          setAttempt((count) => count + 1);
        }}
      />
    );
  return (
    <>
      <SQLiteProvider
        key={attempt}
        databaseName={DATABASE_NAME}
        assetSource={{ assetId: languagePack, forceOverwrite: true }}
        onInit={prepare}
        onError={(error) => {
          console.error('Could not open the Language Pack', error);
          setFailed(true);
        }}
      >
        {children}
        <OnMount onMount={markOpened} />
      </SQLiteProvider>
      {/* Over the children, so the screen is never blank between the two. */}
      {opened ? null : (
        <View style={StyleSheet.absoluteFill}>
          <FeedLoadingScreen />
        </View>
      )}
    </>
  );
}

/** The local error state: the Language Pack can't be opened. */
export function LoadFailed({
  onRetry,
  testID = 'feed-error',
}: {
  onRetry: () => void;
  testID?: string;
}) {
  const { colors } = useTokens();
  const { title, message, retry } = editionStrings.loadFailed;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <DecorBackground />
      <FeedError title={title} message={message} retry={retry} onRetry={onRetry} testID={testID} />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });

/** The Core's Entries of this Edition, read from the bundled Language Pack. */
export function useEntries(): Entries {
  const db = useSQLiteContext();
  return useMemo(() => createEntries({ content: openedPack(db), edition }), [db]);
}
