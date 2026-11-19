/**
 * Reads a `wordfreq` frequency list (`large_uk.msgpack.gz`, the cBpack
 * format): a header, then one bucket of words per centibel, so the words of
 * bucket i have Zipf 9 − i/100, as `wordfreq.zipf_frequency` gives them.
 */
import { gunzipSync } from 'node:zlib';

import { matchKey } from './text';

/** Each word of the list with its Zipf frequency. */
export function readWordfreq(file: Uint8Array): ReadonlyMap<string, number> {
  const pack = new MessagePack(gunzipSync(file)).read();
  if (!isList(pack)) throw new Error('Not a wordfreq cBpack: no top-level list');
  const [header, ...buckets] = pack;
  const format: unknown = header instanceof Map ? header.get('format') : undefined;
  if (format !== 'cB') throw new Error('Not a wordfreq cBpack: the header names no "cB" format');
  const frequencies = new Map<string, number>();
  buckets.forEach((bucket, index) => {
    if (!isList(bucket)) return;
    const zipf = Math.round(900 - index) / 100;
    for (const word of bucket) {
      if (typeof word === 'string' && !frequencies.has(word)) frequencies.set(word, zipf);
    }
  });
  return frequencies;
}

/**
 * The Zipf of a Lemma, 0 when the list lacks it; the list is lowercase NFC,
 * and the Lemma is looked up with every apostrophe the Edition accepts.
 */
export function zipfOf(frequencies: ReadonlyMap<string, number>, lemma: string): number {
  const key = matchKey(lemma.normalize('NFC'));
  return Math.max(
    0,
    ...["'", '’', 'ʼ'].map((mark) => frequencies.get(key.replaceAll("'", mark)) ?? 0),
  );
}

function isList(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/** A MessagePack reader for what a cBpack holds: lists, maps, strings and integers. */
class MessagePack {
  private at = 0;
  constructor(private readonly bytes: Buffer) {}

  read(): unknown {
    const type = this.byte();
    if (type <= 0x7f) return type;
    if (type >= 0x80 && type <= 0x8f) return this.map(type & 0x0f);
    if (type >= 0x90 && type <= 0x9f) return this.list(type & 0x0f);
    if (type >= 0xa0 && type <= 0xbf) return this.text(type & 0x1f);
    switch (type) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xcc:
        return this.byte();
      case 0xcd:
        return this.uint(2);
      case 0xce:
        return this.uint(4);
      case 0xd9:
        return this.text(this.byte());
      case 0xda:
        return this.text(this.uint(2));
      case 0xdb:
        return this.text(this.uint(4));
      case 0xdc:
        return this.list(this.uint(2));
      case 0xdd:
        return this.list(this.uint(4));
      case 0xde:
        return this.map(this.uint(2));
      default:
        throw new Error(
          `Unexpected MessagePack type 0x${type.toString(16)} at ${String(this.at - 1)}`,
        );
    }
  }

  private byte(): number {
    const value = this.bytes[this.at];
    if (value === undefined) throw new Error('The MessagePack data ends early');
    this.at += 1;
    return value;
  }

  private uint(size: 2 | 4): number {
    const value = size === 2 ? this.bytes.readUInt16BE(this.at) : this.bytes.readUInt32BE(this.at);
    this.at += size;
    return value;
  }

  private text(length: number): string {
    const value = this.bytes.toString('utf8', this.at, this.at + length);
    this.at += length;
    return value;
  }

  private list(length: number): unknown[] {
    return Array.from({ length }, () => this.read());
  }

  private map(length: number): Map<unknown, unknown> {
    const map = new Map<unknown, unknown>();
    for (let index = 0; index < length; index += 1) map.set(this.read(), this.read());
    return map;
  }
}
