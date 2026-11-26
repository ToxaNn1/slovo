import { describe, expect, it } from 'vitest';

import {
  LANGUAGE_MODEL,
  plainText,
  quoteOf,
  quoteOnPage,
  quotedTextOf,
  readArticleBlocks,
  squash,
  withoutHomonymIndexes,
} from './index';

const block = (headword: string, text: string, dictionary: string) =>
  `<div class="article-block"><h2><span class="uppercase">${headword}</span></h2>
    <p>${text}</p>  <div class="source-info"> ${dictionary}
    </div></div>`;

const GOROH = 'https://goroh.pp.ua/Тлумачення/слово';

describe('the quote check', () => {
  it('reads each article block of a goroh page with its headword, dictionary and text', () => {
    const page = `<div class="other">Поза блоком</div>${block('сло́во1', 'Одиниця   мови.', 'СУМ-11')}${block(
      'сло́во',
      'Мовна одиниця.',
      `${LANGUAGE_MODEL} (бета)`,
    )}<div class="article-block">Порожній</div>`;
    expect(readArticleBlocks(page)).toEqual([
      {
        headword: 'сло́во1',
        dictionary: 'СУМ-11',
        languageModel: false,
        text: 'сло́во1 Одиниця мови. СУМ-11',
      },
      {
        headword: 'сло́во',
        dictionary: `${LANGUAGE_MODEL} (бета)`,
        languageModel: true,
        text: `сло́во Мовна одиниця. ${LANGUAGE_MODEL} (бета)`,
      },
      { headword: '', dictionary: '', languageModel: false, text: 'Порожній' },
    ]);
  });

  it('drops the homonym index after a lower-case word, with or without its Stress, and keeps a name’s number', () => {
    expect(withoutHomonymIndexes('склад1 1. лю́тий2 СІС2 2024 а12')).toBe(
      'склад 1. лю́тий СІС2 2024 а',
    );
  });

  it('squashes case, spaces, quotation marks, apostrophes and dashes away', () => {
    expect(squash('Пʼять «Слів» — "ТАК"’ „то“ ”це” \'і\' – до-бре\tсклад1')).toBe(
      'пятьслівтактоцеідобресклад',
    );
  });

  it('quotes the first 40 characters without a final period', () => {
    expect(quoteOf('Сильний вітер.')).toBe('сильнийвітер');
    expect(quoteOf('Те, що й т. ін.')).toBe('те,щойт.ін');
    expect(quoteOf(`${'а'.repeat(39)}бв`)).toBe(`${'а'.repeat(39)}б`);
  });

  it('reads a page’s text without scripts, styles or tags, its entities decoded', () => {
    expect(
      plainText('<p>а</p><script type="x">б</script><STYLE>в</STYLE><scripts>г</scripts>д'),
    ).toBe(' а    г д');
    expect(plainText('<script>а</script>б<script>в</script>')).toBe(' б ');
    expect(
      plainText(
        '&amp;&LT;&gt;&quot;&apos;&nbsp;&laquo;&raquo;&bdquo;&ldquo;&rdquo;&lsquo;&rsquo;&mdash;&ndash;&hellip;&shy;&#65;&#x41;&#X41;&unknown;',
      ),
    ).toBe('&<>"\' «»„“”‘’—–…AAA&unknown;');
    expect(plainText('&#x10FFFF;')).toBe('\u{10FFFF}');
  });

  describe('a quote on its page', () => {
    const quote = 'Одиниця мови.';

    it('fails a page that did not come back 200, naming the status', () => {
      expect(quoteOnPage(quote, 'https://example.org', { status: 404, body: quote })).toEqual({
        outcome: 'fetch-failed',
        status: 404,
      });
    });

    it('finds the quote anywhere in the text of a page off goroh', () => {
      const page = (body: string) => ({ status: 200, body });
      expect(
        quoteOnPage(quote, 'https://example.org/a', page('<p>Одиниця</p> <b>мови</b>')),
      ).toEqual({
        outcome: 'ok',
      });
      expect(quoteOnPage(quote, 'https://example.org/a', page('<p>Інша мова</p>'))).toEqual({
        outcome: 'miss',
        quote: 'одиницямови',
      });
    });

    it('finds the quote on goroh in a block a dictionary wrote, not a language model', () => {
      const dictionary = block('сло́во', 'Одиниця мови.', 'СУМ-11');
      const model = block('сло́во', 'Одиниця мови.', LANGUAGE_MODEL);
      const page = (body: string) => ({ status: 200, body });
      expect(quoteOnPage(quote, GOROH, page(model + dictionary))).toEqual({ outcome: 'ok' });
      expect(quoteOnPage(quote, GOROH, page(model))).toEqual({ outcome: 'llm' });
      expect(
        quoteOnPage(quote, GOROH, page(`<p>Одиниця мови.</p>${block('сло́во', 'Інше.', 'СУМ-11')}`)),
      ).toEqual({
        outcome: 'miss',
        quote: 'одиницямови',
      });
    });
  });

  it('quotes the field each kind of record takes from its first source', () => {
    const sources = [{ url: GOROH }];
    expect([
      quotedTextOf({ kind: 'word', fields: { sources, primaryDefinition: 'w' } }),
      quotedTextOf({ kind: 'idiom', fields: { sources, primaryDefinition: 'i' } }),
      quotedTextOf({ kind: 'correction', fields: { sources, explanation: 'c' } }),
      quotedTextOf({ kind: 'tip', fields: { sources, explanation: 't' } }),
      quotedTextOf({ kind: 'synonymRow', fields: { sources, meaning: 'r' } }),
    ]).toEqual(['w', 'i', 'c', 't', 'r']);
  });
});
