import { useState } from 'react';

import { isVowel, stressGame, verdict, type StressRound } from '../stress-game';

const tile =
  'grid aspect-[1/1.1] place-items-center rounded-[14px] border-0 p-0 font-word text-[clamp(16px,2.2vw,26px)] font-black transition-[transform,background-color] duration-[250ms,150ms] ease-[cubic-bezier(.3,1.4,.5,1)]';

/** The landing's playable Наголос: tap the stressed vowel, then go on to the next word. */
export function StressGame() {
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const round: StressRound = stressGame[index % stressGame.length] ?? { word: '', stress: 0 };
  const letters = Array.from(round.word);

  return (
    <div className="flex flex-col gap-5 rounded-[18px] bg-sf p-[clamp(20px,3vw,36px)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-word text-base font-extrabold">Наголос</span>
        <span className="text-sm font-semibold whitespace-nowrap text-mute">
          {index + 1} / {stressGame.length} · вгадано {score}
        </span>
      </div>
      <p className="m-0 text-base font-semibold">Торкнися голосної, на яку падає наголос.</p>
      <div
        className="grid gap-[clamp(4px,0.8vw,8px)]"
        style={{ gridTemplateColumns: `repeat(${String(letters.length)}, minmax(0, 56px))` }}
      >
        {letters.map((letter, i) => {
          const vowel = isVowel(letter);
          const right = pick !== null && i === round.stress;
          const wrong = pick === i && i !== round.stress;
          const look = right
            ? '-translate-y-1.5 -rotate-4 bg-red text-coal shadow-[0_5px_0_var(--red-edge)]'
            : wrong
              ? 'bg-coal text-cream shadow-[0_5px_0_var(--coal-edge)]'
              : vowel
                ? 'bg-tile text-ink shadow-[0_5px_0_var(--edge)]'
                : 'bg-transparent text-mute';
          return (
            <button
              key={i}
              type="button"
              disabled={!vowel || pick !== null}
              aria-label={vowel ? `Наголос на «${letter}»` : letter}
              onClick={() => {
                setPick(i);
                if (i === round.stress) setScore((s) => s + 1);
              }}
              className={`${tile} ${look} ${vowel && pick === null ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {right ? `${letter.toUpperCase()}́` : letter.toUpperCase()}
            </button>
          );
        })}
      </div>
      <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-3">
        <span aria-live="polite" className="text-lg font-bold">
          {pick === null ? '' : verdict(round, pick)}
        </span>
        {pick !== null && (
          <button
            type="button"
            onClick={() => {
              setIndex((n) => (n + 1) % stressGame.length);
              setPick(null);
            }}
            className="h-12 cursor-pointer rounded-2xl border-0 bg-red px-5 font-word text-[13px] font-extrabold text-coal shadow-[0_4px_0_var(--red-edge)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--red-edge)]"
          >
            Наступне слово
          </button>
        )}
      </div>
    </div>
  );
}
