import { describe, expect, it } from 'vitest';

import { linkFromOutside, linkTo, parseLink, linkSourceOf } from './entry-links';

describe('the link to an Entry', () => {
  it.each(['notification', 'widget'] as const)(
    'marks a link from the %s with its source',
    (source) => {
      const link = linkTo('w_00g2ap', source);

      expect(link).toBe(`/entry/w_00g2ap?from=${source}`);
      expect(parseLink(link)).toEqual({ entryId: 'w_00g2ap', source, key: undefined });
    },
  );

  it('reads a link without a known mark as a plain link from inside the app', () => {
    expect(parseLink('/entry/w_00g2ap')).toEqual({
      entryId: 'w_00g2ap',
      source: undefined,
      key: undefined,
    });
    expect(parseLink('/entry/w_00g2ap?from=feed')?.source).toBeUndefined();
  });

  it("reads the key the widget's link carries", () => {
    expect(parseLink('/entry/c_0a1b2c?from=widget&key=k1&edition=uk')).toEqual({
      entryId: 'c_0a1b2c',
      source: 'widget',
      key: 'k1',
    });
  });

  it('reads no Entry link from any other path', () => {
    expect(parseLink('/game/w_00g2ap?from=widget')).toBeUndefined();
    expect(parseLink('/entry')).toBeUndefined();
    expect(parseLink('/entry/w_00g2ap/more?from=widget')).toBeUndefined();
  });

  it('reads the source of the search params the Entry route gets', () => {
    expect(linkSourceOf({ from: 'notification' })).toBe('notification');
    expect(linkSourceOf({ from: 'widget' })).toBe('widget');
    expect(linkSourceOf({ from: 'feed' })).toBeUndefined();
    expect(linkSourceOf({})).toBeUndefined();
  });
});

describe('what an Entry link from outside the app marks', () => {
  const opened = (link: string, widgetLinkKey: string | undefined) => {
    const parsed = parseLink(link);
    return parsed === undefined ? undefined : linkFromOutside(parsed, widgetLinkKey);
  };

  it("keeps the widget's source, which marks its Entry Seen and puts it in History, with the key the widget reads now", () => {
    expect(opened('/entry/c_0a1b2c?from=widget&key=k1', 'k1')).toEqual({
      entryId: 'c_0a1b2c',
      source: 'widget',
    });
  });

  it.each([
    ['without its key', '/entry/c_0a1b2c?from=widget', 'k1'],
    ['with another key', '/entry/c_0a1b2c?from=widget&key=guessed', 'k1'],
    ['with no Widget Snapshot to check its key', '/entry/c_0a1b2c?from=widget&key=k1', undefined],
  ])("opens the widget's mark %s as a plain link, which marks nothing", (_, link, key) => {
    expect(opened(link, key)).toEqual({ entryId: 'c_0a1b2c', source: undefined });
  });

  it("opens a notification's mark as a plain link: a notification's link never comes from outside", () => {
    expect(opened('/entry/w_00g2ap?from=notification', 'k1')).toEqual({
      entryId: 'w_00g2ap',
      source: undefined,
    });
  });
});
