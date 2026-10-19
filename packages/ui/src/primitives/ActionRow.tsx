import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';

/** The size of each action-row button, from the design. */
const ACTION_SIZE = 52;

export interface ActionRowProps {
  /** The «Знаю» and «Не знаю» buttons, on a line of their own above the icons; the row leaves them out without. */
  marks?: ReactNode;
  /** The heart: keeps the Entry in Favorites, or takes it out. */
  favorite?: ReactNode;
  /** Opens the sheet with the Share Card; the row leaves its slot out without it. */
  share?: ReactNode;
  /** Adds the Entry to Collections. */
  collection?: ReactNode;
  /** Hides the Entry, or its Category. */
  hide?: ReactNode;
}

/**
 * The action row under the Entry card (ADR 0017): one 52 pt slot per action,
 * spread evenly across the card's width, the same on a Word and a Correction
 * card: the heart, share, Collections and hide, as the design has it. Without
 * a share action the other three spread over the row. The mark buttons, when
 * given, sit on a line above them.
 */
export function ActionRow({ marks, favorite, share, collection, hide }: ActionRowProps) {
  return (
    <View testID="action-row" style={styles.container}>
      {marks !== undefined && <View style={styles.marks}>{marks}</View>}
      <View style={styles.row}>
        <View style={styles.slot}>{favorite}</View>
        {share !== undefined && <View style={styles.slot}>{share}</View>}
        <View style={styles.slot}>{collection}</View>
        <View style={styles.slot}>{hide}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: space[3] },
  marks: { marginBottom: space[1] },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: { width: ACTION_SIZE, height: ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
});
