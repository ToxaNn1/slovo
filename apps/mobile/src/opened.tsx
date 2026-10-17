import { DecorBackground, FeedError, useTokens } from '@slovo/ui';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { editionStrings } from './edition/edition';
import { FeedLoadingScreen } from './edition/feed-loading';
import { useSubscribed, type Opening } from './opening';

/**
 * The gate of an opening: the Feed's loading state while it opens, the error
 * state with its retry when it fails, and `children` once it is open, so
 * nothing under it ever sees it loading or failed (`useOpened`).
 */
export function Opened({
  opening,
  failedTestID,
  children,
}: {
  opening: Opening<unknown>;
  failedTestID: string;
  children: ReactNode;
}) {
  const state = useSubscribed(opening, ({ state }) => state);
  if (state.status === 'loading') return <FeedLoadingScreen />;
  if (state.status === 'failed') return <LoadFailed testID={failedTestID} onRetry={state.retry} />;
  return children;
}

/** The local error state: the Language Pack or the composition over it can't be opened. */
function LoadFailed({ onRetry, testID }: { onRetry: () => void; testID: string }) {
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
