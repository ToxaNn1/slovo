import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { actionButtonSize, space } from '../tokens';

export interface ActionRowProps {
  /** The «Знаю» and «Не знаю» buttons, on a line of their own above the icons; the row leaves them out without. */
  marks?: ReactNode;
  /** The heart: keeps the Entry in Favorites, or takes it out. */
  favorite?: ReactNode;
  /** Opens the sheet with the Share Card; the row leaves its slot out without it. */
  share?: ReactNode;
  /** Adds the Entry to Collections. */
  collection?: ReactNode;
  /** Hides the Entry, or its Category; the row leaves its slot out without it. */
  hide?: ReactNode;
  /** Opens the sheet of a Mistake Report; the row leaves its slot out without it. */
  report?: ReactNode;
}

/**
 * The action row under the Entry card (ADR 0017): one 52 pt slot per action,
 * spread evenly across the card's width, the same on a Word and a Correction
 * card: the heart, share, Collections and hide, as the design has it, and the
 * flag of «Повідомити про помилку» last (ADR 0056). Without a share, a hide
 * or a report action the others spread over the row, as on a Synonym Row's
 * and a Tip's card (spec #730). The mark buttons, when given, sit on a
 * line above them.
 */
export function ActionRow({ marks, favorite, share, collection, hide, report }: ActionRowProps) {
  return (
    <View testID="action-row" style={styles.container}>
      {marks !== undefined && <View style={styles.marks}>{marks}</View>}
      <View style={styles.row}>
        <View style={styles.slot}>{favorite}</View>
        {share !== undefined && <View style={styles.slot}>{share}</View>}
        <View style={styles.slot}>{collection}</View>
        {hide !== undefined && <View style={styles.slot}>{hide}</View>}
        {report !== undefined && <View style={styles.slot}>{report}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: space[3] },
  marks: { marginBottom: space[1] },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  slot: {
    width: actionButtonSize,
    height: actionButtonSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
