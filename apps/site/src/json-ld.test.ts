import { describe, expect, it } from 'vitest';

import { jsonLd } from './json-ld';

describe('the JSON-LD of a page', () => {
  it('cannot close its script element, whatever a text holds, and reads back as the same data', () => {
    const data = { name: '</script><script>alert(1)</script>', note: 'a <!-- b' };

    const text = jsonLd(data);

    expect(text).not.toContain('<');
    expect(JSON.parse(text)).toEqual(data);
  });
});
