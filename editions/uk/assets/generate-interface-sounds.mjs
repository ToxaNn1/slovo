// Generates the four Interface sounds of the UA Edition in assets/sounds/,
// synthesized from the design's own oscillator settings (SlovoApp `snd`):
// a waveform swept exponentially from one frequency to another, its gain
// falling exponentially to silence, so no third-party licence is involved.
//
//   node editions/uk/assets/generate-interface-sounds.mjs
//
// The output is deterministic: the same script writes the same bytes.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;

/** Each sound: waveform, start and end frequency in Hz, length in seconds. */
const SOUNDS = {
  shout: ['sawtooth', 220, 760, 0.3],
  right: ['triangle', 660, 1320, 0.18],
  wrong: ['square', 280, 130, 0.22],
  tap: ['triangle', 520, 520, 0.05],
};

const WAVES = {
  sawtooth: (phase) => 2 * phase - 1,
  triangle: (phase) => 1 - 4 * Math.abs(phase - 0.5),
  square: (phase) => (phase < 0.5 ? 1 : -1),
};

function wavOf([wave, from, to, seconds]) {
  const frames = Math.round(SAMPLE_RATE * (seconds + 0.02));
  const samples = new Int16Array(frames);
  let phase = 0;
  for (let index = 0; index < frames; index += 1) {
    const t = Math.min(index / SAMPLE_RATE, seconds);
    phase = (phase + (from * (to / from) ** (t / seconds)) / SAMPLE_RATE) % 1;
    // The gain falls from full to 1/80 over the sound; a 2 ms fade-in keeps the start from clicking.
    const gain = Math.min(1, index / (SAMPLE_RATE * 0.002)) * (1 / 80) ** (t / seconds);
    const tail = index / SAMPLE_RATE > seconds ? 0 : 1;
    samples[index] = Math.round(WAVES[wave](phase) * gain * tail * 0.6 * 32767);
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
  Buffer.from(samples.buffer).copy(wav, 44);
  return wav;
}

for (const [name, sound] of Object.entries(SOUNDS)) {
  writeFileSync(fileURLToPath(new URL(`sounds/${name}.wav`, import.meta.url)), wavOf(sound));
}
