import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from './tokens';

/** The size of each action-row button, from the design. */
const ACTION_SIZE = 52;

export interface ActionRowProps {
  /** The heart: keeps the Entry in Favorites, or takes it out. */
  favorite?: ReactNode;
  /** Adds the Entry to Collections. */
  collection?: ReactNode;
  /** Hides the Entry, or its Category. */
  hide?: ReactNode;
}

/**
 * The action row under the Entry card (ADR 0017): one 52 pt slot per action,
 * spread evenly across the card's width, the same on a Word and a Correction
 * card. Share joins in 0.6, between the heart and Collections, as the design
 * has it.
 */
export function ActionRow({ favorite, collection, hide }: ActionRowProps) {
  return (
    <View testID="action-row" style={styles.row}>
      <View style={styles.slot}>{favorite}</View>
      <View style={styles.slot}>{collection}</View>
      <View style={styles.slot}>{hide}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', marginTop: space[3] },
  slot: { width: ACTION_SIZE, height: ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
});
