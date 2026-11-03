import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { HalftoneGround } from '../primitives/HalftoneGround';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { typeStyle, type TypeRole, type Wedge } from '../tokens';
import { OnAccentProvider } from './on-accent';

/**
 * The design's red ground under its halftone raster, with a giant cream
 * letter overhanging its top right corner, behind the content. Cut to
 * `points` when given; the letter then stops where the cut starts on the
 * right edge (`letterStopsAt`, a fraction of the height). Everything in it
 * knows it sits on red (`useOnAccent`). VoiceOver skips the ground and the
 * letter.
 */
export function AccentGround({
  id,
  letter,
  letterRole,
  letterAt,
  points,
  letterStopsAt = 1,
  style,
  testID,
  children,
}: {
  /** Unique on the screen: it names the raster. */
  id: string;
  letter: string;
  letterRole: Extract<TypeRole, 'giantLetter' | 'panelLetter'>;
  /** How far the letter overhangs the top right corner. */
  letterAt: { right: number; top: number };
  points?: Wedge;
  letterStopsAt?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
}) {
  const tokens = useTokens();
  const cream = useSchemeColors('light').background;
  const [size, setSize] = useState<{ width: number; height: number }>();
  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize({ width, height });
  };
  return (
    <View testID={testID} onLayout={measure} style={[styles.ground, style]}>
      {size !== undefined && (
        <>
          <HalftoneGround id={id} width={size.width} height={size.height} points={points} />
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.letterBox, { height: size.height * letterStopsAt }]}
          >
            <Text
              testID={`${id}-letter`}
              style={[
                typeStyle(letterRole, tokens),
                styles.letter,
                { color: cream, right: letterAt.right, top: letterAt.top },
              ]}
            >
              {letter}
            </Text>
          </View>
        </>
      )}
      <OnAccentProvider value>{children}</OnAccentProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { overflow: 'hidden' },
  letterBox: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  letter: { position: 'absolute' },
});
