import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { HalftoneGround } from '../primitives/HalftoneGround';
import { Wedge } from '../primitives/Wedge';
import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { aboutPanel, fontScaleCap, typeStyle, wedges } from '../tokens';

/**
 * The About screen's red shout panel: on the halftone red, a giant `glyph`
 * in the cream off its top right, and the wedge with the app's `name` in
 * the key ink at its foot. VoiceOver reads the name only, as the screen's
 * header.
 */
export function AboutPanel({
  name,
  glyph,
  testID,
}: {
  /** The app's name, such as «SLOVO». */
  name: string;
  /** The giant letter behind the name. */
  glyph: string;
  testID?: string;
}) {
  const tokens = useTokens();
  const light = useSchemeColors('light');
  const { voice } = useEdition();
  const [size, setSize] = useState<{ width: number; height: number }>();
  const measure = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    setSize({ width, height });
  };
  return (
    <View testID={testID} style={styles.panel}>
      <View style={StyleSheet.absoluteFill} onLayout={measure}>
        {size === undefined ? null : (
          <HalftoneGround id="about-panel" width={size.width} height={size.height} />
        )}
      </View>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        allowFontScaling={false}
        style={[typeStyle('aboutGiant', tokens), styles.giant, { color: light.onAccent }]}
      >
        {glyph}
      </Text>
      <View style={styles.name}>
        <Wedge
          points={wedges.logo}
          color={light.ink}
          width={aboutPanel.wedge.width}
          height={aboutPanel.wedge.height}
        />
        <Text
          accessibilityRole="header"
          {...voice}
          maxFontSizeMultiplier={fontScaleCap.number}
          style={[typeStyle('aboutName', tokens), { color: light.ink }]}
        >
          {name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: aboutPanel.height,
    borderRadius: aboutPanel.radius,
    padding: aboutPanel.padding,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  giant: { position: 'absolute', right: aboutPanel.giant.right, top: aboutPanel.giant.top },
  name: { flexDirection: 'row', alignItems: 'center', gap: aboutPanel.gap },
});
