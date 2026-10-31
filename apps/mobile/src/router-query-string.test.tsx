import { expect, test } from '@jest/globals';

// expo-router parses search params with query-string 7, which loads decode-uri-component with a
// plain require; the patched release of that package is ES-module only, so query-string carries a
// patch that reads its default export.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const queryString = require('query-string') as {
  parse: (query: string) => Record<string, string | string[] | null>;
};

test('the router decodes a percent-encoded search param', () => {
  expect(queryString.parse('q=%D1%81%D0%BB%D0%BE%D0%B2%D0%BE')).toEqual({ q: 'слово' });
});
