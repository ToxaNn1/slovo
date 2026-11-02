import type { Clock } from '@slovo/core';
import { describe, expect, it } from 'vitest';

import { strings } from '../test-support';
import { todayText } from './today-text';

const at = (iso: string): Clock => ({ now: () => new Date(iso), timeZone: () => 'Europe/Kyiv' });

describe('todayText', () => {
  it('says the local day as the Feed header does', () => {
    expect(todayText(at('2026-11-02T09:00:00Z'), strings)).toBe('пн, 2 листопада');
  });

  it('follows the reader’s time zone past midnight', () => {
    // 23:30 on Saturday in UTC is already Sunday in Kyiv.
    expect(todayText(at('2026-11-07T23:30:00Z'), strings)).toBe('нд, 8 листопада');
  });
});
