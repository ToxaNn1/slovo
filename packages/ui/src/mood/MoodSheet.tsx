import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '../primitives/BottomSheet';
import { SheetTitle } from '../primitives/SheetParts';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { disabledOpacity, minTouchTarget, space, typeSize, withAlpha } from '../tokens';

/** A mood on offer: its id, name and emoji, and why it is disabled, if it is. */
export interface MoodChip {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  /** Why the mood can't be chosen; it is disabled while there is one. */
  readonly disabledHint?: string | undefined;
}

/** How many chips sit side by side. */
const COLUMNS = 2;

/**
 * The sheet the 🎲 of the «Головна» header opens: «Слово під настрій» over the
 * moods as chips, two to a row. A disabled chip is dimmed and takes no tap,
 * with why under it, which VoiceOver reads as its hint. Once a chip is chosen
 * the sheet shows the roulette's current Lemma (`roulette`) in their place,
 * hidden from VoiceOver. A tap on the scrim, a drag on the grabber and
 * VoiceOver's escape gesture ask `onClose`; `onDismissed` runs once the sheet
 * has slid away.
 */
export function MoodSheet({
  visible,
  moods,
  roulette,
  onChoose,
  onClose,
  onDismissed,
}: {
  visible: boolean;
  moods: readonly MoodChip[];
  /** The Lemma the roulette shows now, while it runs. */
  roulette: string | undefined;
  onChoose: (moodId: string) => void;
  onClose: () => void;
  onDismissed: () => void;
}) {
  const { strings } = useEdition();
  const rows = Array.from({ length: Math.ceil(moods.length / COLUMNS) }, (_, row) =>
    moods.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );
  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} testID="mood-sheet">
      <View style={styles.content}>
        <SheetTitle>{strings.mood.title}</SheetTitle>
        {roulette !== undefined ? (
          <Roulette lemma={roulette} />
        ) : (
          rows.map((row) => (
            <View key={row.map(({ id }) => id).join()} style={styles.row}>
              {row.map((mood) => (
                <MoodChipButton key={mood.id} mood={mood} onChoose={onChoose} />
              ))}
              {/* A short last row keeps its chip the width of the others. */}
              {row.length < COLUMNS && <View style={styles.cell} />}
            </View>
          ))
        )}
      </View>
    </BottomSheet>
  );
}

/** A mood's chip, and why it is disabled under it. */
function MoodChipButton({
  mood: { id, name, emoji, disabledHint },
  onChoose,
}: {
  mood: MoodChip;
  onChoose: (moodId: string) => void;
}) {
  const { colors, fontFamilies, radii } = useTokens();
  const { voice } = useEdition();
  const disabled = disabledHint !== undefined;
  return (
    <View style={styles.cell}>
      <Pressable
        testID={`mood-chip-${id}`}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={disabledHint}
        accessibilityState={{ disabled }}
        {...voice}
        disabled={disabled}
        onPress={() => {
          onChoose(id);
        }}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: withAlpha(colors.accent, 0.45),
            borderRadius: radii.chip,
            opacity: disabled ? disabledOpacity : pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text style={[styles.chipText, { color: colors.ink, fontFamily: fontFamilies.ui }]}>
          {`${emoji} ${name}`}
        </Text>
      </Pressable>
      {disabled && (
        <Text
          testID={`mood-chip-${id}-hint`}
          // VoiceOver reads it as the hint of the disabled chip instead.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          {...voice}
          style={[styles.hint, { color: colors.muted, fontFamily: fontFamilies.ui }]}
        >
          {disabledHint}
        </Text>
      )}
    </View>
  );
}

/** The roulette's current Lemma, large, in the middle of the sheet. */
function Roulette({ lemma }: { lemma: string }) {
  const { colors, fontFamilies } = useTokens();
  const { voice } = useEdition();
  return (
    <View
      testID="mood-roulette"
      // Twelve Lemmas in under two seconds would only chatter; VoiceOver reads the card.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.roulette}
    >
      <Text
        testID="mood-roulette-lemma"
        {...voice}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.lemma, { color: colors.ink, fontFamily: fontFamilies.word }]}
      >
        {lemma}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: space[3], paddingBottom: space[4] },
  row: { flexDirection: 'row', gap: space[3] },
  cell: { flex: 1, gap: space[1] },
  chip: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: typeSize.button, fontWeight: '600' },
  hint: { fontSize: typeSize.meta, textAlign: 'center' },
  // The height of the three rows of chips it takes the place of, so the sheet keeps its size.
  roulette: {
    minHeight: minTouchTarget * 3 + space[3] * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lemma: { fontSize: typeSize.emptyStateTitle, fontWeight: '500' },
});
