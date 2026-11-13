import { describe, expect, it } from 'vitest';

import { ExamplePairSchema, parseStandardExample } from './correction';

const pair = (standard: string) => ({ nonStandard: 'Ми приймаємо участь у конкурсі.', standard });

describe("a Correction's example pair", () => {
  it('accepts a standard sentence whose standard form is marked', () => {
    expect(ExamplePairSchema.safeParse(pair('Ми **беремо участь** у конкурсі.')).success).toBe(
      true,
    );
  });

  it.each([
    ['no marked standard form', 'Ми беремо участь у конкурсі.'],
    ['an unclosed mark', 'Ми **беремо участь у конкурсі.'],
    ['an empty mark', 'Ми **** беремо участь.'],
    ['a stray asterisk', 'Ми **беремо участь** у конкурсі*.'],
  ])('refuses a standard sentence with %s, naming the field', (_, standard) => {
    const result = ExamplePairSchema.safeParse(pair(standard));

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['standard']);
    expect(result.error?.issues[0]?.message).toMatch(/\*\*/);
  });
});

describe('parsing a standard example sentence', () => {
  it('splits it into its text and its standard form, in order', () => {
    expect(parseStandardExample('Ми **беремо участь** у конкурсі.')).toEqual({
      kind: 'marked',
      segments: [
        { kind: 'text', text: 'Ми ' },
        { kind: 'standardForm', text: 'беремо участь' },
        { kind: 'text', text: ' у конкурсі.' },
      ],
    });
  });

  it('keeps a standard form split by other words as two marked parts', () => {
    expect(parseStandardExample('**Взяти** це **до уваги**.')).toEqual({
      kind: 'marked',
      segments: [
        { kind: 'standardForm', text: 'Взяти' },
        { kind: 'text', text: ' це ' },
        { kind: 'standardForm', text: 'до уваги' },
        { kind: 'text', text: '.' },
      ],
    });
  });

  it('keeps the Stress marks of a stress trap inside the standard form', () => {
    expect(parseStandardExample('Переглянь **катало́г**.')).toEqual({
      kind: 'marked',
      segments: [
        { kind: 'text', text: 'Переглянь ' },
        { kind: 'standardForm', text: 'катало́г' },
        { kind: 'text', text: '.' },
      ],
    });
  });

  it('calls a sentence with no marked standard form broken', () => {
    const parsed = parseStandardExample('Ми беремо участь.');

    expect(parsed.kind).toBe('broken');
    expect(parsed.kind === 'broken' && parsed.problem).toMatch(/\*\*/);
  });
});
