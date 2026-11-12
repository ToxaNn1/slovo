import { describe, expect, it } from 'vitest';

import { mp3DurationMs } from './mp3-duration';
import { mp3Of } from './test-mp3';

describe('mp3DurationMs', () => {
  it('sums the frames of an MPEG-2 Layer III file after its ID3 tag, less the Info frame and the encoder gap', () => {
    // 24 frames of 576 samples at 24 kHz, less 576 + 1105 samples of delay and padding.
    expect(mp3DurationMs(mp3Of(24))).toBe(506);
  });

  it('answers undefined for bytes that are no mp3', () => {
    expect(mp3DurationMs(new TextEncoder().encode('no mp3 at all'))).toBeUndefined();
  });
});
