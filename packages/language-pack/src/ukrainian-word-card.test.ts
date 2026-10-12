import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildWordCard, createEntries, type WordCardModel } from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';

// The Core's Word card over the real Ukrainian Language Pack (spec #51, seam 1).
// It lives here because only this package can build and read a pack in Node.

const editionDir = fileURLToPath(new URL('../../../editions/uk', import.meta.url));

let workDir: string;
let pack: NodeLanguagePack;
let cards: WordCardModel[];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-word-card-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  const words = await Promise.all((await pack.listWordIds()).map((id) => pack.getWord(id)));
  const entries = createEntries({ content: pack, edition: { isFeatureEnabled: () => true } });
  cards = await Promise.all(
    words.map((word) => {
      if (word === undefined) throw new Error('A listed Word is missing');
      return buildWordCard({ word, entries });
    }),
  );
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

const STRESS_MARK = '́';

describe('the Word cards of the Ukrainian Edition', () => {
  it('mark every Stress, including the Lemmas with two', () => {
    const stressMarks = (card: WordCardModel) => card.lemma.split(STRESS_MARK).length - 1;

    expect(cards.every((card) => stressMarks(card) >= 1)).toBe(true);
    expect(cards.some((card) => stressMarks(card) === 2)).toBe(true);
  });

  it('show at most 3 Synonyms', () => {
    expect(Math.max(...cards.map((card) => card.synonyms.length))).toBe(3);
  });

  it('never hold an empty section: details only with something in them', () => {
    for (const { details } of cards) {
      if (details === undefined) continue;
      const items =
        (details.etymology === undefined ? 0 : 1) +
        details.extraDefinitions.length +
        details.examples.length;
      expect(items).toBeGreaterThan(0);
    }
    expect(cards.some((card) => card.details === undefined)).toBe(true);
    expect(cards.some((card) => card.details !== undefined)).toBe(true);
  });
});
