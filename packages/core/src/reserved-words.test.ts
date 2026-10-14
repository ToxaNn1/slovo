import { describe, expect, it } from 'vitest';

import { createMemoryUserStatePort, createReservedWords, openUserState } from './index';

/** The Reserved Words over the records: the user state survives between runs. */
async function open(records = new Map<string, string>()) {
  const userState = await openUserState({ port: createMemoryUserStatePort(records) });
  return createReservedWords({ userState });
}

/** A plan of two days: 09:00 and 13:00 on the 14th, and 07:15 and 21:30 on the 15th. */
const twoDays = [
  { date: '2026-10-14', time: '13:00', wordId: 'w_b' },
  { date: '2026-10-14', time: '09:00', wordId: 'w_a' },
  { date: '2026-10-15', time: '21:30', wordId: 'w_d' },
  { date: '2026-10-15', time: '07:15', wordId: 'w_c' },
];

describe('the Reserved Words', () => {
  it('are the Words of the stored plan, for the next run too', async () => {
    const records = new Map<string, string>();
    await (await (await open(records)).stored()).replace(twoDays);

    const reserved = await open(records);
    const stored = await reserved.stored();

    expect([...stored.words].sort()).toEqual(['w_a', 'w_b', 'w_c', 'w_d']);
    expect(stored.wordAt({ date: '2026-10-15', time: '07:15' })).toBe('w_c');
    expect(stored.wordAt({ date: '2026-10-15', time: '09:00' })).toBeUndefined();
    expect(await reserved.isReserved('w_d')).toBe(true);
    expect(await reserved.isReserved('w_e')).toBe(false);
  });

  it("give each day's morning Word: the Word of its earliest planned notification", async () => {
    const reserved = await open();
    await (await reserved.stored()).replace(twoDays);

    expect(await reserved.morningWordOf('2026-10-14')).toBe('w_a');
    expect(await reserved.morningWordOf('2026-10-15')).toBe('w_c');
    expect(await reserved.morningWordOf('2026-10-16')).toBeUndefined();
  });

  it('are replaced whole: a Word no longer planned is no longer Reserved', async () => {
    const reserved = await open();
    await (await reserved.stored()).replace(twoDays);

    await (
      await reserved.stored()
    ).replace([
      { date: '2026-10-15', time: '07:15', wordId: 'w_c' },
      { date: '2026-10-15', time: '21:30', wordId: 'w_e' },
    ]);

    expect([...(await reserved.stored()).words].sort()).toEqual(['w_c', 'w_e']);
    expect(await reserved.isReserved('w_a')).toBe(false);
    expect(await reserved.morningWordOf('2026-10-14')).toBeUndefined();
    expect(await reserved.morningWordOf('2026-10-15')).toBe('w_c');

    await (await reserved.stored()).replace([]);
    expect(await reserved.isReserved('w_c')).toBe(false);
  });
});
