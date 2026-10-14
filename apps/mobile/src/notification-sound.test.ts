import { EditionConfigSchema, readNotificationSound } from '@slovo/contracts';
import { describe, expect, it } from 'vitest';

import ukrainianEdition from '../../../editions/uk/edition.json';

const SAMPLE_RATE = 8000;

/** A mono 16-bit PCM WAV of the given length, silent. */
function wav(seconds: number): Uint8Array {
  const data = Math.round(seconds * SAMPLE_RATE) * 2;
  const bytes = Buffer.alloc(44 + data);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data, 40);
  return bytes;
}

/** A mono 16-bit AIFF of the given length, silent. */
function aiff(seconds: number): Uint8Array {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const data = frames * 2;
  const bytes = Buffer.alloc(12 + 26 + 16 + data);
  bytes.write('FORM', 0);
  bytes.writeUInt32BE(4 + 26 + 16 + data, 4);
  bytes.write('AIFFCOMM', 8);
  bytes.writeUInt32BE(18, 16);
  bytes.writeInt16BE(1, 20);
  bytes.writeUInt32BE(frames, 22);
  bytes.writeInt16BE(16, 26);
  // The sample rate, 8000 = 1.953125 × 2^12, as an 80-bit extended float.
  bytes.writeUInt16BE(0x400b, 28);
  bytes.writeUInt32BE(0xfa000000, 30);
  bytes.write('SSND', 38);
  bytes.writeUInt32BE(8 + data, 42);
  return bytes;
}

/** A mono 16-bit linear PCM CAF of the given length, silent. */
function caf(seconds: number): Uint8Array {
  const data = Math.round(seconds * SAMPLE_RATE) * 2;
  const bytes = Buffer.alloc(8 + 12 + 32 + 12 + 4 + data);
  bytes.write('caff', 0);
  bytes.writeUInt16BE(1, 4);
  bytes.write('desc', 8);
  bytes.writeBigInt64BE(32n, 12);
  bytes.writeDoubleBE(SAMPLE_RATE, 20);
  bytes.write('lpcm', 28);
  bytes.writeUInt32BE(0x2, 32);
  bytes.writeUInt32BE(2, 36);
  bytes.writeUInt32BE(1, 40);
  bytes.writeUInt32BE(1, 44);
  bytes.writeUInt32BE(16, 48);
  bytes.write('data', 52);
  bytes.writeBigInt64BE(BigInt(4 + data), 56);
  return bytes;
}

describe('the Edition config notification sound', () => {
  const edition = (notificationSound?: string) =>
    EditionConfigSchema.safeParse({
      ...ukrainianEdition,
      ...(notificationSound === undefined ? {} : { notificationSound }),
    });

  it('is optional: an Edition without one is valid', () => {
    expect(edition().error).toBeUndefined();
  });

  it.each(['notification.wav', 'pluck.caf', 'pluck-2.aiff'])('accepts the file %s', (file) => {
    expect(edition(file).error).toBeUndefined();
  });

  it.each([
    ['an mp3', 'notification.mp3'],
    ['an m4a', 'notification.m4a'],
    ['a file without an extension', 'notification'],
    ['a path', 'sounds/notification.wav'],
    ['an upward path', '../notification.wav'],
    ['only an extension', '.wav'],
  ])('refuses %s', (_, file) => {
    expect(edition(file).success).toBe(false);
  });
});

describe('reading a notification sound file', () => {
  it.each([
    ['wav', wav],
    ['aiff', aiff],
    ['caf', caf],
  ] as const)('tells the format and the length of a %s file', (format, make) => {
    const sound = readNotificationSound(make(0.6));

    expect(sound.format).toBe(format);
    expect(sound.seconds).toBeCloseTo(0.6, 3);
  });

  it.each([
    ['wav', wav],
    ['aiff', aiff],
    ['caf', caf],
  ] as const)('accepts a %s file of exactly 30 seconds', (_, make) => {
    expect(readNotificationSound(make(30)).seconds).toBeCloseTo(30, 3);
  });

  it.each([
    ['wav', wav],
    ['aiff', aiff],
    ['caf', caf],
  ] as const)('refuses a %s file longer than 30 seconds', (_, make) => {
    expect(() => readNotificationSound(make(30.5))).toThrow(/longer than 30 seconds/);
  });

  it('refuses a WAV in a codec iOS does not play for notifications', () => {
    const mp3InWav = Buffer.from(wav(1));
    mp3InWav.writeUInt16LE(0x55, 20);

    expect(() => readNotificationSound(mp3InWav)).toThrow(/WAV format tag 85.*linear PCM/);
  });

  it('refuses a CAF in a codec iOS does not play for notifications', () => {
    const aacInCaf = Buffer.from(caf(1));
    aacInCaf.write('aac ', 28);

    expect(() => readNotificationSound(aacInCaf)).toThrow(/CAF "aac "/);
  });

  it('refuses a file that is not a sound iOS plays for notifications', () => {
    expect(() =>
      readNotificationSound(new TextEncoder().encode('ID3 an mp3 file, not a sound iOS plays')),
    ).toThrow(/not a WAV, AIFF or CAF/);
  });

  it('refuses a truncated header', () => {
    expect(() => readNotificationSound(wav(0.6).slice(0, 20))).toThrow(/incomplete/);
  });
});
