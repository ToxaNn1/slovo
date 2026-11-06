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

/** A copy of the valid fixture (voices anna and boris, three Words) with the fixture Recordings. */
function withRecordings(): string {
  const dir = mkdtempSync(join(tmpdir(), 'slovo-requests-'));
  workDirs.push(dir);
  const editionDir = join(dir, 'edition');
  cpSync(fixture('valid'), editionDir, { recursive: true });
  cpSync(fixture('recordings'), join(editionDir, 'assets/recordings'), { recursive: true });
  return editionDir;
}

describe('the Recordings to make for an Edition', () => {
  it('asks for every Word in every Narrator Voice, the Lemma with its Stress marked', () => {
    const requests = recordingRequests(editionFiles(withRecordings()), 'all');

    expect(requests).toEqual([
      { voice: 'anna', wordId: 'w_fx0001', text: 'заметі́ль' },
      { voice: 'anna', wordId: 'w_fx0002', text: 'балаку́чий' },
      { voice: 'anna', wordId: 'w_fx0003', text: 'за́вжди́' },
      { voice: 'boris', wordId: 'w_fx0001', text: 'заметі́ль' },
      { voice: 'boris', wordId: 'w_fx0002', text: 'балаку́чий' },
      { voice: 'boris', wordId: 'w_fx0003', text: 'за́вжди́' },
    ]);
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

    expect(requests.filter(({ voice }) => voice === 'boris')).toHaveLength(3);
  });

  it('sends a Word without Stress positions as its Lemma', () => {
    const editionDir = withRecordings();
    const file = join(editionDir, 'content/words/w_fx0003.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"stress": \[[^\]]*\]/, '"stress": []'));

    const requests = recordingRequests(editionFiles(editionDir), 'all');

    expect(requests).toContainEqual({ voice: 'anna', wordId: 'w_fx0003', text: 'завжди' });
  });
});
