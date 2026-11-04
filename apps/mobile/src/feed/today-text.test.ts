import { describe, expect, it } from 'vitest';

import { strings } from '../test-support';
import { todayText } from './today-text';

describe('todayText', () => {
  it('says the local day as the Feed header does', () => {
    expect(todayText({ year: 2026, month: 11, day: 2 }, strings)).toBe('пн, 2 листопада');
  });

  it('names the weekday of the day, Sunday last', () => {
    expect(todayText({ year: 2026, month: 11, day: 8 }, strings)).toBe('нд, 8 листопада');
  });
});
