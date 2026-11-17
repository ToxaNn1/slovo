import { expect, test } from 'vitest';

import { formatMoment, formatWhen } from './format';

test('a moment reads in Kyiv time, whatever zone the browser is in', () => {
  // 22:30 UTC on 31 December is 00:30 on 1 January in Kyiv (UTC+2).
  const read = formatMoment('2026-12-31T22:30:00Z');
  expect(read).toContain('00:30');
  expect(read).toContain('2027');
});

test('a moment of this year reads as its day and minutes in Kyiv: «17 листопада, 19:40»', () => {
  expect(formatWhen('2026-11-17T17:40:00Z')).toBe('17 листопада, 19:40');
  expect(formatWhen('2026-12-31T22:30:00Z')).toBe('1 січня, 00:30');
});
