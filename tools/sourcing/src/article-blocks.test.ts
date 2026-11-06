import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { readArticleBlocks } from './index';

const fixture = (name: string) =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'goroh', name),
    'utf8',
  );

describe('the sourcing entry point', () => {
  it('reads every goroh article block with the dictionary it cites', () => {
    const blocks = readArticleBlocks(fixture('definitions-pleso.html'));

    expect(
      blocks.map(({ headword, dictionary, languageModel }) => ({
        headword,
        dictionary,
        languageModel,
      })),
    ).toEqual([
      {
        headword: 'ПЛЕ́СО',
        dictionary: "Тлумачний словник української мови. Томи 1-15 (А-П'ЯТЬ)",
        languageModel: false,
      },
      { headword: 'Плес', dictionary: 'Велика мовна модель', languageModel: true },
    ]);
    expect(blocks[0]?.text).toContain('зі спокійною течією ділянка русла річки');
  });
});
