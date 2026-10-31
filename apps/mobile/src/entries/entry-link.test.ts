import { describe, expect, it } from 'vitest';

import { openedFromOf } from './entry-link';

/** The search params the Entry route reads from a link. */
const paramsOf = (link: string) => Object.fromEntries(new URL(link, 'slovo://app').searchParams);

describe('where an Entry link opened from', () => {
  it("reads the widget's link as from the widget", () => {
    expect(openedFromOf(paramsOf('slovo://entry/c_0a1b2c?from=widget'))).toBe('widget');
  });

  it("reads a notification's link as from a notification", () => {
    expect(openedFromOf(paramsOf('/entry/w_00g2ap?from=notification'))).toBe('notification');
  });

  it('reads a link without a known mark as from inside the app', () => {
    expect(openedFromOf(paramsOf('/entry/w_00g2ap'))).toBeUndefined();
    expect(openedFromOf(paramsOf('/entry/w_00g2ap?from=feed'))).toBeUndefined();
  });
});
