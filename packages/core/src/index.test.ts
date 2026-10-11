import { describe, expect, it } from 'vitest';

import * as core from './index';

describe('Core public interface', () => {
  it('can be imported', () => {
    expect(core).toBeTypeOf('object');
  });
});
