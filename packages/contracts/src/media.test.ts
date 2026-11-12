import { describe, expect, it } from 'vitest';

import { illustrationPath, recordingPath } from './media';

const hash = 'a'.repeat(64);

describe('a Media Store path', () => {
  it('names a Recording by its Narrator Voice, Recording Kind, Word id and hash', () => {
    expect(
      recordingPath({ wordId: 'w_1', narratorVoice: 'oleksa', recordingKind: 'plain', hash }),
    ).toBe(`recordings/oleksa/plain/w_1.${hash}.mp3`);
  });

  it('names an Illustration by its Word id and hash', () => {
    expect(illustrationPath({ wordId: 'w_1', hash })).toBe(`illustrations/w_1.${hash}.png`);
  });
});
