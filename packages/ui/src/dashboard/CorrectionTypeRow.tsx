import { fill, type Correction } from '@slovo/contracts';
import { withoutStress } from '@slovo/core';
import { useState } from 'react';
import { StyleSheet, Text, View, type TextLayoutLine } from 'react-native';

import { PressedTile } from '../primitives/PressedTile';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { railScreen as place, typeStyle } from '../tokens';

/**
 * One Correction on its type's screen (ADR 0076), a cream card as the board
 * draws it: the type's chip, «Так часто кажуть» over the non-standard form
 * struck through in red, and under it the ink «Як правильно?» until it is
 * worked through; then the red block «Українською краще» with the standard
 * form, the main one first, and the explanation in its place.
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
  const keyInk = useSchemeColors('light').ink;
  const { strings, voice } = useEdition();
  const { id, correctionType, nonStandardForm, standardEquivalents, explanation } = correction;
  const [main, ...others] = standardEquivalents;
  const card = strings.correctionCard;
  return (
    <View
      testID={`correction-type-row-${id}`}
      style={[
        styles.card,
        {
          backgroundColor: colors.tile,
          borderColor: colors.line,
          shadowColor: colors.tileEdge,
        },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: colors.surfaceSunken }]}>
        <Text {...voice} style={[typeStyle('railChip', tokens), { color: colors.ink }]}>
          {card.correctionTypes[correctionType]}
        </Text>
      </View>
      <View style={styles.said}>
        <Text {...voice} style={[typeStyle('railLabel', tokens), { color: colors.muted }]}>
          {card.nonStandard}
        </Text>
        <Struck label={withoutStress(nonStandardForm)}>{nonStandardForm}</Struck>
      </View>
      {workedThrough ? (
        <View testID={`correction-type-revealed-${id}`} style={styles.revealed}>
          <Wedge
            points={place.revealed.topCut}
            color={colors.accent}
            width="100%"
            height={place.revealed.slant}
            style={styles.slant}
          />
          <View style={[styles.ground, { backgroundColor: colors.accent }]} />
          <Text {...voice} style={[typeStyle('railLabel', tokens), { color: keyInk }]}>
            {card.standard}
          </Text>
          {main !== undefined && (
            <Text
              {...voice}
              accessibilityLabel={withoutStress(main)}
              style={[typeStyle('railStandard', tokens), { color: keyInk }]}
            >
              {main}
            </Text>
          )}
          {others.length > 0 && (
            <Text {...voice} style={[typeStyle('railNote', tokens), { color: keyInk }]}>
              {fill(card.otherEquivalents, { equivalents: others.join(', ') })}
            </Text>
          )}
          <Text {...voice} style={[typeStyle('railNote', tokens), { color: keyInk }]}>
            {explanation}
          </Text>
        </View>
      ) : (
        <PressedTile
          tone="inverse"
          depth="action"
          radius={place.button.radius}
          testID={`correction-type-reveal-${id}`}
          accessibilityLabel={strings.dashboard.correctionTypes.reveal}
          accessibilityLanguage={voice.accessibilityLanguage}
          onPress={onReveal}
          faceStyle={styles.button}
        >
          <Text {...voice} style={[typeStyle('railButton', tokens), { color: colors.background }]}>
            {strings.dashboard.correctionTypes.reveal}
          </Text>
        </PressedTile>
      )}
    </View>
  );
}

/** The non-standard form with the board's thick red line through each of its lines. */
function Struck({ label, children }: { label: string; children: string }) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const [lines, setLines] = useState<readonly TextLayoutLine[]>([]);
  return (
    <View>
      <Text
        {...voice}
        accessibilityLabel={label}
        onTextLayout={({ nativeEvent }) => {
          setLines(nativeEvent.lines);
        }}
        style={[typeStyle('railStruck', tokens), { color: colors.ink }]}
      >
        {children}
      </Text>
      {lines.map(({ x, y, width, height }, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[
            styles.strike,
            {
              left: x,
              width,
              top: y + height * place.strike.at - place.strike.thickness / 2,
              backgroundColor: colors.accent,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: place.card.padding,
    gap: place.card.gap,
    borderRadius: place.card.radius,
    borderWidth: StyleSheet.hairlineWidth,
    // The board's hard edge: no blur, straight below.
    shadowOffset: { width: 0, height: place.card.edge },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: place.chip.paddingHorizontal,
    paddingVertical: place.chip.paddingVertical,
    borderRadius: place.chip.radius,
  },
  said: { gap: place.card.labelGap },
  strike: { position: 'absolute', height: place.strike.thickness },
  slant: { position: 'absolute', top: 0, left: 0 },
  ground: { position: 'absolute', top: place.revealed.slant, right: 0, bottom: 0, left: 0 },
  revealed: {
    gap: place.revealed.gap,
    padding: place.revealed.padding,
    paddingTop: place.revealed.paddingTop,
    marginHorizontal: -place.revealed.overhang,
  },
  button: {
    height: place.button.height,
    paddingHorizontal: place.button.paddingHorizontal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
