import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { TitledSheet } from '../primitives/TitledSheet';
import { collectionMenu, disabledOpacity, typeStyle } from '../tokens';

/** One row of the menu's group. */
interface MenuRow {
  readonly key: 'share' | 'rename' | 'delete';
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly hint?: string | undefined;
}

/**
 * The menu a Collection's «⋯» opens (board 09): the bottom sheet with the
 * Collection's name on the ink plate, one bordered group of rows, «share a
 * link» first when it is given one (dimmed while it is disabled, when
 * VoiceOver reads why after its label), «rename» and «delete» in red, and the
 * cancel button last. A tap on a row asks for its action; the cancel button,
 * a tap on the scrim, a drag on its top and VoiceOver's escape gesture ask
 * `onCancel`. The caller turns `visible` off in all of them; `onDismissed`
 * runs once the sheet has slid away.
 */
export function CollectionMenuSheet({
  visible,
  title,
  copy,
  share,
  onRename,
  onDelete,
  onCancel,
  onDismissed,
  testID = 'collection-menu',
}: {
  visible: boolean;
  /** The Collection's name, on the plate. */
  title: string;
  copy: { rename: string; delete: string; cancel: string };
  /** The row that shares the Collection by a link, when the menu offers it. */
  share?:
    | {
        label: string;
        disabled: boolean;
        /** What VoiceOver reads after the label while the row is disabled. */
        disabledHint: string;
        onPress: () => void;
      }
    | undefined;
  onRename: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onDismissed?: (() => void) | undefined;
  testID?: string;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const rows: readonly MenuRow[] = [
    ...(share === undefined
      ? []
      : [
          {
            key: 'share' as const,
            label: share.label,
            onPress: share.onPress,
            disabled: share.disabled,
            hint: share.disabled ? share.disabledHint : undefined,
          },
        ]),
    { key: 'rename', label: copy.rename, onPress: onRename },
    { key: 'delete', label: copy.delete, onPress: onDelete },
  ];
  return (
    <TitledSheet
      visible={visible}
      title={title}
      cancelLabel={copy.cancel}
      onClose={onCancel}
      onDismissed={onDismissed}
      testID={testID}
    >
      <View style={[styles.group, { borderColor: colors.line }]}>
        {rows.map((row, index) => (
          <Pressable
            key={row.key}
            testID={`${testID}-${row.key}`}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            accessibilityHint={row.hint}
            accessibilityState={{ disabled: row.disabled === true }}
            {...voice}
            disabled={row.disabled}
            onPress={row.onPress}
            style={({ pressed }) => [
              styles.row,
              index > 0 && [styles.divided, { borderTopColor: colors.line }],
              pressed && { backgroundColor: colors.surfaceSunken },
              row.disabled === true && styles.disabled,
            ]}
          >
            <Text
              style={[
                typeStyle('rowLabel', tokens),
                { color: row.key === 'delete' ? colors.accentText : colors.ink },
              ]}
            >
              {row.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </TitledSheet>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: collectionMenu.radius, overflow: 'hidden' },
  row: {
    paddingVertical: collectionMenu.rowPaddingVertical,
    paddingHorizontal: collectionMenu.rowPaddingHorizontal,
  },
  divided: { borderTopWidth: 1 },
  disabled: { opacity: disabledOpacity },
});
