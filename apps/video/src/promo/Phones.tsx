import { AbsoluteFill, Easing, Img, interpolate, Sequence, useCurrentFrame } from 'remotion';

import { dark, light, uiFont, wordFont } from '../look';
import { useSafe } from '../safe';
import { Knock, Sfx, sfx } from '../sound';
import { clamp, pop } from '../shared/motion';

/** How long a step's background takes to wipe over the one before it. */
const wipe = 8;

/**
 * One of the app's screens. Until real screenshots are dropped in, the phone
 * shows a placeholder with `title` and `line`; `shot` (an image URL, for
 * example `staticFile(…)`) fills the phone's screen instead.
 */
export type Screen = { title: string; line: string; shot?: string };

/** One step of the cut through the app: a benefit said large beside one phone, or a pair of them. */
export type PhoneStep = {
  /** The benefit, outside the phone; `\n` breaks it in two lines. */
  caption: string;
  screens: readonly Screen[];
  /** How long the step is on screen. */
  frames: number;
  tone: 'red' | 'cream' | 'dark';
  /** Each step sounds its own way, not one swish for all. */
  sound: 'feed' | 'stress' | 'crossword' | 'reward';
};

export const screens = {
  feed: { title: 'Стрічка', line: 'слово за словом' },
  stress: { title: 'Наголос', line: 'гра на час' },
  crossword: { title: 'Кросворд', line: 'щодня новий' },
  calendar: { title: 'Календар', line: 'день за днем' },
  reward: { title: 'Нагорода', line: 'штамп за слова' },
} as const satisfies Record<string, Screen>;

/** The steps every promo cuts from: the three main screens, then the calendar and the reward as a pair. */
export const steps = {
  feed: {
    caption: 'Гортай слова,\nяк стрічку',
    screens: [screens.feed],
    tone: 'red',
    sound: 'feed',
  },
  stress: {
    caption: 'Вгадай,\nде наголос',
    screens: [screens.stress],
    tone: 'cream',
    sound: 'stress',
  },
  crossword: {
    caption: 'Кросворд\nщодня',
    screens: [screens.crossword],
    tone: 'red',
    sound: 'crossword',
  },
  streak: {
    caption: 'Серія днів\nі нагороди',
    screens: [screens.calendar, screens.reward],
    tone: 'cream',
    sound: 'reward',
  },
} as const satisfies Record<string, Omit<PhoneStep, 'frames'>>;

export const phonesLength = (list: readonly PhoneStep[]) =>
  list.reduce((sum, step) => sum + step.frames, 0);

const tones = {
  red: { background: light.accent, caption: light.background, kicker: light.ink, frame: light.ink },
  cream: {
    background: light.background,
    caption: light.ink,
    kicker: light.accent,
    frame: light.ink,
  },
  dark: {
    background: dark.background,
    caption: dark.ink,
    kicker: light.accent,
    frame: light.accent,
  },
} as const;

/** The cut through the app: each step wipes in over the one before it. */
export function Phones({ steps: list }: { steps: readonly PhoneStep[] }) {
  let from = 0;
  return (
    <>
      {list.map((step, index) => {
        const start = from;
        from += step.frames;
        const last = index === list.length - 1;
        return (
          // A step stays under the next one's wipe.
          <Sequence
            key={index}
            from={start}
            durationInFrames={step.frames + (last ? 0 : wipe)}
            name={step.caption}
          >
            <Step step={step} next={list[index + 1]} />
          </Sequence>
        );
      })}
    </>
  );
}

