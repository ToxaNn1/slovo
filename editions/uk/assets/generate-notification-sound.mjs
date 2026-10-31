// Generates notification.wav, the placeholder notification sound of the
// UA Edition: a short plucked-string note, synthesized here, so no
// third-party licence is involved. The final royalty-free bandura pluck from
// the design replaces it before 1.0.
//
//   node editions/uk/assets/generate-notification-sound.mjs
//
// The output is deterministic: the same script writes the same bytes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const SECONDS = 0.6;
// D5; the string loops its noise burst through a damped delay line (Karplus-Strong).
const FREQUENCY = 587.33;
const DAMPING = 0.996;

// A small seeded generator (mulberry32) for the noise burst, so the file is reproducible.
let seed = 0x510f0;
function random() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const frames = Math.round(SAMPLE_RATE * SECONDS);
const period = Math.round(SAMPLE_RATE / FREQUENCY);
const string = Array.from({ length: period }, () => random() * 2 - 1);
const samples = new Float64Array(frames);
for (let index = 0; index < frames; index += 1) {
  const slot = index % period;
  const next = string[(slot + 1) % period];
  const value = string[slot];
  samples[index] = value;
  string[slot] = DAMPING * 0.5 * (value + next);
}

// A 5 ms fade-in and a 150 ms fade-out keep the ends from clicking; scale to 80% of full range.
const fadeIn = Math.round(SAMPLE_RATE * 0.005);
const fadeOut = Math.round(SAMPLE_RATE * 0.15);
let peak = 0;
for (let index = 0; index < frames; index += 1) {
  const gain = Math.min(1, index / fadeIn, (frames - 1 - index) / fadeOut);
  samples[index] *= gain;
  peak = Math.max(peak, Math.abs(samples[index]));
}

const dataBytes = frames * 2;
const wav = Buffer.alloc(44 + dataBytes);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataBytes, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); // fmt chunk size
wav.writeUInt16LE(1, 20); // linear PCM
wav.writeUInt16LE(1, 22); // mono
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28); // bytes per second
wav.writeUInt16LE(2, 32); // bytes per frame
wav.writeUInt16LE(16, 34); // bits per sample
wav.write('data', 36);
wav.writeUInt32LE(dataBytes, 40);
for (let index = 0; index < frames; index += 1) {
  wav.writeInt16LE(Math.round((samples[index] / peak) * 0.8 * 32767), 44 + index * 2);
}

writeFileSync(fileURLToPath(new URL('./notification.wav', import.meta.url)), wav);
