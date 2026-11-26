import { describe, expect, it } from 'vitest';

import { RecordChangeSchema } from './sync';

/** A value of arrays nested `depth` levels deep. */
function nested(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let level = 0; level < depth; level += 1) value = [value];
  return value;
}

/** Why a change of a record whose value is `value` is refused; none when it is taken. */
const problemsOf = (value: unknown) =>
  RecordChangeSchema.safeParse({ key: 'settings', value, changedAt: 0 }).error?.issues.map(
    ({ message }) => message,
  );

describe('a change of a record', () => {
  it('takes a value of JSON, or null for a tombstone', () => {
    expect(problemsOf({ theme: 'dark', fontScale: 1.2 })).toBeUndefined();
    expect(problemsOf('dark')).toBeUndefined();
    expect(problemsOf(null)).toBeUndefined();
  });

  it('takes a value nested 32 levels deep, objects and arrays alike', () => {
    expect(problemsOf(nested(32))).toBeUndefined();
    expect(problemsOf({ a: nested(31) })).toBeUndefined();
  });

  it('refuses a value nested deeper, however deep, without overflowing the stack', () => {
    expect(problemsOf(nested(33))).toEqual(['nests deeper than 32 levels']);
    expect(problemsOf({ a: nested(32) })).toEqual(['nests deeper than 32 levels']);
    expect(problemsOf([[], nested(33)])).toEqual(['nests deeper than 32 levels']);
    expect(problemsOf(nested(100_000))).toEqual(['nests deeper than 32 levels']);
  });
});