function Step({ step, next }: { step: PhoneStep; next?: PhoneStep }) {
  const frame = useCurrentFrame();
  const { width, portrait, s, safe } = useSafe();
  const tone = tones[step.tone];
  const cover = interpolate(frame, [0, wipe], [100, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const lines = step.caption.split('\n');
  const captionSize = (portrait ? 80 : 94) * s;
  const lineHeight = 1.1;
  const captionHeight = lines.length * captionSize * lineHeight;
  const pair = step.screens.length > 1;
  const gap = 36 * s;

  // Portrait: the benefit on top, the phones under it, all inside the safe zone.
  // Landscape: the benefit left, the phones right, the next screen peeking in behind.
  const area = portrait
    ? { left: safe.left, top: safe.top + captionHeight + 56 * s, width: safe.width, height: 0 }
    : { left: width * 0.5, top: safe.top + 46 * s, width: safe.right - width * 0.5, height: 0 };
  area.height = safe.bottom - (portrait ? 14 : 46) * s - area.top;
  const count = step.screens.length;
  // A pair is tilted apart: leave its corners room inside the safe zone.
  const room = area.width - (pair ? 28 * s : 0);
  const phoneH = Math.min(area.height, (room - gap * (count - 1)) / count / 0.48);
  const phoneW = phoneH * 0.48;
  const rowWidth = phoneW * count + gap * (count - 1);
  const rowLeft = portrait || pair ? area.left + (area.width - rowWidth) / 2 : area.left + 60 * s;
  const rowTop = area.top + (area.height - phoneH) / 2;

  return (
    <AbsoluteFill style={{ background: tone.background, clipPath: `inset(0 0 0 ${cover}%)` }}>
      <div
        style={{
          position: 'absolute',
          left: safe.left,
          top: portrait ? safe.top + 12 * s : safe.centerY - captionHeight / 2 - 30 * s,
          width: portrait ? safe.width : width * 0.5 - safe.left,
        }}
      >
        {!portrait && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              marginBottom: 26 * s,
              fontFamily: uiFont,
              fontWeight: 600,
              fontSize: 38 * s,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              color: tone.kicker,
              opacity: interpolate(frame, [6, 14], [0, 1], clamp),
            }}
          >
            {step.screens.map((screen) => screen.title).join(' · ')}
          </div>
        )}
        {lines.map((line, i) => {
          const t = interpolate(frame, [3 + i * 4, 13 + i * 4], [0, 1], { ...clamp, easing: pop });
          return (
            <div
              key={i}
              style={{
                fontFamily: wordFont,
                fontWeight: 900,
                fontSize: captionSize,
                lineHeight,
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                color: tone.caption,
                opacity: Math.min(1, t * 2),
                translate: `${(1 - t) * 60 * s}px 0px`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
      {/* The next screen, small behind the phone: landscape only, where there is room for it. */}
      {!portrait && !pair && next !== undefined && next.screens[0] !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: rowLeft + phoneW + 50 * s,
            top: rowTop + phoneH * 0.09,
            opacity: 0.6 * interpolate(frame, [6, 16], [0, 1], clamp),
            translate: `${interpolate(frame, [4, 16], [200 * s, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px 0px`,
            rotate: '4deg',
          }}
        >
          <Phone
            screen={next.screens[0]}
            width={phoneW * 0.82}
            height={phoneH * 0.82}
            frameColor={tone.frame}
            s={s}
          />
        </div>
      )}
      {step.screens.map((screen, i) => {
        const at = 1 + i * 6;
        const enter = interpolate(frame, [at, at + 10], [1, 0], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const tilt = pair ? (i === 0 ? -2 : 2) : -1.5;
        return (
          <div
            key={screen.title}
            style={{
              position: 'absolute',
              left: rowLeft + i * (phoneW + gap),
              top: rowTop,
              translate: `${enter * width}px 0px`,
              rotate: `${tilt + enter * 8}deg`,
            }}
          >
            <Phone screen={screen} width={phoneW} height={phoneH} frameColor={tone.frame} s={s} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function Phone({
  screen,
  width,
  height,
  frameColor,
  s,
}: {
  screen: Screen;
  width: number;
  height: number;
  frameColor: string;
  s: number;
}) {
  // Sized by the phone so the longest title stays inside it.
  const titleSize = width * 0.1;
  return (
    <div
      style={{
        width,
        height,
        boxSizing: 'border-box',
        borderRadius: width * 0.13,
        background: light.surface,
        border: `${Math.max(8 * s, width * 0.03)}px solid ${frameColor}`,
        boxShadow: `0 ${18 * s}px ${40 * s}px rgba(20, 12, 10, 0.22)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: width * 0.05,
      }}
    >
      {screen.shot !== undefined ? (
        <Img src={screen.shot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          <div
            style={{
              fontFamily: wordFont,
              fontWeight: 900,
              fontSize: titleSize,
              color: light.ink,
              rotate: '-4deg',
            }}
          >
            {screen.title}
          </div>
          <div style={{ fontFamily: uiFont, fontSize: titleSize * 0.45, color: light.muted }}>
            {screen.line}
          </div>
          <div
            style={{
              fontFamily: uiFont,
              fontSize: titleSize * 0.35,
              color: light.muted,
              marginTop: width * 0.08,
            }}
          >
            місце для скріншота
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The cut's sounds for phones starting on frame `at`. Every step has its
 * own: the feed flicks, the Stress game plucks a string, the crossword's
 * tiles knock, the reward is stamped.
 */
export function PhonesSound({ at, steps: list }: { at: number; steps: readonly PhoneStep[] }) {
  let from = at;
  return (
    <>
      {list.map((step, index) => {
        const start = from;
        from += step.frames;
        return <StepSound key={index} at={start} sound={step.sound} />;
      })}
    </>
  );
}

function StepSound({ at, sound }: { at: number; sound: PhoneStep['sound'] }) {
  switch (sound) {
    case 'feed':
      return (
        <>
          <Sfx src={sfx.swish} at={at} volume={0.45} />
          <Sfx src={sfx.flap} at={at + 12} volume={0.7} />
          <Sfx src={sfx.flap} at={at + 19} volume={0.7} />
        </>
      );
    case 'stress':
      return (
        <>
          <Sfx src={sfx.swish} at={at} volume={0.25} />
          <Sfx src={sfx.chord} at={at + 6} volume={0.4} />
        </>
      );
    case 'crossword':
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Knock key={i} index={i} at={at + 2 + i * 4} volume={0.65} />
          ))}
        </>
      );
    case 'reward':
      return (
        <>
          <Sfx src={sfx.swish} at={at} volume={0.3} />
          <Sfx src={sfx.stamp} at={at + 15} volume={0.6} />
        </>
      );
  }
}
