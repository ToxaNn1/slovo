import { describe, expect, it } from '@jest/globals';

import { paramOf } from './route-params';

describe('paramOf', () => {
  it('reads a param given once as it is', () => {
    expect(paramOf({ id: 'w_1' }, 'id')).toBe('w_1');
  });

  it('reads the first value of a param repeated in the URL', () => {
    expect(paramOf({ from: ['w_1', 'w_2'] }, 'from')).toBe('w_1');
  });

  it('reads nothing for a param the URL lacks', () => {
    expect(paramOf({}, 'from')).toBeUndefined();
    expect(paramOf({ from: [] }, 'from')).toBeUndefined();
  });
});
