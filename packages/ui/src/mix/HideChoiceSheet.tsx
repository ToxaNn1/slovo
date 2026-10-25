import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { SecondaryButton } from '../primitives/SecondaryButton';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeSize } from '../tokens';

/**
 * The hide choice a card's hide button opens: a bottom sheet with a row per
 * way to hide, in the order given, and the cancel row last. A row with a
 * `disabledHint` is dimmed and takes no tap, with the hint under it, which
 * VoiceOver reads as the row's hint. A tap on a row asks
 * `onChoose` with its key; the cancel row, a tap on the scrim, a drag on the
 * grabber and VoiceOver's escape gesture ask `onCancel`. The caller turns
 * `visible` off in both callbacks.
 */
export function HideChoiceSheet({
  visible,
  options,
  cancelLabel,
  onChoose,
  onCancel,
  testID = 'hide-choice',
}: {
  visible: boolean;
  /** What the reader can hide, each with a key `onChoose` gets back. */
  options: readonly {
    readonly key: string;
    readonly label: string;
    /** Why the option can't be chosen; it is disabled while there is one. */
    readonly disabledHint?: string;
  }[];
  cancelLabel: string;
  onChoose: (key: string) => void;
  onCancel: () => void;
  testID?: string;
}) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <BottomSheet visible={visible} onClose={onCancel} testID={testID}>
      <View style={styles.rows}>
        {options.map(({ key, label, disabledHint }) => (
          <Fragment key={key}>
            <SecondaryButton
              label={label}
              disabled={disabledHint !== undefined}
              accessibilityHint={disabledHint}
              onPress={() => {
                onChoose(key);
              }}
              testID={`${testID}-${key}`}
            />
            {disabledHint !== undefined && (
              <Text
                testID={`${testID}-${key}-hint`}
                // VoiceOver reads it as the hint of the disabled row instead.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                {...voice}
                style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
              >
                {disabledHint}
              </Text>
            )}
          </Fragment>
        ))}
        <SecondaryButton label={cancelLabel} onPress={onCancel} testID={`${testID}-cancel`} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space[2] },
  hint: { fontSize: typeSize.body },
});
