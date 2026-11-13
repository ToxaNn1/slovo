import { expect, test } from 'vitest';

import { formatMoment } from './format';

test('a moment reads in Kyiv time, whatever zone the browser is in', () => {
  // 22:30 UTC on 31 December is 00:30 on 1 January in Kyiv (UTC+2).
  const read = formatMoment('2026-12-31T22:30:00Z');
  expect(read).toContain('00:30');
  expect(read).toContain('2027');
});
