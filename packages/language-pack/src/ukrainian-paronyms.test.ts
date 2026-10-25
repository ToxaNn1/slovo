import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildLanguagePack, openLanguagePack, type NodeLanguagePack } from './index';
import { ukrainianFolder } from './test-support';

// The paronyms of the real Ukrainian Language Pack: Corrections of Correction
// Type paronym, two look-alike words swapped (spec #680, seam 1).

const PARONYM_ID = 'c_apq2ge';

let workDir: string;
let pack: NodeLanguagePack;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'slovo-paronyms-'));
  const outFile = join(workDir, 'language-pack.db');
  const result = buildLanguagePack({ editionDir: ukrainianFolder.dir, outFile });
  if (!result.ok) throw new Error('The Ukrainian Language Pack does not build');
  pack = openLanguagePack(outFile);
});

afterAll(() => {
  pack.close();
  rmSync(workDir, { recursive: true, force: true });
});

describe('the paronyms of the Ukrainian Language Pack', () => {
  it('calls the Correction Type paronym «пароніми»', () => {
    expect(ukrainianFolder.read('strings').correctionCard.correctionTypes.paronym).toBe('пароніми');
  });

  it('gives «ефективна сукня» as a paronym of «ефектна сукня», with its sources', async () => {
    const [paronym] = await pack.getEntries([PARONYM_ID]);

    expect(paronym).toMatchObject({
      kind: 'correction',
      correctionType: 'paronym',
      nonStandardForm: 'ефективна сукня',
      standardEquivalents: ['ефектна сукня'],
      sources: [
        expect.objectContaining({ url: 'https://goroh.pp.ua/Тлумачення/ефектний' }),
        expect.objectContaining({ url: 'https://goroh.pp.ua/Тлумачення/ефективний' }),
      ],
    });
  });
});
