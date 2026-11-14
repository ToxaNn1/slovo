import { StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { Button } from '../primitives/Button';
import { TitledSheet } from '../primitives/TitledSheet';
import { collectionLinkBox, typeStyle } from '../tokens';

/**
 * The share sheet of a Collection (board 09): «share a link» on the ink plate,
 * the line that the Collection is shared as it is now, the Collection Link in
 * its box without its scheme, «copy the link» while it is offered, the system
 * Share as the second action, and the cancel button last. It shows while it
 * has a `url`. The cancel button, a tap on the scrim, a drag on its top and
 * VoiceOver's escape gesture ask `onClose`; the caller clears `url` in every
 * callback, and `onDismissed` runs once the sheet has slid away.
 */
export function CollectionShareSheet({
  url,
  copy,
  onCopy,
  onShare,
  onClose,
  onDismissed,
  testID,
}: {
  /** The Collection Link; an empty one hides the sheet. */
  url: string;
  copy: { title: string; snapshot: string; copy: string; share: string; cancel: string };
  /** Copies the link; without it the sheet keeps the system Share alone. */
  onCopy?: (() => void) | undefined;
  onShare: () => void;
  onClose: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string | undefined;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const id = (part: string) => (testID === undefined ? undefined : `${testID}-${part}`);
  return (
    <TitledSheet
      visible={url !== ''}
      title={copy.title}
      cancelLabel={copy.cancel}
      onClose={onClose}
      onDismissed={onDismissed}
      testID={testID}
    >
      {url !== '' && (
        <>
          <Text
            {...voice}
            style={[typeStyle('collectionSheetNote', tokens), { color: colors.muted }]}
          >
            {copy.snapshot}
          </Text>
          <View style={[styles.link, { backgroundColor: colors.surfaceSunken }]}>
            <Text
              {...voice}
              testID={id('link')}
              numberOfLines={1}
              selectable
              style={[typeStyle('collectionLink', tokens), { color: colors.ink }]}
            >
              {url.replace(/^https?:\/\//, '')}
            </Text>
          </View>
          {onCopy !== undefined && (
            <Button variant="inverse" label={copy.copy} onPress={onCopy} testID={id('copy')} />
          )}
          <Button
            variant={onCopy === undefined ? 'inverse' : 'neutral'}
            label={copy.share}
            onPress={onShare}
            testID={id('share')}
          />
        </>
      )}
    </TitledSheet>
  );
}

const styles = StyleSheet.create({
  link: {
    height: collectionLinkBox.height,
    borderRadius: collectionLinkBox.radius,
    paddingHorizontal: collectionLinkBox.paddingHorizontal,
    justifyContent: 'center',
  },
});
