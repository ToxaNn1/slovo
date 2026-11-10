# The videos' sounds

Every sound in `sounds/` is synthesised by `sounds/make.py`: Python's
standard library only, seeded, so a run writes the same files again.

```sh
python3 -I apps/video/sounds/make.py
```

No sample, recording or third-party sound is used. Each file is our own work,
made by this script, and free to use as part of the SLOVO videos (dedicated to
the public domain, CC0). The app's sounds in `editions/uk/assets/sounds` are
not used here. The fonts still come from the Edition's assets
(`remotion.config.ts`).

`src/sound.tsx` imports the files and places them: `Sfx` for an effect on a
frame, `Knock` for a tile landing, `Horn` for Рупор's shout, `Bed` for the bed
under a whole video, `Voice` for a recorded word (none yet, see below). The
end card brings its own sounds (`EndCardSound` in `src/EndCard.tsx`).

## The mix

The levels live in `levels` in `src/sound.tsx`:

| What | Level | Note |
| --- | --- | --- |
| pad | 0.5 | fades in over 0.5 s and out over the last second |
| beat | 0.65 | comes in at full level, so its first downbeat lands under the shout; fades out only |
| horn | 0.4 | the same in every video (`Horn`); `hornLength` is its 27 frames |
| end card | swish 0.45, chime 0.55, pop 0.5 | the swish 2 frames before the card, the chime on «Тримай слово.», the pop on the store badge |

The videos are heard mostly on phone speakers, which play next to nothing
under 300 Hz. So the kick has a 2–4 kHz click, the bass an octave doubled and
saturated, the hats are loud, the knocks and the stamp carry a 1–5 kHz layer,
and the pad has a soft upper voice at 440–1200 Hz.

The final loudness, −14 LUFS and −1 dBTP, is a separate ffmpeg `loudnorm`
pass over the rendered video, not done in Remotion.

| File | Source | Licence | Used for |
| --- | --- | --- | --- |
| `pop.wav` | synthesised: sine blip bending up + click | CC0, own work | a letter appearing (Promo act 1); a caption or a speech bubble popping in; the store badge on the end card |
| `knock-1.wav` … `knock-3.wav` | synthesised: band-passed noise, a 1–5 kHz clack, a sine ring and thump, three pitches | CC0, own work | a letter tile landing |
| `crack.wav` | synthesised: noise snap + random crackles | CC0, own work | cracks over the tiles (Promo act 2) |
| `rubble.wav` | synthesised: 26 low knocks scattered over 1.2 s | CC0, own work | the letters falling into a heap |
| `whoosh.wav`, `swish.wav` | synthesised: noise with a sweeping filter | CC0, own work | the red sweep, Рупор bursting in, phones and cards sliding in |
| `horn.wav` | synthesised: detuned saws, band-passed and softly clipped | CC0, own work | Рупор's shout through the megaphone |
| `chime.wav` | synthesised: two bell strikes from inharmonic partials | CC0, own work | «Тримай слово.» landing on the end card |
| `deflate.wav` | synthesised: square wave sliding down + air hiss | CC0, own work | the boss going down (episode «бундючний») |
| `miss.wav` | synthesised: two muffled Karplus-Strong plucks a semitone apart | CC0, own work | a wrong Stress guess («Де наголос?»); quietly, the line stuck at «як його…» («бундючний») |
| `chord.wav` | synthesised: open D arpeggio (D A D E A, no third) of Karplus-Strong plucks | CC0, own work | the right Stress («Де наголос?») |
| `pluck.wav` | synthesised: one Karplus-Strong pluck, D5 | CC0, own work | the Stress mark landing on its vowel («Табло», «бундючний») |
| `inflate.wav` | synthesised: triangle and saw creeping up 200→400 Hz, rubber creaks | CC0, own work | the boss swelling (episode «бундючний») |
| `flap.wav` | synthesised: two short noise ticks | CC0, own work | a split-flap cell flipping («Табло»); quiet ticks under a line typing in |
| `stamp.wav` | synthesised: sine thud, a 350 Hz body, paper slap and a 1–5 kHz smack | CC0, own work | the «СЛОВО ДНЯ» stamp («Табло») |
| `pad.wav` | synthesised: D minor 9 chord of detuned saws, low-passed, breathing, with a soft D and A voice above | CC0, own work | the bed under every video |
| `beat.wav` | synthesised: kick with a click, snap, hats and a two-octave bass, one bar at 120 BPM, loops | CC0, own work | the rhythm from Рупор's shout on |

## The owner's beat

`beat.wav` holds the place of the owner's beat. To use the real track, put it
in `sounds/` and point the `beat` import in `src/sound.tsx` at it; every video
takes it from the shout on, at full level from its first beat and faded out
by `Bed`. A full-length track
that should play from the first frame goes in place of `pad.wav` the same way.

## The voice

Nothing is recorded yet: Рупор's shout is the horn alone. `Voice` in
`src/sound.tsx` is the slot for the word spoken aloud. Put a recording in
`sounds/voice/<lemma>.wav`, add it to the table above with its source and
licence, import it in the video and place `<Voice src={…} at={…} />` right
after the shout (about `hornLength` frames after `Horn`), under the tiles
landing. Without `src` it plays nothing.
