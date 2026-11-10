/**
 * An mp3 as ffmpeg writes the Edition's Recordings: an ID3 tag, an Info
 * frame whose LAME tag names an encoder delay of 576 samples and a padding
 * of 1105, then `frames` silent MPEG-2 Layer III frames, mono, 64 kbps at
 * 24 kHz (192 bytes and 24 ms each). `mark` goes into the last frame, so
 * files of the same length can differ.
 */
export function mp3Of(frames: number, mark = ''): Uint8Array {
  const tag = [0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0x02, 0, 0];
  const frame = (body: number[]) => [
    0xff,
    0xf3,
    0x84,
    0xc0,
    ...body,
    ...Array.from({ length: 188 - body.length }, () => 0),
  ];
  // The Info frame: side information, «Info», no fields (flags 0), then the LAME tag.
  const lame = [...encode('Lavc62.11'), ...Array.from({ length: 12 }, () => 0), 0x24, 0x04, 0x51];
  const info = frame([
    ...Array.from({ length: 9 }, () => 0),
    ...encode('Info'),
    0,
    0,
    0,
    0,
    ...lame,
  ]);
  const silent = Array.from({ length: frames }, (_, index) =>
    frame(index === frames - 1 ? encode(mark) : []),
  );
  return new Uint8Array([...tag, ...info, ...silent.flat()]);
}

const encode = (text: string) => [...new TextEncoder().encode(text)];
