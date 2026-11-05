import { describe, expect, it } from 'vitest';

import { testStateOf } from './test-states';

describe('a test state link', () => {
  it('names its test state, with the scheme or as a path', () => {
    expect(testStateOf('slovo://dev/state/level-7')).toEqual({ name: 'level-7' });
    expect(testStateOf('/dev/state/full-saved/')).toEqual({ name: 'full-saved' });
  });

  it('names its test state behind Expo Go’s `/--/` prefix', () => {
    expect(testStateOf('exp://127.0.0.1:8197/--/dev/state/fresh')).toEqual({ name: 'fresh' });
    expect(testStateOf('/--/dev/state/fresh')).toEqual({ name: 'fresh' });
    expect(testStateOf('exp://127.0.0.1:8197/--/entry/w_one')).toBeUndefined();
  });

  it('names none for an unknown name or the bare list link', () => {
    expect(testStateOf('slovo://dev/state/level-99')).toBe('unknown');
    expect(testStateOf('slovo://dev/state')).toBe('unknown');
  });

  it('is no test state link for any other link', () => {
    expect(testStateOf('slovo://entry/w_one')).toBeUndefined();
    expect(testStateOf('https://slovo.app/uk/c/abc')).toBeUndefined();
  });
});
