import { describe, expect, it } from 'vitest';

import { gameHaptics, type GameChange } from './game-haptics';

const changes: readonly GameChange[] = ['right-answer', 'wrong-answer', 'win'];

describe('Game haptics', () => {
  it.each(changes)('asks for no haptic on a %s', (change) => {
    expect(gameHaptics(change)).toEqual([]);
  });
});
