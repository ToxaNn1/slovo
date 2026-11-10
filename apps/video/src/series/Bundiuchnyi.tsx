import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import word from '../../../../editions/uk/content/words/w_ft35h4.json';
import { light, uiFont } from '../look';
import { useSafe } from '../safe';
import { Sfx, sfx } from '../sound';
import { beats, Missing } from './Missing';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const pop = Easing.bezier(0.34, 1.56, 0.64, 1);

/** The boss in pixels of the 1080×1920 frame: where he sits, his size before he swells, the desk's top edge. */
const boss = { x: 640, foot: 900, body: 260, swollen: 1.55, deskTop: 880 } as const;

/** The frame the boss says «Я тут головний!». */
const bubbleAt = 20;

/** Episode «бундючний»: the boss puffs up like a balloon; the word hits him and the air goes out. */
export function Bundiuchnyi() {
  return (
    <Missing
      word={word}
      setup={'Колега після\nпідвищення:'}
      hesitation={'Він став такий…\nну… як його…'}
      reply={['Він став такий', 'бундючний!']}
      meaning="Пихатий, надутий від власної важливості."
      target={{ x: boss.x, y: boss.foot - (boss.body * boss.swollen) / 2 }}
      Scene={BossBalloon}
    />
  );
}

/** The boss, a round balloon behind a desk, swelling with pride until the word hits him. */
function BossBalloon() {
  const frame = useCurrentFrame();
  const { s } = useSafe();
  const swell = interpolate(frame, [0, beats.shout], [1.1, boss.swollen], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  // The first tile hits: he jolts, the air goes out, and he zigzags up and away like a let-go balloon.
  const out = interpolate(frame, [beats.hit, beats.word - 4], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const jolt = interpolate(frame, [beats.hit - 1, beats.hit + 1, beats.hit + 5], [0, 1, 0], clamp);
  const scale = swell * (1 - out * 0.7) * (1 - jolt * 0.12);
  const bob = Math.sin(frame / 9) * 8 * s * (1 - out);
  const zig = Math.sin(out * Math.PI * 5) * 150 * s * Math.min(1, out * 3) + jolt * 26 * s;
  const fly = -out * out * 1500 * s;
  const deflated = frame >= beats.hit;
  const body = boss.body * s;
  const desk = interpolate(frame, [beats.hit + 14, beats.word - 2], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) });

  return (
    <AbsoluteFill>
      <Sfx src={sfx.pop} at={bubbleAt} volume={0.5} />
      {/* He swells: a rubbery tone creeping up under the caption and the hesitation. */}
      <Sfx src={sfx.inflate} at={bubbleAt + 2} volume={0.3} />
      {/* The air going out of him: quieter than the shout and clear of its attack. */}
      <Sfx src={sfx.deflate} at={beats.hit} volume={0.35} />
      <div
        style={{
          position: 'absolute',
          left: boss.x * s - body / 2,
          top: boss.foot * s - body,
          width: body,
          height: body,
          translate: `${zig}px ${bob + fly}px`,
          scale: String(scale),
          rotate: `${out * 420}deg`,
          transformOrigin: out > 0 ? '50% 50%' : '50% 100%',
        }}
      >
        <Boss deflated={deflated} size={body} />
      </div>
      {deflated &&
        [0, 1, 2, 3].map((i) => {
          const t = interpolate(frame, [beats.hit + i * 3, beats.hit + 16 + i * 3], [0, 1], clamp);
          const angle = -150 + i * 40;
          const reach = (150 + t * 150) * s;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: boss.x * s + Math.cos((angle * Math.PI) / 180) * reach - 7 * s,
                top: (boss.foot - 200) * s + Math.sin((angle * Math.PI) / 180) * reach - 30 * s,
                width: 14 * s,
                height: 60 * s,
                borderRadius: 7 * s,
                background: light.ink,
                rotate: `${angle + 90}deg`,
                opacity: t === 0 ? 0 : 1 - t,
              }}
            />
          );
        })}
      <div
        style={{
          position: 'absolute',
          left: (boss.x - 250) * s,
          width: 490 * s,
          top: boss.deskTop * s,
          height: 100 * s,
          background: light.ink,
          borderRadius: 18 * s,
          borderTop: `${16 * s}px solid ${light.accent}`,
          translate: `0px ${desk * 60 * s}px`,
          opacity: 1 - desk,
        }}
      />
      <Bubble frame={frame} right={(boss.x - 215) * s} bottom={(boss.foot - 215) * s} s={s} />
    </AbsoluteFill>
  );
}

/** The boss himself: a round head-and-body, smug while swollen, startled when deflated. */
function Boss({ deflated, size }: { deflated: boolean; size: number }) {
  const ink = light.ink;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible' }}>
      <circle cx={50} cy={50} r={45} fill={light.surface} stroke={ink} strokeWidth={7} />
      <path d="M44 3 Q50 -9 58 3" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
      {deflated ? (
        <>
          <circle cx={36} cy={42} r={6} fill={ink} />
          <circle cx={64} cy={42} r={6} fill={ink} />
          <ellipse cx={50} cy={64} rx={7} ry={9} fill={ink} />
        </>
      ) : (
        <>
          <path d="M28 40 Q36 34 44 40" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <path d="M56 40 Q64 34 72 40" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
          <path d="M38 60 Q50 54 62 60" fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />
        </>
      )}
      <path d="M50 78 L43 98 L50 104 L57 98 Z" fill={light.accent} stroke={ink} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
}

/** «Я тут головний!» popping out of the swelling boss, left of him, until the hesitation. */
function Bubble({ frame, right, bottom, s }: { frame: number; right: number; bottom: number; s: number }) {
  const { width, height } = useSafe();
  const t =
    interpolate(frame, [bubbleAt, bubbleAt + 10], [0, 1], { ...clamp, easing: pop }) *
    interpolate(frame, [beats.hesitate - 6, beats.hesitate], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        right: width - right,
        bottom: height - bottom,
        padding: `${24 * s}px ${36 * s}px`,
        background: light.ink,
        color: light.background,
        borderRadius: `${32 * s}px ${32 * s}px ${6 * s}px ${32 * s}px`,
        fontFamily: uiFont,
        fontWeight: 600,
        fontSize: 54 * s,
        lineHeight: 1.15,
        whiteSpace: 'pre',
        scale: String(t),
        transformOrigin: 'right bottom',
        rotate: '-4deg',
      }}
    >
      {'Я тут\nголовний!'}
    </div>
  );
}
