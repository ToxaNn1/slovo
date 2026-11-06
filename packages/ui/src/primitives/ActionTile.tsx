import { createContext, useContext, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useSchemeColors, useTokens } from '../providers/TokensProvider';
import { actionTile, cornerTile, pressedFade, typeStyle } from '../tokens';
import { PressedTile, type TileTone } from './PressedTile';

/**
 * How an action row draws its actions: raised `tiles` with a label under
 * each icon, under a Word card, bare `icons`, under a Correction, Idiom,
 * Synonym Row or Tip card, or dark `corner` tiles in the card's corner.
 */
export type ActionRowLook = 'tiles' | 'icons' | 'corner';

const ActionRowLookContext = createContext<ActionRowLook>('tiles');

/** Tells the actions inside an action row how the row draws them. */
export const ActionRowLookProvider = ActionRowLookContext.Provider;

/**
 * What an action's state marks on its tile: nothing, the red of an Entry in
 * Favorites, or the ink of an Entry filed in a Collection.
 */
export type ActionMark = 'none' | 'favorite' | 'filed';

/** An action's icon on the 24-point grid: its outline, which a mark fills, and what is drawn inside it. */
export interface ActionIconPaths {
  readonly outline: string;
  readonly inner?: string | undefined;
}

/** The colours an action's icon is drawn in, which its tile hands to `icon`. */
export interface ActionIconLook {
  /** The icon's side. */
  readonly size: number;
  readonly color: string;
  /** Whether the outline is filled with `color`, as a marked tile's. */
  readonly filled: boolean;
  /** The colour of the inner path: the face's, so it shows on a filled outline. */
  readonly innerColor: string;
}

/** An action's icon: the outline, filled when marked, and its inner path. */
export function ActionIcon({ paths, look }: { paths: ActionIconPaths; look: ActionIconLook }) {
  return (
    <Svg width={look.size} height={look.size} viewBox="0 0 24 24">
      <Path
        d={paths.outline}
        fill={look.filled ? look.color : 'none'}
        stroke={look.color}
        strokeWidth={actionTile.iconStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {paths.inner !== undefined && (
        <Path
          d={paths.inner}
          fill="none"
          stroke={look.innerColor}
          strokeWidth={actionTile.iconStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}

const tones: Record<ActionMark, TileTone> = { none: 'tile', favorite: 'accent', filed: 'inverse' };

/**
 * One action of the action row (XActions): as a tile, a raised face with the
 * icon over its `label`; in a row of icons, the icon alone, on the red of
 * Favorites when so marked. A `mark` fills the icon: red with an ink heart
 * for Favorites, the Theme's ink for a filed Collection, its inner path in
 * the face's colour. Disabled, it is dimmed and takes no press. VoiceOver
 * reads `accessibilityLabel`, what a tap will do, and a mark as selected.
 */
export function ActionTile({
  label,
  accessibilityLabel,
  mark = 'none',
  disabled = false,
  onPress,
  testID,
  icon,
}: {
  /** The words under the icon on a tile. */
  label: string;
  accessibilityLabel: string;
  mark?: ActionMark;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
  /** Draws the icon in the colours the tile gives it, as `ActionIcon` does. */
  icon: (look: ActionIconLook) => ReactNode;
}) {
  const look = useContext(ActionRowLookContext);
  const tokens = useTokens();
  const { colors } = tokens;
  const { ink: keyInk, background: keyBackground } = useSchemeColors('light');
  const { voice } = useEdition();
  const color = { none: colors.ink, favorite: keyInk, filed: colors.background }[mark];
  const common = {
    onPress,
    disabled,
    testID,
    accessibilityLabel,
    accessibilityState: { selected: mark !== 'none' },
    ...voice,
  };
  if (look === 'corner') {
    // The board draws the corner's tiles in the key ink with a cream icon on every card, in either Theme.
    const cream = keyBackground;
    const iconColor = mark === 'favorite' ? colors.heart : cream;
    return (
      <Pressable
        {...common}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.corner,
          { backgroundColor: keyInk, shadowColor: keyInk, opacity: pressed ? pressedFade : 1 },
        ]}
      >
        {icon({
          size: cornerTile.icon,
          color: iconColor,
          filled: mark !== 'none',
          // A filed bookmark is cream with its check cut in the ink.
          innerColor: mark === 'filed' ? keyInk : iconColor,
        })}
      </Pressable>
    );
  }
  if (look === 'icons') {
    const iconColor = mark === 'favorite' ? keyInk : colors.ink;
    return (
      <PressedTile
        {...common}
        tone="none"
        radius={actionTile.compact.radius}
        faceStyle={[styles.compact, mark === 'favorite' && { backgroundColor: colors.heart }]}
      >
        {icon({
          size: actionTile.compact.icon,
          color: iconColor,
          filled: mark !== 'none',
          // On the bare card the check of a filed bookmark is cut in the card's colour.
          innerColor: mark === 'filed' ? colors.surface : iconColor,
        })}
      </PressedTile>
    );
  }
  return (
    <PressedTile
      {...common}
      // A disabled tile keeps its face and border but stands on no edge.
      tone={disabled ? 'none' : tones[mark]}
      depth="action"
      radius={actionTile.radius}
      faceStyle={[
        styles.tile,
        { borderColor: mark === 'none' ? colors.line : 'transparent' },
        disabled && { backgroundColor: colors.tile },
      ]}
    >
      {icon({
        size: actionTile.icon,
        color,
        filled: mark !== 'none',
        // The check of a filed bookmark is cut in the face's ink, so it shows on the filled bookmark.
        innerColor: mark === 'filed' ? colors.ink : color,
      })}
      <Text
        {...voice}
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typeStyle('actionLabel', tokens), { color }]}
      >
        {label}
      </Text>
    </PressedTile>
  );
}

const styles = StyleSheet.create({
  tile: {
    height: actionTile.height,
    gap: actionTile.gap,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  corner: {
    width: cornerTile.side,
    height: cornerTile.side,
    borderRadius: cornerTile.radius,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: cornerTile.shadowDepth },
    shadowOpacity: cornerTile.shadowOpacity,
    shadowRadius: 0,
  },
  compact: {
    width: actionTile.compact.width,
    height: actionTile.compact.height,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
