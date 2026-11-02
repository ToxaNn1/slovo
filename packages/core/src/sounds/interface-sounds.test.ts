import { describe, expect, it, vi } from 'vitest';

import { createInterfaceSounds } from './interface-sounds';

function soundsWith(switchedOn: boolean, setting: boolean) {
  const play = vi.fn();
  const sounds = createInterfaceSounds({
    engine: { play },
    switchedOn: () => switchedOn,
    setting: () => setting,
  });
  return { sounds, play };
}

describe('createInterfaceSounds', () => {
  it('plays the sound asked for while the switch and «Звуки» are on', () => {
    const { sounds, play } = soundsWith(true, true);
    sounds.play('right');
    expect(play).toHaveBeenCalledExactlyOnceWith('right');
  });

  it.each([
    [false, true],
    [true, false],
    [false, false],
  ])('plays nothing while the switch is %s and «Звуки» is %s', (switchedOn, setting) => {
    const { sounds, play } = soundsWith(switchedOn, setting);
    sounds.play('tap');
    expect(play).not.toHaveBeenCalled();
  });
});
