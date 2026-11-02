/** A change in a Game the shell could answer with a haptic. */
export type GameChange = 'right-answer' | 'wrong-answer' | 'win';

/**
 * The haptic sequence of a Game change. Games give no haptics (ADR 0025), so
 * the sequence of every change is empty, and its type says so.
 */
export function gameHaptics(_change: GameChange): readonly [] {
  return [];
}
