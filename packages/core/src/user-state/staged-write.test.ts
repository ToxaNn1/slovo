import { describe, expect, it } from 'vitest';

import type { UserStateChanges } from '../ports';
import { staged, stagedTogether, writeStaged, type StagedPiece } from './staged-write';

/** A user state that keeps each write it is given, and says so in `log`. */
function recordingUserState(log: string[] = []) {
  const writes: UserStateChanges[] = [];
  return {
    log,
    writes,
    write: async (changes: UserStateChanges) => {
      await Promise.resolve();
      writes.push(changes);
      log.push('write');
    },
  };
}

const piece = (log: string[], name: string, changes: [string, string | undefined][]): StagedPiece =>
  staged(new Map(changes), () => void log.push(`commit ${name}`));

describe('the staged write of the user state', () => {
  it('writes the pieces in one write and then commits them in the order given', async () => {
    const userState = recordingUserState();
    const { log } = userState;

    await writeStaged(userState, [
      piece(log, 'first', [['a', '1']]),
      undefined,
      piece(log, 'second', [['b', '2']]),
      piece(log, 'third', [['c', undefined]]),
    ]);

    expect(userState.writes.map((changes) => [...changes])).toEqual([
      [
        ['a', '1'],
        ['b', '2'],
        ['c', undefined],
      ],
    ]);
    expect(log).toEqual(['write', 'commit first', 'commit second', 'commit third']);
  });

  it('keeps the value of the later piece when two pieces change one key', async () => {
    const userState = recordingUserState();

    await writeStaged(userState, [staged(new Map([['a', '1']])), staged(new Map([['a', '2']]))]);

    expect(userState.writes.map((changes) => [...changes])).toEqual([[['a', '2']]]);
  });

  it('waits for a commit that takes time before it makes the next', async () => {
    const userState = recordingUserState();
    const { log } = userState;
    const slow: StagedPiece<Promise<void>> = {
      changes: new Map([['a', '1']]),
      commit: async () => {
        // Several turns, so a commit not waited for would come first.
        for (let turn = 0; turn < 5; turn += 1) await Promise.resolve();
        log.push('commit slow');
      },
    };

    await writeStaged(userState, [slow, piece(log, 'after', [['b', '2']])]);

    expect(log).toEqual(['write', 'commit slow', 'commit after']);
  });

  it('makes the commits that take no time at once, with nothing between them', async () => {
    const userState = recordingUserState();
    const { log } = userState;
    const done = writeStaged(userState, [
      staged(new Map([['a', '1']]), () => {
        log.push('commit first');
        // Whatever waits for a turn runs only after every commit.
        void Promise.resolve().then(() => log.push('later'));
      }),
      piece(log, 'second', []),
    ]);

    await done;

    expect(log).toEqual(['write', 'commit first', 'commit second', 'later']);
  });

  it('writes nothing for pieces that change nothing, and still commits them', async () => {
    const userState = recordingUserState();
    const { log } = userState;

    await writeStaged(userState, [piece(log, 'empty', []), undefined]);

    expect(log).toEqual(['commit empty']);
  });

  it('commits nothing when the write fails', async () => {
    const log: string[] = [];
    const failing = { write: () => Promise.reject(new Error('disk full')) };

    await expect(writeStaged(failing, [piece(log, 'first', [['a', '1']])])).rejects.toThrow(
      'disk full',
    );

    expect(log).toEqual([]);
  });

  it('stages several pieces as one, committed in their order within the write', async () => {
    const userState = recordingUserState();
    const { log } = userState;
    const together = stagedTogether([
      piece(log, 'inner first', [['a', '1']]),
      undefined,
      piece(log, 'inner second', [['b', '2']]),
    ]);

    await writeStaged(userState, [piece(log, 'before', [['z', '0']]), together]);

    expect(userState.writes.map((changes) => [...changes.keys()])).toEqual([['z', 'a', 'b']]);
    expect(log).toEqual(['write', 'commit before', 'commit inner first', 'commit inner second']);
  });
});
