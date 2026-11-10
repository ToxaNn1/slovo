import { AbsoluteFill, Sequence } from 'remotion';

import { EndCardAt, endCardFrom } from '../EndCard';
import { Bed } from '../sound';
import { beatFrames, Shout, type ShoutBeats, ShoutSound } from './Comeback';
import { Phones, phonesLength, type PhoneStep, PhonesSound, steps } from './Phones';
import { promoLine } from './Promo';

/** The cut for Reels and TikTok is 15 s at 30 fps. */
export const promoSocialLength = 450;

/**
 * Рупор shouts from the very first frame; the word is forgotten on the 3rd
 * beat (1.5 s) and stamped back on the 5th (2.5 s).
 */
const shout: ShoutBeats = {
  shout: 0,
  // The first tiles are down on frame 0: the opening frame already shows the word forming.
  tiles: -16,
  tileStep: 3,
  tileFlight: 12,
  forgotten: 3 * beatFrames,
  stamp: 5 * beatFrames,
};

/** Three phones from 4 s to 10.5 s, every cut on a beat; the last, on black, cuts to the red end card. */
const phones: PhoneStep[] = [
  { ...steps.feed, frames: 4 * beatFrames },
  { ...steps.stress, frames: 4 * beatFrames },
  { ...steps.crossword, tone: 'dark', frames: 5 * beatFrames },
];

export const promoSocialBeats = {
  phones: 8 * beatFrames,
  end: endCardFrom(promoSocialLength),
} as const;

/**
 * The promo cut for Reels and TikTok, 9:16, 15 s: it starts where the long
 * one turns. Рупор shouts КРАКЕЛЮР on cream, «Це слово забули.» →
 * «SLOVO повертає.», three screens of the app, the shared end card. Sound
 * from the first frame: the horn and the beat together.
 */
export function PromoSocial() {
  const at = promoSocialBeats;
  if (at.phones + phonesLength(phones) !== at.end) throw new Error('PromoSocial: the phones must end where the end card starts');
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={at.phones + 10} name="Shout">
        <Shout beats={shout} />
      </Sequence>
      <Sequence from={at.phones} durationInFrames={at.end - at.phones} name="The app">
        <Phones steps={phones} />
      </Sequence>
      <EndCardAt from={at.end} line={promoLine} />

      <Bed beatFrom={0} />
      <ShoutSound at={0} beats={shout} />
      <PhonesSound at={at.phones} steps={phones} />
    </AbsoluteFill>
  );
}
