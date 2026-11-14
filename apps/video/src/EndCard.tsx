import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

import { light, uiFont, wordFont } from './look';
import { Rupor } from './Rupor';
import { safeFor } from './safe';
import { levels, Sfx, sfx } from './sound';
import { type Store, StoreBadge } from './StoreBadge';
import { clamp, pop } from './shared/motion';

/** The brand's one slogan and its descriptor: the same on every video's end card. */
export const slogan = 'Тримай слово.';
export const descriptor = 'Рідкісні українські слова — щодня в кишені';

/**
 * How long the end card stays on screen, in frames at 30 fps: 4.5 s, the
 * store badge fully in view for the last 3.4 s of them. A video may give it
 * more, not less.
 */
export const endCardLength = 135;

/** The frames the card's parts come in on, counted from the card's first frame. */
export const endCardBeats = {
  line: 0,
  slogan: 6,
  rupor: 10,
  brand: 16,
  descriptor: 21,
  badge: 24,
} as const;

/** The frame the end card starts on in a video `total` frames long. */
export const endCardFrom = (total: number, length: number = endCardLength) => total - length;

export type EndCardProps = {
  /** The video's own line, above the slogan; none, or the slogan itself, leaves the slogan alone. */
  line?: string;
  /** The layout; by default the Composition's own shape. */
  orientation?: 'portrait' | 'landscape';
  /** The link a QR code leads to. Not set: no QR code is drawn. */
  qrUrl?: string;
  store?: Store;
};

/**
 * The one end card of every video, on red: the video's line, «Тримай слово.»,
 * SLOVO in black, the descriptor, the store badge and Рупор glad. Portrait
 * keeps everything inside the 9:16 safe zone (safe.ts), Рупор in his band.
 * Silent by itself: `EndCardSound` or `EndCardAt` brings the swish and the chime.
 */
export function EndCard({ line, orientation, qrUrl, store = 'appStore' }: EndCardProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = orientation === undefined ? height > width : orientation === 'portrait';
  const s = width / (portrait ? 1080 : 1920);
  const safe = safeFor(portrait, width);
  const at = (start: number) =>
    interpolate(frame, [start, start + 10], [0, 1], { ...clamp, easing: pop });
  const fade = (start: number) => interpolate(frame, [start, start + 8], [0, 1], clamp);
  const ownLine =
    line !== undefined && line.trim() !== '' && line.trim() !== slogan ? line : undefined;

  const size = portrait
    ? {
        line: 52,
        slogan: 150,
        brand: 96,
        descriptor: 42,
        badge: 120,
        rupor: 460,
        column: safe.width,
      }
    : {
        line: 48,
        slogan: 132,
        brand: 110,
        descriptor: 40,
        badge: 100,
        rupor: 560,
        column: 1080 * s,
      };
  const ruporHeight = (size.rupor * s * 112) / 150;
  // Portrait: the badge and Рупор share the bottom row, Рупор inside his band.
  // Landscape: Рупор stands right of the words, in the middle of the safe height.
  const ruporTop = portrait ? safe.rupor.top + 40 * s : safe.centerY - ruporHeight / 2;
  const rise = (t: number) => `0px ${(1 - t) * 24 * s}px`;

  const badge = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 * s }}>
      <StoreBadge height={size.badge * s} store={store} />
      {qrUrl !== undefined && <Qr url={qrUrl} size={size.badge * s} />}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: light.accent }}>
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          top: portrait ? safe.top : safe.top + 92 * s,
          width: size.column,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {/* Two lines are always kept for the video's line, so the slogan stands on the same spot in every video. */}
        <div
          style={{
            height: size.line * 1.18 * 2 * s,
            display: 'flex',
            alignItems: 'flex-end',
            fontFamily: wordFont,
            fontWeight: 800,
            fontSize: size.line * s,
            lineHeight: 1.18,
            letterSpacing: '-0.01em',
            color: light.ink,
            scale: String(at(endCardBeats.line)),
            transformOrigin: 'left bottom',
          }}
        >
          {ownLine}
        </div>
        <div
          style={{
            marginTop: 44 * s,
            // The tilt swings the first letter left: keep it inside the safe zone.
            marginLeft: 14 * s,
            fontFamily: wordFont,
            fontWeight: 900,
            fontSize: size.slogan * s,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: light.background,
            rotate: '-3deg',
            scale: String(at(endCardBeats.slogan)),
            transformOrigin: 'left center',
          }}
        >
          Тримай
          <br />
          слово.
        </div>
        <div
          style={{
            marginTop: (portrait ? 56 : 44) * s,
            fontFamily: wordFont,
            fontWeight: 900,
            fontSize: size.brand * s,
            lineHeight: 1,
            letterSpacing: '0.16em',
            color: light.ink,
            opacity: fade(endCardBeats.brand),
            translate: rise(at(endCardBeats.brand)),
          }}
        >
          SLOVO
        </div>
        <div
          style={{
            marginTop: 22 * s,
            whiteSpace: 'pre-line',
            fontFamily: uiFont,
            fontWeight: 600,
            fontSize: size.descriptor * s,
            lineHeight: 1.22,
            color: light.ink,
            opacity: fade(endCardBeats.descriptor),
            translate: rise(at(endCardBeats.descriptor)),
          }}
        >
          {portrait ? descriptor.replace(' — ', ' —\n') : descriptor}
        </div>
        {!portrait && (
          <div
            style={{
              marginTop: 40 * s,
              opacity: fade(endCardBeats.badge),
              scale: String(0.7 + 0.3 * at(endCardBeats.badge)),
              transformOrigin: 'left center',
            }}
          >
            {badge}
          </div>
        )}
      </div>
      {portrait && (
        <div
          style={{
            position: 'absolute',
            left: safe.left,
            top: ruporTop + ruporHeight / 2 - (size.badge * s) / 2,
            opacity: fade(endCardBeats.badge),
            scale: String(0.7 + 0.3 * at(endCardBeats.badge)),
            transformOrigin: 'left center',
          }}
        >
          {badge}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: safe.right - size.rupor * s,
          top: ruporTop,
          scale: String(at(endCardBeats.rupor)),
          rotate: `${Math.sin(frame / 8) * 3}deg`,
        }}
      >
        <Rupor state="happy" width={size.rupor * s} onRed />
      </div>
    </AbsoluteFill>
  );
}

/**
 * The QR code's place. There is no real link and no QR library yet, and a
 * made-up pattern would lead nowhere, so this draws nothing.
 * TODO(owner): once the store link exists, add a QR encoder (for example the
 * `qrcode` package) and draw `url` here as a cream square `size` on a side.
 */
function Qr(_props: { url: string; size: number }) {
  return null;
}

/** The end card's sounds for a card starting on frame `at`: the swish in, the chime on the slogan, a pop on the badge. */
export function EndCardSound({ at }: { at: number }) {
  return (
    <>
      <Sfx src={sfx.swish} at={at - 2} volume={levels.endSwish} />
      <Sfx src={sfx.chime} at={at + endCardBeats.slogan + 4} volume={levels.endChime} />
      <Sfx src={sfx.pop} at={at + endCardBeats.badge} volume={levels.endPop} />
    </>
  );
}

/**
 * The end card with its sounds from frame `from` to the video's end: all a
 * video needs. `<EndCardAt from={endCardFrom(length)} line="…" />`
 */
export function EndCardAt({ from, ...card }: EndCardProps & { from: number }) {
  return (
    <>
      <Sequence from={from} name="End card">
        <EndCard {...card} />
      </Sequence>
      <EndCardSound at={from} />
    </>
  );
}
