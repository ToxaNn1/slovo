import { z } from 'zod';

/** The containers iOS plays for a local notification's custom sound. */
export type NotificationSoundFormat = 'wav' | 'aiff' | 'caf';

/** The longest custom notification sound iOS plays; a longer one falls back to the default. */
export const MAX_NOTIFICATION_SOUND_SECONDS = 30;

/** The file extension of each format. */
export const NOTIFICATION_SOUND_EXTENSIONS: readonly NotificationSoundFormat[] = [
  'caf',
  'wav',
  'aiff',
];

/**
 * The file name of an Edition's notification sound in its `assets/` folder:
 * a plain name in a format iOS plays for notifications.
 */
export const NotificationSoundFileSchema = z
  .string()
  .regex(
    new RegExp(`^[A-Za-z0-9][A-Za-z0-9._-]*\\.(${NOTIFICATION_SOUND_EXTENSIONS.join('|')})$`),
    `Expected a plain file name ending in ${NOTIFICATION_SOUND_EXTENSIONS.map((extension) => `.${extension}`).join(', ')}`,
  );

export interface NotificationSound {
  readonly format: NotificationSoundFormat;
  readonly seconds: number;
}

const fourCC = (view: DataView, offset: number): string =>
  String.fromCharCode(...[0, 1, 2, 3].map((index) => view.getUint8(offset + index)));

function unplayable(codec: string): Error {
  return new Error(
    `The sound file is encoded as ${codec}; iOS plays only linear PCM, IMA4, µLaw and aLaw for notifications`,
  );
}

/** The WAV format tags: PCM, aLaw, µLaw and IMA ADPCM. */
const WAV_PLAYABLE_TAGS = [1, 6, 7, 17];

/** The AIFF-C and CAF codec ids iOS plays: linear PCM (either byte order), µLaw, aLaw and IMA4. */
const AIFC_PLAYABLE_CODECS = ['NONE', 'twos', 'sowt', 'ulaw', 'ULAW', 'alaw', 'ALAW', 'ima4'];
const CAF_PLAYABLE_CODECS = ['lpcm', 'ulaw', 'alaw', 'ima4'];

function incomplete(): Error {
  return new Error('The sound file is incomplete: its header is cut short');
}

/** Reads the RIFF chunks of a WAV file and returns its length. */
function wavSeconds(view: DataView): number {
  let byteRate: number | undefined;
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const type = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (type === 'fmt ') {
      if (body + 16 > view.byteLength) throw incomplete();
      const tag = view.getUint16(body, true);
      if (!WAV_PLAYABLE_TAGS.includes(tag)) throw unplayable(`WAV format tag ${String(tag)}`);
      byteRate = view.getUint32(body + 8, true);
    } else if (type === 'data') {
      if (byteRate === undefined || byteRate === 0) throw incomplete();
      // A streamed file may claim more data than it holds.
      return Math.min(size, view.byteLength - body) / byteRate;
    }
    offset = body + size + (size % 2);
  }
  throw incomplete();
}

/** The sample rate of an AIFF file, stored as an 80-bit extended float. */
function extendedFloat(view: DataView, offset: number): number {
  const exponent = (view.getUint16(offset) & 0x7fff) - 16383;
  const mantissa = view.getUint32(offset + 2) * 2 ** 32 + view.getUint32(offset + 6);
  return mantissa * 2 ** (exponent - 63);
}

function aiffSeconds(view: DataView): number {
  for (let offset = 12; offset + 8 <= view.byteLength;) {
    const type = fourCC(view, offset);
    const size = view.getUint32(offset + 4);
    const body = offset + 8;
    if (type === 'COMM') {
      if (body + 18 > view.byteLength) throw incomplete();
      if (fourCC(view, 8) === 'AIFC') {
        if (body + 22 > view.byteLength) throw incomplete();
        const codec = fourCC(view, body + 18);
        if (!AIFC_PLAYABLE_CODECS.includes(codec)) throw unplayable(`AIFF-C "${codec}"`);
      }
      const rate = extendedFloat(view, body + 8);
      if (rate <= 0) throw incomplete();
      return view.getUint32(body + 2) / rate;
    }
    offset = body + size + (size % 2);
  }
  throw incomplete();
}

function cafSeconds(view: DataView): number {
  let rate: number | undefined;
  let bytesPerPacket = 0;
  let framesPerPacket = 0;
  let validFrames: number | undefined;
  for (let offset = 8; offset + 12 <= view.byteLength;) {
    const type = fourCC(view, offset);
    const size = Number(view.getBigInt64(offset + 4));
    const body = offset + 12;
    if (type === 'desc') {
      if (body + 32 > view.byteLength) throw incomplete();
      const codec = fourCC(view, body + 8);
      if (!CAF_PLAYABLE_CODECS.includes(codec)) throw unplayable(`CAF "${codec}"`);
      rate = view.getFloat64(body);
      bytesPerPacket = view.getUint32(body + 16);
      framesPerPacket = view.getUint32(body + 20);
    } else if (type === 'pakt') {
      if (body + 16 > view.byteLength) throw incomplete();
      validFrames = Number(view.getBigInt64(body + 8));
    } else if (type === 'data') {
      if (rate === undefined || rate <= 0) throw incomplete();
      if (validFrames !== undefined) return validFrames / rate;
      if (bytesPerPacket === 0 || framesPerPacket === 0) throw incomplete();
      // The data chunk starts with a 4-byte edit count; -1 means "to the end of the file".
      const dataBytes = (size < 0 ? view.byteLength - body : size) - 4;
      return ((dataBytes / bytesPerPacket) * framesPerPacket) / rate;
    }
    if (size < 0) break;
    offset = body + size;
  }
  throw incomplete();
}

/**
 * The format and length of a notification sound file, from its header.
 * Throws a message naming the problem when the bytes are not a WAV, AIFF or
 * CAF file, are cut short, or run longer than iOS plays.
 */
export function readNotificationSound(bytes: Uint8Array): NotificationSound {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 12) throw incomplete();
  const magic = fourCC(view, 0);
  const kind = fourCC(view, 8);
  let sound: NotificationSound;
  if (magic === 'RIFF' && kind === 'WAVE') sound = { format: 'wav', seconds: wavSeconds(view) };
  else if (magic === 'FORM' && (kind === 'AIFF' || kind === 'AIFC'))
    sound = { format: 'aiff', seconds: aiffSeconds(view) };
  else if (magic === 'caff') sound = { format: 'caf', seconds: cafSeconds(view) };
  else throw new Error('The sound file is not a WAV, AIFF or CAF file');
  if (sound.seconds > MAX_NOTIFICATION_SOUND_SECONDS) {
    throw new Error(
      `The sound is ${sound.seconds.toFixed(1)} seconds long, longer than ${String(MAX_NOTIFICATION_SOUND_SECONDS)} seconds, which iOS does not play`,
    );
  }
  return sound;
}
