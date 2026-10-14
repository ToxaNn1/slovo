const SAMPLE_RATE = 8000;

/** The WAV format tag of linear PCM, and the tag WAVE_FORMAT_EXTENSIBLE puts in its place. */
const PCM = 1;
const EXTENSIBLE = 0xfffe;

interface WavOptions {
  /** The bits of one sample; 16 by default. */
  readonly bitsPerSample?: number;
  /** Writes a WAVE_FORMAT_EXTENSIBLE header whose subformat has this format tag. */
  readonly extensible?: number;
}

/** A mono WAV of the given length, silent: linear PCM, or extensible with the given subformat. */
export function wav(seconds: number, { bitsPerSample = 16, extensible }: WavOptions = {}): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const data = Math.round(seconds * SAMPLE_RATE) * bytesPerSample;
  const fmtSize = extensible === undefined ? 16 : 40;
  const bytes = Buffer.alloc(28 + fmtSize + data);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(20 + fmtSize + data, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(fmtSize, 16);
  bytes.writeUInt16LE(extensible === undefined ? PCM : EXTENSIBLE, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28);
  bytes.writeUInt16LE(bytesPerSample, 32);
  bytes.writeUInt16LE(bitsPerSample, 34);
  if (extensible !== undefined) {
    bytes.writeUInt16LE(22, 36); // the size of the extension
    bytes.writeUInt16LE(bitsPerSample, 38); // valid bits per sample
    bytes.writeUInt32LE(4, 40); // the channel mask: front centre
    // The subformat GUID: the format tag, then the fixed tail every WAVE_FORMAT_* GUID shares.
    bytes.writeUInt16LE(extensible, 44);
    Buffer.from('000000001000800000aa00389b71', 'hex').copy(bytes, 46);
  }
  bytes.write('data', 20 + fmtSize);
  bytes.writeUInt32LE(data, 24 + fmtSize);
  return bytes;
}
