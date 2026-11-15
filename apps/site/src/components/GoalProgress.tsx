import { barWidth, formatCount, goal, shareOfGoal } from '../goal';
import { useCountUp } from './useCountUp';

/** The mission's count towards a million, its bar and its share of the way. */
export function GoalProgress() {
  const shown = useCountUp(goal.confirmed);
  return (
    <>
      <div className="font-word text-[calc(8vw_+_24px)] leading-[0.95] font-black tracking-[-0.05em] text-red tabular-nums">
        {formatCount(shown)}
      </div>
      <div className="h-5 overflow-hidden rounded-[10px] bg-coal-sunk">
        <div
          className="h-full rounded-[10px] bg-red"
          style={{ width: `${String(barWidth(shown, goal.target))}%` }}
        />
      </div>
      <div className="flex justify-between text-base font-semibold">
        <span className="whitespace-nowrap">{shareOfGoal(goal.confirmed, goal.target)} шляху</span>
        <span className="whitespace-nowrap">{formatCount(goal.target)}</span>
      </div>
    </>
  );
}
