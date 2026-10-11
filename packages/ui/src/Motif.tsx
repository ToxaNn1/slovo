import type { DecorMotif } from '@slovo/contracts';
import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { useTokens } from './TokensProvider';

/** The motif's layers in the colours of the colour scheme in effect. */
function Layers({ motif }: { motif: DecorMotif }) {
  const { colorScheme } = useTokens();
  return motif.layers.map((layer, index) => (
    <Path key={index} d={layer.path} fill={layer[colorScheme]} />
  ));
}

/** Keeps Decor out of VoiceOver and out of the way of touches. */
export function DecorView({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={style}
    >
      {children}
    </View>
  );
}

/** A motif drawn once, `width` points wide, its height in proportion. */
export function MotifImage({ motif, width }: { motif: DecorMotif; width: number }) {
  return (
    <Svg
      width={width}
      height={(width * motif.height) / motif.width}
      viewBox={`0 0 ${String(motif.width)} ${String(motif.height)}`}
    >
      <Layers motif={motif} />
    </Svg>
  );
}

/** A motif repeated at its own size in points across the whole of its box. */
export function MotifPattern({ motif }: { motif: DecorMotif }) {
  // Pattern ids are looked up by URL, which takes letters and digits only.
  const id = `motif${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={id} patternUnits="userSpaceOnUse" width={motif.width} height={motif.height}>
          <Layers motif={motif} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
