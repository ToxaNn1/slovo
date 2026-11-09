import { describe, expect, it } from 'vitest';

import { parseDefinitions } from './goroh';

/** A «Тлумачення» article block as goroh prints it, cited to the explanatory dictionary. */
function block(headword: string, definition: string): string {
  return `<div class="article-block">
    <h2 class="page__sub-header"><span class="uppercase">${headword}</span></h2>
    <div class="article-block__body">
      <div class="interpret list-item"><span class="interpret-formula">${definition}</span></div>
    </div>
    <div class='source-info'><a>Тлумачний словник української мови. Томи 1-15 (А-П'ЯТЬ)</a></div>
  </div>`;
}

describe('parseDefinitions', () => {
  it('reads the headword the dictionary prints in capitals as the Lemma', () => {
    const { articles } = parseDefinitions(block('ДРА́ТВА', 'Міцна нитка.'), 'дратва');

    expect(articles.map((article) => article.definitions[0]?.text)).toEqual(['Міцна нитка.']);
  });

  it('does not draft a capitalised proper-name article as one more homonym', () => {
    const page = block('ДРА́ТВА', 'Міцна нитка.') + block('Дра́тва', 'Село на Поділлі.');

    const { articles } = parseDefinitions(page, 'дратва');

    expect(articles).toHaveLength(1);
    expect(articles[0]).not.toHaveProperty('homonymNumber');
    expect(articles[0]?.definitions[0]?.text).toBe('Міцна нитка.');
  });
});
