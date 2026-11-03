import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

import { useEdition } from '../providers/EditionProvider';
import { useTokens } from '../providers/TokensProvider';
import { actionTile, space, typeStyle } from '../tokens';
import { ActionRowLookProvider, type ActionRowLook } from './ActionTile';

export interface ActionRowProps {
  /** Raised `tiles` with labels, under a Word card, or bare `icons`, under the other kinds. */
  look?: ActionRowLook;
  /** The «Знаю» and «Не знаю» buttons, on a line of their own; the row leaves them out without. */
  marks?: ReactNode;
  /** Where `marks` go: `above` the actions, as in the Feed, or `below` them, as on Entry details. */
  marksAt?: 'above' | 'below';
  /** The heart: keeps the Entry in Favorites, or takes it out; the row leaves its slot out without it, as on a Tip. */
  favorite?: ReactNode;
  /** Opens the sheet with the Share Card; the row leaves its slot out without it. */
  share?: ReactNode;
  /** Adds the Entry to Collections; the row leaves its slot out without it, as on a Tip. */
  collection?: ReactNode;
  /** Hides the Entry, or its Category; the row leaves its slot out without it. */
  hide?: ReactNode;
  /** Opens the sheet of a Mistake Report; the row leaves its slot out without it. */
  report?: ReactNode;
  /** The line under the tiles that says where the Entry is kept; none without it, and none under icons. */
  hint?: string | undefined;
}

/**
 * The action row under an Entry card (ADR 0017, XActions): the heart, share,
 * Collections, hide and the flag of «Повідомити про помилку» last (ADR 0056),
 * in that order. Under a Word card they are raised tiles with labels that
 * share the card's width, the hint under them; under the other kinds they
 * are bare icons on the left, under a hairline. The mark buttons go above
 * or below the actions (`marksAt`). An action left out leaves no slot.
 */
export function ActionRow({
  look = 'tiles',
  marks,
  marksAt = 'above',
  favorite,
  share,
  collection,
  hide,
  report,
  hint,
}: ActionRowProps) {
  const tokens = useTokens();
  const { colors } = tokens;
  const { voice } = useEdition();
  const tiles = look === 'tiles';
  const actions = Object.entries({ favorite, share, collection, hide, report }).filter(
    (slot): slot is [string, NonNullable<ReactNode>] => slot[1] !== undefined,
  );
  return (
    <ActionRowLookProvider value={look}>
      <View testID="action-row" style={styles.container}>
        {marksAt === 'above' && marks !== undefined && <View>{marks}</View>}
        <View
          testID="action-row-actions"
          style={tiles ? styles.tiles : [styles.icons, { borderTopColor: colors.line }]}
        >
          {actions.map(([name, action]) => (
            <View key={name} style={tiles && styles.slot}>
              {action}
            </View>
          ))}
        </View>
        {tiles && hint !== undefined && (
          <View testID="action-row-hint" style={styles.hint}>
            <Pennant color={colors.accent} />
            <Text {...voice} style={[typeStyle('actionHint', tokens), { color: colors.muted }]}>
              {hint}
            </Text>
          </View>
        )}
        {marksAt === 'below' && marks !== undefined && <View>{marks}</View>}
      </View>
    </ActionRowLookProvider>
  );
}

/** The red pennant before the hint: a flag cut to a point, its tip at 30–70% of its height. */
function Pennant({ color }: { color: string }) {
  const { width, height } = actionTile.pennant;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${String(width)} ${String(height)}`}>
      <Polygon
        points={`0,0 ${String(width)},${String(height * 0.3)} ${String(width)},${String(height * 0.7)} 0,${String(height)}`}
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: space[3], gap: space[3] },
  tiles: { flexDirection: 'row', gap: actionTile.rowGap },
  slot: { flex: 1 },
  icons: {
    flexDirection: 'row',
    gap: actionTile.compact.gap,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: actionTile.compact.paddingTop,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: actionTile.hintGap },
});
