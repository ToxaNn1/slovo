import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { editionFiles } from './edition-folder';
import { recordingRequests } from './recording-requests';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

const workDirs: string[] = [];

afterEach(() => {
  for (const dir of workDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * A copy of the valid fixture (voices anna and boris, three Words, w_fx0001
 * Retired) with the fixture Recordings and the texts they were made from.
 */
function withRecordings(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-requests-'));
  workDirs.push(dir);
  const editionDir = join(dir, 'edition');
  cpSync(fixture('valid'), editionDir, { recursive: true });
  cpSync(fixture('recordings'), join(editionDir, 'assets/recordings'), { recursive: true });
  return editionDir;
}

describe('the Recordings to make for an Edition', () => {
  it('asks for every live Word in every Narrator Voice, the Lemma with its first Stress marked', () => {
    const requests = recordingRequests(editionFiles(withRecordings()), 'all');

    expect(requests).toEqual([
      { voice: 'anna', wordId: 'w_fx0002', text: 'балаку́чий' },
      { voice: 'anna', wordId: 'w_fx0003', text: 'за́вжди' },
      { voice: 'boris', wordId: 'w_fx0002', text: 'балаку́чий' },
      { voice: 'boris', wordId: 'w_fx0003', text: 'за́вжди' },
    ]);
  });

  it('never asks for a Retired Word', () => {
    const editionDir = withRecordings();
    rmSync(join(editionDir, 'assets/recordings/anna'), { recursive: true });

    const requests = recordingRequests(editionFiles(editionDir), 'missing');

    expect(requests.map(({ wordId }) => wordId)).not.toContain('w_fx0001');
  });

  it('asks again for a Recording made from another text than the Word reads now', () => {
    const editionDir = withRecordings();
    const texts = join(editionDir, 'assets/recordings/anna/texts.json');
    writeFileSync(texts, readFileSync(texts, 'utf8').replace('балаку́чий', 'бала́кучий'));

    const requests = recordingRequests(editionFiles(editionDir), 'missing');

    expect(requests).toContainEqual({ voice: 'anna', wordId: 'w_fx0002', text: 'балаку́чий' });
  });

  it('asks again for a Recording without the text it was made from', () => {
    const editionDir = withRecordings();
    rmSync(join(editionDir, 'assets/recordings/anna/texts.json'));

    const requests = recordingRequests(editionFiles(editionDir), 'missing');

    expect(requests.filter(({ voice }) => voice === 'anna')).toHaveLength(2);
  });

  it('asks only for the Recordings a Narrator Voice lacks', () => {
    const requests = recordingRequests(editionFiles(withRecordings()), 'missing');

    expect(requests.map(({ voice, wordId }) => `${voice}/${wordId}`)).toEqual([
      'anna/w_fx0003',
      'boris/w_fx0002',
      'boris/w_fx0003',
    ]);
  });

  it('asks for every Word of a Narrator Voice without a folder', () => {
    const editionDir = withRecordings();
    rmSync(join(editionDir, 'assets/recordings/boris'), { recursive: true });

    const requests = recordingRequests(editionFiles(editionDir), 'missing');

    expect(requests.filter(({ voice }) => voice === 'boris')).toHaveLength(2);
  });

  it('sends a Word without Stress positions as its Lemma', () => {
    const editionDir = withRecordings();
    const file = join(editionDir, 'content/words/w_fx0003.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"stress": \[[^\]]*\]/, '"stress": []'));

    const requests = recordingRequests(editionFiles(editionDir), 'all');

    expect(requests).toContainEqual({ voice: 'anna', wordId: 'w_fx0003', text: 'завжди' });
  });
});
