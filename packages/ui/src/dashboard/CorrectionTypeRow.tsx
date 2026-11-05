import { fill, type Correction } from '@slovo/contracts';
import { withoutStress } from '@slovo/core';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../primitives/Button';
import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { space, typeStyle } from '../tokens';

/**
 * One Correction on its type's screen (ADR 0076): the non-standard form, and
 * under it «Як правильно?» until it is worked through; then the standard form,
 * the main one first, and the explanation in its place.
 */
export function CorrectionTypeRow({
  correction,
  workedThrough,
  onReveal,
}: {
  correction: Correction;
  workedThrough: boolean;
  onReveal: () => void;
}) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { strings, voice } = useEdition();
  const { id, nonStandardForm, standardEquivalents, explanation } = correction;
  const [main, ...others] = standardEquivalents;
  return (
    <View
      testID={`correction-type-row-${id}`}
      style={[styles.row, { borderBottomColor: colors.line }]}
    >
      <Text
        {...voice}
        accessibilityLabel={withoutStress(nonStandardForm)}
        style={[typeStyle('listWord', tokens), styles.struck, { color: colors.muted }]}
      >
        {nonStandardForm}
      </Text>
      {workedThrough ? (
        <>
          {main !== undefined && (
            <Text
              {...voice}
              accessibilityLabel={withoutStress(main)}
              style={[typeStyle('listWord', tokens), { color: colors.ink }]}
            >
              {main}
            </Text>
          )}
          {others.length > 0 && (
            <Text {...voice} style={[typeStyle('rowSub', tokens), { color: colors.muted }]}>
              {fill(strings.correctionCard.otherEquivalents, { equivalents: others.join(', ') })}
            </Text>
          )}
          <Text {...voice} style={[typeStyle('sub', tokens), { color: colors.ink }]}>
            {explanation}
          </Text>
        </>
      ) : (
        <View style={styles.reveal}>
          <Button
            variant="neutral"
            size="small"
            testID={`correction-type-reveal-${id}`}
            label={strings.dashboard.correctionTypes.reveal}
            onPress={onReveal}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: space[6],
    paddingVertical: space[4],
    gap: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  struck: { textDecorationLine: 'line-through' },
  reveal: { alignItems: 'flex-start' },
});
