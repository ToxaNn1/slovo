import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Correction } from '@slovo/contracts';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainianFolder } from './test-support';

// The stress traps of the real Ukrainian Language Pack: wrong-stress
// Corrections whose texts carry their Stress marks (spec #526, seam 1).

const STRESS_MARK = '́';

let workDir: string;
let pack: NodeLanguagePack;
let stressTraps: Correction[];

beforeAll(async () => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-stress-traps-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
  const corrections = await Promise.all(
    (await pack.listCorrectionIds()).map((id) => pack.getCorrection(id)),
  );
  stressTraps = corrections.filter(
    (correction): correction is Correction => correction?.correctionType === 'wrongStress',
  );
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('the stress traps of the Ukrainian Language Pack', () => {
  it('holds 15 wrong-stress Corrections', () => {
    expect(stressTraps).toHaveLength(15);
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
