// Kilobits per second by bitrate index, for MPEG-1 and for MPEG-2 and 2.5, Layer III.
const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
} as const;
// Samples per second by sample rate index, for MPEG versions 1, 2 and 2.5.
const SAMPLE_RATES = {
  1: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  25: [11025, 12000, 8000],
};

interface Frame {
  readonly length: number;
  readonly samples: number;
  readonly sampleRate: number;
}

/** The Layer III frame whose header starts at the offset, or undefined. */
function frameAt(bytes: Uint8Array, offset: number): Frame | undefined {
  if (offset + 4 > bytes.length) return undefined;
  const [b0, b1, b2] = [bytes[offset] ?? 0, bytes[offset + 1] ?? 0, bytes[offset + 2] ?? 0];
  if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0 || ((b1 >> 1) & 0x03) !== 0x01) return undefined;
  const versionBits = (b1 >> 3) & 0x03;
  const version =
    versionBits === 3 ? 1 : versionBits === 2 ? 2 : versionBits === 0 ? 25 : undefined;
  if (version === undefined) return undefined;
  const kbps = BITRATES[version === 1 ? 1 : 2][b2 >> 4];
  const sampleRate = SAMPLE_RATES[version][(b2 >> 2) & 0x03];
  if (kbps === undefined || kbps === 0 || sampleRate === undefined) return undefined;
  const samples = version === 1 ? 1152 : 576;
  const padding = (b2 >> 1) & 0x01;
  return {
    length: Math.floor((samples / 8) * ((kbps * 1000) / sampleRate)) + padding,
    samples,
    sampleRate,
  };
}

/**
 * The encoder delay and padding, in samples, that the LAME tag of an Info or
 * Xing frame names (ffmpeg writes one), or 0 without such a tag.
 */
function encoderGap(bytes: Uint8Array, offset: number, head: string): number {
  const at = Math.max(head.indexOf('Xing'), head.indexOf('Info'));
  if (at < 0) return 0;
  const flags = bytes[offset + at + 7] ?? 0;
  const tag =
    offset +
    at +
    8 +
    (flags & 1 ? 4 : 0) +
    (flags & 2 ? 4 : 0) +
    (flags & 4 ? 100 : 0) +
    (flags & 8 ? 4 : 0);
  const encoder = new TextDecoder('latin1').decode(bytes.subarray(tag, tag + 4));
  if (encoder !== 'LAME' && encoder !== 'Lavc' && encoder !== 'Lavf') return 0;
  const [d0, d1, d2] = [bytes[tag + 21] ?? 0, bytes[tag + 22] ?? 0, bytes[tag + 23] ?? 0];
  return ((d0 << 4) | (d1 >> 4)) + (((d1 & 0x0f) << 8) | d2);
}

/**
 * How long an mp3 plays, in whole milliseconds: the sum of its Layer III
 * frames after an ID3v2 tag, leaving out a leading Xing or Info frame, which
 * carries no sound, and the encoder delay and padding its LAME tag names.
 * Undefined when the bytes hold no such frames.
 */
export function mp3DurationMs(bytes: Uint8Array): number | undefined {
  let offset = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33 && bytes.length >= 10) {
    const size = [6, 7, 8, 9].reduce((sum, index) => (sum << 7) | ((bytes[index] ?? 0) & 0x7f), 0);
    offset = 10 + size;
  }
  let samples = 0;
  let sampleRate: number | undefined;
  for (let frame = frameAt(bytes, offset); frame !== undefined; frame = frameAt(bytes, offset)) {
    if (sampleRate === undefined) {
      sampleRate = frame.sampleRate;
      const head = new TextDecoder('latin1').decode(bytes.subarray(offset, offset + 48));
      if (head.includes('Xing') || head.includes('Info')) {
        samples -= encoderGap(bytes, offset, head);
        offset += frame.length;
        continue;
      }
    }
    samples += frame.samples;
    offset += frame.length;
  }
  return sampleRate === undefined
    ? undefined
    : Math.round((Math.max(samples, 0) / sampleRate) * 1000);
}
