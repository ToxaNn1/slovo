import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Correction } from '@slovo/contracts';
import { buildCorrectionCard } from '@slovo/core';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainianFolder } from './test-support';

// The stress traps of the real Ukrainian Language Pack: wrong-stress
// Corrections whose texts carry their Stress marks (spec #526, seam 1).

const STRESS_MARK = '́';

let workDir: string;
let pack: NodeLanguagePack;
let corrections: Correction[];
let stressTraps: Correction[];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-stress-traps-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  corrections = (await pack.getEntries(await pack.listCorrectionIds())).filter(
    (entry): entry is Correction => entry.kind === 'correction',
  );
  stressTraps = corrections.filter((correction) => correction.correctionType === 'wrongStress');
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('the stress traps of the Ukrainian Language Pack', () => {
  it('holds wrong-stress Corrections', () => {
    expect(stressTraps.length).toBeGreaterThan(0);
  });

  it('keeps the Stress mark in both forms and in the example pair of each', () => {
    for (const { nonStandardForm, standardEquivalents, examplePair } of stressTraps) {
      for (const text of [
        nonStandardForm,
        ...standardEquivalents,
        examplePair.nonStandard,
        examplePair.standard,
      ]) {
        expect(text).toContain(STRESS_MARK);
      }
    }
  });
});

describe('the Correction card of a Ukrainian stress trap', () => {
  it('gives the stressed vowels of its non-standard form and its main equivalent', () => {
    const catalog = corrections.find(({ id }) => id === 'c_vaadzf');
    if (catalog === undefined) throw new Error('The stress trap «катало́г» is missing');
    const card = buildCorrectionCard(catalog);

    expect(card.nonStandardForm).toBe('ката́лог');
    expect(card.nonStandardStressedVowels).toEqual(['а']);
    expect(card.mainEquivalent).toBe('катало́г');
    expect(card.mainEquivalentStressedVowels).toEqual(['о']);
  });

  it('gives each stress trap a stressed vowel on both forms', () => {
    for (const card of stressTraps.map(buildCorrectionCard)) {
      expect(card.nonStandardStressedVowels).toHaveLength(1);
      expect(card.mainEquivalentStressedVowels).toHaveLength(1);
    }
  });

  it('gives no stressed vowel on the card of a Correction of another type', () => {
    const others = corrections.filter(({ correctionType }) => correctionType !== 'wrongStress');

    expect(others.length).toBeGreaterThan(0);
    for (const card of others.map(buildCorrectionCard)) {
      expect(card.nonStandardStressedVowels).toEqual([]);
      expect(card.mainEquivalentStressedVowels).toEqual([]);
    }
  });
});
