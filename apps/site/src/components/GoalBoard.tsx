import { boardCells, formatCount, goal } from '../goal';
import { useCountUp } from './useCountUp';

/** The hero's board of digits counting up to the confirmed Entries. */
export function GoalBoard() {
  const shown = useCountUp(goal.confirmed);
  return (
    <div
      role="img"
      aria-label={formatCount(goal.confirmed)}
      className="flex flex-wrap items-end gap-[5px]"
    >
      {boardCells(shown, goal.confirmed).map((digit, index) =>
        digit === null ? (
          <span key={index} className="w-2" />
        ) : (
          <span
            key={index}
            className="grid h-[clamp(46px,5vw,58px)] w-[clamp(36px,4vw,46px)] place-items-center rounded-[10px] bg-cream font-word text-[clamp(22px,2.6vw,30px)] leading-none font-black text-coal tabular-nums shadow-[0_5px_0_var(--coal)]"
          >
            {digit}
          </span>
        ),
      )}
    </div>
  );
}
