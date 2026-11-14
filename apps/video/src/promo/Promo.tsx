import { AbsoluteFill, Audio, Sequence } from 'remotion';

import { EndCardAt } from '../EndCard';
import { Bed, Sfx, sfx } from '../sound';
import { beatFrames, Shout, type ShoutBeats, ShoutSound, Wedge } from './Comeback';
import { captions, Forgotten, forgottenBeats as dim, forgottenLength } from './Forgotten';
import { Phones, phonesLength, type PhoneStep, PhonesSound, steps } from './Phones';
import { typedFrames } from './Caption';

/** The promo is 30 s at 30 fps. */
export const promoLength = 900;

/** The video's own line on the end card. */
export const promoLine = 'Мова багатша, ніж ти думаєш.';

/** Act 3, counted from its first frame: the wedge, Рупор lands and shouts, the stamp 4 beats after the shout. */
const shout: ShoutBeats = {
  enter: 4,
  shout: 16,
  tiles: 22,
  tileStep: 4,
  tileFlight: 14,
  stamp: 16 + 4 * beatFrames,
};

/** The app: three main screens 3 s each, the calendar and the reward as a pair. Every cut is on a beat. */
const phones: PhoneStep[] = [
  { ...steps.feed, frames: 6 * beatFrames },
  { ...steps.stress, frames: 6 * beatFrames },
  { ...steps.crossword, frames: 6 * beatFrames },
  { ...steps.streak, frames: 5 * beatFrames },
];

/** The frames the promo's parts start on. Everything from the shout on is a whole number of beats from it. */
export const promoBeats = {
  comeback: forgottenLength,
  shout: forgottenLength + shout.shout,
  stamp: forgottenLength + shout.stamp,
  phones: forgottenLength + shout.shout + 8 * beatFrames,
  end: forgottenLength + shout.shout + 8 * beatFrames + phonesLength(phones),
} as const;

/**
 * «Спочатку було слово» — the 30 s promo, the same for 16:9 and 9:16: the
 * dark opening (a word, then forgotten), Рупор brings it back, the app's
 * screens with what each gives, the shared end card. A pad under it all, the
 * beat from the shout; the effects are the videos' own (sound.tsx).
 */
export function Promo() {
  const at = promoBeats;
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={forgottenLength} name="Acts 1–2: forgotten">
        <Forgotten />
      </Sequence>
      <Sequence
        from={at.comeback}
        durationInFrames={at.phones - at.comeback + 10}
        name="Act 3: comeback"
      >
        <Shout beats={shout} />
        <Wedge />
      </Sequence>
      <Sequence from={at.phones} durationInFrames={at.end - at.phones} name="The app">
        <Phones steps={phones} />
      </Sequence>
      <EndCardAt from={at.end} line={promoLine} />

      <Bed beatFrom={at.shout} />
      {/* Act 1: a pop as each letter of the first word appears, 3 frames a letter. */}
      {Array.from({ length: 8 }, (_, i) => (
        <Sfx key={`pop-${i}`} src={sfx.pop} at={dim.word + i * 3} volume={0.4} />
      ))}
      {/* The captions are typed: a tick on every other letter. */}
      <Ticks at={dim.first} text={captions.first} />
      <Ticks at={dim.grey} text={captions.second} />
      {/* The camera pulls back: the other words appear. */}
      {Array.from({ length: 4 }, (_, i) => (
        <Sfx
          key={`sky-${i}`}
          src={sfx.pop}
          at={dim.others + (i + 1) * dim.othersStep}
          volume={0.22}
        />
      ))}
      {/* Act 2: a low, duller pop as each word goes grey, the main word last and lowest. */}
      {Array.from({ length: 4 }, (_, i) => (
        <Low
          key={`grey-${i}`}
          at={dim.grey + i * dim.greyStep}
          rate={0.7 - i * 0.05}
          volume={0.4}
        />
      ))}
      <Low at={dim.greyMain} rate={0.45} volume={0.55} />
      {/* The cracks run over the tiles, then the letters fall into a heap. */}
      <Sfx src={sfx.crack} at={dim.crack} volume={0.9} />
      <Sfx src={sfx.rubble} at={dim.fall + 4} volume={0.7} />
      {/* Act 3: the red sweep, then the shout, the tiles and the stamp. */}
      <Sfx src={sfx.whoosh} at={at.comeback - 4} volume={0.6} />
      <ShoutSound at={at.comeback} beats={shout} />
      <PhonesSound at={at.phones} steps={phones} />
    </AbsoluteFill>
  );
}

/** The typing of a caption: a soft tick on every other letter. */
function Ticks({ at, text }: { at: number; text: string }) {
  return (
    <>
      {Array.from({ length: Math.ceil(typedFrames(text) / 4) }, (_, i) => (
        <Sfx key={i} src={sfx.flap} at={at + i * 4} volume={0.3} />
      ))}
    </>
  );
}

/** The letter pop played slower, so lower and duller: a word going grey. */
function Low({ at, rate, volume }: { at: number; rate: number; volume: number }) {
  return (
    <Sequence from={at} name="Sound" layout="none">
      <Audio src={sfx.pop} playbackRate={rate} volume={volume} />
    </Sequence>
  );
}
