import { describe, expect, it } from 'vitest';

import { nearLimit } from './services';

describe('a limit near its end', () => {
  it('is one used to 90 per cent or more', () => {
    expect(nearLimit({ used: 89, limit: 100 })).toBe(false);
    expect(nearLimit({ used: 90, limit: 100 })).toBe(true);
    expect(nearLimit({ used: 120, limit: 100 })).toBe(true);
  });
});
